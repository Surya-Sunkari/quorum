from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    """
    Abstract base class for LLM providers.
    Designed for easy swap with Microsoft Agent Framework in the future.
    """

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        """
        Generate a response from the LLM.

        Returns:
            dict with 'content' (str) and 'usage' (dict) keys
        """
        pass

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        """
        Generate a JSON response from the LLM.

        Returns:
            Parsed JSON dict
        """
        pass

    @abstractmethod
    async def validate_key(self) -> bool:
        """
        Validate that the API key is valid.

        Returns:
            True if valid, False otherwise
        """
        pass
