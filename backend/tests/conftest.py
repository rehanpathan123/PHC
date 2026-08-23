"""Pytest fixtures — named SQLite test database shared across connections."""
import os
import tempfile

# Point to a temp file DB so all connections share the same data
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
TEST_DB_PATH = _tmp_db.name
TEST_DB_URL = f"sqlite:///{TEST_DB_PATH}"

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["JWT_SECRET"] = "test-secret-phcsync"
os.environ["REDIS_URL"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import after env vars are set
from app.db import Base, get_db
from app.main import app
from app.seed import run_seed

_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
_TestSession = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

# Create tables and seed
Base.metadata.create_all(bind=_engine)
with _TestSession() as s:
    run_seed(s)


def override_get_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def asha_token(client):
    resp = client.post("/api/auth/login", json={"email": "asha@phcsync.demo", "password": "Demo@123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


@pytest.fixture(scope="session")
def officer_token(client):
    resp = client.post("/api/auth/login", json={"email": "officer@phcsync.demo", "password": "Demo@123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/api/auth/login", json={"email": "admin@phcsync.demo", "password": "Demo@123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]
