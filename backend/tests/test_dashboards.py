"""Tests for dashboard endpoints."""

import pytest


class TestDashboardsList:
    """Tests for GET /dashboards"""

    def test_list_empty(self, client, auth_headers):
        """Test listing dashboards when empty."""
        response = client.get("/dashboards", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_requires_auth(self, client):
        """Test dashboards listing requires authentication."""
        response = client.get("/dashboards")
        assert response.status_code == 401


class TestDashboardsDelete:
    """Tests for DELETE /dashboards/{id}"""

    def test_delete_nonexistent_dashboard(self, client, auth_headers):
        """Test deleting nonexistent dashboard fails."""
        response = client.delete("/dashboards/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_requires_auth(self, client):
        """Test dashboard deletion requires authentication."""
        response = client.delete("/dashboards/some-id")
        assert response.status_code == 401


class TestDashboardsGet:
    """Tests for GET /dashboards/{id}"""

    def test_get_nonexistent_dashboard(self, client, auth_headers):
        """Test getting nonexistent dashboard fails."""
        response = client.get("/dashboards/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_get_requires_auth(self, client):
        """Test getting dashboard requires authentication."""
        response = client.get("/dashboards/some-id")
        assert response.status_code == 401
