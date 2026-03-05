"""Tests for auth/jwt_utils.py — JWT issue and verify."""
import os
import time
import pytest
import jwt as pyjwt
from auth.jwt_utils import issue_jwt, verify_jwt


class TestIssueJwt:
    def test_returns_string_token(self):
        token = issue_jwt("user-1", "a@b.com", "free")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_payload_contains_required_fields(self):
        token = issue_jwt("user-1", "a@b.com", "free")
        payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        assert payload["user_id"] == "user-1"
        assert payload["email"] == "a@b.com"
        assert payload["tier"] == "free"
        assert "iat" in payload
        assert "exp" in payload

    def test_expiry_is_30_days_by_default(self):
        token = issue_jwt("user-1", "a@b.com", "free")
        payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        delta = payload["exp"] - payload["iat"]
        assert delta == 30 * 86400  # 30 days in seconds

    def test_custom_expiry_days(self):
        original = os.environ.get("JWT_EXPIRY_DAYS")
        os.environ["JWT_EXPIRY_DAYS"] = "7"
        try:
            token = issue_jwt("user-1", "a@b.com", "free")
            payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
            delta = payload["exp"] - payload["iat"]
            assert delta == 7 * 86400
        finally:
            if original:
                os.environ["JWT_EXPIRY_DAYS"] = original
            else:
                os.environ.pop("JWT_EXPIRY_DAYS", None)


class TestVerifyJwt:
    def test_valid_token(self):
        token = issue_jwt("user-1", "a@b.com", "pro")
        payload = verify_jwt(token)
        assert payload["user_id"] == "user-1"
        assert payload["tier"] == "pro"

    def test_expired_token(self):
        original = os.environ.get("JWT_EXPIRY_DAYS")
        os.environ["JWT_EXPIRY_DAYS"] = "0"
        try:
            # Create a token that expires immediately
            now = time.time()
            payload = {
                "user_id": "user-1",
                "email": "a@b.com",
                "tier": "free",
                "iat": now - 100,
                "exp": now - 50,
            }
            token = pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
            with pytest.raises(pyjwt.ExpiredSignatureError):
                verify_jwt(token)
        finally:
            if original:
                os.environ["JWT_EXPIRY_DAYS"] = original
            else:
                os.environ.pop("JWT_EXPIRY_DAYS", None)

    def test_tampered_token(self):
        token = issue_jwt("user-1", "a@b.com", "free")
        # Tamper with the token
        parts = token.split(".")
        parts[1] = parts[1] + "tampered"
        tampered = ".".join(parts)
        with pytest.raises(pyjwt.InvalidTokenError):
            verify_jwt(tampered)

    def test_wrong_secret(self):
        payload = {
            "user_id": "user-1",
            "email": "a@b.com",
            "tier": "free",
            "iat": time.time(),
            "exp": time.time() + 3600,
        }
        token = pyjwt.encode(payload, "wrong-secret", algorithm="HS256")
        with pytest.raises(pyjwt.InvalidTokenError):
            verify_jwt(token)

    def test_missing_jwt_secret(self):
        original = os.environ.pop("JWT_SECRET", None)
        try:
            with pytest.raises(RuntimeError, match="JWT_SECRET"):
                issue_jwt("user-1", "a@b.com", "free")
        finally:
            if original:
                os.environ["JWT_SECRET"] = original
