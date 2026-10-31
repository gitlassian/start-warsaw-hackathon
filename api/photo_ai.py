"""Duplicate detection and semantic search for event albums.

Pure analysis only: no database, no S3. main.py feeds it bytes and stores the results.
"""
import io
from dataclasses import dataclass

import imagehash
import numpy as np
from PIL import Image, ImageOps

from gather import dedup, search
from gather.embedder import Embedder
from gather.features import Photo as PhotoFeatures
from gather.features import exif_time, laplacian_variance

embedder = Embedder()


@dataclass
class Analysis:
    phash: str
    sharpness: float
    pixels: int
    taken_at: float | None  # EXIF capture time, None when the original carries none
    embedding: bytes


def analyze(thumb: bytes, head: bytes | None = None) -> Analysis:
    """`thumb` is the decodable image (the 600px thumbnail, or the original if there is none).
    `head` is the start of the original file: enough for its EXIF time and true dimensions."""
    with Image.open(io.BytesIO(thumb)) as raw:
        img = ImageOps.exif_transpose(raw)
        img.load()
    taken_at, pixels = None, img.width * img.height
    if head:
        try:
            with Image.open(io.BytesIO(head)) as original:
                taken_at = exif_time(original)
                pixels = original.width * original.height
        except Exception:  # truncated or undecodable header: fall back to the thumbnail's numbers
            pass
    vector = embedder.embed_pil([img])[0].astype(np.float32)
    return Analysis(str(imagehash.phash(img)), laplacian_variance(img), pixels, taken_at, vector.tobytes())


@dataclass
class Item:
    id: int
    phash: str
    sharpness: float
    pixels: int
    taken_at: float | None
    embedding: bytes


def _split(items: list[Item]) -> tuple[list[PhotoFeatures], np.ndarray]:
    photos = [
        PhotoFeatures(
            taken_at=i.taken_at,
            phash=imagehash.hex_to_hash(i.phash),
            sharpness=i.sharpness,
            pixels=i.pixels,
        )
        for i in items
    ]
    vectors = np.stack([np.frombuffer(i.embedding, dtype=np.float32) for i in items])
    return photos, vectors


def duplicate_groups(items: list[Item]) -> list[tuple[int, list[int]]]:
    """(kept photo id, [dropped photo ids]) for every group of near-duplicates."""
    if not items:
        return []
    photos, vectors = _split(items)
    out = []
    for group in dedup.group_duplicates(photos, vectors):
        if len(group) > 1:
            best = dedup.pick_best(photos, group)
            out.append((items[best].id, sorted(items[i].id for i in group if i != best)))
    return sorted(out)


# CLIP ViT-B/32 scores sit in a narrow band: about 0.2 for unrelated pictures, 0.23 to 0.29 for a real match.
# Show only what actually matches, so "pizza" in an album with no pizza finds nothing instead of twelve random photos.
MIN_SCORE = 0.22  # the best result must reach this, or nothing is shown
WINDOW = 0.04  # ...and only results this close to the best one are kept


def search_items(items: list[Item], query: str, k: int, skip: set[int]) -> list[tuple[int, float]]:
    """Photos that match `query`, best first; ids in `skip` are left out."""
    candidates = [n for n, i in enumerate(items) if i.id not in skip]
    if not candidates:
        return []
    _, vectors = _split(items)
    hits = search.top_k(vectors, embedder.embed_text(query), k, candidates)
    if not hits or hits[0][1] < MIN_SCORE:
        return []
    best = hits[0][1]
    return [(items[n].id, score) for n, score in hits if score >= best - WINDOW]
