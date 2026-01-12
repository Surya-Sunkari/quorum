import json
import re
import base64
from typing import Any
from google import genai
from google.genai import types
from .base import BaseProvider


class GeminiProvider(BaseProvider):
    """Google Gemini provider implementation using the new google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        # Extract model name from "gemini:model-name" format
        if model.startswith("gemini:"):
            model = model[7:]
        self.model_name = model
        self.client = genai.Client(api_key=api_key)

    def _build_content(self, prompt: str, image: str | None = None) -> list:
        """Build content parts, optionally with image."""
        parts = []

        if image and image.startswith("data:"):
            # Parse data URL: "data:image/png;base64,..."
            header, base64_data = image.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
            image_bytes = base64.b64decode(base64_data)
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

        if prompt:
            # In new SDK, just append strings directly or use Part with text kwarg
            parts.append(prompt)

        return parts

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        image: str | None = None,
    ) -> dict[str, Any]:
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=system_prompt if system_prompt else None,
        )

        contents = self._build_content(prompt, image)
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )

        # Extract usage if available
        usage = {}
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0),
                "completion_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0),
                "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0),
            }

        return {
            "content": response.text,
            "usage": usage,
        }

    async def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        image: str | None = None,
    ) -> dict[str, Any]:
        # Append JSON instruction to system prompt
        json_system = (system_prompt or "") + "\n\nYou must respond with valid JSON only. No markdown, no explanation, just the JSON object."

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=json_system,
            response_mime_type="application/json",
        )

        contents = self._build_content(prompt, image)
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )

        content_text = response.text
        try:
            return json.loads(content_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content_text)
            if json_match:
                return json.loads(json_match.group(1))
            raise ValueError(f"Failed to parse JSON response: {content_text[:200]}")

    async def validate_key(self) -> bool:
        try:
            await self.client.aio.models.list()
            return True
        except Exception:
            return False
