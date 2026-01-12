from .base import BaseProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .gemini_provider import GeminiProvider


def get_provider(model: str, api_key: str) -> BaseProvider:
    """
    Factory function to get the appropriate provider based on model prefix.

    Model format: "provider:model-name"
    Examples:
        - "openai:gpt-4.1-mini"
        - "anthropic:claude-sonnet-4-20250514"
        - "gemini:gemini-2.5-flash"
    """
    if model.startswith("openai:"):
        return OpenAIProvider(api_key=api_key, model=model)
    elif model.startswith("anthropic:"):
        return AnthropicProvider(api_key=api_key, model=model)
    elif model.startswith("gemini:"):
        return GeminiProvider(api_key=api_key, model=model)
    else:
        raise ValueError(f"Unknown provider for model: {model}. Expected format: 'provider:model-name'")
