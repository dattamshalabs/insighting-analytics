"""Tests for alerts CRUD endpoints."""

import pytest


class TestAlertsList:
    """Tests for GET /alerts"""

    def test_list_empty(self, client, auth_headers):
        """Test listing alerts when empty."""
        response = client.get("/alerts", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_requires_auth(self, client):
        """Test alerts listing requires authentication."""
        response = client.get("/alerts")
        assert response.status_code == 401


class TestAlertsCreate:
    """Tests for POST /alerts"""

    def test_create_alert(self, client, auth_headers):
        """Test creating an alert."""
        response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "High Error Rate",
                "query": "SELECT COUNT(*) FROM errors WHERE created_at > NOW() - INTERVAL '1 hour'",
                "threshold_condition": "result > 100",
                "cron_expression": "0 * * * *",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "High Error Rate"
        assert data["threshold_condition"] == "result > 100"
        assert data["enabled"] is True
        assert "id" in data

    def test_create_alert_with_webhook(self, client, auth_headers):
        """Test creating an alert with webhook URL."""
        response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "Sales Alert",
                "query": "SELECT SUM(amount) FROM sales WHERE date = CURRENT_DATE",
                "threshold_condition": "result < 1000",
                "cron_expression": "0 18 * * *",
                "webhook_url": "https://hooks.example.com/alert",
            },
        )
        assert response.status_code == 201
        assert response.json()["webhook_url"] == "https://hooks.example.com/alert"

    def test_create_alert_disabled(self, client, auth_headers):
        """Test creating a disabled alert."""
        response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "Disabled Alert",
                "query": "SELECT 1",
                "threshold_condition": "result > 0",
                "enabled": False,
            },
        )
        assert response.status_code == 201
        assert response.json()["enabled"] is False

    def test_create_alert_invalid_cron(self, client, auth_headers):
        """Test creating alert with invalid cron fails validation."""
        response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "Invalid Cron Alert",
                "query": "SELECT 1",
                "threshold_condition": "result > 0",
                "cron_expression": "invalid cron",
            },
        )
        assert response.status_code == 422


class TestAlertsUpdate:
    """Tests for PUT /alerts/{id}"""

    def test_update_alert(self, client, auth_headers):
        """Test updating an alert."""
        # Create alert
        create_response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "Test Alert",
                "query": "SELECT COUNT(*) FROM users",
                "threshold_condition": "result > 100",
            },
        )
        alert_id = create_response.json()["id"]

        # Update it
        response = client.put(
            f"/alerts/{alert_id}",
            headers=auth_headers,
            json={"name": "Updated Alert", "enabled": False},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Alert"
        assert response.json()["enabled"] is False

    def test_update_nonexistent_alert(self, client, auth_headers):
        """Test updating nonexistent alert fails."""
        response = client.put(
            "/alerts/nonexistent-id",
            headers=auth_headers,
            json={"name": "New Name"},
        )
        assert response.status_code == 404


class TestAlertsDelete:
    """Tests for DELETE /alerts/{id}"""

    def test_delete_alert(self, client, auth_headers):
        """Test deleting an alert."""
        # Create alert
        create_response = client.post(
            "/alerts",
            headers=auth_headers,
            json={
                "name": "To Delete",
                "query": "SELECT 1",
                "threshold_condition": "result > 0",
            },
        )
        alert_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/alerts/{alert_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        list_response = client.get("/alerts", headers=auth_headers)
        assert len(list_response.json()) == 0

    def test_delete_nonexistent_alert(self, client, auth_headers):
        """Test deleting nonexistent alert fails."""
        response = client.delete("/alerts/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404
