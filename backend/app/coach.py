from dataclasses import dataclass, field
from .ai import MockProvider, get_provider
from .models import ClientEvent, CoachMessage, Problem


@dataclass
class CoachState:
    problem: Problem
    latest_code: str = ""
    attention_score: float = 100
    hints_used: int = 0
    failed_runs: int = 0
    last_nudge_bucket: int = 4
    history: list[str] = field(default_factory=list)

    async def handle(self, event: ClientEvent) -> CoachMessage | None:
        if event.code is not None:
            self.latest_code = event.code[-8000:]
        if event.type == "attention" and event.attention_score is not None:
            self.attention_score = event.attention_score
            bucket = int(self.attention_score // 20)
            if bucket < 2 and bucket < self.last_nudge_bucket:
                self.last_nudge_bucket = bucket
                return CoachMessage(
                    type="coach",
                    level="nudge",
                    message="Looks like your attention may have drifted. Want to pause for 30 seconds or restate the plan?",
                )
            self.last_nudge_bucket = bucket
        should_call_ai = event.type == "hint_request" or event.type == "user_message" or (
            event.type == "run_result" and event.passed is False
        )
        if event.type == "hint_request":
            self.hints_used += 1
        if event.type == "run_result" and event.passed is False:
            self.failed_runs += 1
        if event.type == "hint_request":
            candidate = (event.code or self.latest_code).strip()
            language = event.language or "python"
            starter = self.problem.starter_code.get(language, "").strip()
            if not candidate or candidate == starter:
                text = (
                    "You haven’t written an approach yet. Start by naming the input, "
                    "the required output, and one data structure that could connect "
                    "them. Then write the first small step."
                )
                self.history.append(text)
                return CoachMessage(type="coach", level="hint", message=text)
        if should_call_ai:
            context = {
                "problem": self.problem.model_dump(),
                "code": self.latest_code,
                "language": event.language,
                "passed": event.passed,
                "output": event.output,
                "attention_score": self.attention_score,
                "hints_used": self.hints_used,
                "failed_runs": self.failed_runs,
                "user_message": event.message,
            }
            try:
                text = await get_provider().coach(context)
            except Exception:
                text = await MockProvider().coach(context)
                text += " (Local fallback used.)"
            self.history.append(text)
            level = "info" if event.type == "user_message" else "hint"
            return CoachMessage(type="coach", level=level, message=text)
        if event.type == "run_result" and event.passed:
            return CoachMessage(
                type="coach",
                level="celebrate",
                message="Tests passed. Now explain your complexity and the invariant that makes the solution correct.",
            )
        return None

