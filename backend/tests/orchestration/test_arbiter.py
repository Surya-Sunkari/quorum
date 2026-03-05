"""Tests for orchestration/arbiter.py — ArbiterAgent consensus determination."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from orchestration.arbiter import ArbiterAgent
from schemas.models import AgentOutput, Status


@pytest.fixture
def mock_provider():
    provider = MagicMock()
    provider.generate_json = AsyncMock()
    return provider


@pytest.fixture
def arbiter(mock_provider):
    return ArbiterAgent(provider=mock_provider)


def make_output(agent_id, answer="42", confidence=0.9):
    return AgentOutput(
        agent_id=agent_id, answer=answer, confidence=confidence,
        assumptions=[], short_rationale="reason",
    )


class TestEvaluate:
    @pytest.mark.asyncio
    async def test_consensus_reached(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
            "disagreement_summary": "",
            "reconcile_instructions": "",
            "cluster_assignments": [0, 0, 0],
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("6*7?", outputs, 0.67, is_final_round=False)

        assert result.status == Status.CONSENSUS_REACHED
        assert result.agreement_ratio == 1.0
        assert result.winning_cluster_size == 3

    @pytest.mark.asyncio
    async def test_needs_reconcile(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
            "disagreement_summary": "one agent disagreed",
            "reconcile_instructions": "recheck",
            "cluster_assignments": [0, 0, 1],
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("test", outputs, 0.8, is_final_round=False)

        assert result.status == Status.NEEDS_RECONCILE
        assert abs(result.agreement_ratio - 2 / 3) < 0.01

    @pytest.mark.asyncio
    async def test_best_effort_on_final_round(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
            "disagreement_summary": "disagreement",
            "reconcile_instructions": "",
            "cluster_assignments": [0, 1, 2],
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("test", outputs, 0.8, is_final_round=True)

        assert result.status == Status.BEST_EFFORT
        assert abs(result.agreement_ratio - 1 / 3) < 0.01

    @pytest.mark.asyncio
    async def test_server_side_ratio_recalculation(self, arbiter, mock_provider):
        """Arbiter recalculates ratio from cluster_assignments, doesn't trust LLM math."""
        mock_provider.generate_json.return_value = {
            "agreement_ratio": 0.99,  # LLM claims this
            "consensus_answer": "42",
            "cluster_assignments": [0, 0, 1],  # Actually 2/3
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("test", outputs, 0.5, is_final_round=False)

        # Should use calculated value, not the LLM's
        assert abs(result.agreement_ratio - 2 / 3) < 0.01

    @pytest.mark.asyncio
    async def test_single_agent_always_consensus(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
            "cluster_assignments": [0],
        }
        outputs = [make_output(0)]

        result = await arbiter.evaluate("test", outputs, 0.67, is_final_round=False)

        assert result.status == Status.CONSENSUS_REACHED
        assert result.agreement_ratio == 1.0

    @pytest.mark.asyncio
    async def test_wrong_length_cluster_assignments_fixed(self, arbiter, mock_provider):
        """If LLM returns wrong-length cluster_assignments, arbiter falls back to unique clusters."""
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
            "cluster_assignments": [0, 0],  # Wrong length for 3 agents
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("test", outputs, 0.67, is_final_round=False)

        # Falls back to range(3) = [0, 1, 2] → each in own cluster
        assert len(result.cluster_assignments) == 3

    @pytest.mark.asyncio
    async def test_missing_cluster_assignments(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "consensus_answer": "42",
        }
        outputs = [make_output(i) for i in range(3)]

        result = await arbiter.evaluate("test", outputs, 0.5, is_final_round=False)

        assert len(result.cluster_assignments) == 3

    @pytest.mark.asyncio
    async def test_consensus_answer_falls_back_to_first_agent(self, arbiter, mock_provider):
        mock_provider.generate_json.return_value = {
            "cluster_assignments": [0, 0],
        }
        outputs = [make_output(0, answer="first"), make_output(1, answer="second")]

        result = await arbiter.evaluate("test", outputs, 0.5, is_final_round=False)

        assert result.consensus_answer == "first"
