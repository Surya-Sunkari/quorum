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
    Create a Stripe Checkout session for upgrading to Standard or Pro.
    Request body: { "plan": "standard" | "pro" }
    Returns { "checkout_url": "https://checkout.stripe.com/..." }
    """
    user = g.user

    if user["tier"] in ("standard", "pro"):
        return jsonify({"error": "Already on a paid tier"}), 400

    body = request.get_json(silent=True) or {}
    plan = body.get("plan", "standard")
    if plan not in ("standard", "pro"):
        plan = "standard"

    try:
        checkout_url = create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            stripe_customer_id=user.get("stripe_customer_id"),
            plan=plan,
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
        # Link the Stripe customer ID to our user, then set the correct tier.
        # subscription.created fires before this event, so the customer_id isn't
        # on the user row yet when that handler runs — we must set the tier here.
        meta = data.get("metadata", {})
        user_id = meta.get("user_id")
        customer_id = data.get("customer")
        plan = meta.get("plan", "standard")
        tier = "pro" if plan == "pro" else "standard"
        if user_id and customer_id:
            set_stripe_customer_id(user_id, customer_id)
            update_user_tier(stripe_customer_id=customer_id, tier=tier)

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = data.get("customer")
        status = data.get("status")
        subscription_id = data.get("id")
        plan = data.get("metadata", {}).get("plan", "standard")
        if status in ("active", "trialing"):
            tier = "pro" if plan == "pro" else "standard"
        else:
            tier = "free"
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
