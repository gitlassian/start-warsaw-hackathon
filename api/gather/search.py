"""Cosine-similarity search over normalised embeddings."""
import numpy as np


def top_k(
    embeddings: np.ndarray,
    query_vec: np.ndarray,
    k: int = 5,
    candidates: list[int] | None = None,
) -> list[tuple[int, float]]:
    """Return (index, score) pairs, best first. `candidates` restricts the search."""
    idx = np.arange(len(embeddings)) if candidates is None else np.asarray(candidates)
    if len(idx) == 0:
        return []
    scores = embeddings[idx] @ query_vec
    order = np.argsort(-scores)[:k]
    return [(int(idx[o]), float(scores[o])) for o in order]
