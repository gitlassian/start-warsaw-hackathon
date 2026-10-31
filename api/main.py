import io
import logging
import os
import secrets
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import boto3
import jwt
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response
from PIL import Image, ImageOps
from pydantic import AwareDatetime, BaseModel, Field
import requests
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, LargeBinary, String, Text, create_engine, delete, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

import photo_ai

log = logging.getLogger("rollcall")

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
URL_REUSE = 3600  # hand out the same signed URL for an hour, so a refresh doesn't make browsers re-download every photo
MAX_PHOTO_BYTES = 50 * 1024 * 1024
MAX_VIDEO_BYTES = 200 * 1024 * 1024
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: codes get typed by hand
MEDIA_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
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


class PhotoFeature(Base):
    """What duplicate detection and search need per photo; filled in after upload."""

    __tablename__ = "photo_features"
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True)
    phash: Mapped[str] = mapped_column(String(32))
    sharpness: Mapped[float] = mapped_column(Float)
    pixels: Mapped[int] = mapped_column(BigInteger)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # EXIF time; NULL = unknown
    embedding: Mapped[bytes] = mapped_column(LargeBinary)


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
    # Load the CLIP models in the background so the first search doesn't wait for them.
    threading.Thread(target=photo_ai.embedder.warm_up, daemon=True).start()
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


_signed: dict[tuple[str, bool], tuple[float, str]] = {}


def get_url(key: str, download: bool = False) -> str:
    cached = _signed.get((key, download))
    if cached and time.monotonic() - cached[0] < URL_REUSE:
        return cached[1]
    params = {"Bucket": S3_BUCKET, "Key": key}
    if download:
        params["ResponseContentDisposition"] = f'attachment; filename="{key.rsplit("/", 1)[-1]}"'
    url = public(s3.generate_presigned_url("get_object", Params=params, ExpiresIn=URL_TTL))
    _signed[(key, download)] = (time.monotonic(), url)
    return url


def is_heif(key: str) -> bool:
    return key.lower().endswith((".heic", ".heif"))


def is_video(key: str) -> bool:
    return key.lower().endswith((".mp4", ".mov", ".webm"))


def view_key(key: str) -> str:
    """What the viewer shows. Only Safari decodes HEIC, so those get a JPEG copy next to the original."""
    return f"{key}.view.jpg" if is_heif(key) else key


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


def event_out(e: Event, user: User, latest_thumb: str | None = None):
    preview = e.cover_key or latest_thumb
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "starts_at": e.starts_at.isoformat(),
        "ends_at": e.ends_at.isoformat(),
        "code": e.code,
        "cover_url": get_url(e.cover_key) if e.cover_key else None,
        "preview_url": get_url(preview) if preview else None,  # the cover, else the newest photo
        "is_owner": e.owner_id == user.id,
    }


