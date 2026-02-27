import os
import stripe


def _configure():
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")


def create_checkout_session(user_id: str, email: str, stripe_customer_id: str | None) -> str:
    """
    Create a Stripe Checkout session for the $10/month subscription.
    Returns the session URL to redirect the user to.
    """
    _configure()
    price_id = os.environ["STRIPE_PRICE_ID"]

    params: dict = {
        "payment_method_types": ["card"],
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": "https://quorum.app/success?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": "https://quorum.app/cancel",
        "metadata": {"user_id": user_id},
        "subscription_data": {
            "metadata": {"user_id": user_id},
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
