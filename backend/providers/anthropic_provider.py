import json
import re
from typing import Any
import anthropic
from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    """Anthropic Claude provider implementation."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-5"):
        # Extract model name from "anthropic:model-name" format
        if model.startswith("anthropic:"):
            model = model[10:]
        self.model = model
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    def _build_user_content(self, prompt: str, image: str | None = None) -> list | str:
        """Build user message content, optionally with image."""
        if not image:
            return prompt

        content = []
        if prompt:
            content.append({"type": "text", "text": prompt})

        # Parse data URL: "data:image/png;base64,..."
        if image.startswith("data:"):
            # Extract media type and base64 data
            header, base64_data = image.split(",", 1)
            media_type = header.split(":")[1].split(";")[0]
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_data,
                }
            })
        return content

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        image: str | None = None,
    ) -> dict[str, Any]:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": self._build_user_content(prompt, image)}],
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        # Only add temperature if not using extended thinking models
        if temperature is not None:
            kwargs["temperature"] = temperature

        response = await self.client.messages.create(**kwargs)

        return {
            "content": response.content[0].text,
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            },
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

        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": json_system,
            "messages": [{"role": "user", "content": self._build_user_content(prompt, image)}],
        }

        if temperature is not None:
            kwargs["temperature"] = temperature

        response = await self.client.messages.create(**kwargs)

        content = response.content[0].text
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if json_match:
                return json.loads(json_match.group(1))
            raise ValueError(f"Failed to parse JSON response: {content[:200]}")

    async def validate_key(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False
