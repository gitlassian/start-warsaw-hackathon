"""Cheap per-photo features: capture time, perceptual hash, sharpness."""
from dataclasses import dataclass
from pathlib import Path

import imagehash
import numpy as np
from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

_EXIF_IFD = 0x8769
_DATETIME_ORIGINAL = 0x9003
_DATETIME = 0x0132
_SHARPNESS_SIDE = 512


@dataclass
class Photo:
    taken_at: float | None  # unix seconds; None when the photo carries no capture time
    phash: imagehash.ImageHash
    sharpness: float
    pixels: int
    path: Path | None = None


def list_photos(folder: Path) -> list[Path]:
    return sorted(
        p
        for p in Path(folder).rglob("*")
        if p.suffix.lower() in IMAGE_EXTS and not p.name.startswith(".")
    )


def exif_time(img: Image.Image) -> float | None:
    from datetime import datetime

    exif = img.getexif()
    raw = exif.get_ifd(_EXIF_IFD).get(_DATETIME_ORIGINAL) or exif.get(_DATETIME)
    if not raw:
        return None
    try:
        return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S").timestamp()
    except ValueError:
        return None


def laplacian_variance(img: Image.Image) -> float:
    """Variance of the Laplacian on a downscaled grayscale copy; higher = sharper."""
    gray = img.convert("L")
    gray.thumbnail((_SHARPNESS_SIDE, _SHARPNESS_SIDE))
    a = np.asarray(gray, dtype=np.float32)
    lap = (
        -4 * a[1:-1, 1:-1]
        + a[:-2, 1:-1]
        + a[2:, 1:-1]
        + a[1:-1, :-2]
        + a[1:-1, 2:]
    )
    return float(lap.var())


def analyze(path: Path) -> Photo:
    with Image.open(path) as raw:
        taken_at = exif_time(raw)
        img = ImageOps.exif_transpose(raw)
        img.load()
    return Photo(
        path=Path(path),
        taken_at=taken_at if taken_at is not None else Path(path).stat().st_mtime,
        phash=imagehash.phash(img),
        sharpness=laplacian_variance(img),
        pixels=img.width * img.height,
    )
