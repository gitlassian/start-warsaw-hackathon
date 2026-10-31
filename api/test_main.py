import io
from datetime import datetime

import jwt
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageFilter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
import photo_ai


def scene(seed: int, tint: int, blur: float = 0, exif_time: str | None = None) -> bytes:
    """Random-block picture dominated by one colour channel; same seed = same scene."""
    rng = np.random.default_rng(seed)
    pixels = rng.integers(0, 120, (12, 16, 3), dtype=np.uint8)
    pixels[..., tint] += 120
    img = Image.fromarray(pixels).resize((640, 480), Image.NEAREST)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    exif = Image.Exif()
    if exif_time:
        exif.get_ifd(0x8769)[0x9003] = exif_time
    out = io.BytesIO()
    img.save(out, "JPEG", quality=92, exif=exif)
    return out.getvalue()


class FakeEmbedder:
    """Stands in for CLIP: an image's vector is its mean colour; text names a colour."""

    COLOURS = {"red": 0, "green": 1, "blue": 2}

    def embed_pil(self, images):
        mean = np.array([np.asarray(i.convert("RGB"), dtype=np.float32).mean(axis=(0, 1)) for i in images])
        return mean / np.linalg.norm(mean, axis=1, keepdims=True)

    def embed_text(self, query):
        vec = np.zeros(3, dtype=np.float32)
        vec[self.COLOURS[query]] = 1
        return vec

    def warm_up(self):
        pass


class FakeS3:
    def __init__(self):
        self.deleted = []
        self.objects = {}

    def generate_presigned_url(self, op, Params, ExpiresIn):
        return f"{main.S3_ENDPOINT}/{Params['Bucket']}/{Params['Key']}?sig"

    def head_object(self, Bucket, Key):
        return {"ContentLength": len(self.objects[Key]) if Key in self.objects else 10}

    def get_object(self, Bucket, Key, Range=None):
        data = self.objects.get(Key) or scene(hash(Key) % 1000, 0)
        if Range:
            data = data[: int(Range.split("-")[1]) + 1]
        return {"Body": io.BytesIO(data)}

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.objects[Key] = Body

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    main.Base.metadata.create_all(engine)
    monkeypatch.setattr(main, "SessionLocal", sessionmaker(engine))
    monkeypatch.setattr(main, "s3", FakeS3())
    monkeypatch.setattr(photo_ai, "embedder", FakeEmbedder())
    with main.SessionLocal() as s:
        s.add_all([main.User(id=i, google_sub=str(i), email=f"{i}@x.com", name=f"U{i}") for i in (1, 2, 3)])
        s.commit()

    def client(uid):
        c = TestClient(main.app)
        c.cookies.set("session", jwt.encode({"sub": str(uid)}, main.JWT_SECRET, "HS256"))
        return c

    return client


EVENT = {"title": "Party", "starts_at": "2026-11-01T18:00:00Z", "ends_at": "2026-11-01T23:00:00Z"}


def test_album_flow(setup):
    owner, guest, stranger = setup(1), setup(2), setup(3)
    assert TestClient(main.app).get("/api/events").status_code == 401

    bad = {**EVENT, "ends_at": "2026-11-01T17:00:00Z"}
    assert owner.post("/api/events", json=bad).status_code == 422
    assert owner.post("/api/events", json={**EVENT, "cover_key": "u/2/x.jpg"}).status_code == 400

    ev = owner.post("/api/events", json=EVENT).json()
    assert len(ev["code"]) == 6 and ev["is_owner"]
    assert stranger.get(f"/api/events/{ev['id']}").status_code == 404

    assert guest.get(f"/api/codes/{ev['code'].lower()}").json()["joined"] is False
    assert guest.post(f"/api/codes/{ev['code']}/join").json() == {"id": ev["id"]}
    assert guest.post(f"/api/codes/{ev['code']}/join").status_code == 200  # idempotent

    up = guest.post("/api/uploads", json={"types": ["image/jpeg", "image/jpeg"]}).json()
    assert up[0]["url"].startswith("/s3/") and up[0]["key"].startswith("u/2/")
    assert guest.post("/api/uploads", json={"types": ["text/html"]}).status_code == 400
    assert guest.post(f"/api/events/{ev['id']}/photos", json={"key": "u/1/a.jpg", "thumb_key": "u/1/a.jpg"}).status_code == 400

    photo = guest.post(f"/api/events/{ev['id']}/photos", json={"key": up[0]["key"], "thumb_key": up[1]["key"]}).json()
    owner_up = owner.post("/api/uploads", json={"types": ["image/png"]}).json()[0]
    owner_photo = owner.post(f"/api/events/{ev['id']}/photos", json={"key": owner_up["key"], "thumb_key": owner_up["key"]}).json()

    album = guest.get(f"/api/events/{ev['id']}").json()
    assert [p["can_delete"] for p in album["photos"]] == [False, True]
    assert stranger.post(f"/api/codes/NOPE00/join").status_code == 404

    teaser = TestClient(main.app).get(f"/api/codes/{ev['code']}/teaser").json()  # no session
    assert (teaser["title"], teaser["photos"], teaser["people"]) == ("Party", 2, 2)
    assert "code" not in teaser and "id" not in teaser

    assert guest.delete(f"/api/photos/{owner_photo['id']}").status_code == 403
    assert stranger.delete(f"/api/photos/{photo['id']}").status_code == 404
    assert owner.delete(f"/api/photos/{photo['id']}").status_code == 200
    assert sorted(main.s3.deleted) == sorted([up[0]["key"], up[1]["key"]])
    assert len(guest.get(f"/api/events/{ev['id']}").json()["photos"]) == 1
    assert [e["id"] for e in guest.get("/api/events").json()] == [ev["id"]]



