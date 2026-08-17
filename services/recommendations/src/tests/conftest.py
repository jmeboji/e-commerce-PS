import pytest

from src.db import Base, SessionLocal, engine


@pytest.fixture(autouse=True, scope="session")
def _create_tables():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
