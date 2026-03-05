"""Tests for billing/routes.py — Billing API routes."""
import pytest
from unittest.mock import patch, MagicMock
import stripe
from auth.jwt_utils import issue_jwt


@pytest.fixture
def free_user():
    return {"id": "u-1", "email": "a@b.com", "tier": "free", "stripe_customer_id": None}


@pytest.fixture
def pro_user():
    return {"id": "u-2", "email": "pro@b.com", "tier": "pro", "stripe_customer_id": "cus_pro"}


class TestCreateCheckout:
    @patch("billing.routes.create_checkout_session", return_value="https://checkout.stripe.com/s1")
    @patch("auth.middleware.get_monthly_usage", return_value=0)
    @patch("auth.middleware.get_user_by_id")
    def test_free_user_can_upgrade(self, mock_get_user, mock_usage, mock_checkout, client, free_user):
        mock_get_user.return_value = free_user
        token = issue_jwt(free_user["id"], free_user["email"], "free")

        resp = client.post(
            "/billing/create-checkout",
            json={"plan": "standard"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["checkout_url"] == "https://checkout.stripe.com/s1"

    @patch("auth.middleware.get_monthly_usage", return_value=0)
    @patch("auth.middleware.get_user_by_id")
    def test_paid_user_gets_400(self, mock_get_user, mock_usage, client, pro_user):
        mock_get_user.return_value = pro_user
        token = issue_jwt(pro_user["id"], pro_user["email"], "pro")

        resp = client.post(
            "/billing/create-checkout",
            json={"plan": "pro"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "Already" in resp.get_json()["error"]

    def test_no_auth(self, client):
        resp = client.post("/billing/create-checkout", json={"plan": "standard"})
        assert resp.status_code == 401


class TestStripeWebhook:
    @patch("billing.routes.update_user_tier")
    @patch("billing.routes.set_stripe_customer_id")
    @patch("billing.routes.construct_webhook_event")
    def test_checkout_completed(self, mock_event, mock_set_cus, mock_update, client):
        mock_event.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "cus_new",
                    "metadata": {"user_id": "u-1", "plan": "standard"},
                }
            },
        }
        resp = client.post(
            "/billing/webhook",
            data=b"payload",
            headers={"Stripe-Signature": "sig"},
        )
        assert resp.status_code == 200
        mock_set_cus.assert_called_once_with("u-1", "cus_new")
        mock_update.assert_called_once_with(stripe_customer_id="cus_new", tier="standard")

    @patch("billing.routes.update_user_tier")
    @patch("billing.routes.construct_webhook_event")
    def test_subscription_updated_active(self, mock_event, mock_update, client):
        mock_event.return_value = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": "cus_1",
                    "status": "active",
                    "id": "sub_1",
                    "metadata": {"plan": "pro"},
                }
            },
        }
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 200
        mock_update.assert_called_once_with(
            stripe_customer_id="cus_1", tier="pro",
            subscription_id="sub_1", subscription_status="active",
        )

    @patch("billing.routes.update_user_tier")
    @patch("billing.routes.construct_webhook_event")
    def test_subscription_deleted(self, mock_event, mock_update, client):
        mock_event.return_value = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": "cus_1"}},
        }
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 200
        mock_update.assert_called_once_with(
            stripe_customer_id="cus_1", tier="free",
            subscription_id=None, subscription_status="canceled",
        )

    @patch("billing.routes.construct_webhook_event")
    def test_unknown_event_ignored(self, mock_event, client):
        mock_event.return_value = {
            "type": "invoice.paid",
            "data": {"object": {}},
        }
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 200

    @patch("billing.routes.construct_webhook_event")
    def test_invalid_signature(self, mock_event, client):
        mock_event.side_effect = stripe.error.SignatureVerificationError("bad", "sig")
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "bad"})
        assert resp.status_code == 400
        assert "signature" in resp.get_json()["error"].lower()

    @patch("billing.routes.update_user_tier")
    @patch("billing.routes.construct_webhook_event")
    def test_subscription_updated_canceled_reverts_to_free(self, mock_event, mock_update, client):
        mock_event.return_value = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": "cus_1",
                    "status": "canceled",
                    "id": "sub_1",
                    "metadata": {"plan": "standard"},
                }
            },
        }
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 200
        mock_update.assert_called_once_with(
            stripe_customer_id="cus_1", tier="free",
            subscription_id="sub_1", subscription_status="canceled",
        )

    @patch("billing.routes.update_user_tier")
    @patch("billing.routes.set_stripe_customer_id")
    @patch("billing.routes.construct_webhook_event")
    def test_checkout_completed_pro_plan(self, mock_event, mock_set_cus, mock_update, client):
        mock_event.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "cus_pro",
                    "metadata": {"user_id": "u-2", "plan": "pro"},
                }
            },
        }
        resp = client.post("/billing/webhook", data=b"payload", headers={"Stripe-Signature": "sig"})
        assert resp.status_code == 200
        mock_update.assert_called_once_with(stripe_customer_id="cus_pro", tier="pro")
