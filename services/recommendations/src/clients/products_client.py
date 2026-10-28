import logging

import httpx
from pydantic import BaseModel

from src.config import settings

logger = logging.getLogger(__name__)


# Local type, not imported from the products service — same boundary rule
# every other cross-service client in this repo follows (see cart.client.ts,
# orders/clients/cart.client.ts).
class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: str
    sku: str
    stock: int


class ProductsUnavailableError(RuntimeError):
    """products could not be reached, or answered with a server error.

    Deliberately distinct from get_product_by_id returning None: None means
    products *was* reached and authoritatively said the product is gone,
    which search treats as a stale embedding row and skips. This means the
    catalog is unreachable, so no result set can be trusted to be complete.
    """


async def _fetch(path: str) -> httpx.Response:
    url = f"{settings.products_service_url}{path}"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
    except httpx.RequestError as e:
        # Connection refused / DNS failure / timeout. There is no response to
        # inspect, so this escapes both the 404 check and raise_for_status
        # below entirely — unhandled, it surfaced as an opaque 500 with the
        # real cause only visible in this service's own stdout.
        logger.error(f"products request to {url} failed: {e}")
        raise ProductsUnavailableError(
            f"Could not reach products service at {settings.products_service_url}: {e}"
        ) from e

    if res.status_code >= 500:
        # products is up but broken. Same conclusion for a caller as being
        # unreachable, and equally retryable, so it maps to the same error
        # rather than a generic HTTPStatusError.
        logger.error(f"products responded {res.status_code} for {url}")
        raise ProductsUnavailableError(
            f"Products service responded with {res.status_code}"
        )

    return res


async def get_product_by_id(product_id: str) -> ProductResponse | None:
    res = await _fetch(f"/products/{product_id}")

    if res.status_code == 404:
        return None

    res.raise_for_status()
    return ProductResponse.model_validate(res.json())


async def list_products() -> list[ProductResponse]:
    res = await _fetch("/products")

    res.raise_for_status()
    return [ProductResponse.model_validate(item) for item in res.json()]
