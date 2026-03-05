"""Tests for orchestration/orchestrator.py — Full orchestration flow."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from orchestration.orchestrator import Orchestrator, _get_hosted_api_key
from schemas.models import AskRequest, AgentOutput, ArbiterResult, Status, AskResponse


@pytest.fixture
def mock_get_key():
    with patch("orchestration.orchestrator._get_hosted_api_key", return_value="sk-test") as m:
        yield m


@pytest.fixture
def mock_get_provider():
    with patch("orchestration.orchestrator.get_provider") as m:
        mock_provider = MagicMock()
        mock_provider.generate_json = AsyncMock()
        m.return_value = mock_provider
        yield m, mock_provider


def make_agent_output(agent_id, answer="42", confidence=0.9):
    return AgentOutput(
        agent_id=agent_id, answer=answer, confidence=confidence,
        assumptions=[], short_rationale="reason", model="openai:gpt-4.1-mini",
    )


def make_consensus_result(n_agents=3):
    return ArbiterResult(
        status=Status.CONSENSUS_REACHED,
        agreement_ratio=1.0,
        winning_cluster_size=n_agents,
        consensus_answer="42",
        disagreement_summary="",
        reconcile_instructions="",
        cluster_assignments=[0] * n_agents,
    )


def make_needs_reconcile_result(n_agents=3):
    assignments = [0, 0, 1] if n_agents == 3 else list(range(n_agents))
    return ArbiterResult(
        status=Status.NEEDS_RECONCILE,
        agreement_ratio=2 / 3,
        winning_cluster_size=2,
        consensus_answer="42",
        disagreement_summary="one disagreed",
        reconcile_instructions="recheck",
        cluster_assignments=assignments,
    )


class TestGetHostedApiKey:
    def test_returns_key(self):
        key = _get_hosted_api_key("openai")
        assert key == "sk-test-openai"

    def test_missing_key_raises(self):
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="not configured"):
                _get_hosted_api_key("openai")


class TestOrchestratorSetup:
    def test_single_model_creates_n_agents(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=3, model="openai:gpt-4.1-mini")
        orch = Orchestrator(req)
        orch._setup_agents()
        assert len(orch.agents) == 3
        assert orch.arbiter is not None

    def test_mixed_model_creates_correct_agents(self, mock_get_key, mock_get_provider):
        from schemas.models import ModelConfig
        req = AskRequest(
            question="test",
            mixed_models=[
                ModelConfig(model="openai:gpt-4.1-mini", count=2),
                ModelConfig(model="anthropic:claude-haiku-4-5", count=1),
            ],
        )
        orch = Orchestrator(req)
        orch._setup_agents()
        assert len(orch.agents) == 3


class TestOrchestratorRun:
    @pytest.mark.asyncio
    async def test_consensus_on_round_1(self, mock_get_key, mock_get_provider):
        _, mock_provider = mock_get_provider
        req = AskRequest(question="6*7?", n_agents=3)
        orch = Orchestrator(req)

        outputs = [make_agent_output(i) for i in range(3)]

        with patch.object(orch, '_setup_agents'):
            orch.agents = [MagicMock() for _ in range(3)]
            orch.arbiter = MagicMock()

            # Set up agents to return outputs
            for i, agent in enumerate(orch.agents):
                agent.answer = AsyncMock(return_value=outputs[i])

            # Arbiter returns consensus
            orch.arbiter.evaluate = AsyncMock(return_value=make_consensus_result())

            response = await orch.run()

        assert isinstance(response, AskResponse)
        assert response.status == "consensus_reached"
        assert response.rounds_used == 1
        assert response.answer == "42"

    @pytest.mark.asyncio
    async def test_reconciliation_then_consensus(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=3, max_rounds=2)
        orch = Orchestrator(req)

        outputs = [make_agent_output(i) for i in range(3)]

        with patch.object(orch, '_setup_agents'):
            orch.agents = [MagicMock() for _ in range(3)]
            orch.arbiter = MagicMock()

            for i, agent in enumerate(orch.agents):
                agent.answer = AsyncMock(return_value=outputs[i])
                agent.reconcile = AsyncMock(return_value=outputs[i])
                agent.previous_output = outputs[i]

            # Round 1: needs reconcile, Round 2: consensus
            orch.arbiter.evaluate = AsyncMock(side_effect=[
                make_needs_reconcile_result(),
                make_consensus_result(),
            ])

            response = await orch.run()

        assert response.status == "consensus_reached"
        assert response.rounds_used == 2

    @pytest.mark.asyncio
    async def test_best_effort_after_max_rounds(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=3, max_rounds=1)
        orch = Orchestrator(req)

        outputs = [make_agent_output(i) for i in range(3)]

        with patch.object(orch, '_setup_agents'):
            orch.agents = [MagicMock() for _ in range(3)]
            orch.arbiter = MagicMock()

            for i, agent in enumerate(orch.agents):
                agent.answer = AsyncMock(return_value=outputs[i])

            best_effort = ArbiterResult(
                status=Status.BEST_EFFORT,
                agreement_ratio=1 / 3,
                winning_cluster_size=1,
                consensus_answer="42",
                cluster_assignments=[0, 1, 2],
            )
            orch.arbiter.evaluate = AsyncMock(return_value=best_effort)

            response = await orch.run()

        assert response.status == "best_effort"

    @pytest.mark.asyncio
    async def test_agent_failure_creates_fallback_output(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=2)
        orch = Orchestrator(req)

        with patch.object(orch, '_setup_agents'):
            agent0 = MagicMock()
            agent0.answer = AsyncMock(return_value=make_agent_output(0))
            agent1 = MagicMock()
            agent1.answer = AsyncMock(side_effect=Exception("API error"))
            orch.agents = [agent0, agent1]
            orch.arbiter = MagicMock()
            orch.arbiter.evaluate = AsyncMock(return_value=make_consensus_result(2))

            response = await orch.run()

        # Should still succeed (with error output for failed agent)
        assert isinstance(response, AskResponse)

    @pytest.mark.asyncio
    async def test_single_agent_mode(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=1)
        orch = Orchestrator(req)

        output = make_agent_output(0)

        with patch.object(orch, '_setup_agents'):
            agent = MagicMock()
            agent.answer = AsyncMock(return_value=output)
            orch.agents = [agent]
            orch.arbiter = MagicMock()
            orch.arbiter.evaluate = AsyncMock(return_value=ArbiterResult(
                status=Status.CONSENSUS_REACHED,
                agreement_ratio=1.0,
                winning_cluster_size=1,
                consensus_answer="42",
                cluster_assignments=[0],
            ))

            response = await orch.run()

        assert response.n_agents == 1
        assert response.status == "consensus_reached"

    @pytest.mark.asyncio
    async def test_max_rounds_zero_skips_reconciliation(self, mock_get_key, mock_get_provider):
        req = AskRequest(question="test", n_agents=3, max_rounds=0)
        orch = Orchestrator(req)

        outputs = [make_agent_output(i) for i in range(3)]

        with patch.object(orch, '_setup_agents'):
            orch.agents = [MagicMock() for _ in range(3)]
            orch.arbiter = MagicMock()

            for i, agent in enumerate(orch.agents):
                agent.answer = AsyncMock(return_value=outputs[i])

            # Even with needs_reconcile, max_rounds=0 means it's final
            orch.arbiter.evaluate = AsyncMock(return_value=ArbiterResult(
                status=Status.BEST_EFFORT,
                agreement_ratio=1 / 3,
                winning_cluster_size=1,
                consensus_answer="42",
                cluster_assignments=[0, 1, 2],
            ))

            response = await orch.run()

        assert response.rounds_used == 1
        # evaluate should only be called once
        assert orch.arbiter.evaluate.call_count == 1
