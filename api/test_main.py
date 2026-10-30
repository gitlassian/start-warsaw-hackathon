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
        return {"ContentLength": 10}

    def get_object(self, Bucket, Key, Range=None):
        data = self.objects.get(Key) or scene(hash(Key) % 1000, 0)
        if Range:
            data = data[: int(Range.split("-")[1]) + 1]
        return {"Body": io.BytesIO(data)}

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

    assert guest.delete(f"/api/photos/{owner_photo['id']}").status_code == 403
    assert stranger.delete(f"/api/photos/{photo['id']}").status_code == 404
    assert owner.delete(f"/api/photos/{photo['id']}").status_code == 200
    assert sorted(main.s3.deleted) == sorted([up[0]["key"], up[1]["key"]])
    assert len(guest.get(f"/api/events/{ev['id']}").json()["photos"]) == 1
    assert [e["id"] for e in guest.get("/api/events").json()] == [ev["id"]]


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
