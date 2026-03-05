"""Tests for auth/db.py — Supabase database operations."""
import pytest
from unittest.mock import MagicMock, patch
from auth.db import (
    upsert_user, get_user_by_id, get_monthly_usage,
    increment_usage, update_user_tier, set_stripe_customer_id,
)


@pytest.fixture
def mock_db():
    """Patch get_db to return a mock Supabase client."""
    mock_client = MagicMock()
    with patch("auth.db.get_db", return_value=mock_client):
        yield mock_client


class TestUpsertUser:
    def test_returns_user_data(self, mock_db):
        user_data = {"id": "uuid-1", "google_id": "g-1", "email": "a@b.com", "tier": "free"}
        mock_result = MagicMock()
        mock_result.data = [user_data]
        mock_db.table.return_value.upsert.return_value.execute.return_value = mock_result

        result = upsert_user("g-1", "a@b.com")

        assert result == user_data
        mock_db.table.assert_called_with("users")
        mock_db.table.return_value.upsert.assert_called_with(
            {"google_id": "g-1", "email": "a@b.com"},
            on_conflict="google_id",
        )


class TestGetUserById:
    def test_returns_user(self, mock_db):
        user_data = {"id": "uuid-1", "email": "a@b.com", "tier": "free"}
        mock_result = MagicMock()
        mock_result.data = user_data
        mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result

        result = get_user_by_id("uuid-1")
        assert result == user_data

    def test_returns_none_when_not_found(self, mock_db):
        mock_result = MagicMock()
        mock_result.data = None
        mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result

        result = get_user_by_id("nonexistent")
        assert result is None

    def test_returns_none_when_result_is_none(self, mock_db):
        mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = None

        result = get_user_by_id("nonexistent")
        assert result is None


class TestGetMonthlyUsage:
    def test_returns_count(self, mock_db):
        mock_result = MagicMock()
        mock_result.data = {"count": 15}
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result

        result = get_monthly_usage("uuid-1", "2026-03")
        assert result == 15

    def test_returns_zero_when_no_record(self, mock_db):
        mock_result = MagicMock()
        mock_result.data = None
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result

        result = get_monthly_usage("uuid-1", "2026-03")
        assert result == 0

    def test_returns_zero_when_result_is_none(self, mock_db):
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = None

        result = get_monthly_usage("uuid-1", "2026-03")
        assert result == 0


class TestIncrementUsage:
    def test_calls_rpc(self, mock_db):
        mock_result = MagicMock()
        mock_result.data = 16
        mock_db.rpc.return_value.execute.return_value = mock_result

        result = increment_usage("uuid-1", "2026-03")

        assert result == 16
        mock_db.rpc.assert_called_with(
            "increment_usage",
            {"p_user_id": "uuid-1", "p_period": "2026-03"},
        )


class TestUpdateUserTier:
    def test_updates_tier(self, mock_db):
        update_user_tier("cus_123", "pro")
        mock_db.table.assert_called_with("users")
        call_args = mock_db.table.return_value.update.call_args[0][0]
        assert call_args["tier"] == "pro"

    def test_includes_subscription_fields(self, mock_db):
        update_user_tier("cus_123", "standard", "sub_456", "active")
        call_args = mock_db.table.return_value.update.call_args[0][0]
        assert call_args["tier"] == "standard"
        assert call_args["stripe_subscription_id"] == "sub_456"
        assert call_args["subscription_status"] == "active"


class TestSetStripeCustomerId:
    def test_updates_stripe_customer_id(self, mock_db):
        set_stripe_customer_id("uuid-1", "cus_abc")
        mock_db.table.assert_called_with("users")
        call_args = mock_db.table.return_value.update.call_args[0][0]
        assert call_args["stripe_customer_id"] == "cus_abc"
