import io
import zipfile

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

import main
from migrate import migrate_database
from test_main import EVENT, FakeGoogle, scene, setup  # shared isolated DB, storage and Google fixtures


def anonymous_join(event):
    client = TestClient(main.app)
    response = client.post(f"/api/invites/{event['invite_token']}/join", json={})
    assert response.status_code == 200
    return client


def guest_photo(client, event_id):
    image = scene(91, 1)
    response = client.post("/api/uploads", json={"event_id": event_id, "types": ["image/jpeg"], "sizes": [len(image)]})
    assert response.status_code == 200
    target = response.json()[0]
    assert target["fields"]["key"] == target["key"]
    main.s3.objects[target["key"]] = image
    response = client.post(f"/api/events/{event_id}/photos", json={"key": target["key"], "thumb_key": target["key"]})
    assert response.status_code == 200
    return response.json()


def test_anonymous_invitation_creates_a_private_reusable_guest_session(setup):
    owner = setup(1)
    event = owner.post("/api/events", json=EVENT).json()
    assert len(event["invite_token"]) >= 32
    guest = TestClient(main.app)
    assert guest.get(f"/api/events/{event['id']}").status_code == 401
    response = guest.post(f"/api/invites/{event['invite_token']}/join", json={})
    assert response.status_code == 200 and response.json()["code"] == event["code"]
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    me = guest.get("/api/me").json()
    assert me["is_guest"] and me["email"] is None and me["name"] == "Guest"
    first_cookie = guest.cookies.get("session")
    for path in (f"/api/invites/{event['invite_token']}/join", f"/api/codes/{event['code'].lower()}/join"):
        assert guest.post(path, json={}).status_code == 200
    assert guest.cookies.get("session") == first_cookie
    with main.SessionLocal() as s:
        assert s.scalar(main.select(main.func.count()).select_from(main.User)) == 4
        assert s.scalar(main.select(main.func.count()).select_from(main.Member)) == 2
    album = guest.get(f"/api/events/{event['id']}").json()
    assert not album["is_owner"] and album["viewer_is_guest"]


def test_short_code_accepts_guests_and_recovers_an_expired_cookie(setup):
    event = setup(1).post("/api/events", json=EVENT).json()
    guest = TestClient(main.app)
    guest.cookies.set("session", "expired-or-invalid")
    response = guest.post(f"/api/codes/{event['code']}/join", json={})
    assert response.status_code == 200
    assert guest.get("/api/me").json()["is_guest"]
    assert guest.get(f"/api/events/{event['id']}").status_code == 200


def test_invitation_preserves_a_signed_in_host_session(setup):
    owner, other = setup(1), setup(2)
    event = other.post("/api/events", json=EVENT).json()
    old_cookie = owner.cookies.get("session")
    response = owner.post(f"/api/invites/{event['invite_token']}/join", json={})
    assert response.status_code == 200 and "set-cookie" not in response.headers
    assert owner.cookies.get("session") == old_cookie
    assert owner.get("/api/me").json()["id"] == 1
    assert owner.post("/api/events", json=EVENT).status_code == 200


