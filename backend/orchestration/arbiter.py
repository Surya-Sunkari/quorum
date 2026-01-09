from typing import Any
from providers.base import BaseProvider
from schemas.models import AgentOutput, ArbiterResult, Status

ARBITER_SYSTEM_PROMPT = """You are an arbiter agent. Your task is to analyze multiple answers from independent agents and determine if they agree.

You MUST respond with valid JSON in this exact format:
{
    "status": "consensus_reached" | "needs_reconcile" | "best_effort",
    "agreement_ratio": 0.67,
    "winning_cluster_size": 2,
    "consensus_answer": "The best answer from the winning cluster",
    "disagreement_summary": "Brief summary of key disagreements (if any)",
    "reconcile_instructions": "Instructions for agents to reconcile (if needed)",
    "cluster_assignments": [0, 0, 1]
}

Rules for clustering:
- Group answers that are SEMANTICALLY equivalent (same meaning, possibly different wording)
- Minor differences in phrasing do NOT make answers different
- Focus on the core claim/answer, not the rationale
- cluster_assignments: Array mapping each agent (by index) to a cluster number (0, 1, 2, etc.)
- agreement_ratio = size of largest cluster / total number of agents

Status rules:
- "consensus_reached": agreement_ratio >= threshold (provided in prompt)
- "needs_reconcile": agreement_ratio < threshold AND reconciliation may help
- "best_effort": Only use after reconciliation attempts when consensus still not reached

For reconcile_instructions:
- Be specific about what the minority agents should reconsider
- Reference the winning cluster's reasoning"""


class ArbiterAgent:
    """Agent that determines consensus among answer agents."""

    def __init__(self, provider: BaseProvider):
        self.provider = provider

    async def evaluate(
        self,
        question: str,
        agent_outputs: list[AgentOutput],
        agreement_threshold: float,
        is_final_round: bool = False,
    ) -> ArbiterResult:
        """Evaluate agent outputs and determine consensus."""
        # Format agent outputs for the prompt
        outputs_text = "\n\n".join(
            f"Agent {out.agent_id}:\n"
            f"  Answer: {out.answer}\n"
            f"  Confidence: {out.confidence}\n"
            f"  Rationale: {out.short_rationale}"
            for out in agent_outputs
        )

        prompt = f"""Question asked: {question}

Agreement threshold required: {agreement_threshold}

Agent responses:
{outputs_text}

{"This is the FINAL round - if consensus is not reached, return status 'best_effort'." if is_final_round else ""}

Analyze these responses and determine if consensus is reached."""

        response = await self.provider.generate_json(
            prompt=prompt,
            system_prompt=ARBITER_SYSTEM_PROMPT,
            temperature=0.3,  # Low temperature for consistent evaluation
            max_tokens=2000,
        )

        # Parse status
        status_str = response.get("status", "best_effort")
        try:
            status = Status(status_str)
        except ValueError:
            status = Status.BEST_EFFORT

        # If final round and still not consensus, force best_effort
        agreement_ratio = float(response.get("agreement_ratio", 0.0))
        if is_final_round and agreement_ratio < agreement_threshold:
            status = Status.BEST_EFFORT

        # Override status based on actual ratio if arbiter made an error
        if agreement_ratio >= agreement_threshold and status != Status.CONSENSUS_REACHED:
            status = Status.CONSENSUS_REACHED

        return ArbiterResult(
            status=status,
            agreement_ratio=agreement_ratio,
            winning_cluster_size=int(response.get("winning_cluster_size", 1)),
            consensus_answer=response.get("consensus_answer", agent_outputs[0].answer if agent_outputs else ""),
            disagreement_summary=response.get("disagreement_summary", ""),
            reconcile_instructions=response.get("reconcile_instructions", ""),
            cluster_assignments=response.get("cluster_assignments", list(range(len(agent_outputs)))),
        )
