"""Tests for auth/routes.py — Auth API routes."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestGoogleAuth:
    def test_missing_access_token(self, client):
        resp = client.post("/auth/google", json={})
        assert resp.status_code == 400
        assert "access_token" in resp.get_json()["error"]

    def test_no_body(self, client):
        resp = client.post("/auth/google", content_type="application/json")
        assert resp.status_code == 400

    @patch("auth.routes.issue_jwt", return_value="jwt-token-123")
    @patch("auth.routes.upsert_user")
    @patch("auth.routes.verify_google_token")
    def test_successful_auth(self, mock_verify, mock_upsert, mock_jwt, client):
        mock_verify.return_value = {"google_id": "g-1", "email": "a@b.com"}
        mock_upsert.return_value = {"id": "u-1", "email": "a@b.com", "tier": "free"}

        resp = client.post("/auth/google", json={"access_token": "valid-token"})

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["token"] == "jwt-token-123"
        assert data["user"]["email"] == "a@b.com"
        assert data["user"]["tier"] == "free"

    @patch("auth.routes.verify_google_token", side_effect=ValueError("Invalid token"))
    def test_invalid_google_token(self, mock_verify, client):
        resp = client.post("/auth/google", json={"access_token": "bad-token"})
        assert resp.status_code == 401
        assert "Invalid token" in resp.get_json()["error"]


class TestMe:
    def test_no_auth(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_returns_user_info(self, mock_get_user, mock_usage, client, sample_user, valid_jwt):
        mock_get_user.return_value = sample_user
        # Also patch the route's get_monthly_usage
        with patch("auth.routes.get_monthly_usage", return_value=5):
            resp = client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {valid_jwt}"},
            )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["email"] == "test@example.com"
        assert data["tier"] == "free"
        assert data["usage"]["count"] == 5
        assert data["usage"]["limit"] == 20