def test_host_edits_and_deletes_event(setup):
    owner, guest, stranger = setup(1), setup(2), setup(3)
    cover = owner.post("/api/uploads", json={"types": ["image/jpeg"]}).json()[0]["key"]
    ev = owner.post("/api/events", json={**EVENT, "cover_key": cover}).json()
    guest.post(f"/api/codes/{ev['code']}/join")
    edit = {**EVENT, "title": " Party 2 ", "description": "Bring snacks"}

    assert guest.put(f"/api/events/{ev['id']}", json=edit).status_code == 403
    assert stranger.put(f"/api/events/{ev['id']}", json=edit).status_code == 404
    assert owner.put(f"/api/events/{ev['id']}", json={**edit, "ends_at": "2026-11-01T17:00:00Z"}).status_code == 422
    assert owner.put(f"/api/events/{ev['id']}", json={**edit, "cover_key": "u/2/x.jpg"}).status_code == 400

    # Saving without a new cover keeps the old one.
    out = owner.put(f"/api/events/{ev['id']}", json=edit).json()
    assert (out["title"], out["description"], out["code"]) == ("Party 2", "Bring snacks", ev["code"])
    assert cover in out["cover_url"] and main.s3.deleted == []

    new_cover = owner.post("/api/uploads", json={"types": ["image/jpeg"]}).json()[0]["key"]
    assert new_cover in owner.put(f"/api/events/{ev['id']}", json={**edit, "cover_key": new_cover}).json()["cover_url"]
    assert main.s3.deleted == [cover]
    assert owner.put(f"/api/events/{ev['id']}", json={**edit, "remove_cover": True}).json()["cover_url"] is None
    assert main.s3.deleted == [cover, new_cover]

    photo = upload(guest, ev["id"], scene(1, 0))
    assert guest.delete(f"/api/events/{ev['id']}").status_code == 403
    assert stranger.delete(f"/api/events/{ev['id']}").status_code == 404
    assert owner.delete(f"/api/events/{ev['id']}").status_code == 200
    assert len(main.s3.deleted) == 3  # the photo's one key on top of the two old covers
    assert guest.get(f"/api/events/{ev['id']}").status_code == 404
    assert guest.get("/api/events").json() == [] and owner.get("/api/events").json() == []
    with main.SessionLocal() as s:
        assert s.get(main.Photo, photo) is None and s.scalar(main.select(main.PhotoFeature)) is None


def upload(client, event_id, data):
    """Register a photo the way the web app does; its bytes sit in the fake bucket."""
    key = client.post("/api/uploads", json={"types": ["image/jpeg"]}).json()[0]["key"]
    main.s3.objects[key] = data
    return client.post(f"/api/events/{event_id}/photos", json={"key": key, "thumb_key": key}).json()["id"]


