import json
import re
from typing import Any
from openai import AsyncOpenAI
from .base import BaseProvider


class OpenAIProvider(BaseProvider):
    """OpenAI provider implementation."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        # Extract model name from "openai:model-name" format
        if model.startswith("openai:"):
            model = model[7:]
        self.model = model
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
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
    ) -> dict[str, Any]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
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
