"""Group near-duplicate photos and pick the best one per group."""
import numpy as np

from .features import Photo


def group_duplicates(
    photos: list[Photo],
    embeddings: np.ndarray,
    *,
    phash_max_dist: int = 4,
    time_window: float = 180.0,
    min_similarity: float = 0.90,
    unknown_time_similarity: float = 0.95,
) -> list[list[int]]:
    """Return groups of indices (singletons included).

    Two photos are linked if their perceptual hashes are nearly identical
    (re-sent / recompressed copies), or if they show the same scene: taken close
    in time with very similar CLIP embeddings, or, when either photo has no
    capture time, an even higher similarity. Embeddings must be L2-normalised.
    """
    n = len(photos)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    sims = embeddings @ embeddings.T
    for i in range(n):
        for j in range(i + 1, n):
            same_hash = photos[i].phash - photos[j].phash <= phash_max_dist
            ti, tj = photos[i].taken_at, photos[j].taken_at
            if ti is None or tj is None:
                same_scene = sims[i, j] >= unknown_time_similarity
            else:
                same_scene = abs(ti - tj) <= time_window and sims[i, j] >= min_similarity
            if same_hash or same_scene:
                parent[find(i)] = find(j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def quality(photo: Photo) -> float:
    return photo.sharpness * photo.pixels**0.5


def pick_best(photos: list[Photo], group: list[int]) -> int:
    return max(group, key=lambda i: quality(photos[i]))


def keepers(photos: list[Photo], groups: list[list[int]]) -> list[int]:
    return sorted(pick_best(photos, g) for g in groups)
