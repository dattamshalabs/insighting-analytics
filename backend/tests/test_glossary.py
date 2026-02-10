"""Tests for glossary CRUD endpoints."""

import pytest


class TestGlossaryList:
    """Tests for GET /glossary"""

    def test_list_empty(self, client, auth_headers):
        """Test listing glossary when empty."""
        response = client.get("/glossary", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_requires_auth(self, client):
        """Test glossary listing requires authentication."""
        response = client.get("/glossary")
        assert response.status_code == 401


class TestGlossaryCreate:
    """Tests for POST /glossary"""

    def test_create_term(self, client, auth_headers):
        """Test creating a glossary term."""
        response = client.post(
            "/glossary",
            headers=auth_headers,
            json={
                "term": "revenue",
                "sql_expression": "SUM(amount)",
                "description": "Total revenue from sales",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["term"] == "revenue"
        assert data["sql_expression"] == "SUM(amount)"
        assert data["description"] == "Total revenue from sales"
        assert "id" in data
        assert "created_at" in data

    def test_create_duplicate_term_fails(self, client, auth_headers):
        """Test creating duplicate term fails."""
        # Create first term
        client.post(
            "/glossary",
            headers=auth_headers,
            json={"term": "revenue", "sql_expression": "SUM(amount)"},
        )

        # Try to create duplicate
        response = client.post(
            "/glossary",
            headers=auth_headers,
            json={"term": "revenue", "sql_expression": "SUM(sales)"},
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_create_without_description(self, client, auth_headers):
        """Test creating term without description succeeds."""
        response = client.post(
            "/glossary",
            headers=auth_headers,
            json={"term": "cost", "sql_expression": "SUM(expense)"},
        )
        assert response.status_code == 201
        assert response.json()["description"] is None


class TestGlossaryUpdate:
    """Tests for PUT /glossary/{id}"""

    def test_update_term(self, client, auth_headers):
        """Test updating a glossary term."""
        # Create term
        create_response = client.post(
            "/glossary",
            headers=auth_headers,
            json={"term": "revenue", "sql_expression": "SUM(amount)"},
        )
        term_id = create_response.json()["id"]

        # Update it
        response = client.put(
            f"/glossary/{term_id}",
            headers=auth_headers,
            json={"sql_expression": "SUM(total_amount)"},
        )
        assert response.status_code == 200
        assert response.json()["sql_expression"] == "SUM(total_amount)"
        assert response.json()["term"] == "revenue"

    def test_update_nonexistent_term(self, client, auth_headers):
        """Test updating nonexistent term fails."""
        response = client.put(
            "/glossary/nonexistent-id",
            headers=auth_headers,
            json={"sql_expression": "SUM(amount)"},
        )
        assert response.status_code == 404


class TestGlossaryDelete:
    """Tests for DELETE /glossary/{id}"""

    def test_delete_term(self, client, auth_headers):
        """Test deleting a glossary term."""
        # Create term
        create_response = client.post(
            "/glossary",
            headers=auth_headers,
            json={"term": "revenue", "sql_expression": "SUM(amount)"},
        )
        term_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/glossary/{term_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        list_response = client.get("/glossary", headers=auth_headers)
        assert len(list_response.json()) == 0

    def test_delete_nonexistent_term(self, client, auth_headers):
        """Test deleting nonexistent term fails."""
        response = client.delete("/glossary/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404
