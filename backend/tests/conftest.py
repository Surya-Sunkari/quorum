import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set required env vars before any app imports
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("JWT_EXPIRY_DAYS", "30")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-supabase-key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_fake")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_fake")
os.environ.setdefault("STRIPE_STANDARD_PRICE_ID", "price_standard_test")
os.environ.setdefault("STRIPE_PRO_PRICE_ID", "price_pro_test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-openai")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("GEMINI_API_KEY", "AIza-test-gemini")
os.environ.setdefault("FRONTEND_URL", "https://quorum.app")


@pytest.fixture
def app():
    """Create Flask test application."""
    # Reset the Supabase singleton so tests don't share state
    import auth.db as db_mod
    db_mod._client = None

    with patch("auth.db.create_client") as mock_create:
        mock_create.return_value = MagicMock()
        from app import app as flask_app
        flask_app.config["TESTING"] = True
        yield flask_app


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def sample_user():
    """Sample user dict as returned from Supabase."""
    return {
        "id": "user-uuid-1234",
        "google_id": "google-id-5678",
        "email": "test@example.com",
        "tier": "free",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "subscription_status": None,
    }


@pytest.fixture
def sample_standard_user():
    return {
        "id": "user-uuid-std",
        "google_id": "google-id-std",
        "email": "standard@example.com",
        "tier": "standard",
        "stripe_customer_id": "cus_standard",
        "stripe_subscription_id": "sub_standard",
        "subscription_status": "active",
    }


@pytest.fixture
def sample_pro_user():
    return {
        "id": "user-uuid-pro",
        "google_id": "google-id-pro",
        "email": "pro@example.com",
        "tier": "pro",
        "stripe_customer_id": "cus_pro",
        "stripe_subscription_id": "sub_pro",
        "subscription_status": "active",
    }


@pytest.fixture
def valid_jwt(sample_user):
    """Issue a real JWT for testing."""
    from auth.jwt_utils import issue_jwt
    return issue_jwt(
        user_id=sample_user["id"],
        email=sample_user["email"],
        tier=sample_user["tier"],
    )


@pytest.fixture
def auth_headers(valid_jwt):
    """Authorization headers with a valid JWT."""
    return {"Authorization": f"Bearer {valid_jwt}"}


@pytest.fixture
def mock_supabase():
    """Patch the Supabase singleton and return the mock client."""
    import auth.db as db_mod
    mock_client = MagicMock()
    db_mod._client = mock_client
    yield mock_client
    db_mod._client = None
