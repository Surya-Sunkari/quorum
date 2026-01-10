from collections import Counter
from typing import Any
from providers.base import BaseProvider
from schemas.models import AgentOutput, ArbiterResult, Status

ARBITER_SYSTEM_PROMPT = """You are an arbiter agent. Your task is to analyze multiple answers from independent agents, verify their reasoning, and determine consensus.

CRITICAL: For math/logic problems, you must VERIFY the correctness of each agent's work, not just count votes. An answer backed by flawed reasoning should not win just because it's popular.

You MUST respond with valid JSON in this exact format:
{
    "status": "consensus_reached" | "needs_reconcile" | "best_effort",
    "agreement_ratio": 0.67,
    "winning_cluster_size": 2,
    "consensus_answer": "The best CORRECT answer, verified by checking the reasoning",
    "disagreement_summary": "Brief summary of key disagreements and any errors found",
    "reconcile_instructions": "Specific instructions pointing out errors in reasoning if found",
    "cluster_assignments": [0, 0, 1]
}

Rules for clustering:
- Group answers that are SEMANTICALLY equivalent (same meaning, possibly different wording)
- Minor differences in phrasing do NOT make answers different
- Focus on the core claim/answer, not the rationale
- cluster_assignments: Array mapping each agent (by index) to a cluster number (0, 1, 2, etc.)
- agreement_ratio = size of largest cluster / total number of agents

IMPORTANT for math/technical questions:
- Review each agent's step-by-step work for errors
- If a minority agent has correct reasoning and the majority has errors, note this in disagreement_summary
- The consensus_answer should be the CORRECT answer, even if fewer agents got it right
- In reconcile_instructions, point out specific calculation errors

Status rules:
- "consensus_reached": agreement_ratio >= threshold (provided in prompt)
- "needs_reconcile": agreement_ratio < threshold AND reconciliation may help
- "best_effort": Only use after reconciliation attempts when consensus still not reached

For reconcile_instructions:
- Be specific about what errors agents made
- Show the correct approach if you identified one"""


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

        # Get cluster assignments from LLM
        cluster_assignments = response.get("cluster_assignments", list(range(len(agent_outputs))))

        # Ensure cluster_assignments has correct length
        if len(cluster_assignments) != len(agent_outputs):
            cluster_assignments = list(range(len(agent_outputs)))

        # Calculate agreement ratio ourselves (don't trust LLM math)
        n_agents = len(agent_outputs)
        if n_agents > 0 and cluster_assignments:
            cluster_counts = Counter(cluster_assignments)
            winning_cluster_size = max(cluster_counts.values())
            agreement_ratio = winning_cluster_size / n_agents
        else:
            winning_cluster_size = 1
            agreement_ratio = 1.0 if n_agents <= 1 else 0.0

        # Determine status based on calculated ratio
        if agreement_ratio >= agreement_threshold:
            status = Status.CONSENSUS_REACHED
        elif is_final_round:
            status = Status.BEST_EFFORT
        else:
            status = Status.NEEDS_RECONCILE

        return ArbiterResult(
            status=status,
            agreement_ratio=agreement_ratio,
            winning_cluster_size=winning_cluster_size,
            consensus_answer=response.get("consensus_answer", agent_outputs[0].answer if agent_outputs else ""),
            disagreement_summary=response.get("disagreement_summary", ""),
            reconcile_instructions=response.get("reconcile_instructions", ""),
            cluster_assignments=cluster_assignments,
        )
