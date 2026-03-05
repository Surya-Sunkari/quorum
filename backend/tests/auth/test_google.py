"""Tests for auth/google.py — Google OAuth token verification."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from auth.google import verify_google_token


@pytest.fixture
def valid_google_response():
    return {
        "sub": "google-user-123",
        "email": "user@gmail.com",
        "aud": "test-client-id.apps.googleusercontent.com",
        "email_verified": "true",
    }


class TestVerifyGoogleToken:
    @pytest.mark.asyncio
    async def test_valid_token(self, valid_google_response):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = valid_google_response

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await verify_google_token("valid-google-token")

        assert result["google_id"] == "google-user-123"
        assert result["email"] == "user@gmail.com"

    @pytest.mark.asyncio
    async def test_invalid_token_http_error(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.text = "Invalid token"

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with pytest.raises(ValueError, match="verification failed"):
                await verify_google_token("bad-token")

    @pytest.mark.asyncio
    async def test_token_with_error_field(self, valid_google_response):
        response_data = {**valid_google_response, "error": "invalid_grant"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = response_data

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with pytest.raises(ValueError, match="Invalid Google token"):
                await verify_google_token("error-token")

    @pytest.mark.asyncio
    async def test_wrong_audience(self, valid_google_response):
        valid_google_response["aud"] = "other-client-id.apps.googleusercontent.com"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = valid_google_response

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with pytest.raises(ValueError, match="audience"):
                await verify_google_token("wrong-aud-token")

    @pytest.mark.asyncio
    async def test_unverified_email(self, valid_google_response):
        valid_google_response["email_verified"] = "false"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = valid_google_response

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with pytest.raises(ValueError, match="not verified"):
                await verify_google_token("unverified-token")

    @pytest.mark.asyncio
    async def test_unverified_email_boolean_false(self, valid_google_response):
        valid_google_response["email_verified"] = False
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = valid_google_response

        with patch("auth.google.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.return_value = mock_resp
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            with pytest.raises(ValueError, match="not verified"):
                await verify_google_token("unverified-bool-token")
