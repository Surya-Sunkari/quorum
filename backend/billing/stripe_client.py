import os
import stripe


def _configure():
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")


def create_checkout_session(
    user_id: str,
    email: str,
    stripe_customer_id: str | None,
    plan: str = "standard",
) -> str:
    """
    Create a Stripe Checkout session for the chosen plan.
    plan must be 'standard' or 'pro'.
    Returns the session URL to redirect the user to.
    """
    _configure()
    if plan == "pro":
        price_id = os.environ["STRIPE_PRO_PRICE_ID"]
    else:
        plan = "standard"
        price_id = os.environ["STRIPE_STANDARD_PRICE_ID"]

    params: dict = {
        "payment_method_types": ["card"],
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": "https://quorum.app/success?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": "https://quorum.app/cancel",
        "metadata": {"user_id": user_id, "plan": plan},
        "subscription_data": {
            "metadata": {"user_id": user_id, "plan": plan},
        },
    }

    if stripe_customer_id:
        params["customer"] = stripe_customer_id
    else:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """
    Verify and parse a Stripe webhook event.
    Raises stripe.error.SignatureVerificationError if the signature is invalid.
    """
    _configure()
    webhook_secret = os.environ["STRIPE_WEBHOOK_SECRET"]
    return stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
