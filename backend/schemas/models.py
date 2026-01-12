from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum


class Status(str, Enum):
    CONSENSUS_REACHED = "consensus_reached"
    NEEDS_RECONCILE = "needs_reconcile"
    BEST_EFFORT = "best_effort"


class AskRequest(BaseModel):
    question: str = Field(default="", max_length=10000)
    image: Optional[str] = Field(default=None, description="Base64 encoded image data URL")
    n_agents: int = Field(default=3, ge=1, le=10)
    agreement_ratio: float = Field(default=0.67, ge=0.0, le=1.0)
    max_rounds: int = Field(default=2, ge=0, le=5)
    model: str = Field(default="openai:gpt-4.1-mini")
    api_key: str = Field(..., min_length=1)
    return_agent_outputs: bool = Field(default=False)

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


class AgentOutput(BaseModel):
    agent_id: int
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    assumptions: list[str] = Field(default_factory=list)
    short_rationale: str = ""


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
