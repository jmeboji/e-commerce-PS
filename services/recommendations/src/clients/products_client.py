import httpx
from pydantic import BaseModel

from src.config import settings


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


async def get_product_by_id(product_id: str) -> ProductResponse | None:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{settings.products_service_url}/products/{product_id}")

    if res.status_code == 404:
        return None

    res.raise_for_status()
    return ProductResponse.model_validate(res.json())


async def list_products() -> list[ProductResponse]:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{settings.products_service_url}/products")

    res.raise_for_status()
    return [ProductResponse.model_validate(item) for item in res.json()]
