import asyncio
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pydantic import ValidationError

from schemas.models import AskRequest, AskResponse
from orchestration.orchestrator import Orchestrator
from providers import get_provider

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for extension requests

# Server-side limits (can be overridden by env vars)
MAX_AGENTS = int(os.getenv("MAX_AGENTS", "10"))
MAX_ROUNDS = int(os.getenv("MAX_ROUNDS", "5"))


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/validate-key", methods=["POST"])
def validate_key():
    """Validate an API key for any supported provider."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    api_key = data.get("api_key")
    provider_name = data.get("provider", "openai")

    if not api_key:
        return jsonify({"error": "api_key is required"}), 400

    # Map provider name to a dummy model string for get_provider
    provider_models = {
        "openai": "openai:gpt-4.1-mini",
        "anthropic": "anthropic:claude-3-5-haiku-20241022",
        "gemini": "gemini:gemini-2.0-flash",
    }

    if provider_name not in provider_models:
        return jsonify({"valid": False, "error": f"Unknown provider: {provider_name}"}), 400

    try:
        provider = get_provider(model=provider_models[provider_name], api_key=api_key)
        # Run async validation in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        is_valid = loop.run_until_complete(provider.validate_key())
        loop.close()

        if is_valid:
            return jsonify({"valid": True})
        else:
            return jsonify({"valid": False, "error": "Invalid API key"}), 401
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 400


@app.route("/ask", methods=["POST"])
def ask():
    """
    Main endpoint for asking questions to the multi-agent system.

    SECURITY NOTE:
    - API key is received in request body
    - Key is never persisted or logged
    - Key is only used for the duration of this request
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    # Validate request
    try:
        ask_request = AskRequest(**data)
    except ValidationError as e:
        errors = []
        for err in e.errors():
            field = ".".join(str(x) for x in err["loc"])
            msg = err["msg"]
            errors.append(f"{field}: {msg}")
        return jsonify({"error": "Validation failed", "details": errors}), 400

    # Enforce server-side limits
    if ask_request.n_agents > MAX_AGENTS:
        return jsonify({
            "error": f"n_agents exceeds server limit of {MAX_AGENTS}"
        }), 400

    if ask_request.max_rounds > MAX_ROUNDS:
        return jsonify({
            "error": f"max_rounds exceeds server limit of {MAX_ROUNDS}"
        }), 400

    # Run orchestration
    try:
        orchestrator = Orchestrator(ask_request)

        # Run async orchestration in sync Flask context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(orchestrator.run())
        loop.close()

        return jsonify(response.model_dump())

    except Exception as e:
        import traceback
        error_msg = str(e)
        error_type = type(e).__name__

        # Get traceback but sanitize API keys
        tb = traceback.format_exc()
        if "sk-" in tb:
            tb = "Traceback hidden (contains API key)"

        # Sanitize error message
        if "sk-" in error_msg:
            error_msg = "Authentication error - please check your API key"

        return jsonify({
            "error": "Failed to process request",
            "error_type": error_type,
            "details": error_msg,
            "traceback": tb
        }), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    print(f"Starting Quorum backend on {host}:{port}")
    print(f"Debug mode: {debug}")

    app.run(host=host, port=port, debug=debug)
