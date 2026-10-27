from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.clients import products_client
from src.clients.products_client import (
    ProductsUnavailableError,
    get_product_by_id,
    list_products,
)


def _fake_async_client(*, response=None, raises=None):
    """Stand in for httpx.AsyncClient used as an async context manager."""
    client = MagicMock()
    client.get = AsyncMock(return_value=response, side_effect=raises)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return MagicMock(return_value=ctx)


async def test_get_product_by_id_raises_products_unavailable_when_the_connection_fails(monkeypatch):
    # The regression this fixes: a ConnectError has no response to inspect,
    # so it used to sail past the 404 check and raise_for_status and surface
    # as an opaque 500 from /search.
    monkeypatch.setattr(
        products_client,
        "httpx",
        MagicMock(
            AsyncClient=_fake_async_client(raises=httpx.ConnectError("All connection attempts failed")),
            RequestError=httpx.RequestError,
        ),
    )

    with pytest.raises(ProductsUnavailableError) as excinfo:
        await get_product_by_id("prod-1")

    assert "Could not reach products service" in str(excinfo.value)


async def test_get_product_by_id_raises_products_unavailable_on_an_upstream_5xx(monkeypatch):
    monkeypatch.setattr(
        products_client.httpx,
        "AsyncClient",
        _fake_async_client(response=MagicMock(status_code=503)),
    )

    with pytest.raises(ProductsUnavailableError) as excinfo:
        await get_product_by_id("prod-1")

    assert "responded with 503" in str(excinfo.value)


async def test_get_product_by_id_still_returns_none_for_a_real_404(monkeypatch):
    # Unchanged contract: None means products was reached and said the
    # product is gone — a stale embedding row, not an outage.
    monkeypatch.setattr(
        products_client.httpx,
        "AsyncClient",
        _fake_async_client(response=MagicMock(status_code=404)),
    )

    assert await get_product_by_id("prod-gone") is None


async def test_get_product_by_id_returns_the_parsed_product_on_success(monkeypatch):
    payload = {
        "id": "prod-1",
        "name": "QuietMax Headphones",
        "description": "Wireless, noise-cancelling",
        "price": "149.99",
        "sku": "HEAD-1",
        "stock": 5,
    }
    res = MagicMock(status_code=200)
    res.json.return_value = payload
    monkeypatch.setattr(
        products_client.httpx, "AsyncClient", _fake_async_client(response=res)
    )

    product = await get_product_by_id("prod-1")

    assert product is not None
    assert product.name == "QuietMax Headphones"
    assert product.price == "149.99"


async def test_list_products_raises_products_unavailable_when_the_connection_fails(monkeypatch):
    # scripts/ingest_products.py depends on this path, so it gets the same
    # named error rather than a raw httpx exception.
    monkeypatch.setattr(
        products_client,
        "httpx",
        MagicMock(
            AsyncClient=_fake_async_client(raises=httpx.ConnectError("boom")),
            RequestError=httpx.RequestError,
        ),
    )

    with pytest.raises(ProductsUnavailableError):
        await list_products()