def test_duplicates_and_search(setup):
    owner, guest, stranger = setup(1), setup(2), setup(3)
    ev = owner.post("/api/events", json=EVENT).json()
    guest.post(f"/api/codes/{ev['code']}/join")

    sharp = upload(guest, ev["id"], scene(1, tint=0))
    blurry = upload(owner, ev["id"], scene(1, tint=0, blur=3))  # same scene, shot on another phone
    blue = upload(guest, ev["id"], scene(2, tint=2))
    green = upload(owner, ev["id"], scene(3, tint=1))

    dups = guest.get(f"/api/events/{ev['id']}/duplicates").json()
    assert dups == {"groups": [{"keep": sharp, "drop": [blurry]}], "hidden": 1}

    found = guest.get(f"/api/events/{ev['id']}/search", params={"q": "red"}).json()["results"]
    assert [r["id"] for r in found][0] == sharp and blurry not in [r["id"] for r in found]
    everything = guest.get(f"/api/events/{ev['id']}/search", params={"q": "red", "all": True}).json()["results"]
    assert {r["id"] for r in everything} == {sharp, blurry, blue, green}
    assert [r["id"] for r in guest.get(f"/api/events/{ev['id']}/search", params={"q": "blue", "k": 1}).json()["results"]] == [blue]

    assert stranger.get(f"/api/events/{ev['id']}/duplicates").status_code == 404
    assert stranger.get(f"/api/events/{ev['id']}/search", params={"q": "red"}).status_code == 404
    assert guest.get(f"/api/events/{ev['id']}/search", params={"q": ""}).status_code == 422
    assert TestClient(main.app).get(f"/api/events/{ev['id']}/duplicates").status_code == 401


def test_features_are_computed_once(setup, monkeypatch):
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    upload(owner, ev["id"], scene(5, tint=1))
    calls = []
    real = photo_ai.analyze
    monkeypatch.setattr(photo_ai, "analyze", lambda *a: calls.append(1) or real(*a))
    owner.get(f"/api/events/{ev['id']}/duplicates")
    owner.get(f"/api/events/{ev['id']}/duplicates")
    assert calls == []  # already analysed in the background after upload


def test_unreadable_photo_does_not_break_the_album(setup):
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    broken = upload(owner, ev["id"], b"not an image")
    good = upload(owner, ev["id"], scene(6, tint=2))
    assert owner.get(f"/api/events/{ev['id']}/duplicates").json() == {"groups": [], "hidden": 0}
    found = owner.get(f"/api/events/{ev['id']}/search", params={"q": "blue", "all": True}).json()["results"]
    assert [r["id"] for r in found] == [good] and broken not in [r["id"] for r in found]


def test_capture_time_comes_from_exif_of_the_original():
    data = scene(7, tint=0, exif_time="2026:11:01 18:30:00")
    result = photo_ai.analyze(data, head=data[:2000])
    assert datetime.fromtimestamp(result.taken_at) == datetime(2026, 11, 1, 18, 30)
    assert photo_ai.analyze(scene(7, tint=0), head=None).taken_at is None


def _item(photo_id, taken_at, cos_to_first):
    """Photo whose embedding sits at the given cosine from [1, 0]; hashes are maximally different."""
    vec = np.array([cos_to_first, np.sqrt(1 - cos_to_first**2)], dtype=np.float32)
    return photo_ai.Item(photo_id, f"{photo_id:016x}" if photo_id == 1 else "ffffffffffffffff", 100.0, 10**6, taken_at, vec.tobytes())


@pytest.mark.parametrize(
    "t1, t2, cos, duplicate",
    [
        (1000, 1060, 0.92, True),  # close in time: 0.90 is enough
        (1000, 90000, 0.97, False),  # same look but hours apart: a different moment
        (None, None, 0.92, False),  # no capture time: 0.92 is what different desk scenes reach
        (None, 1000, 0.92, False),
        (None, None, 0.97, True),  # but a near-identical look is still a duplicate
    ],
)
def test_capture_time_decides_how_similar_duplicates_must_be(t1, t2, cos, duplicate):
    groups = photo_ai.duplicate_groups([_item(1, t1, 1.0), _item(2, t2, cos)])
    assert bool(groups) is duplicate


class FakeGoogle:
    def __init__(self, aud, email_verified=True):
        self.aud, self.email_verified = aud, email_verified

    def __call__(self, url, **kw):
        class R:
            ok = True

        r = R()
        if "tokeninfo" in url:
            r.json = lambda: {"aud": self.aud, "sub": "g-42"}
        else:
            r.json = lambda: {"sub": "g-42", "email": "new@x.com", "name": "New", "email_verified": self.email_verified}
        return r


