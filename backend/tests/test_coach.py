import asyncio
from backend.app.coach import CoachState
from backend.app.models import ClientEvent
from backend.app.problems import PROBLEMS


def test_low_attention_nudge():
    state = CoachState(problem=PROBLEMS[0])
    result = asyncio.run(
        state.handle(ClientEvent(type="attention", attention_score=30))
    )
    assert result is not None
    assert result.level == "nudge"


def test_unchanged_starter_gets_grounded_hint_without_ai():
    problem = PROBLEMS[1]
    state = CoachState(problem=problem)
    result = asyncio.run(
        state.handle(
            ClientEvent(
                type="hint_request",
                language="python",
                code=problem.starter_code["python"],
            )
        )
    )
    assert result is not None
    assert "haven’t written an approach" in result.message
    assert "stack" not in result.message.lower()
