"""Tests for orchestration/agents.py — AnswerAgent."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from orchestration.agents import AnswerAgent
from schemas.models import AgentOutput


@pytest.fixture
def mock_provider():
    provider = MagicMock()
    provider.generate_json = AsyncMock()
    return provider


@pytest.fixture
def agent(mock_provider):
    return AnswerAgent(agent_id=0, provider=mock_provider, model="openai:gpt-4.1-mini")


class TestAnswer:
    @pytest.mark.asyncio
    async def test_returns_agent_output(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "42",
            "confidence": 0.9,
            "assumptions": ["math"],
            "rationale": "6 * 7 = 42",
        }

        output = await agent.answer("What is 6*7?")

        assert isinstance(output, AgentOutput)
        assert output.agent_id == 0
        assert output.answer == "42"
        assert output.confidence == 0.9
        assert output.model == "openai:gpt-4.1-mini"

    @pytest.mark.asyncio
    async def test_temperature_varies_by_agent_id(self, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 0.5, "assumptions": [], "rationale": ""
        }
        agent0 = AnswerAgent(agent_id=0, provider=mock_provider)
        agent2 = AnswerAgent(agent_id=2, provider=mock_provider)

        await agent0.answer("test")
        temp0 = mock_provider.generate_json.call_args[1]["temperature"]

        await agent2.answer("test")
        temp2 = mock_provider.generate_json.call_args[1]["temperature"]

        assert abs(temp0 - 0.30) < 0.001
        assert abs(temp2 - 0.34) < 0.001

    @pytest.mark.asyncio
    async def test_confidence_clamped_high(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 1.5, "assumptions": [], "rationale": ""
        }
        output = await agent.answer("test")
        assert output.confidence == 1.0

    @pytest.mark.asyncio
    async def test_confidence_clamped_low(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": -0.5, "assumptions": [], "rationale": ""
        }
        output = await agent.answer("test")
        assert output.confidence == 0.0

    @pytest.mark.asyncio
    async def test_default_confidence_when_missing(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "assumptions": [], "rationale": ""
        }
        output = await agent.answer("test")
        assert output.confidence == 0.5

    @pytest.mark.asyncio
    async def test_stores_previous_output(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 0.5, "assumptions": [], "rationale": ""
        }
        assert agent.previous_output is None
        output = await agent.answer("test")
        assert agent.previous_output == output

    @pytest.mark.asyncio
    async def test_image_passed_to_provider(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 0.5, "assumptions": [], "rationale": ""
        }
        await agent.answer("test", image="data:image/png;base64,abc")
        call_kwargs = mock_provider.generate_json.call_args[1]
        assert call_kwargs["image"] == "data:image/png;base64,abc"


class TestReconcile:
    @pytest.mark.asyncio
    async def test_reconcile_with_previous_output(self, agent, mock_provider):
        # First answer
        mock_provider.generate_json.return_value = {
            "answer": "41", "confidence": 0.6, "assumptions": [], "rationale": "close"
        }
        await agent.answer("6*7?")

        # Reconcile
        mock_provider.generate_json.return_value = {
            "answer": "42", "confidence": 0.95, "assumptions": [], "rationale": "corrected"
        }
        output = await agent.reconcile(
            question="6*7?",
            winning_answer="42",
            disagreement_summary="one agent said 41",
            reconcile_instructions="recheck math",
        )

        assert output.answer == "42"
        assert output.confidence == 0.95

    @pytest.mark.asyncio
    async def test_reconcile_uses_lower_temperature(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 0.5, "assumptions": [], "rationale": ""
        }
        await agent.answer("test")

        mock_provider.generate_json.return_value = {
            "answer": "a", "confidence": 0.9, "assumptions": [], "rationale": ""
        }
        await agent.reconcile("test", "a", "none", "confirm")

        temp = mock_provider.generate_json.call_args[1]["temperature"]
        assert abs(temp - 0.2) < 0.001

    @pytest.mark.asyncio
    async def test_reconcile_without_previous_falls_back_to_answer(self, agent, mock_provider):
        mock_provider.generate_json.return_value = {
            "answer": "first", "confidence": 0.7, "assumptions": [], "rationale": ""
        }
        assert agent.previous_output is None
        output = await agent.reconcile("test", "a", "summary", "instructions")
        # Should have called answer() instead
        assert output.answer == "first"
