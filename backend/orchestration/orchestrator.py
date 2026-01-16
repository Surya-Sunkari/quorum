import asyncio
from typing import Any
from providers.base import BaseProvider
from providers import get_provider
from schemas.models import AskRequest, AskResponse, AgentOutput, Status
from .agents import AnswerAgent
from .arbiter import ArbiterAgent


# Arbiter model configuration
ARBITER_MODEL = "openai:gpt-5.2"
# Fallback models in order of preference if OpenAI key not available
ARBITER_FALLBACK_MODELS = [
    ("openai", "openai:gpt-5.2"),
    ("anthropic", "anthropic:claude-opus-4-5-20251101"),
    ("gemini", "gemini:gemini-3-pro-preview"),
]


class Orchestrator:
    """
    Main orchestration layer for multi-agent consensus.
    Designed to be provider-agnostic for future Microsoft Agent Framework integration.
    """

    def __init__(self, request: AskRequest):
        self.request = request
        self.agents: list[AnswerAgent] = []
        self.arbiter: ArbiterAgent | None = None
        self.all_outputs: list[list[AgentOutput]] = []  # Outputs per round

    def _get_api_key_for_provider(self, provider: str) -> str | None:
        """Get the API key for a specific provider."""
        if self.request.is_mixed_mode() and self.request.api_keys:
            return getattr(self.request.api_keys, provider, None)
        elif not self.request.is_mixed_mode():
            # Single-model mode - check if the model matches the provider
            if self.request.model.startswith(f"{provider}:"):
                return self.request.api_key
        return None

    def _create_arbiter_provider(self) -> BaseProvider:
        """
        Create provider for arbiter. Always uses GPT-5.2 if OpenAI key available,
        otherwise falls back to best available model.
        """
        for provider_name, model in ARBITER_FALLBACK_MODELS:
            api_key = self._get_api_key_for_provider(provider_name)
            if api_key:
                return get_provider(model=model, api_key=api_key)

        # If we get here, something went wrong with validation
        raise ValueError("No API key available for arbiter")

    def _setup_agents(self) -> None:
        """Initialize answer agents and arbiter based on mode."""
        agent_id = 0

        if self.request.is_mixed_mode():
            # Mixed-model mode: create agents for each model config
            for model_config in self.request.mixed_models:
                provider_name = model_config.model.split(":")[0]
                api_key = getattr(self.request.api_keys, provider_name)
                provider = get_provider(model=model_config.model, api_key=api_key)

                for _ in range(model_config.count):
                    self.agents.append(
                        AnswerAgent(
                            agent_id=agent_id,
                            provider=provider,
                            model=model_config.model
                        )
                    )
                    agent_id += 1
        else:
            # Single-model mode: all agents use the same provider
            provider = get_provider(model=self.request.model, api_key=self.request.api_key)
            for i in range(self.request.n_agents):
                self.agents.append(
                    AnswerAgent(
                        agent_id=i,
                        provider=provider,
                        model=self.request.model
                    )
                )

        # Arbiter always uses GPT-5.2 (or best available fallback)
        arbiter_provider = self._create_arbiter_provider()
        self.arbiter = ArbiterAgent(provider=arbiter_provider)

    async def _run_agents_parallel(self, question: str, image: str | None = None) -> list[AgentOutput]:
        """Run all answer agents in parallel."""
        tasks = [agent.answer(question, image) for agent in self.agents]
        outputs = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions
        results = []
        for i, output in enumerate(outputs):
            if isinstance(output, Exception):
                # Create a fallback output for failed agents
                results.append(
                    AgentOutput(
                        agent_id=i,
                        answer=f"Error: {str(output)}",
                        confidence=0.0,
                        assumptions=[],
                        short_rationale="Agent failed to respond",
                    )
                )
            else:
                results.append(output)

        return results

    async def _run_reconciliation_parallel(
        self,
        question: str,
        winning_answer: str,
        disagreement_summary: str,
        reconcile_instructions: str,
        image: str | None = None,
    ) -> list[AgentOutput]:
        """Run reconciliation for all agents in parallel."""
        tasks = [
            agent.reconcile(
                question=question,
                winning_answer=winning_answer,
                disagreement_summary=disagreement_summary,
                reconcile_instructions=reconcile_instructions,
                image=image,
            )
            for agent in self.agents
        ]
        outputs = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions
        results = []
        for i, output in enumerate(outputs):
            if isinstance(output, Exception):
                # Keep previous output on failure
                prev = self.agents[i].previous_output
                if prev:
                    results.append(prev)
                else:
                    results.append(
                        AgentOutput(
                            agent_id=i,
                            answer=f"Error: {str(output)}",
                            confidence=0.0,
                            assumptions=[],
                            short_rationale="Agent failed to reconcile",
                        )
                    )
            else:
                results.append(output)

        return results

    async def run(self) -> AskResponse:
        """
        Execute the full orchestration flow:
        1. Run N agents in parallel
        2. Arbiter evaluates consensus
        3. If not met, run reconciliation rounds
        4. Return final result
        """
        self._setup_agents()
        question = self.request.question
        image = self.request.image
        threshold = self.request.agreement_ratio
        max_rounds = self.request.max_rounds

        # Round 1: Initial answers
        current_round = 1
        outputs = await self._run_agents_parallel(question, image)
        self.all_outputs.append(outputs)

        # Arbiter evaluation
        is_final = current_round >= max_rounds or max_rounds == 0
        arbiter_result = await self.arbiter.evaluate(
            question=question,
            agent_outputs=outputs,
            agreement_threshold=threshold,
            is_final_round=is_final,
        )

        # Reconciliation loop
        while (
            arbiter_result.status == Status.NEEDS_RECONCILE
            and current_round < max_rounds
        ):
            current_round += 1
            is_final = current_round >= max_rounds

            outputs = await self._run_reconciliation_parallel(
                question=question,
                winning_answer=arbiter_result.consensus_answer,
                disagreement_summary=arbiter_result.disagreement_summary,
                reconcile_instructions=arbiter_result.reconcile_instructions,
                image=image,
            )
            self.all_outputs.append(outputs)

            arbiter_result = await self.arbiter.evaluate(
                question=question,
                agent_outputs=outputs,
                agreement_threshold=threshold,
                is_final_round=is_final,
            )

        # Calculate average confidence from winning cluster
        cluster_confidences = []
        for i, output in enumerate(outputs):
            if i < len(arbiter_result.cluster_assignments):
                # Find which cluster is the winning one (most common)
                winning_cluster = max(
                    set(arbiter_result.cluster_assignments),
                    key=arbiter_result.cluster_assignments.count,
                )
                if arbiter_result.cluster_assignments[i] == winning_cluster:
                    cluster_confidences.append(output.confidence)

        avg_confidence = (
            sum(cluster_confidences) / len(cluster_confidences)
            if cluster_confidences
            else 0.5
        )

        # Build response
        return AskResponse(
            status=arbiter_result.status.value,
            answer=arbiter_result.consensus_answer,
            agreement_ratio_achieved=arbiter_result.agreement_ratio,
            agreement_threshold=threshold,
            winning_cluster_size=arbiter_result.winning_cluster_size,
            n_agents=self.request.get_total_agents(),
            rounds_used=current_round,
            confidence=round(avg_confidence, 2),
            disagreement_summary=arbiter_result.disagreement_summary,
            agent_outputs=outputs if self.request.return_agent_outputs else [],
        )
