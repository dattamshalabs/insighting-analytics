"""Tests for authentication endpoints."""

import pytest


class TestAuthRegister:
    """Tests for POST /auth/register"""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/auth/register",
            json={"email": "newuser@example.com", "password": "password123"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "user"
        assert data["is_active"] is True
        assert "id" in data

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email fails."""
        response = client.post(
            "/auth/register",
            json={"email": test_user.email, "password": "password123"},
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_short_password(self, client):
        """Test registration with short password fails validation."""
        response = client.post(
            "/auth/register",
            json={"email": "newuser@example.com", "password": "short"},
        )
        assert response.status_code == 422

    def test_register_invalid_email(self, client):
        """Test registration with invalid email fails validation."""
        response = client.post(
            "/auth/register",
            json={"email": "not-an-email", "password": "password123"},
        )
        assert response.status_code == 422


class TestAuthLogin:
    """Tests for POST /auth/login"""

    def test_login_success(self, client, test_user):
        """Test successful login returns tokens."""
        response = client.post(
            "/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    def test_login_wrong_password(self, client, test_user):
        """Test login with wrong password fails."""
        response = client.post(
            "/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        """Test login with nonexistent email fails."""
        response = client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "password123"},
        )
        assert response.status_code == 401


class TestAuthMe:
    """Tests for GET /auth/me"""

    def test_get_me_authenticated(self, client, test_user, auth_headers):
        """Test getting current user when authenticated."""
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["id"] == test_user.id

    def test_get_me_unauthenticated(self, client):
        """Test getting current user without auth fails."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self, client):
        """Test getting current user with invalid token fails."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401


class TestAuthRefresh:
    """Tests for POST /auth/refresh"""

    def test_refresh_success(self, client, test_user):
        """Test refreshing tokens works."""
        # First login to get tokens
        login_response = client.post(
            "/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        refresh_token = login_response.json()["refresh_token"]

        # Then refresh
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_invalid_token(self, client):
        """Test refresh with invalid token fails."""
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": "invalid-refresh-token"},
        )
        assert response.status_code == 401


class TestProtectedEndpoints:
    """Tests for endpoint protection."""

    def test_datasources_requires_auth(self, client):
        """Test datasources endpoint requires authentication."""
        response = client.get("/datasources")
        assert response.status_code == 401

    def test_chat_requires_auth(self, client):
        """Test chat endpoint requires authentication."""
        response = client.post("/chat", json={"query": "test"})
        assert response.status_code == 401

    def test_admin_requires_admin_role(self, client, auth_headers):
        """Test admin endpoints require admin role."""
        response = client.get("/admin/logs/llm", headers=auth_headers)
        assert response.status_code == 403

    def test_admin_accessible_to_admin(self, client, admin_auth_headers):
        """Test admin endpoints accessible to admin users."""
        response = client.get("/admin/logs/llm", headers=admin_auth_headers)
        assert response.status_code == 200