def test_invalid_or_cross_site_invites_do_not_allocate_guests(setup):
    event = setup(1).post("/api/events", json=EVENT).json()
    guest = TestClient(main.app)
    assert guest.post("/api/invites/not-an-invitation/join", json={}).status_code == 404
    assert guest.post(f"/api/invites/{event['invite_token']}/join", json={}, headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert guest.get("/api/me").status_code == 401
    with main.SessionLocal() as s:
        assert s.scalar(main.select(main.func.count()).select_from(main.User)) == 3


def test_guest_upload_view_download_and_deletion_permissions(setup):
    owner = setup(1)
    event = owner.post("/api/events", json=EVENT).json()
    guest, other_guest = anonymous_join(event), anonymous_join(event)
    photo = guest_photo(guest, event["id"])
    other = guest_photo(other_guest, event["id"])
    assert main.s3.last_post_conditions == [{"Content-Type": "image/jpeg"}, ["content-length-range", 1, main.MAX_PHOTO_BYTES]]
    album = owner.get(f"/api/events/{event['id']}").json()
    assert {p["id"] for p in album["photos"]} == {photo["id"], other["id"]}
    assert guest.get(f"/api/events/{event['id']}/search", params={"q": "green"}).status_code == 200
    download = guest.get(f"/api/events/{event['id']}/download?all=true")
    assert download.status_code == 200
    assert len(zipfile.ZipFile(io.BytesIO(download.content)).namelist()) == 2
    assert guest.delete(f"/api/photos/{other['id']}").status_code == 403
    assert guest.post(f"/api/events/{event['id']}/photos/delete", json={"photo_ids": [photo["id"], other["id"]]}).status_code == 403
    assert guest.delete(f"/api/photos/{photo['id']}").status_code == 200
    assert owner.delete(f"/api/photos/{other['id']}").status_code == 200


def test_guests_cannot_create_or_manage_events_or_upload_outside_an_album(setup):
    owner = setup(1)
    event = owner.post("/api/events", json=EVENT).json()
    foreign = owner.post("/api/events", json=EVENT).json()
    guest = anonymous_join(event)
    assert guest.post("/api/events", json=EVENT).status_code == 403
    assert guest.put(f"/api/events/{event['id']}", json=EVENT).status_code == 403
    assert guest.delete(f"/api/events/{event['id']}").status_code == 403
    assert guest.patch(f"/api/events/{event['id']}/access", json={"uploads_open": False}).status_code == 403
    assert guest.get(f"/api/events/{foreign['id']}").status_code == 404
    upload = {"types": ["image/jpeg"], "sizes": [10]}
    assert guest.post("/api/uploads", json=upload).status_code == 403
    assert guest.post("/api/uploads", json={**upload, "event_id": foreign["id"]}).status_code == 404
    assert guest.post("/api/uploads", json={"types": ["image/jpeg"], "event_id": event["id"]}).status_code == 422
    assert guest.post("/api/uploads", json={**upload, "event_id": event["id"], "sizes": [main.MAX_PHOTO_BYTES + 1]}).status_code == 413
    assert guest.post("/api/uploads", json={**upload, "event_id": event["id"], "sizes": [0]}).status_code == 413


def test_guest_upload_is_bound_to_the_target_album(setup):
    owner = setup(1)
    first = owner.post("/api/events", json=EVENT).json()
    second = owner.post("/api/events", json=EVENT).json()
    guest = anonymous_join(first)
    guest.post(f"/api/invites/{second['invite_token']}/join", json={})
    target = guest.post("/api/uploads", json={"types": ["image/jpeg"], "sizes": [10], "event_id": first["id"]}).json()[0]
    assert guest.post(f"/api/events/{second['id']}/photos", json={"key": target["key"], "thumb_key": target["key"]}).status_code == 400


def test_host_closes_and_rotates_invitations_and_pauses_uploads(setup):
    owner = setup(1)
    event = owner.post("/api/events", json=EVENT).json()
    guest = anonymous_join(event)
    url = f"/api/events/{event['id']}/access"
    owner.patch(url, json={"invites_open": False})
    newcomer = TestClient(main.app)
    assert newcomer.post(f"/api/invites/{event['invite_token']}/join", json={}).status_code == 403
    assert newcomer.post(f"/api/codes/{event['code']}/join", json={}).status_code == 403
    assert guest.post(f"/api/invites/{event['invite_token']}/join", json={}).status_code == 200
    assert guest.get(f"/api/events/{event['id']}").status_code == 200
    rotated = owner.patch(url, json={"invites_open": True, "rotate_invite": True}).json()
    assert rotated["invite_token"] != event["invite_token"]
    assert newcomer.post(f"/api/invites/{event['invite_token']}/join", json={}).status_code == 404
    assert newcomer.post(f"/api/invites/{rotated['invite_token']}/join", json={}).status_code == 200
    image = scene(92, 1)
    pending = guest.post("/api/uploads", json={"event_id": event["id"], "types": ["image/jpeg"], "sizes": [len(image)]}).json()[0]
    main.s3.objects[pending["key"]] = image
    owner.patch(url, json={"uploads_open": False})
    assert guest.post("/api/uploads", json={"event_id": event["id"], "types": ["image/jpeg"], "sizes": [10]}).status_code == 403
    assert guest.post(f"/api/events/{event['id']}/photos", json={"key": pending["key"], "thumb_key": pending["key"]}).status_code == 403
    assert guest.get(f"/api/events/{event['id']}").status_code == 200
    owner.patch(url, json={"uploads_open": True})
    assert guest.post(f"/api/events/{event['id']}/photos", json={"key": pending["key"], "thumb_key": pending["key"]}).status_code == 200


def test_nonmember_cannot_read_the_long_invitation_token(setup):
    owner, stranger = setup(1), setup(2)
    event = owner.post("/api/events", json=EVENT).json()
    assert stranger.get(f"/api/codes/{event['code']}").json()["invite_token"] is None


def test_short_code_rate_limit_and_guest_photo_quota(setup, monkeypatch):
    event = setup(1).post("/api/events", json=EVENT).json()
    guest = anonymous_join(event)
    monkeypatch.setattr(main, "MAX_GUEST_PHOTOS", 1)
    guest_photo(guest, event["id"])
    assert guest.post("/api/uploads", json={"event_id": event["id"], "types": ["image/jpeg"], "sizes": [10]}).status_code == 429
    visitor = TestClient(main.app)
    for _ in range(60):
        assert visitor.post("/api/codes/WRONG0/join", json={}).status_code == 404
    assert visitor.post(f"/api/codes/{event['code']}/join", json={}).status_code == 429
    assert visitor.post(f"/api/invites/{event['invite_token']}/join", json={}).status_code == 200


def test_signing_in_upgrades_a_guest_without_losing_photos(setup, monkeypatch):
    event = setup(1).post("/api/events", json=EVENT).json()
    guest = anonymous_join(event)
    photo = guest_photo(guest, event["id"])
    old_id = guest.get("/api/me").json()["id"]
    monkeypatch.setattr(main, "GOOGLE_CLIENT_ID", "ours")
    monkeypatch.setattr(main.requests, "get", FakeGoogle("ours"))
    signed_in = guest.post("/api/auth/google", json={"access_token": "token"})
    assert signed_in.status_code == 200
    assert signed_in.json()["id"] == old_id and not signed_in.json()["is_guest"]
    assert guest.post("/api/events", json=EVENT).status_code == 200
    assert guest.delete(f"/api/photos/{photo['id']}").status_code == 200


def test_guest_photos_merge_into_an_existing_google_account(setup, monkeypatch):
    owner = setup(1)
    event = owner.post("/api/events", json=EVENT).json()
    guest = anonymous_join(event)
    photo = guest_photo(guest, event["id"])
    guest_id = guest.get("/api/me").json()["id"]
    with main.SessionLocal() as s:
        s.get(main.User, 1).google_sub = "g-42"
        s.commit()
    monkeypatch.setattr(main, "GOOGLE_CLIENT_ID", "ours")
    monkeypatch.setattr(main.requests, "get", FakeGoogle("ours"))
    signed_in = guest.post("/api/auth/google", json={"access_token": "token"})
    assert signed_in.status_code == 200 and signed_in.json()["id"] == 1
    with main.SessionLocal() as s:
        assert s.get(main.User, guest_id) is None
        assert s.get(main.Photo, photo["id"]).user_id == 1
        assert s.get(main.Member, (event["id"], 1)) is not None
    assert guest.get(f"/api/events/{event['id']}").json()["is_owner"]


def test_migrations_create_a_fresh_database_and_are_repeatable(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fresh.sqlite'}")
    migrate_database(engine)
    migrate_database(engine)
    columns = {column["name"]: column for column in inspect(engine).get_columns("users")}
    assert columns["google_sub"]["nullable"] and columns["email"]["nullable"]
    assert set(main.Base.metadata.tables) <= set(inspect(engine).get_table_names())
    with engine.begin() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0002"


def test_migrations_keep_existing_users_events_memberships_and_photos(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.sqlite'}")
    config = Config()
    config.set_main_option("script_location", str(main.__file__).replace("main.py", "migrations"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0001")
        connection.execute(text("DROP TABLE alembic_version"))
        connection.execute(text("INSERT INTO users (id, google_sub, email, name) VALUES (1, 'google-1', 'host@example.com', 'Host')"))
        connection.execute(text("INSERT INTO events (id, owner_id, code, title, description, starts_at, ends_at, created_at) VALUES (1, 1, 'ABCDEF', 'Party', '', '2026-11-01', '2026-11-02', '2026-10-31')"))
        connection.execute(text("INSERT INTO members (event_id, user_id) VALUES (1, 1)"))
        connection.execute(text("INSERT INTO photos (id, event_id, user_id, key, thumb_key, created_at) VALUES (1, 1, 1, 'u/1/old.jpg', 'u/1/old.jpg', '2026-10-31')"))
    migrate_database(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT google_sub FROM users WHERE id=1")).scalar() == "google-1"
        token = connection.execute(text("SELECT invite_token FROM events WHERE id=1")).scalar()
        assert len(token) >= 32
        assert connection.execute(text("SELECT count(*) FROM members")).scalar() == 1
        assert connection.execute(text("SELECT key FROM photos WHERE id=1")).scalar() == "u/1/old.jpg"
    migrate_database(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT invite_token FROM events WHERE id=1")).scalar() == token
