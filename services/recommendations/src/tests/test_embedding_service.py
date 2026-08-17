import math

from src.models import EMBEDDING_DIM
from src.services.embedding_service import embed


def test_embed_returns_a_vector_of_the_expected_dimension():
    vector = embed("a comfortable pair of running shoes")
    assert len(vector) == EMBEDDING_DIM


def test_embed_is_deterministic_for_the_same_input():
    # Loose snapshot: same model, same input, no dropout at inference — the
    # output should be stable, but pin it with a tolerance rather than exact
    # float equality so this doesn't chase BLAS-level nondeterminism.
    first = embed("a comfortable pair of running shoes")
    second = embed("a comfortable pair of running shoes")
    assert len(first) == len(second) == EMBEDDING_DIM
    assert all(math.isclose(a, b, abs_tol=1e-6) for a, b in zip(first, second))


def test_embed_puts_similar_text_closer_than_dissimilar_text():
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b)

    shoes = embed("running shoes for jogging")
    sneakers = embed("sneakers for a morning run")
    laptop = embed("a high-performance gaming laptop")

    assert cosine_similarity(shoes, sneakers) > cosine_similarity(shoes, laptop)