def test_google_login_checks_audience(setup, monkeypatch):
    monkeypatch.setattr(main, "GOOGLE_CLIENT_ID", "ours.apps.googleusercontent.com")
    client = TestClient(main.app)

    monkeypatch.setattr(main.requests, "get", FakeGoogle("someone-elses-app"))
    assert client.post("/api/auth/google", json={"access_token": "t"}).status_code == 401

    monkeypatch.setattr(main.requests, "get", FakeGoogle("ours.apps.googleusercontent.com", email_verified=False))
    assert client.post("/api/auth/google", json={"access_token": "t"}).status_code == 401

    monkeypatch.setattr(main.requests, "get", FakeGoogle("ours.apps.googleusercontent.com"))
    res = client.post("/api/auth/google", json={"access_token": "t"})
    assert res.status_code == 200 and res.json()["email"] == "new@x.com"
    assert client.get("/api/me").json()["name"] == "New"  # session cookie was set


def heic(seed: int) -> bytes:
    out = io.BytesIO()
    Image.open(io.BytesIO(scene(seed, tint=0))).save(out, "HEIF", quality=80)
    return out.getvalue()


def test_heic_gets_jpeg_previews(setup):
    try:
        original = heic(1)
    except Exception:
        pytest.skip("this libheif build cannot encode HEIC")
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    key = owner.post("/api/uploads", json={"types": ["image/heic"]}).json()[0]["key"]
    main.s3.objects[key] = original  # the browser couldn't thumbnail it, so thumb_key == key
    photo = owner.post(f"/api/events/{ev['id']}/photos", json={"key": key, "thumb_key": key}).json()

    assert photo["thumb_url"].split("?")[0].endswith(f"{key}.thumb.jpg")
    assert photo["url"].split("?")[0].endswith(f"{key}.view.jpg")
    assert photo["download_url"].split("?")[0].endswith(key)  # saving still hands out the original
    for copy in (f"{key}.thumb.jpg", f"{key}.view.jpg"):
        assert main.s3.objects[copy][:3] == b"\xff\xd8\xff"  # JPEG

    assert owner.get(f"/api/events/{ev['id']}/duplicates").json()["groups"] == []  # analysed from the JPEG thumbnail
    assert owner.delete(f"/api/photos/{photo['id']}").status_code == 200
    assert {key, f"{key}.thumb.jpg", f"{key}.view.jpg"} <= set(main.s3.deleted)


def test_unreadable_heic_is_rejected_and_removed(setup):
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    key = owner.post("/api/uploads", json={"types": ["image/heic"]}).json()[0]["key"]
    main.s3.objects[key] = b"not really a heic"
    res = owner.post(f"/api/events/{ev['id']}/photos", json={"key": key, "thumb_key": key})
    assert res.status_code == 400 and key in main.s3.deleted
    assert owner.get(f"/api/events/{ev['id']}").json()["photos"] == []


def test_event_list_previews_cover_or_latest_photo(setup):
    owner = setup(1)
    empty = owner.post("/api/events", json=EVENT).json()
    assert empty["preview_url"] is None

    ev = owner.post("/api/events", json={**EVENT, "title": "Second"}).json()
    first = upload(owner, ev["id"], scene(1, tint=0))
    last = upload(owner, ev["id"], scene(2, tint=1))
    assert last > first
    listed = {e["id"]: e for e in owner.get("/api/events").json()}
    newest_thumb = owner.get(f"/api/events/{ev['id']}").json()["photos"][0]["thumb_url"]  # newest first
    assert listed[ev["id"]]["preview_url"] == newest_thumb
    assert listed[empty["id"]]["preview_url"] is None

    cover = owner.post("/api/uploads", json={"types": ["image/jpeg"]}).json()[0]["key"]
    with_cover = owner.post("/api/events", json={**EVENT, "title": "Third", "cover_key": cover}).json()
    assert with_cover["preview_url"] == with_cover["cover_url"]


