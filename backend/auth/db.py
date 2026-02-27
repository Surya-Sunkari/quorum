import os
from datetime import datetime, timezone
from supabase import create_client, Client

_client: Client | None = None


def get_db() -> Client:
    """Return singleton Supabase client (service role key)."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SECRET_KEY"]
        _client = create_client(url, key)
    return _client


def upsert_user(google_id: str, email: str) -> dict:
    """
    Insert user if not exists, or update email if changed.
    Returns the full user row.
    """
    db = get_db()
    result = (
        db.table("users")
        .upsert(
            {"google_id": google_id, "email": email},
            on_conflict="google_id",
        )
        .execute()
    )
    return result.data[0]


def get_user_by_id(user_id: str) -> dict | None:
    """Fetch a user row by internal UUID."""
    db = get_db()
    result = (
        db.table("users")
        .select("*")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result is not None else None


def get_monthly_usage(user_id: str, period: str) -> int:
    """Return the current usage count for a user in the given YYYY-MM period."""
    db = get_db()
    result = (
        db.table("usage")
        .select("count")
        .eq("user_id", user_id)
        .eq("period", period)
        .maybe_single()
        .execute()
    )
    if result is None or result.data is None:
        return 0
    return result.data["count"]


def increment_usage(user_id: str, period: str) -> int:
    """
    Atomically increment the usage count for a user+period via Postgres RPC.
    Returns the new count.
    """
    db = get_db()
    result = db.rpc(
        "increment_usage",
        {"p_user_id": user_id, "p_period": period},
    ).execute()
    return result.data


def update_user_tier(
    stripe_customer_id: str,
    tier: str,
    subscription_id: str | None = None,
    subscription_status: str | None = None,
) -> None:
    """Update user tier and subscription info looked up by Stripe customer ID."""
    db = get_db()
    payload: dict = {"tier": tier}
    if subscription_id is not None:
        payload["stripe_subscription_id"] = subscription_id
    if subscription_status is not None:
        payload["subscription_status"] = subscription_status
    db.table("users").update(payload).eq("stripe_customer_id", stripe_customer_id).execute()


def set_stripe_customer_id(user_id: str, stripe_customer_id: str) -> None:
    """Store a Stripe customer ID on the user row."""
    db = get_db()
    db.table("users").update({"stripe_customer_id": stripe_customer_id}).eq("id", user_id).execute()