def photo_out(p: Photo, author: User, user: User, event: Event):
    return {
        "id": p.id,
        "kind": "video" if is_video(p.key) else "image",
        "url": get_url(view_key(p.key)),
        # a video the browser couldn't take a poster frame from has no thumbnail (thumb_key is the video itself)
        "thumb_url": None if p.thumb_key == p.key and is_video(p.key) else get_url(p.thumb_key),
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
    access_token: str


def google_profile(access_token: str) -> dict:
    """Checks the token was issued to *our* client (else any Google app's token would log in), then reads the profile."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "GOOGLE_CLIENT_ID is not configured")
    try:
        token = requests.get(
            "https://oauth2.googleapis.com/tokeninfo", params={"access_token": access_token}, timeout=10
        )
        if not token.ok or token.json().get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(401, "Invalid Google sign-in")
        profile = requests.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(502, "Couldn't reach Google. Try again.")
    info = profile.json() if profile.ok else {}
    if info.get("sub") != token.json().get("sub"):
        raise HTTPException(401, "Invalid Google sign-in")
    if not info.get("email_verified"):
        raise HTTPException(401, "Google email is not verified")
    return info


@api.post("/auth/google")
def google_login(body: GoogleIn, response: Response, s: Session = Depends(db)):
    info = google_profile(body.access_token)
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
        if t not in MEDIA_TYPES:
            raise HTTPException(400, "Only photos and videos can be uploaded")
        key = f"u/{user.id}/{uuid.uuid4().hex}{MEDIA_TYPES[t]}"
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
    ).all()
    latest: dict[int, str] = {}
    newest_first = select(Photo.event_id, Photo.thumb_key).where(Photo.event_id.in_([e.id for e in events]))
    for event_id, thumb_key in s.execute(newest_first.order_by(Photo.created_at.desc(), Photo.id.desc())):
        latest.setdefault(event_id, thumb_key)
    return [event_out(e, user, latest.get(e.id)) for e in events]


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


def owned_event(event_id: int, user: User, s: Session) -> Event:
    e = member_event(event_id, user, s)
    if e.owner_id != user.id:
        raise HTTPException(403, "Only the host can change this event")
    return e


class EventEdit(EventIn):
    remove_cover: bool = False  # cover_key replaces the cover; this drops it


@api.put("/events/{event_id}")
def update_event(event_id: int, body: EventEdit, user: User = Depends(current_user), s: Session = Depends(db)):
    e = owned_event(event_id, user, s)
    if body.ends_at < body.starts_at:
        raise HTTPException(422, "The event can't end before it starts")
    if body.cover_key and body.cover_key != e.cover_key:
        check_upload(body.cover_key, user)
    if (body.cover_key and body.cover_key != e.cover_key) or body.remove_cover:
        if e.cover_key:
            s3.delete_object(Bucket=S3_BUCKET, Key=e.cover_key)
        e.cover_key = None if body.remove_cover else body.cover_key
    e.title = body.title.strip()
    e.description = body.description.strip()
    e.starts_at = body.starts_at
    e.ends_at = body.ends_at
    s.commit()
    return event_out(e, user)


@api.delete("/events/{event_id}")
def delete_event(event_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    e = owned_event(event_id, user, s)
    photos = s.scalars(select(Photo).where(Photo.event_id == e.id)).all()
    # shortcut: one S3 call per object; switch to delete_objects batches for albums in the thousands.
    for key in {k for p in photos for k in (p.key, p.thumb_key, view_key(p.key))} | ({e.cover_key} if e.cover_key else set()):
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
    # Explicit child deletes: SQLite (tests) doesn't enforce ON DELETE CASCADE.
    ids = [p.id for p in photos]
    s.execute(delete(PhotoFeature).where(PhotoFeature.photo_id.in_(ids)))
    s.execute(delete(Photo).where(Photo.event_id == e.id))
    s.execute(delete(Member).where(Member.event_id == e.id))
    s.delete(e)
    s.commit()
    return {"ok": True}


@api.get("/events/{event_id}/version")
def event_version(event_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    """Changes whenever a photo is added or removed. The album page polls this instead of re-fetching the album."""
    member_event(event_id, user, s)
    count, latest = s.execute(select(func.count(Photo.id), func.max(Photo.id)).where(Photo.event_id == event_id)).one()
    return {"version": f"{count}:{latest or 0}"}


class PhotoIn(BaseModel):
    key: str
    thumb_key: str


def make_previews(key: str) -> str:
    """JPEG thumbnail and viewer copy of a HEIC original; returns the thumbnail's key."""
    with Image.open(io.BytesIO(_read(key))) as raw:
        img = ImageOps.exif_transpose(raw).convert("RGB")
    for name, side, quality in (("thumb", 600, 82), ("view", 2000, 88)):
        copy = img.copy()
        copy.thumbnail((side, side))
        out = io.BytesIO()
        copy.save(out, "JPEG", quality=quality)
        s3.put_object(Bucket=S3_BUCKET, Key=f"{key}.{name}.jpg", Body=out.getvalue(), ContentType="image/jpeg")
    return f"{key}.thumb.jpg"


@api.post("/events/{event_id}/photos")
def add_photo(
    event_id: int, body: PhotoIn, background: BackgroundTasks, user: User = Depends(current_user), s: Session = Depends(db)
):
    e = member_event(event_id, user, s)
    # shortcut: presigned PUT can't cap size, so oversized originals are rejected here after upload.
    limit = MAX_VIDEO_BYTES if is_video(body.key) else MAX_PHOTO_BYTES
    if check_upload(body.key, user) > limit:
        s3.delete_object(Bucket=S3_BUCKET, Key=body.key)
        raise HTTPException(413, f"File is larger than {limit // 2**20} MB")
    if body.thumb_key != body.key:
        check_upload(body.thumb_key, user)
    thumb_key = body.thumb_key
    if is_heif(body.key):
        try:
            made = make_previews(body.key)
        except Exception:
            s3.delete_object(Bucket=S3_BUCKET, Key=body.key)
            raise HTTPException(400, "This photo couldn't be read")
        if thumb_key == body.key:  # the browser couldn't make a thumbnail either
            thumb_key = made
    p = Photo(event_id=e.id, user_id=user.id, key=body.key, thumb_key=thumb_key)
    s.add(p)
    s.commit()
    background.add_task(analyze_event, e.id)
    return photo_out(p, user, user, e)


@api.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    p = s.get(Photo, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    e = member_event(p.event_id, user, s)
    if p.user_id != user.id and e.owner_id != user.id:
        raise HTTPException(403, "You can only delete your own photos")
    for key in {p.key, p.thumb_key, view_key(p.key)}:
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
    s.delete(p)
    s.commit()
    return {"ok": True}


_analysis_lock = threading.Lock()
HEAD_BYTES = 128 * 1024  # an original's EXIF block sits in its first bytes


def _read(key: str, byte_range: str | None = None) -> bytes:
    params = {"Bucket": S3_BUCKET, "Key": key}
    if byte_range:
        params["Range"] = byte_range
    return s3.get_object(**params)["Body"].read()


def analyze_event(event_id: int) -> None:
    """Compute features for every photo of the event that has none yet. Safe to call concurrently."""
    with _analysis_lock, SessionLocal() as s:
        missing = s.scalars(
            select(Photo)
            .outerjoin(PhotoFeature, PhotoFeature.photo_id == Photo.id)
            .where(Photo.event_id == event_id, PhotoFeature.photo_id.is_(None))
        ).all()
        for p in missing:
            if is_video(p.key) and p.thumb_key == p.key:
                continue  # no poster frame to look at
            try:
                thumb = _read(p.thumb_key)
                if p.thumb_key == p.key:
                    head = thumb[:HEAD_BYTES]
                elif is_heif(p.key):
                    head = _read(p.key)
                else:
                    head = _read(p.key, f"bytes=0-{HEAD_BYTES - 1}")
                a = photo_ai.analyze(thumb, head)
            except Exception:  # one unreadable file must not take the whole album down
                log.exception("Could not analyze photo %s", p.id)
                continue
            taken_at = datetime.fromtimestamp(a.taken_at, timezone.utc) if a.taken_at else None
            s.add(PhotoFeature(photo_id=p.id, phash=a.phash, sharpness=a.sharpness, pixels=a.pixels,
                               taken_at=taken_at, embedding=a.embedding))
            s.commit()


def album_items(event_id: int, s: Session) -> tuple[list[photo_ai.Item], set[int]]:
    """Analysed photos of the event, plus the ids of those that are videos (searchable, never duplicates)."""
    analyze_event(event_id)  # covers photos uploaded before the analysis existed or that failed earlier
    rows = s.execute(
        select(PhotoFeature, Photo.key).join(Photo, Photo.id == PhotoFeature.photo_id)
        .where(Photo.event_id == event_id).order_by(PhotoFeature.photo_id)
    ).all()
    items = [
        photo_ai.Item(f.photo_id, f.phash, f.sharpness, f.pixels, f.taken_at and f.taken_at.timestamp(), f.embedding)
        for f, _ in rows
    ]
    return items, {f.photo_id for f, key in rows if is_video(key)}


def duplicate_pairs(event_id: int, s: Session) -> tuple[list[photo_ai.Item], list[tuple[int, list[int]]]]:
    items, videos = album_items(event_id, s)
    return items, photo_ai.duplicate_groups([i for i in items if i.id not in videos])


@api.get("/events/{event_id}/duplicates")
def duplicates(event_id: int, user: User = Depends(current_user), s: Session = Depends(db)):
    """Near-duplicate groups: the sharpest shot is kept, the rest are listed as dropped."""
    member_event(event_id, user, s)
    groups = [{"keep": keep, "drop": drop} for keep, drop in duplicate_pairs(event_id, s)[1]]
    return {"groups": groups, "hidden": sum(len(g["drop"]) for g in groups)}


@api.get("/events/{event_id}/search")
def search_photos(
    event_id: int,
    q: str = Query(min_length=1, max_length=200),
    all: bool = False,
    k: int = Query(12, ge=1, le=100),
    user: User = Depends(current_user),
    s: Session = Depends(db),
):
    """Photos and videos (by poster frame) matching a text query, best first. Duplicates are skipped unless `all` is set."""
    member_event(event_id, user, s)
    items, groups = duplicate_pairs(event_id, s)
    skip = set() if all else {d for _, drop in groups for d in drop}
    return {"results": [{"id": i, "score": round(score, 4)} for i, score in photo_ai.search_items(items, q.strip(), k, skip)]}


@api.get("/codes/{code}")
def preview_code(code: str, user: User = Depends(current_user), s: Session = Depends(db)):
    e = event_by_code(code, s)
    return {**event_out(e, user), "joined": s.get(Member, (e.id, user.id)) is not None}


@api.get("/codes/{code}/teaser")
def code_teaser(code: str, s: Session = Depends(db)):
    """Public: what a guest sees on the sign-in screen after scanning. Cover and counts only, never the photos."""
    e = event_by_code(code, s)
    return {
        "title": e.title,
        "starts_at": e.starts_at.isoformat(),
        "ends_at": e.ends_at.isoformat(),
        "cover_url": get_url(e.cover_key) if e.cover_key else None,
        "photos": s.scalar(select(func.count()).where(Photo.event_id == e.id)),
        "people": s.scalar(select(func.count()).where(Member.event_id == e.id)),
    }


@api.post("/codes/{code}/join")
def join(code: str, user: User = Depends(current_user), s: Session = Depends(db)):
    e = event_by_code(code, s)
    if not s.get(Member, (e.id, user.id)):
        s.add(Member(event_id=e.id, user_id=user.id))
        s.commit()
    return {"id": e.id}


app.include_router(api)
