"""Tests for providers/gemini_provider.py — Google Gemini provider."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from providers.gemini_provider import GeminiProvider


@pytest.fixture
def provider():
    with patch("providers.gemini_provider.genai.Client"):
        return GeminiProvider(api_key="AIza-test", model="gemini:gemini-2.5-flash")


class TestInit:
    def test_strips_prefix(self, provider):
        assert provider.model_name == "gemini-2.5-flash"


class TestBuildContent:
    def test_text_only(self, provider):
        parts = provider._build_content("Hello")
        assert len(parts) == 1
        assert parts[0] == "Hello"

    @patch("providers.gemini_provider.types.Part.from_bytes")
    def test_text_with_image(self, mock_from_bytes, provider):
        mock_part = MagicMock()
        mock_from_bytes.return_value = mock_part

        parts = provider._build_content("Describe", "data:image/png;base64,dGVzdA==")

        assert len(parts) == 2
        assert parts[1] == "Describe"
        mock_from_bytes.assert_called_once()

    def test_no_image_without_data_prefix(self, provider):
        parts = provider._build_content("Hello", "https://example.com/img.png")
        assert len(parts) == 1


class TestGenerate:
    @pytest.mark.asyncio
    async def test_returns_content_and_usage(self, provider):
        mock_response = MagicMock()
        mock_response.text = "Hello World"
        mock_response.usage_metadata = MagicMock()
        mock_response.usage_metadata.prompt_token_count = 10
        mock_response.usage_metadata.candidates_token_count = 5
        mock_response.usage_metadata.total_token_count = 15
        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        result = await provider.generate("Hi")

        assert result["content"] == "Hello World"
        assert result["usage"]["total_tokens"] == 15

    @pytest.mark.asyncio
    async def test_handles_no_usage_metadata(self, provider):
        mock_response = MagicMock()
        mock_response.text = "Hello"
        mock_response.usage_metadata = None
        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        result = await provider.generate("Hi")
        assert result["usage"] == {}


class TestGenerateJson:
    @pytest.mark.asyncio
    async def test_parses_json(self, provider):
        mock_response = MagicMock()
        mock_response.text = '{"answer": "42"}'
        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("What is 6*7?")
        assert result == {"answer": "42"}

    @pytest.mark.asyncio
    async def test_extracts_json_from_markdown(self, provider):
        mock_response = MagicMock()
        mock_response.text = '```json\n{"answer": "42"}\n```'
        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        result = await provider.generate_json("test")
        assert result == {"answer": "42"}

    @pytest.mark.asyncio
    async def test_raises_on_unparseable(self, provider):
        mock_response = MagicMock()
        mock_response.text = "not json"
        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        with pytest.raises(ValueError, match="Failed to parse JSON"):
            await provider.generate_json("test")


class TestValidateKey:
    @pytest.mark.asyncio
    async def test_valid(self, provider):
        provider.client.aio.models.list = AsyncMock(return_value=[])
        assert await provider.validate_key() is True

    @pytest.mark.asyncio
    async def test_invalid(self, provider):
        provider.client.aio.models.list = AsyncMock(side_effect=Exception("Unauthorized"))
        assert await provider.validate_key() is False
