from typing import Any
from providers.base import BaseProvider
from schemas.models import AgentOutput

ANSWER_SYSTEM_PROMPT = """You are an independent answer agent. Your task is to answer the user's question thoughtfully and accurately.

If an image is provided, analyze it carefully to answer the question. For math problems shown in images, solve them step by step.

You MUST respond with valid JSON in this exact format:
{
    "answer": "Your concise, final answer here",
    "confidence": 0.85,
    "assumptions": ["assumption 1", "assumption 2"],
    "short_rationale": "Brief 2-3 sentence explanation of your reasoning"
}

Rules:
- confidence: A float between 0 and 1 indicating how confident you are in your answer
- assumptions: List any assumptions you made (can be empty array)
- short_rationale: Keep it under 3 sentences
- Be direct and concise in your answer
- Think independently - do not hedge or give multiple options unless the question truly has multiple valid answers
- For math answers, use LaTeX with dollar sign delimiters: $inline$ for inline math, $$display$$ for display math
- Example: "The answer is $\\frac{1}{2}$" or "$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$"
- Always escape backslashes in JSON (use \\\\ for \\)"""

RECONCILIATION_PROMPT_TEMPLATE = """You previously answered a question, but there was disagreement among agents.

Original question: {question}

Your previous answer: {previous_answer}

The arbiter found that most agents agreed on this answer: {winning_answer}

Disagreement summary: {disagreement_summary}

Instructions from arbiter: {reconcile_instructions}

Please reconsider your answer in light of this feedback. If you still believe your original answer is correct, explain why. If you now agree with the consensus, update your answer.

Respond with valid JSON in the same format:
{
    "answer": "Your updated answer",
    "confidence": 0.85,
    "assumptions": [],
    "short_rationale": "Why you updated or maintained your answer"
}"""


class AnswerAgent:
    """An independent agent that answers questions."""

    def __init__(self, agent_id: int, provider: BaseProvider):
        self.agent_id = agent_id
        self.provider = provider
        self.previous_output: AgentOutput | None = None

    async def answer(self, question: str, image: str | None = None) -> AgentOutput:
        """Generate an answer to the question."""
        prompt = f"Question: {question}" if question else "Please analyze this image and answer any question it contains."
        response = await self.provider.generate_json(
            prompt=prompt,
            system_prompt=ANSWER_SYSTEM_PROMPT,
            temperature=0.7 + (self.agent_id * 0.05),  # Slight variation per agent
            max_tokens=2000,
            image=image,
        )

        output = AgentOutput(
            agent_id=self.agent_id,
            answer=response.get("answer", ""),
            confidence=min(1.0, max(0.0, float(response.get("confidence", 0.5)))),
            assumptions=response.get("assumptions", []),
            short_rationale=response.get("short_rationale", ""),
        )
        self.previous_output = output
        return output

    async def reconcile(
        self,
        question: str,
        winning_answer: str,
        disagreement_summary: str,
        reconcile_instructions: str,
        image: str | None = None,
    ) -> AgentOutput:
        """Reconsider answer based on arbiter feedback."""
        if not self.previous_output:
            return await self.answer(question, image)

        prompt = RECONCILIATION_PROMPT_TEMPLATE.format(
            question=question,
            previous_answer=self.previous_output.answer,
            winning_answer=winning_answer,
            disagreement_summary=disagreement_summary,
            reconcile_instructions=reconcile_instructions,
        )

        response = await self.provider.generate_json(
            prompt=prompt,
            system_prompt=ANSWER_SYSTEM_PROMPT,
            temperature=0.5,  # Lower temperature for reconciliation
            max_tokens=2000,
        )

        output = AgentOutput(
            agent_id=self.agent_id,
            answer=response.get("answer", ""),
            confidence=min(1.0, max(0.0, float(response.get("confidence", 0.5)))),
            assumptions=response.get("assumptions", []),
            short_rationale=response.get("short_rationale", ""),
        )
        self.previous_output = output
        return output
