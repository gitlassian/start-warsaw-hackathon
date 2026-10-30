import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main


class FakeS3:
    def __init__(self):
        self.deleted = []

    def generate_presigned_url(self, op, Params, ExpiresIn):
        return f"{main.S3_ENDPOINT}/{Params['Bucket']}/{Params['Key']}?sig"

    def head_object(self, Bucket, Key):
        return {"ContentLength": 10}

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    main.Base.metadata.create_all(engine)
    monkeypatch.setattr(main, "SessionLocal", sessionmaker(engine))
    monkeypatch.setattr(main, "s3", FakeS3())
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
