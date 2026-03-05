"""Tests for schemas/models.py — Pydantic data models."""
import pytest
from pydantic import ValidationError
from schemas.models import (
    AskRequest, ModelConfig, AgentOutput, ArbiterResult, AskResponse, Status
)


class TestModelConfig:
    def test_valid_config(self):
        mc = ModelConfig(model="openai:gpt-4.1-mini", count=3)
        assert mc.model == "openai:gpt-4.1-mini"
        assert mc.count == 3

    def test_invalid_model_format(self):
        with pytest.raises(ValidationError):
            ModelConfig(model="invalid-model", count=1)

    def test_count_too_low(self):
        with pytest.raises(ValidationError):
            ModelConfig(model="openai:gpt-4.1-mini", count=0)

    def test_count_too_high(self):
        with pytest.raises(ValidationError):
            ModelConfig(model="openai:gpt-4.1-mini", count=11)

    @pytest.mark.parametrize("prefix", ["openai:", "anthropic:", "gemini:"])
    def test_valid_provider_prefixes(self, prefix):
        mc = ModelConfig(model=f"{prefix}some-model", count=1)
        assert mc.model.startswith(prefix)


class TestAskRequest:
    def test_defaults(self):
        req = AskRequest(question="test")
        assert req.n_agents == 3
        assert req.agreement_ratio == 0.67
        assert req.max_rounds == 2
        assert req.model == "openai:gpt-4.1-mini"
        assert req.return_agent_outputs is False
        assert req.mixed_models is None

    def test_question_max_length(self):
        req = AskRequest(question="a" * 2000)
        assert len(req.question) == 2000

    def test_question_too_long(self):
        with pytest.raises(ValidationError):
            AskRequest(question="a" * 2001)

    def test_n_agents_range(self):
        AskRequest(question="test", n_agents=1)
        AskRequest(question="test", n_agents=10)
        with pytest.raises(ValidationError):
            AskRequest(question="test", n_agents=0)
        with pytest.raises(ValidationError):
            AskRequest(question="test", n_agents=11)

    def test_agreement_ratio_range(self):
        AskRequest(question="test", agreement_ratio=0.0)
        AskRequest(question="test", agreement_ratio=1.0)
        with pytest.raises(ValidationError):
            AskRequest(question="test", agreement_ratio=-0.1)
        with pytest.raises(ValidationError):
            AskRequest(question="test", agreement_ratio=1.1)

    def test_max_rounds_range(self):
        AskRequest(question="test", max_rounds=0)
        AskRequest(question="test", max_rounds=5)
        with pytest.raises(ValidationError):
            AskRequest(question="test", max_rounds=-1)
        with pytest.raises(ValidationError):
            AskRequest(question="test", max_rounds=6)

    def test_invalid_model_format(self):
        with pytest.raises(ValidationError):
            AskRequest(question="test", model="bad-model")

    def test_valid_model_formats(self):
        AskRequest(question="test", model="openai:gpt-4.1-mini")
        AskRequest(question="test", model="anthropic:claude-haiku-4-5")
        AskRequest(question="test", model="gemini:gemini-2.5-flash")

    def test_get_total_agents_single_mode(self):
        req = AskRequest(question="test", n_agents=5)
        assert req.get_total_agents() == 5

    def test_get_total_agents_mixed_mode(self):
        req = AskRequest(
            question="test",
            mixed_models=[
                ModelConfig(model="openai:gpt-4.1-mini", count=2),
                ModelConfig(model="anthropic:claude-haiku-4-5", count=3),
            ],
        )
        assert req.get_total_agents() == 5

    def test_is_mixed_mode_false(self):
        req = AskRequest(question="test")
        assert req.is_mixed_mode() is False

    def test_is_mixed_mode_true(self):
        req = AskRequest(
            question="test",
            mixed_models=[ModelConfig(model="openai:gpt-4.1-mini", count=1)],
        )
        assert req.is_mixed_mode() is True

    def test_is_mixed_mode_empty_list(self):
        req = AskRequest(question="test", mixed_models=[])
        assert req.is_mixed_mode() is False

    def test_empty_question_allowed(self):
        req = AskRequest(question="")
        assert req.question == ""

    def test_image_field(self):
        req = AskRequest(question="test", image="data:image/png;base64,abc123")
        assert req.image == "data:image/png;base64,abc123"


class TestAgentOutput:
    def test_valid_output(self):
        out = AgentOutput(
            agent_id=0,
            answer="42",
            confidence=0.9,
            assumptions=["math"],
            short_rationale="calculated",
            model="openai:gpt-4.1-mini",
        )
        assert out.agent_id == 0
        assert out.confidence == 0.9

    def test_confidence_bounds(self):
        AgentOutput(agent_id=0, answer="a", confidence=0.0)
        AgentOutput(agent_id=0, answer="a", confidence=1.0)
        with pytest.raises(ValidationError):
            AgentOutput(agent_id=0, answer="a", confidence=-0.1)
        with pytest.raises(ValidationError):
            AgentOutput(agent_id=0, answer="a", confidence=1.1)

    def test_defaults(self):
        out = AgentOutput(agent_id=0, answer="a", confidence=0.5)
        assert out.assumptions == []
        assert out.short_rationale == ""
        assert out.model == ""


class TestArbiterResult:
    def test_valid_result(self):
        result = ArbiterResult(
            status=Status.CONSENSUS_REACHED,
            agreement_ratio=0.67,
            winning_cluster_size=2,
            consensus_answer="42",
        )
        assert result.status == Status.CONSENSUS_REACHED

    def test_status_values(self):
        assert Status.CONSENSUS_REACHED.value == "consensus_reached"
        assert Status.NEEDS_RECONCILE.value == "needs_reconcile"
        assert Status.BEST_EFFORT.value == "best_effort"


class TestAskResponse:
    def test_full_response(self):
        resp = AskResponse(
            status="consensus_reached",
            answer="42",
            agreement_ratio_achieved=0.67,
            agreement_threshold=0.67,
            winning_cluster_size=2,
            n_agents=3,
            rounds_used=1,
            confidence=0.9,
        )
        d = resp.model_dump()
        assert d["status"] == "consensus_reached"
        assert d["agent_outputs"] == []

    def test_with_agent_outputs(self):
        outputs = [
            AgentOutput(agent_id=0, answer="a", confidence=0.9),
            AgentOutput(agent_id=1, answer="a", confidence=0.8),
        ]
        resp = AskResponse(
            status="consensus_reached",
            answer="a",
            agreement_ratio_achieved=1.0,
            agreement_threshold=0.67,
            winning_cluster_size=2,
            n_agents=2,
            rounds_used=1,
            confidence=0.85,
            agent_outputs=outputs,
        )
        assert len(resp.agent_outputs) == 2
