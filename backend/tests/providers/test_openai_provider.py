"""Tests for providers/openai_provider.py — OpenAI provider."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from providers.openai_provider import OpenAIProvider


@pytest.fixture
def provider():
    with patch("providers.openai_provider.AsyncOpenAI"):
        return OpenAIProvider(api_key="sk-test", model="openai:gpt-4.1-mini")


@pytest.fixture
def gpt5_provider():
    with patch("providers.openai_provider.AsyncOpenAI"):
        return OpenAIProvider(api_key="sk-test", model="openai:gpt-5.2")


@pytest.fixture
def gpt5_mini_provider():
    with patch("providers.openai_provider.AsyncOpenAI"):
        return OpenAIProvider(api_key="sk-test", model="openai:gpt-5-mini")


class TestModelParams:
    def test_strips_openai_prefix(self, provider):
        assert provider.model == "gpt-4.1-mini"

    def test_uses_new_token_param_gpt5(self, gpt5_provider):
        assert gpt5_provider._uses_new_token_param() is True

    def test_uses_old_token_param_gpt4(self, provider):
        assert provider._uses_new_token_param() is False

    def test_supports_temperature_gpt4(self, provider):
        assert provider._supports_temperature() is True

    def test_no_temperature_gpt5_mini(self, gpt5_mini_provider):
        assert gpt5_mini_provider._supports_temperature() is False


class TestBuildUserContent:
    def test_text_only(self, provider):
        content = provider._build_user_content("Hello")
        assert content == "Hello"

    def test_text_with_image(self, provider):
        content = provider._build_user_content("Describe", "data:image/png;base64,abc")
        assert isinstance(content, list)
        assert len(content) == 2
        assert content[0] == {"type": "text", "text": "Describe"}
        assert content[1]["type"] == "image_url"

    def test_image_only(self, provider):
        content = provider._build_user_content("", "data:image/png;base64,abc")
        assert isinstance(content, list)
        # No text part when prompt is empty
        assert len(content) == 1
        assert content[0]["type"] == "image_url"


class TestGenerate:
    @pytest.mark.asyncio
    async def test_returns_content_and_usage(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello World"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 5
        mock_response.usage.total_tokens = 15
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await provider.generate("Hi")

        assert result["content"] == "Hello World"
        assert result["usage"]["total_tokens"] == 15

    @pytest.mark.asyncio
    async def test_passes_system_prompt(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "response"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 5
        mock_response.usage.total_tokens = 15
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        await provider.generate("Hi", system_prompt="Be helpful")

        call_kwargs = provider.client.chat.completions.create.call_args[1]
        assert call_kwargs["messages"][0]["role"] == "system"
        assert call_kwargs["messages"][0]["content"] == "Be helpful"


class TestGenerateJson:
    @pytest.mark.asyncio
    async def test_parses_json_response(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"answer": "42"}'
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("What is 6*7?")

        assert result == {"answer": "42"}

    @pytest.mark.asyncio
    async def test_extracts_json_from_markdown_block(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '```json\n{"answer": "42"}\n```'
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("What is 6*7?")

        assert result == {"answer": "42"}

    @pytest.mark.asyncio
    async def test_raises_on_unparseable_response(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "not json at all"
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        with pytest.raises(ValueError, match="Failed to parse JSON"):
            await provider.generate_json("What is 6*7?")

    @pytest.mark.asyncio
    async def test_uses_json_response_format(self, provider):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"answer": "42"}'
        provider.client.chat.completions.create = AsyncMock(return_value=mock_response)

        await provider.generate_json("test")

        call_kwargs = provider.client.chat.completions.create.call_args[1]
        assert call_kwargs["response_format"] == {"type": "json_object"}


class TestValidateKey:
    @pytest.mark.asyncio
    async def test_valid_key(self, provider):
        provider.client.models.list = AsyncMock(return_value=[])
        assert await provider.validate_key() is True

    @pytest.mark.asyncio
    async def test_invalid_key(self, provider):
        provider.client.models.list = AsyncMock(side_effect=Exception("Unauthorized"))
        assert await provider.validate_key() is False
