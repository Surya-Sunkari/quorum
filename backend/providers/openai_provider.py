import json
import re
from typing import Any
from openai import AsyncOpenAI
from .base import BaseProvider


class OpenAIProvider(BaseProvider):
    """OpenAI provider implementation."""

    # Models that require max_completion_tokens instead of max_tokens
    NEW_API_MODELS = ("gpt-5", "o3", "o1")

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        # Extract model name from "openai:model-name" format
        if model.startswith("openai:"):
            model = model[7:]
        self.model = model
        self.client = AsyncOpenAI(api_key=api_key)

    def _uses_new_token_param(self) -> bool:
        """Check if this model requires max_completion_tokens instead of max_tokens."""
        return any(self.model.startswith(prefix) for prefix in self.NEW_API_MODELS)

    def _build_user_content(self, prompt: str, image: str | None = None) -> list | str:
        """Build user message content, optionally with image."""
        if not image:
            return prompt

        content = []
        if prompt:
            content.append({"type": "text", "text": prompt})

        # Image should be a data URL like "data:image/png;base64,..."
        content.append({
            "type": "image_url",
            "image_url": {"url": image}
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
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": self._build_user_content(prompt, image)})

        # Use appropriate token parameter based on model
        token_param = "max_completion_tokens" if self._uses_new_token_param() else "max_tokens"

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            **{token_param: max_tokens},
        )

        return {
            "content": response.choices[0].message.content,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
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
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": self._build_user_content(prompt, image)})

        # Use appropriate token parameter based on model
        token_param = "max_completion_tokens" if self._uses_new_token_param() else "max_tokens"

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
            **{token_param: max_tokens},
        )

        content = response.choices[0].message.content
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
            # Make a minimal API call to validate the key
            await self.client.models.list()
            return True
        except Exception:
            return False
