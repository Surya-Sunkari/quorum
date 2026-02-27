import os
import httpx

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_token(access_token: str) -> dict:
    """
    Verify a Google OAuth implicit-flow access token via Google's tokeninfo endpoint.

    Returns dict with keys: google_id, email.
    Raises ValueError if the token is invalid, expired, or issued for a different client.
    """
    expected_client_id = os.environ.get("GOOGLE_CLIENT_ID")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_TOKENINFO_URL,
            params={"access_token": access_token},
            timeout=10.0,
        )

    if resp.status_code != 200:
        raise ValueError(f"Google token verification failed: {resp.text}")

    info = resp.json()

    if "error" in info:
        raise ValueError(f"Invalid Google token: {info['error']}")

    # Validate audience matches our client ID
    if expected_client_id and info.get("aud") != expected_client_id:
        raise ValueError("Token audience does not match the application client ID")

    email_verified = info.get("email_verified", "false")
    if email_verified == "false" or email_verified is False:
        raise ValueError("Google account email is not verified")

    return {
        "google_id": info["sub"],
        "email": info["email"],
    }
