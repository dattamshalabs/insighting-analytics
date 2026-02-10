"""Pytest configuration and fixtures for backend tests."""

import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Set test environment before importing app modules
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ENCRYPTION_KEY"] = "test-encryption-key-for-testing-only=="

from app.main import app
from app.core.database import Base, get_db
from app.models.orm import User
from app.services.auth import hash_password, create_access_token


# In-memory SQLite for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_engine():
    """Create a fresh test database engine for each test."""
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_db(test_engine):
    """Create a database session for testing."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(test_engine, test_db):
    """Create a test client with the test database."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(test_db) -> User:
    """Create a test user and return it."""
    user = User(
        email="test@example.com",
        password_hash=hash_password("password123"),
        role="user",
        is_active=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def admin_user(test_db) -> User:
    """Create an admin user and return it."""
    user = User(
        email="admin@example.com",
        password_hash=hash_password("adminpass123"),
        role="admin",
        is_active=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    """Generate auth headers for the test user."""
    token = create_access_token({
        "sub": test_user.id,
        "email": test_user.email,
        "role": test_user.role,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(admin_user) -> dict:
    """Generate auth headers for the admin user."""
    token = create_access_token({
        "sub": admin_user.id,
        "email": admin_user.email,
        "role": admin_user.role,
    })
    return {"Authorization": f"Bearer {token}"}
