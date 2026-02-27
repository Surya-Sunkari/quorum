from flask import Blueprint, request, jsonify, g
import stripe as stripe_lib

from auth.middleware import require_auth
from auth.db import set_stripe_customer_id, update_user_tier
from billing.stripe_client import create_checkout_session, construct_webhook_event

billing_bp = Blueprint("billing", __name__, url_prefix="/billing")


@billing_bp.route("/create-checkout", methods=["POST"])
@require_auth
def create_checkout():
    """
    Create a Stripe Checkout session for upgrading to the paid tier.
    Returns { "checkout_url": "https://checkout.stripe.com/..." }
    """
    user = g.user

    if user["tier"] == "paid":
        return jsonify({"error": "Already on paid tier"}), 400

    try:
        checkout_url = create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            stripe_customer_id=user.get("stripe_customer_id"),
        )
    except Exception as e:
        return jsonify({"error": f"Failed to create checkout session: {e}"}), 500

    return jsonify({"checkout_url": checkout_url})


@billing_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """
    Handle Stripe webhook events to update user tier on subscription changes.
    Stripe must be configured to send events to this endpoint.
    """
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = construct_webhook_event(payload, sig_header)
    except stripe_lib.error.SignatureVerificationError:
        return jsonify({"error": "Invalid webhook signature"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        # Link the Stripe customer ID to our user
        user_id = data.get("metadata", {}).get("user_id")
        customer_id = data.get("customer")
        if user_id and customer_id:
            set_stripe_customer_id(user_id, customer_id)

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = data.get("customer")
        status = data.get("status")
        subscription_id = data.get("id")
        # Treat active and trialing as paid
        tier = "paid" if status in ("active", "trialing") else "free"
        if customer_id:
            update_user_tier(
                stripe_customer_id=customer_id,
                tier=tier,
                subscription_id=subscription_id,
                subscription_status=status,
            )

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            update_user_tier(
                stripe_customer_id=customer_id,
                tier="free",
                subscription_id=None,
                subscription_status="canceled",
            )

    return jsonify({"received": True})
