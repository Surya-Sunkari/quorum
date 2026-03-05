"""Tests for auth/middleware.py — Authentication decorator and tier enforcement."""
import pytest
from unittest.mock import patch, MagicMock
from flask import Flask
from auth.middleware import (
    get_tier_limits, current_period, _extract_models, require_auth,
    FREE_TIER_MODELS, STANDARD_TIER_MODELS,
    FREE_TIER_MONTHLY_LIMIT, STANDARD_TIER_MONTHLY_LIMIT, PRO_TIER_MONTHLY_LIMIT,
)
from auth.jwt_utils import issue_jwt


@pytest.fixture
def test_app():
    app = Flask(__name__)
    app.config["TESTING"] = True

    @app.route("/protected", methods=["POST", "GET"])
    @require_auth
    def protected():
        from flask import g, jsonify
        return jsonify({"user_id": g.user["id"]})

    return app


class TestGetTierLimits:
    def test_free_tier(self):
        models, limit = get_tier_limits("free")
        assert models == FREE_TIER_MODELS
        assert limit == FREE_TIER_MONTHLY_LIMIT

    def test_standard_tier(self):
        models, limit = get_tier_limits("standard")
        assert models == STANDARD_TIER_MODELS
        assert limit == STANDARD_TIER_MONTHLY_LIMIT

    def test_pro_tier(self):
        models, limit = get_tier_limits("pro")
        assert models is None  # Pro has no model restrictions
        assert limit == PRO_TIER_MONTHLY_LIMIT

    def test_unknown_tier_treated_as_pro(self):
        models, limit = get_tier_limits("enterprise")
        assert models is None
        assert limit == PRO_TIER_MONTHLY_LIMIT


class TestCurrentPeriod:
    def test_returns_yyyy_mm_format(self):
        period = current_period()
        assert len(period) == 7
        assert period[4] == "-"
        year, month = period.split("-")
        assert 2020 <= int(year) <= 2030
        assert 1 <= int(month) <= 12


class TestExtractModels:
    def test_single_model(self):
        models = _extract_models({"model": "openai:gpt-4.1-mini"})
        assert models == {"openai:gpt-4.1-mini"}

    def test_mixed_models(self):
        data = {
            "mixed_models": [
                {"model": "openai:gpt-4.1-mini"},
                {"model": "anthropic:claude-haiku-4-5"},
            ]
        }
        models = _extract_models(data)
        assert models == {"openai:gpt-4.1-mini", "anthropic:claude-haiku-4-5"}

    def test_no_model(self):
        models = _extract_models({})
        assert models == set()

    def test_mixed_models_takes_precedence(self):
        data = {
            "model": "openai:gpt-4.1-mini",
            "mixed_models": [{"model": "anthropic:claude-haiku-4-5"}],
        }
        models = _extract_models(data)
        assert "openai:gpt-4.1-mini" not in models
        assert "anthropic:claude-haiku-4-5" in models


class TestRequireAuth:
    def test_missing_auth_header(self, test_app):
        with test_app.test_client() as client:
            resp = client.get("/protected")
            assert resp.status_code == 401
            assert resp.get_json()["code"] == "AUTH_REQUIRED"

    def test_invalid_bearer_format(self, test_app):
        with test_app.test_client() as client:
            resp = client.get("/protected", headers={"Authorization": "Basic abc"})
            assert resp.status_code == 401
            assert resp.get_json()["code"] == "AUTH_REQUIRED"

    def test_expired_token(self, test_app):
        import time, jwt as pyjwt, os
        payload = {
            "user_id": "u1", "email": "a@b.com", "tier": "free",
            "iat": time.time() - 200, "exp": time.time() - 100,
        }
        token = pyjwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")
        with test_app.test_client() as client:
            resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401
            assert resp.get_json()["code"] == "TOKEN_EXPIRED"

    def test_invalid_token(self, test_app):
        with test_app.test_client() as client:
            resp = client.get("/protected", headers={"Authorization": "Bearer invalid.jwt.token"})
            assert resp.status_code == 401
            assert resp.get_json()["code"] == "INVALID_TOKEN"

    @patch("auth.middleware.get_user_by_id", return_value=None)
    def test_user_not_found(self, mock_get_user, test_app):
        token = issue_jwt("nonexistent", "a@b.com", "free")
        with test_app.test_client() as client:
            resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401
            assert resp.get_json()["code"] == "USER_NOT_FOUND"

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_free_user_with_free_model_passes(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "free"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "free")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-4.1-mini"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_free_user_blocked_from_paid_model(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "free"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "free")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-5.2"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 403
            data = resp.get_json()
            assert data["code"] == "UPGRADE_REQUIRED"
            assert "openai:gpt-5.2" in data["disallowed_models"]

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_standard_user_blocked_from_pro_model(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "standard"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "standard")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-5.2"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 403

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_pro_user_can_use_any_model(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "pro"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "pro")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-5.2"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200

    @patch("auth.middleware.get_monthly_usage", return_value=20)
    @patch("auth.middleware.get_user_by_id")
    def test_free_user_at_usage_limit(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "free"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "free")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-4.1-mini"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 429
            data = resp.get_json()
            assert data["code"] == "USAGE_LIMIT_REACHED"
            assert data["limit"] == 20

    @patch("auth.middleware.get_monthly_usage", return_value=200)
    @patch("auth.middleware.get_user_by_id")
    def test_standard_user_at_usage_limit(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "standard"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "standard")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={"model": "openai:gpt-4.1-mini"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 429

    @patch("auth.middleware.get_monthly_usage", return_value=5)
    @patch("auth.middleware.get_user_by_id")
    def test_mixed_model_blocked_if_any_disallowed(self, mock_get_user, mock_usage, test_app):
        user = {"id": "u1", "email": "a@b.com", "tier": "free"}
        mock_get_user.return_value = user
        token = issue_jwt("u1", "a@b.com", "free")
        with test_app.test_client() as client:
            resp = client.post(
                "/protected",
                json={
                    "mixed_models": [
                        {"model": "openai:gpt-4.1-mini"},
                        {"model": "openai:gpt-5.2"},
                    ]
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 403
            assert "openai:gpt-5.2" in resp.get_json()["disallowed_models"]
