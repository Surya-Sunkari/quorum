"""Tests for providers/__init__.py — Provider factory."""
import pytest
from providers import get_provider
from providers.openai_provider import OpenAIProvider
from providers.anthropic_provider import AnthropicProvider
from providers.gemini_provider import GeminiProvider


class TestGetProvider:
    def test_openai_provider(self):
        provider = get_provider("openai:gpt-4.1-mini", "sk-test")
        assert isinstance(provider, OpenAIProvider)

    def test_anthropic_provider(self):
        provider = get_provider("anthropic:claude-haiku-4-5", "sk-ant-test")
        assert isinstance(provider, AnthropicProvider)

    def test_gemini_provider(self):
        provider = get_provider("gemini:gemini-2.5-flash", "AIza-test")
        assert isinstance(provider, GeminiProvider)

    def test_unknown_provider_raises(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("unknown:model", "key")

    def test_openai_strips_prefix(self):
        provider = get_provider("openai:gpt-4.1-mini", "sk-test")
        assert provider.model == "gpt-4.1-mini"

    def test_anthropic_strips_prefix(self):
        provider = get_provider("anthropic:claude-haiku-4-5", "sk-ant-test")
        assert provider.model == "claude-haiku-4-5"

    def test_gemini_strips_prefix(self):
        provider = get_provider("gemini:gemini-2.5-flash", "AIza-test")
        assert provider.model_name == "gemini-2.5-flash"
