import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import boto3
import jwt
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

env = os.environ.get
DATABASE_URL = env("DATABASE_URL", "postgresql+psycopg://rollcall:rollcall@localhost:5432/rollcall")
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", "")
JWT_SECRET = env("JWT_SECRET", "dev-only-secret-change-me-in-production")
COOKIE_SECURE = env("COOKIE_SECURE", "false") == "true"
S3_ENDPOINT = env("S3_ENDPOINT", "http://localhost:9000")
# Browser-facing prefix for presigned URLs; "/s3" goes through the Next.js rewrite so phones only need the web origin.
S3_PUBLIC_URL = env("S3_PUBLIC_URL", "/s3")
S3_BUCKET = env("S3_BUCKET", "rollcall")
URL_TTL = 6 * 3600
MAX_PHOTO_BYTES = 50 * 1024 * 1024
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: codes get typed by hand
IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
}

if COOKIE_SECURE and JWT_SECRET == "dev-only-secret-change-me-in-production":
    raise RuntimeError("Set JWT_SECRET in production")

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=env("S3_ACCESS_KEY", "rollcall"),
    aws_secret_access_key=env("S3_SECRET_KEY", "rollcall-secret"),
    region_name=env("S3_REGION", "us-east-1"),
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(320))
    name: Mapped[str] = mapped_column(String(200))
    picture: Mapped[str | None] = mapped_column(String(1000))


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    code: Mapped[str] = mapped_column(String(8), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cover_key: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Member(Base):
    __tablename__ = "members"
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)


class Photo(Base):
    __tablename__ = "photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str] = mapped_column(String(200))
    thumb_key: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine)


@asynccontextmanager
async def lifespan(_app):
    # shortcut: create_all instead of migrations; add Alembic before the first schema change.
    Base.metadata.create_all(engine)
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        s3.create_bucket(Bucket=S3_BUCKET)
    yield


app = FastAPI(title="RollCall API", lifespan=lifespan)
api = APIRouter(prefix="/api")


def db():
    with SessionLocal() as s:
        yield s


