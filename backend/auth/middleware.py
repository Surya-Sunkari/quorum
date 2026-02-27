from functools import wraps
from datetime import datetime, timezone
from flask import request, jsonify, g
import jwt as pyjwt

from .jwt_utils import verify_jwt
from .db import get_user_by_id, get_monthly_usage

FREE_TIER_MODELS = {
    "openai:gpt-4.1-mini",
    "anthropic:claude-haiku-4-5",
    "gemini:gemini-2.5-flash",
}

FREE_TIER_MONTHLY_LIMIT = 20


def current_period() -> str:
    """Return the current billing period as 'YYYY-MM'."""
    return datetime.now(tz=timezone.utc).strftime("%Y-%m")


def _extract_models(data: dict) -> set:
    """Extract all model IDs from a parsed /ask request body."""
    models = set()
    if data.get("mixed_models"):
        for entry in data["mixed_models"]:
            if entry.get("model"):
                models.add(entry["model"])
    else:
        if data.get("model"):
            models.add(data["model"])
    return models


def require_auth(f):
    """
    Decorator that enforces authentication and free-tier limits on a Flask route.

    1. Extracts Bearer JWT from Authorization header → 401 if missing
    2. Verifies JWT signature/expiry → 401 if invalid
    3. Loads fresh user from DB → 401 if not found
    4. Sets flask.g.user to the user row dict
    5. For free users:
       - Checks requested models against FREE_TIER_MODELS → 403 UPGRADE_REQUIRED
       - Checks monthly usage against FREE_TIER_MONTHLY_LIMIT → 429 USAGE_LIMIT_REACHED
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({
                "error": "Authentication required",
                "code": "AUTH_REQUIRED",
            }), 401

        token = auth_header[len("Bearer "):]

        try:
            payload = verify_jwt(token)
        except pyjwt.ExpiredSignatureError:
            return jsonify({
                "error": "Session expired, please sign in again",
                "code": "TOKEN_EXPIRED",
            }), 401
        except pyjwt.InvalidTokenError:
            return jsonify({
                "error": "Invalid session token",
                "code": "INVALID_TOKEN",
            }), 401

        # Load fresh user to pick up any tier changes from Stripe webhooks
        user = get_user_by_id(payload["user_id"])
        if not user:
            return jsonify({
                "error": "User not found",
                "code": "USER_NOT_FOUND",
            }), 401

        g.user = user
        tier = user["tier"]

        if tier == "free":
            data = request.get_json(silent=True) or {}
            requested_models = _extract_models(data)
            disallowed = requested_models - FREE_TIER_MODELS
            if disallowed:
                return jsonify({
                    "error": "One or more models require a paid subscription. Upgrade to access all models.",
                    "code": "UPGRADE_REQUIRED",
                    "disallowed_models": list(disallowed),
                }), 403

            period = current_period()
            usage = get_monthly_usage(user["id"], period)
            if usage >= FREE_TIER_MONTHLY_LIMIT:
                return jsonify({
                    "error": f"You've reached the free tier limit of {FREE_TIER_MONTHLY_LIMIT} uses this month. Upgrade for unlimited access.",
                    "code": "USAGE_LIMIT_REACHED",
                    "usage": usage,
                    "limit": FREE_TIER_MONTHLY_LIMIT,
                }), 429

        return f(*args, **kwargs)

    return decorated
