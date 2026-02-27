import os
from datetime import datetime, timedelta, timezone
import jwt


def _secret() -> str:
    s = os.environ.get("JWT_SECRET")
    if not s:
        raise RuntimeError("JWT_SECRET environment variable is not set")
    return s


def _expiry_days() -> int:
    return int(os.environ.get("JWT_EXPIRY_DAYS", "30"))


def issue_jwt(user_id: str, email: str, tier: str) -> str:
    """Issue a signed HS256 JWT containing user identity and tier."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "user_id": user_id,
        "email": email,
        "tier": tier,
        "iat": now,
        "exp": now + timedelta(days=_expiry_days()),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def verify_jwt(token: str) -> dict:
    """
    Decode and verify a JWT. Returns the payload dict.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(token, _secret(), algorithms=["HS256"])
