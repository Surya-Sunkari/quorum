from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from enum import Enum


class Status(str, Enum):
    CONSENSUS_REACHED = "consensus_reached"
    NEEDS_RECONCILE = "needs_reconcile"
    BEST_EFFORT = "best_effort"


class ModelConfig(BaseModel):
    """Configuration for a single model in mixed-model mode."""
    model: str = Field(..., description="Model in format 'provider:model-name'")
    count: int = Field(..., ge=1, le=10, description="Number of agents to spawn with this model")

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        valid_prefixes = ("openai:", "anthropic:", "gemini:")
        if not any(v.startswith(prefix) for prefix in valid_prefixes):
            raise ValueError("Model must start with 'openai:', 'anthropic:', or 'gemini:'")
        return v


class ApiKeys(BaseModel):
    """API keys for each provider."""
    openai: Optional[str] = Field(default=None, description="OpenAI API key")
    anthropic: Optional[str] = Field(default=None, description="Anthropic API key")
    gemini: Optional[str] = Field(default=None, description="Google Gemini API key")


class AskRequest(BaseModel):
    question: str = Field(default="", max_length=10000)
    image: Optional[str] = Field(default=None, description="Base64 encoded image data URL")
    n_agents: int = Field(default=3, ge=1, le=10)
    agreement_ratio: float = Field(default=0.67, ge=0.0, le=1.0)
    max_rounds: int = Field(default=2, ge=0, le=5)
    model: str = Field(default="openai:gpt-4.1-mini")
    api_key: str = Field(default="", description="API key for single-model mode")
    return_agent_outputs: bool = Field(default=False)

    # Mixed-model mode fields
    mixed_models: Optional[list[ModelConfig]] = Field(
        default=None,
        description="List of model configurations for mixed-model mode"
    )
    api_keys: Optional[ApiKeys] = Field(
        default=None,
        description="API keys for each provider (required for mixed-model mode)"
    )

    @field_validator("question")
    @classmethod
    def validate_question_or_image(cls, v, info):
        # Question can be empty if image is provided
        return v

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        valid_prefixes = ("openai:", "anthropic:", "gemini:")
        if not any(v.startswith(prefix) for prefix in valid_prefixes):
            raise ValueError("Model must start with 'openai:', 'anthropic:', or 'gemini:'")
        return v

    @model_validator(mode="after")
    def validate_api_keys_provided(self):
        """Ensure appropriate API keys are provided based on mode."""
        if self.mixed_models:
            # Mixed-model mode: need api_keys object
            if not self.api_keys:
                raise ValueError("api_keys is required for mixed-model mode")

            # Check that API keys are provided for each used provider
            providers_needed = set()
            for mc in self.mixed_models:
                provider = mc.model.split(":")[0]
                providers_needed.add(provider)

            for provider in providers_needed:
                key = getattr(self.api_keys, provider, None)
                if not key:
                    raise ValueError(f"API key for {provider} is required (used in mixed_models)")
        else:
            # Single-model mode: need api_key
            if not self.api_key:
                raise ValueError("api_key is required for single-model mode")

        return self

    def get_total_agents(self) -> int:
        """Get total number of agents across all models."""
        if self.mixed_models:
            return sum(mc.count for mc in self.mixed_models)
        return self.n_agents

    def is_mixed_mode(self) -> bool:
        """Check if this request is in mixed-model mode."""
        return self.mixed_models is not None and len(self.mixed_models) > 0


class AgentOutput(BaseModel):
    agent_id: int
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    assumptions: list[str] = Field(default_factory=list)
    short_rationale: str = ""
    model: str = Field(default="", description="Model used by this agent")


class ArbiterResult(BaseModel):
    status: Status
    agreement_ratio: float
    winning_cluster_size: int
    consensus_answer: str
    disagreement_summary: str = ""
    reconcile_instructions: str = ""
    cluster_assignments: list[int] = Field(default_factory=list)


class AskResponse(BaseModel):
    status: str
    answer: str
    agreement_ratio_achieved: float
    agreement_threshold: float
    winning_cluster_size: int
    n_agents: int
    rounds_used: int
    confidence: float
    disagreement_summary: str = ""
    agent_outputs: list[AgentOutput] = Field(default_factory=list)
