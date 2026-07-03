from typing import Literal
from pydantic import BaseModel, Field


Language = Literal["python", "javascript", "java"]


class Problem(BaseModel):
    id: str
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    topics: list[str]
    description: str
    examples: list[dict[str, str]]
    starter_code: dict[Language, str]
    source: str = "SignalCode"
    source_url: str | None = None
    license: str | None = None
    is_custom: bool = False
    test_cases: list[dict[str, str]] = Field(default_factory=list)


class ProblemCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    topics: list[str] = Field(default_factory=list, max_length=12)
    description: str = Field(min_length=10, max_length=12000)
    examples: list[dict[str, str]] = Field(default_factory=list, max_length=10)
    test_cases: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    starter_code: dict[Language, str] = Field(
        default_factory=lambda: {"python": "", "javascript": "", "java": ""}
    )


class ProblemImportRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=200)




class CodeRunRequest(BaseModel):
    language: Language
    code: str = Field(min_length=1, max_length=50000)
    problem_id: str | None = None
    test_cases: list[dict[str, str]] | None = None


class TestCaseResult(BaseModel):
    name: str
    input: str
    expected: str
    actual: str
    passed: bool
    error: str | None = None


class CodeRunResult(BaseModel):
    output: str
    exit_code: int | None = None
    timed_out: bool = False
    passed: bool | None = None
    test_results: list[TestCaseResult] | None = None


class SessionCreate(BaseModel):
    language: Language = "python"
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    problem_id: str | None = None


class SessionCreated(BaseModel):
    session_id: str
    problem: Problem


class ClientEvent(BaseModel):
    type: Literal["code_update", "run_result", "attention", "hint_request", "complete", "user_message"]
    code: str | None = None
    language: Language | None = None
    passed: bool | None = None
    output: str | None = None
    face_present: bool | None = None
    looking_away: bool | None = None
    attention_score: float | None = Field(default=None, ge=0, le=100)
    message: str | None = None


class CoachMessage(BaseModel):
    type: Literal["coach", "status", "problem", "report", "user"]
    message: str = ""
    level: Literal["info", "nudge", "hint", "celebrate", "user"] = "info"
    payload: dict | None = None


class UserLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=100)


class UserResponse(BaseModel):
    username: str
    completed_problems: list[str]


class ProblemCompleteRequest(BaseModel):
    problem_id: str


class ProblemSyncRequest(BaseModel):
    problem_ids: list[str] = Field(default_factory=list)


class UserProfileResponse(BaseModel):
    username: str
    completed_problems: list[Problem]
    total_completed: int