def test_videos_upload_with_poster_and_stay_out_of_duplicates(setup):
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    types = owner.post("/api/uploads", json={"types": ["video/mp4", "image/jpeg"]}).json()
    assert types[0]["key"].endswith(".mp4")
    assert owner.post("/api/uploads", json={"types": ["video/x-flv"]}).status_code == 400
    main.s3.objects[types[0]["key"]] = b"fake mp4 bytes"
    main.s3.objects[types[1]["key"]] = scene(1, tint=0)
    video = owner.post(f"/api/events/{ev['id']}/photos", json={"key": types[0]["key"], "thumb_key": types[1]["key"]}).json()
    assert video["kind"] == "video" and video["thumb_url"] and video["url"].split("?")[0].endswith(".mp4")

    # a still of the same scene next to it: only the photo list is deduplicated, the video is never dropped
    twin = upload(owner, ev["id"], scene(1, tint=0))
    assert owner.get(f"/api/events/{ev['id']}/duplicates").json()["groups"] == []
    # but its poster frame makes it findable
    found = owner.get(f"/api/events/{ev['id']}/search", params={"q": "red", "all": True}).json()["results"]
    assert {r["id"] for r in found} == {video["id"], twin}
    album = owner.get(f"/api/events/{ev['id']}").json()["photos"]
    assert sorted(p["kind"] for p in album) == ["image", "video"]


def test_video_without_poster_has_no_thumbnail_and_is_not_analysed(setup):
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    key = owner.post("/api/uploads", json={"types": ["video/quicktime"]}).json()[0]["key"]
    main.s3.objects[key] = b"fake mov bytes"
    video = owner.post(f"/api/events/{ev['id']}/photos", json={"key": key, "thumb_key": key}).json()
    assert video["kind"] == "video" and video["thumb_url"] is None
    assert owner.get(f"/api/events/{ev['id']}/search", params={"q": "red", "all": True}).json()["results"] == []


def test_videos_may_be_larger_than_photos(setup, monkeypatch):
    monkeypatch.setattr(main, "MAX_PHOTO_BYTES", 5)
    monkeypatch.setattr(main, "MAX_VIDEO_BYTES", 50)
    owner = setup(1)
    ev = owner.post("/api/events", json=EVENT).json()
    photo_key = owner.post("/api/uploads", json={"types": ["image/jpeg"]}).json()[0]["key"]
    video_key = owner.post("/api/uploads", json={"types": ["video/mp4"]}).json()[0]["key"]
    main.s3.objects[photo_key] = main.s3.objects[video_key] = b"x" * 20
    too_big = owner.post(f"/api/events/{ev['id']}/photos", json={"key": photo_key, "thumb_key": photo_key})
    assert too_big.status_code == 413 and photo_key in main.s3.deleted
    assert owner.post(f"/api/events/{ev['id']}/photos", json={"key": video_key, "thumb_key": video_key}).status_code == 200


def test_version_changes_when_photos_are_added_or_removed(setup):
    owner, guest, stranger = setup(1), setup(2), setup(3)
    ev = owner.post("/api/events", json=EVENT).json()
    guest.post(f"/api/codes/{ev['code']}/join")
    url = f"/api/events/{ev['id']}/version"
    empty = owner.get(url).json()["version"]
    assert empty == "0:0"

    first = upload(guest, ev["id"], scene(1, tint=0))
    after_add = owner.get(url).json()["version"]
    assert after_add == f"1:{first}" != empty

    second = upload(owner, ev["id"], scene(2, tint=1))
    assert guest.get(url).json()["version"] == f"2:{second}"
    owner.delete(f"/api/photos/{second}")
    assert owner.get(url).json()["version"] == after_add
    # remove one and add one between two polls: the count stays, the latest id still changes
    third = upload(owner, ev["id"], scene(3, tint=2))
    owner.delete(f"/api/photos/{first}")
    assert owner.get(url).json()["version"] == f"1:{third}"

    assert stranger.get(url).status_code == 404
    assert TestClient(main.app).get(url).status_code == 401


def test_signed_urls_are_stable_for_an_hour_then_renewed(setup, monkeypatch):
    signed = []

    def fake_sign(op, Params, ExpiresIn):
        signed.append(Params["Key"])
        return f"{main.S3_ENDPOINT}/{Params['Key']}?sig={len(signed)}"

    monkeypatch.setattr(main.s3, "generate_presigned_url", fake_sign)
    clock = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: clock[0])

    first = main.get_url("u/1/stable.jpg")
    assert main.get_url("u/1/stable.jpg") == first and len(signed) == 1  # same string: browsers keep the cached image
    assert main.get_url("u/1/stable.jpg", download=True) != first  # the download link is its own URL
    clock[0] += main.URL_REUSE + 1
    assert main.get_url("u/1/stable.jpg") != first  # renewed well before the 6 h expiry
