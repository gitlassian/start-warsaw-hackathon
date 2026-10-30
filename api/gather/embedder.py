"""CLIP embeddings. The multilingual text model shares the image model's space,
so queries in Russian (and ~50 other languages) match images directly."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

IMAGE_MODEL = "clip-ViT-B-32"
TEXT_MODEL = "sentence-transformers/clip-ViT-B-32-multilingual-v1"
DIM = 512


class Embedder:
    def __init__(self) -> None:
        self._image_model = None
        self._text_model = None

    def _image(self):
        if self._image_model is None:
            from sentence_transformers import SentenceTransformer

            self._image_model = SentenceTransformer(IMAGE_MODEL)
        return self._image_model

    def _text(self):
        if self._text_model is None:
            from sentence_transformers import SentenceTransformer

            self._text_model = SentenceTransformer(TEXT_MODEL)
        return self._text_model

    def warm_up(self) -> None:
        self._image()
        self._text()

    def embed_pil(self, images: list[Image.Image], batch_size: int = 16) -> np.ndarray:
        prepared = []
        for img in images:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((512, 512))
            prepared.append(img)
        out = [
            self._image().encode(
                prepared[i : i + batch_size], convert_to_numpy=True, normalize_embeddings=True
            )
            for i in range(0, len(prepared), batch_size)
        ]
        return np.concatenate(out) if out else np.zeros((0, DIM), dtype=np.float32)

    def embed_images(self, paths: list[Path], batch_size: int = 16) -> np.ndarray:
        images = []
        for p in paths:
            with Image.open(p) as raw:
                images.append(ImageOps.exif_transpose(raw).convert("RGB"))
        return self.embed_pil(images, batch_size)

    def embed_text(self, query: str) -> np.ndarray:
        return self._text().encode(
            [query], convert_to_numpy=True, normalize_embeddings=True
        )[0]
