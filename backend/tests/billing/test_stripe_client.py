"""Tests for billing/stripe_client.py — Stripe integration."""
import pytest
from unittest.mock import patch, MagicMock
import stripe


class TestCreateCheckoutSession:
    @patch("billing.stripe_client.stripe.checkout.Session.create")
    def test_standard_plan(self, mock_create):
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/session123"
        mock_create.return_value = mock_session

        from billing.stripe_client import create_checkout_session
        url = create_checkout_session("u-1", "a@b.com", None, "standard")

        assert url == "https://checkout.stripe.com/session123"
        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["metadata"]["plan"] == "standard"
        assert call_kwargs["customer_email"] == "a@b.com"
        assert "customer" not in call_kwargs

    @patch("billing.stripe_client.stripe.checkout.Session.create")
    def test_pro_plan(self, mock_create):
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/pro123"
        mock_create.return_value = mock_session

        from billing.stripe_client import create_checkout_session
        url = create_checkout_session("u-1", "a@b.com", None, "pro")

        assert url == "https://checkout.stripe.com/pro123"

    @patch("billing.stripe_client.stripe.checkout.Session.create")
    def test_with_existing_customer_id(self, mock_create):
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/existing"
        mock_create.return_value = mock_session

        from billing.stripe_client import create_checkout_session
        url = create_checkout_session("u-1", "a@b.com", "cus_existing", "standard")

        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["customer"] == "cus_existing"
        assert "customer_email" not in call_kwargs


class TestConstructWebhookEvent:
    @patch("billing.stripe_client.stripe.Webhook.construct_event")
    def test_valid_signature(self, mock_construct):
        expected_event = {"type": "checkout.session.completed", "data": {}}
        mock_construct.return_value = expected_event

        from billing.stripe_client import construct_webhook_event
        result = construct_webhook_event(b"payload", "sig_header")

        assert result == expected_event

    @patch("billing.stripe_client.stripe.Webhook.construct_event")
    def test_invalid_signature(self, mock_construct):
        mock_construct.side_effect = stripe.error.SignatureVerificationError("bad sig", "sig")

        from billing.stripe_client import construct_webhook_event
        with pytest.raises(stripe.error.SignatureVerificationError):
            construct_webhook_event(b"payload", "bad_sig")
