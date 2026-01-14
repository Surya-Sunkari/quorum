from typing import Any
from providers.base import BaseProvider
from schemas.models import AgentOutput

ANSWER_SYSTEM_PROMPT = """You are an independent answer agent. Your task is to answer the user's question thoughtfully and accurately.

If an image is provided, analyze it carefully to answer the question.

CRITICAL: For math, logic, or technical problems, you MUST show your complete step-by-step work in the rationale field. Do not skip steps. Verify your answer by checking it against the original problem before responding.

You MUST respond with valid JSON in this exact format:
{
    "answer": "Your final answer here",
    "confidence": 0.85,
    "assumptions": ["assumption 1", "assumption 2"],
    "rationale": "Your detailed step-by-step reasoning"
}

Rules:
- confidence: A float between 0 and 1 indicating how confident you are
- assumptions: List any assumptions you made (can be empty array)
- rationale: Show your complete work. For complex problems, this should be thorough - do not truncate your reasoning
- Think independently - do not hedge or give multiple options unless truly ambiguous
- Double-check your calculations before finalizing
- For math answers, use LaTeX with dollar sign delimiters: $inline$ for inline math, $$display$$ for display math
- Example: "The answer is $\\frac{1}{2}$" or "$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$"
- Always escape backslashes in JSON (use \\\\ for \\)

MULTIPLE CHOICE QUESTIONS:
- For multiple choice, format the answer as: "X) answer text" where X is the letter
- If the answer choice is short (a few words), include it: "B) Paris" or "C) 42"
- If the answer choice is long (a full sentence+), just use the letter: "B"
- Do NOT prefix with "The answer is" - just give the choice directly
- In the rationale, briefly explain why you chose that option and why other options are incorrect"""

RECONCILIATION_PROMPT_TEMPLATE = """You previously answered a question, but there was disagreement among agents.

Original question: {question}

Your previous answer: {previous_answer}

The arbiter found that most agents agreed on this answer: {winning_answer}

Disagreement summary: {disagreement_summary}

Instructions from arbiter: {reconcile_instructions}

Please reconsider your answer carefully. Re-work the problem from scratch if needed. If you still believe your original answer is correct after re-checking, explain why with detailed reasoning. If you find an error in your previous work, correct it.

Respond with valid JSON in the same format:
{{
    "answer": "Your updated answer",
    "confidence": 0.85,
    "assumptions": [],
    "rationale": "Show your re-worked solution and explain why you updated or maintained your answer"
}}"""


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
            temperature=0.3 + (self.agent_id * 0.02),  # Low temp for accuracy, slight variation
            max_tokens=4000,  # Allow thorough reasoning
            image=image,
        )

        output = AgentOutput(
            agent_id=self.agent_id,
            answer=response.get("answer", ""),
            confidence=min(1.0, max(0.0, float(response.get("confidence", 0.5)))),
            assumptions=response.get("assumptions", []),
            short_rationale=response.get("rationale", response.get("short_rationale", "")),
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
            temperature=0.2,  # Very low temperature for reconciliation accuracy
            max_tokens=4000,
        )

        output = AgentOutput(
            agent_id=self.agent_id,
            answer=response.get("answer", ""),
            confidence=min(1.0, max(0.0, float(response.get("confidence", 0.5)))),
            assumptions=response.get("assumptions", []),
            short_rationale=response.get("rationale", response.get("short_rationale", "")),
        )
        self.previous_output = output
        return output
