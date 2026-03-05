"""Tests for providers/anthropic_provider.py — Anthropic Claude provider."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from providers.anthropic_provider import AnthropicProvider


@pytest.fixture
def provider():
    with patch("providers.anthropic_provider.anthropic.AsyncAnthropic"):
        return AnthropicProvider(api_key="sk-ant-test", model="anthropic:claude-haiku-4-5")


class TestInit:
    def test_strips_prefix(self, provider):
        assert provider.model == "claude-haiku-4-5"


class TestBuildUserContent:
    def test_text_only(self, provider):
        content = provider._build_user_content("Hello")
        assert content == "Hello"

    def test_text_with_image(self, provider):
        content = provider._build_user_content("Describe", "data:image/png;base64,abc123")
        assert isinstance(content, list)
        assert len(content) == 2
        assert content[0] == {"type": "text", "text": "Describe"}
        assert content[1]["type"] == "image"
        assert content[1]["source"]["type"] == "base64"
        assert content[1]["source"]["media_type"] == "image/png"
        assert content[1]["source"]["data"] == "abc123"

    def test_jpeg_image(self, provider):
        content = provider._build_user_content("Look", "data:image/jpeg;base64,xyz")
        assert content[1]["source"]["media_type"] == "image/jpeg"

    def test_non_data_url_image(self, provider):
        # If image doesn't start with "data:", the image block is not added
        content = provider._build_user_content("Hello", "https://example.com/img.png")
        assert isinstance(content, list)
        assert len(content) == 1  # Only text, no image block


class TestGenerate:
    @pytest.mark.asyncio
    async def test_returns_content_and_usage(self, provider):
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "Hello World"
        mock_response.usage.input_tokens = 10
        mock_response.usage.output_tokens = 5
        provider.client.messages.create = AsyncMock(return_value=mock_response)

        result = await provider.generate("Hi")

        assert result["content"] == "Hello World"
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["usage"]["total_tokens"] == 15


class TestGenerateJson:
    @pytest.mark.asyncio
    async def test_parses_json(self, provider):
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = '{"answer": "42"}'
        provider.client.messages.create = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("What is 6*7?")
        assert result == {"answer": "42"}

    @pytest.mark.asyncio
    async def test_appends_json_instruction_to_system(self, provider):
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = '{"answer": "42"}'
        provider.client.messages.create = AsyncMock(return_value=mock_response)

        await provider.generate_json("test", system_prompt="Be precise")

        call_kwargs = provider.client.messages.create.call_args[1]
        assert "valid JSON only" in call_kwargs["system"]
        assert "Be precise" in call_kwargs["system"]

    @pytest.mark.asyncio
    async def test_extracts_json_from_markdown(self, provider):
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = '```json\n{"answer": "yes"}\n```'
        provider.client.messages.create = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("test")
        assert result == {"answer": "yes"}

    @pytest.mark.asyncio
    async def test_raises_on_unparseable(self, provider):
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = "just text"
        provider.client.messages.create = AsyncMock(return_value=mock_response)

        with pytest.raises(ValueError, match="Failed to parse JSON"):
            await provider.generate_json("test")


class TestValidateKey:
    @pytest.mark.asyncio
    async def test_valid(self, provider):
        provider.client.models.list = AsyncMock(return_value=[])
        assert await provider.validate_key() is True

    @pytest.mark.asyncio
    async def test_invalid(self, provider):
        provider.client.models.list = AsyncMock(side_effect=Exception("Unauthorized"))
        assert await provider.validate_key() is False
