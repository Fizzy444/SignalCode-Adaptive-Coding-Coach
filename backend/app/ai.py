import json
import httpx
from .config import get_settings


SYSTEM_PROMPT = """You are a calm coding interview coach. Never reveal a full solution.
Give one concise, actionable nudge (maximum 70 words). Use the candidate's code,
run result, coarse attention signal, and user messages/explanations. Do not diagnose emotion or mental health.
Only discuss code that appears verbatim in the supplied code field. Never invent,
infer, or claim the candidate wrote an implementation that is not present.
If they are stuck, ask a guiding question. If correct or explaining complexity/invariants, evaluate their explanation constructively and offer one possible improvement or follow-up question. Return plain text only."""


class AIProvider:
    async def coach(self, context: dict) -> str:
        raise NotImplementedError


class MockProvider(AIProvider):
    async def coach(self, context: dict) -> str:
        if context.get("user_message"):
            msg = str(context["user_message"]).lower()
            if any(w in msg for w in ["o(", "time", "space", "invariant", "complexity", "loop", "hash", "pointer", "array"]):
                return "Great explanation of your complexity and invariants! Your time/space trade-offs are well justified for this algorithm. Would you like to explore any follow-up optimizations?"
            return f"I hear you! Regarding '{context['user_message']}': How does that observation connect to your algorithm's invariants or data structure choice?"
        if context.get("passed"):
            return "Nice—your tests pass. Walk me through the time and space complexity as if I were the interviewer."
        if context.get("output"):
            return "Use the failing case to trace your state one iteration at a time. Which value should change immediately before the mismatch?"
        if context.get("attention_score", 100) < 45:
            return "Take one slow breath, then state the brute-force approach aloud. We can optimize once the invariants are clear."
        return "What information do you need to retrieve quickly while scanning the input? Name the data structure before coding."



class OllamaProvider(AIProvider):
    async def coach(self, context: dict) -> str:
        settings = get_settings()
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(context)},
                    ],
                    "options": {"temperature": 0.3, "num_predict": 120},
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()


class GeminiProvider(AIProvider):
    async def coach(self, context: dict) -> str:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                headers={"x-goog-api-key": settings.gemini_api_key},
                json={
                    "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": [{"parts": [{"text": json.dumps(context)}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 160},
                },
            )
            response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


def get_provider() -> AIProvider:
    provider = get_settings().ai_provider.lower()
    if provider == "ollama":
        return OllamaProvider()
    if provider == "gemini":
        return GeminiProvider()
    return MockProvider()
