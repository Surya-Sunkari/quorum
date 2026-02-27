import asyncio
from flask import Blueprint, request, jsonify, g

from .google import verify_google_token
from .db import upsert_user, get_monthly_usage
from .jwt_utils import issue_jwt
from .middleware import require_auth, FREE_TIER_MONTHLY_LIMIT, current_period

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/google", methods=["POST"])
def google_auth():
    """
    Exchange a Google OAuth access token for a Quorum session JWT.

    Request body: { "access_token": "ya29...." }
    Response:     { "token": "<jwt>", "user": { "id", "email", "tier" } }
    """
    data = request.get_json()
    if not data or not data.get("access_token"):
        return jsonify({"error": "access_token is required"}), 400

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        google_user = loop.run_until_complete(verify_google_token(data["access_token"]))
        loop.close()
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

    user = upsert_user(
        google_id=google_user["google_id"],
        email=google_user["email"],
    )

    token = issue_jwt(
        user_id=user["id"],
        email=user["email"],
        tier=user["tier"],
    )

    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "tier": user["tier"],
        },
    })


@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    """
    Return the current user's profile and usage info.

    Response: { "email", "tier", "usage": { "count", "limit", "period" } }
    """
    user = g.user
    period = current_period()
    count = get_monthly_usage(user["id"], period)
    limit = FREE_TIER_MONTHLY_LIMIT if user["tier"] == "free" else None

    return jsonify({
        "email": user["email"],
        "tier": user["tier"],
        "usage": {
            "count": count,
            "limit": limit,
            "period": period,
        },
    })