def current_user(request: Request, s: Session = Depends(db)) -> User:
    try:
        uid = int(jwt.decode(request.cookies.get("session", ""), JWT_SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Not signed in")
    user = s.get(User, uid)
    if not user:
        raise HTTPException(401, "Not signed in")
    return user


def public(url: str) -> str:
    return S3_PUBLIC_URL + url.removeprefix(S3_ENDPOINT)


def get_url(key: str, download: bool = False) -> str:
    params = {"Bucket": S3_BUCKET, "Key": key}
    if download:
        params["ResponseContentDisposition"] = f'attachment; filename="{key.rsplit("/", 1)[-1]}"'
    return public(s3.generate_presigned_url("get_object", Params=params, ExpiresIn=URL_TTL))


def check_upload(key: str, user: User) -> int:
    """Key must be one this user was handed by /uploads and must actually exist in S3."""
    if not key.startswith(f"u/{user.id}/"):
        raise HTTPException(400, "Unknown upload")
    try:
        return s3.head_object(Bucket=S3_BUCKET, Key=key)["ContentLength"]
    except ClientError:
        raise HTTPException(400, "Upload not found")


def user_out(u: User):
    return {"id": u.id, "name": u.name, "email": u.email, "picture": u.picture}


def event_out(e: Event, user: User):
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "starts_at": e.starts_at.isoformat(),
        "ends_at": e.ends_at.isoformat(),
        "code": e.code,
        "cover_url": get_url(e.cover_key) if e.cover_key else None,
        "is_owner": e.owner_id == user.id,
    }


def photo_out(p: Photo, author: User, user: User, event: Event):
    return {
        "id": p.id,
        "url": get_url(p.key),
        "thumb_url": get_url(p.thumb_key),
        "download_url": get_url(p.key, download=True),
        "author": author.name,
        "can_delete": p.user_id == user.id or event.owner_id == user.id,
    }


def member_event(event_id: int, user: User, s: Session) -> Event:
    e = s.get(Event, event_id)
    if not e or not s.get(Member, (event_id, user.id)):
        raise HTTPException(404, "Event not found")
    return e


def event_by_code(code: str, s: Session) -> Event:
    e = s.scalar(select(Event).where(Event.code == code.strip().upper()))
    if not e:
        raise HTTPException(404, "No event with this code")
    return e


class GoogleIn(BaseModel):
    credential: str


@api.post("/auth/google")
def google_login(body: GoogleIn, response: Response, s: Session = Depends(db)):
    if not GOOGLE_CLIENT_ID:
        # Without an audience google-auth would accept tokens minted for any app.
        raise HTTPException(500, "GOOGLE_CLIENT_ID is not configured")
    try:
        info = id_token.verify_oauth2_token(body.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(401, "Invalid Google sign-in")
    if not info.get("email_verified"):
        raise HTTPException(401, "Google email is not verified")
    user = s.scalar(select(User).where(User.google_sub == info["sub"])) or User(google_sub=info["sub"])
    user.email = info["email"]
    user.name = info.get("name") or info["email"]
    user.picture = info.get("picture")
    s.add(user)
    s.commit()
    token = jwt.encode({"sub": str(user.id), "exp": now() + timedelta(days=30)}, JWT_SECRET, "HS256")
    response.set_cookie(
        "session", token, max_age=30 * 86400, httponly=True, samesite="lax", secure=COOKIE_SECURE
    )
    return user_out(user)


@api.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}


@api.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


class UploadIn(BaseModel):
    types: list[str] = Field(min_length=1, max_length=2)


@api.post("/uploads")
def create_uploads(body: UploadIn, user: User = Depends(current_user)):
    out = []
    for t in body.types:
        if t not in IMAGE_TYPES:
            raise HTTPException(400, "Only images can be uploaded")
        key = f"u/{user.id}/{uuid.uuid4().hex}{IMAGE_TYPES[t]}"
        url = s3.generate_presigned_url(
            "put_object", Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": t}, ExpiresIn=900
        )
        out.append({"key": key, "url": public(url)})
    return out


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field("", max_length=2000)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    cover_key: str | None = None


@api.get("/events")
def list_events(user: User = Depends(current_user), s: Session = Depends(db)):
    events = s.scalars(
        select(Event).join(Member).where(Member.user_id == user.id).order_by(Event.starts_at.desc())
    )
    return [event_out(e, user) for e in events]


@api.post("/events")
def create_event(body: EventIn, user: User = Depends(current_user), s: Session = Depends(db)):
    if body.ends_at < body.starts_at:
        raise HTTPException(422, "The event can't end before it starts")
    if body.cover_key:
        check_upload(body.cover_key, user)
    code = ""
    for _ in range(10):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not s.scalar(select(Event.id).where(Event.code == code)):
            break
    e = Event(
        owner_id=user.id,
        code=code,
        title=body.title.strip(),
        description=body.description.strip(),
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        cover_key=body.cover_key,
    )
    s.add(e)
    s.flush()
    s.add(Member(event_id=e.id, user_id=user.id))
    s.commit()
    return event_out(e, user)


@api.get("/events/{event_id}")
def get_event(event_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    e = member_event(event_id, user, s)
    # shortcut: whole album in one response; paginate once albums pass a few thousand photos.
    rows = s.execute(
        select(Photo, User).join(User, Photo.user_id == User.id)
        .where(Photo.event_id == e.id).order_by(Photo.created_at.desc())
    )
    return {**event_out(e, user), "photos": [photo_out(p, a, user, e) for p, a in rows]}


class PhotoIn(BaseModel):
    key: str
    thumb_key: str


@api.post("/events/{event_id}/photos")
def add_photo(event_id: int, body: PhotoIn, user: User = Depends(current_user), s: Session = Depends(db)):
    e = member_event(event_id, user, s)
    # shortcut: presigned PUT can't cap size, so oversized originals are rejected here after upload.
    if check_upload(body.key, user) > MAX_PHOTO_BYTES:
        s3.delete_object(Bucket=S3_BUCKET, Key=body.key)
        raise HTTPException(413, "Photo is larger than 50 MB")
    if body.thumb_key != body.key:
        check_upload(body.thumb_key, user)
    p = Photo(event_id=e.id, user_id=user.id, key=body.key, thumb_key=body.thumb_key)
    s.add(p)
    s.commit()
    return photo_out(p, user, user, e)


@api.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    p = s.get(Photo, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    e = member_event(p.event_id, user, s)
    if p.user_id != user.id and e.owner_id != user.id:
        raise HTTPException(403, "You can only delete your own photos")
    for key in {p.key, p.thumb_key}:
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
    s.delete(p)
    s.commit()
    return {"ok": True}


@api.get("/codes/{code}")
def preview_code(code: str, user: User = Depends(current_user), s: Session = Depends(db)):
    e = event_by_code(code, s)
    return {**event_out(e, user), "joined": s.get(Member, (e.id, user.id)) is not None}


@api.post("/codes/{code}/join")
def join(code: str, user: User = Depends(current_user), s: Session = Depends(db)):
    e = event_by_code(code, s)
    if not s.get(Member, (e.id, user.id)):
        s.add(Member(event_id=e.id, user_id=user.id))
        s.commit()
    return {"id": e.id}


app.include_router(api)
