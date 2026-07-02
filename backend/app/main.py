import html
import re
from contextlib import asynccontextmanager
from uuid import uuid4
import httpx
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .coach import CoachState
from .config import get_settings
from .database import (
    create_session, finish_session, get_session, initialize, save_custom_problem, save_event,
    session_report,
)
from .models import (
    ClientEvent, CoachMessage, CodeRunRequest, CodeRunResult, Problem,
    ProblemCreate, ProblemImportRequest, SessionCreate, SessionCreated,
)
from .problems import get_problem, search_problems, select_problem
from .sandbox import run_code


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize()
    yield


app = FastAPI(title="SignalCode API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "provider": get_settings().ai_provider}


@app.post("/api/run", response_model=CodeRunResult)
async def execute_code(request: CodeRunRequest):
    test_cases = request.test_cases
    if not test_cases and request.problem_id:
        problem = get_problem(request.problem_id)
        if problem:
            test_cases = problem.test_cases or problem.examples
    return run_code(request.language, request.code, problem_id=request.problem_id, test_cases=test_cases)



@app.get("/api/problems", response_model=list[Problem])
async def problems(
    q: str = "",
    topics: list[str] = Query(default=[]),
    difficulty: str | None = None,
):
    return search_problems(q, topics, difficulty)


@app.get("/api/problems/{problem_id}", response_model=Problem)
async def problem_detail(problem_id: str):
    problem = get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@app.post("/api/problems", response_model=Problem, status_code=201)
async def create_problem(request: ProblemCreate):
    slug = "-".join(request.title.lower().split())[:80]
    data = request.model_dump()
    if not data.get("test_cases") and data.get("examples"):
        data["test_cases"] = data["examples"]
    problem = Problem(
        id=f"custom-{slug}-{str(uuid4())[:8]}",
        **data,
        source="Community",
        is_custom=True,
    )
    save_custom_problem(problem.model_dump())
    return problem


@app.post("/api/problems/import", response_model=Problem, status_code=201)
async def import_problem(request: ProblemImportRequest):
    slug = request.slug.strip().lower().rstrip("/")
    if "leetcode.com/problems/" in slug:
        parts = slug.split("leetcode.com/problems/")[-1].split("/")
        slug = parts[0] if parts else slug
    elif "http" in slug and "/" in slug:
        slug = slug.split("/")[-1] or slug.split("/")[-2]
    else:
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    # LeetCode links copied from numbered lists are often formatted like
    # "10.regular-expression-matching"; the API expects only the title slug.
    slug = re.sub(r"^\d+[\s._-]+", "", slug)

    existing = get_problem(slug) or get_problem(f"custom-{slug}")
    if existing:
        return existing

    data = None
    starter_code = {"python": "# Write your solution here\n", "javascript": "// Write your solution here\n"}
    is_daily = slug in ("daily", "daily-question", "today")

    try:
        if is_daily:
            gql_query = {
                "query": "query activeDailyCodingChallengeQuestion { activeDailyCodingChallengeQuestion { question { questionId title titleSlug difficulty content topicTags { name } codeSnippets { langSlug code } } } }"
            }
        else:
            gql_query = {
                "query": "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { questionId title titleSlug difficulty content topicTags { name } codeSnippets { langSlug code } } }",
                "variables": {"titleSlug": slug}
            }
        async with httpx.AsyncClient(timeout=10) as client:
            gql_res = await client.post("https://leetcode.com/graphql", json=gql_query, headers={"User-Agent": "Mozilla/5.0"})
            if gql_res.status_code == 200:
                res_json = gql_res.json()
                q_data = res_json.get("data", {}).get("activeDailyCodingChallengeQuestion", {}).get("question") if is_daily else res_json.get("data", {}).get("question")
                if q_data and q_data.get("title"):
                    data = {
                        "questionTitle": q_data.get("title"),
                        "titleSlug": q_data.get("titleSlug", "daily" if is_daily else slug),
                        "difficulty": q_data.get("difficulty", "Easy"),
                        "topicTags": q_data.get("topicTags", []),
                        "question": q_data.get("content", "")
                    }
                    for s in q_data.get("codeSnippets", []):
                        if s.get("langSlug") in ("python3", "python") and s.get("code"):
                            starter_code["python"] = s["code"]
                        elif s.get("langSlug") == "javascript" and s.get("code"):
                            starter_code["javascript"] = s["code"]
    except Exception:
        pass

    if not data or "questionTitle" not in data:
        url = "https://alfa-leetcode-api.onrender.com/daily" if is_daily else f"https://alfa-leetcode-api.onrender.com/select?titleSlug={slug}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                elif is_daily:
                    return select_problem("easy")
                else:
                    res.raise_for_status()
        except Exception as e:
            if is_daily:
                return select_problem("easy")
            raise HTTPException(status_code=502, detail=f"Failed to fetch from LeetCode API: {str(e)}. Problem '{slug}' not found on LeetCode API.")

    if not data or "questionTitle" not in data:
        raise HTTPException(status_code=404, detail=f"Problem '{slug}' not found on LeetCode API.")

    title = data["questionTitle"]
    difficulty = str(data.get("difficulty", "easy")).lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "easy"
    topics = [tag["name"].lower() for tag in data.get("topicTags", []) if "name" in tag][:10]
    if not topics:
        topics = ["algorithms"]

    raw_question = str(data.get("question", ""))
    formatted = re.sub(r"<br\s*/?>", "\n", raw_question, flags=re.IGNORECASE)
    formatted = re.sub(r"</(p|pre|ul|ol|div|h\d)>", "\n\n", formatted, flags=re.IGNORECASE)
    formatted = re.sub(r"<li>", "\n  • ", formatted, flags=re.IGNORECASE)
    formatted = re.sub(r"</li>", "", formatted, flags=re.IGNORECASE)
    formatted = re.sub(r"</?code>", "`", formatted, flags=re.IGNORECASE)
    formatted = re.sub(r"</?strong>", "**", formatted, flags=re.IGNORECASE)
    formatted = re.sub(r"</?em>", "*", formatted, flags=re.IGNORECASE)
    clean_text = html.unescape(re.sub(r"<[^>]+>", "", formatted)).strip()
    clean_text = re.sub(r"\n{3,}", "\n\n", clean_text)
    description = clean_text or title

    examples_found = re.findall(r"Input:\s*([^\n]+)\s*Output:\s*([^\n]+)", clean_text, re.IGNORECASE)
    examples = [{"input": inp.strip(), "output": out.strip()} for inp, out in examples_found[:10]]
    if not examples:
        examples = [{"input": "See description", "output": "See description"}]

    if starter_code["python"] == "# Write your solution here\n":
        try:
            query = {
                "query": "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { codeSnippets { langSlug code } } }".replace("$", ""),
                "variables": {"titleSlug": data.get("titleSlug", slug)}
            }
            async with httpx.AsyncClient(timeout=10) as client:
                gql_res = await client.post("https://leetcode.com/graphql", json=query, headers={"User-Agent": "Mozilla/5.0"})
                if gql_res.status_code == 200:
                    snippets = gql_res.json().get("data", {}).get("question", {}).get("codeSnippets", [])
                    for s in snippets:
                        if s.get("langSlug") in ("python3", "python") and s.get("code"):
                            starter_code["python"] = s["code"]
                        elif s.get("langSlug") == "javascript" and s.get("code"):
                            starter_code["javascript"] = s["code"]
        except Exception:
            pass

    problem = Problem(
        id=f"custom-{slug}-{str(uuid4())[:8]}",
        title=title,
        difficulty=difficulty,
        topics=topics,
        description=description,
        examples=examples,
        test_cases=examples,
        starter_code=starter_code,
        source="LeetCode",
        source_url=f"https://leetcode.com/problems/{data.get('titleSlug', slug)}/",
        is_custom=True,
    )
    save_custom_problem(problem.model_dump())
    return problem



@app.post("/api/sessions", response_model=SessionCreated)
async def new_session(request: SessionCreate):
    if request.problem_id and not get_problem(request.problem_id):
        raise HTTPException(status_code=404, detail="Problem not found")
    problem = select_problem(request.difficulty, problem_id=request.problem_id)
    session_id = str(uuid4())
    create_session(session_id, request.language, problem.id, problem.difficulty)
    return SessionCreated(session_id=session_id, problem=problem)


@app.get("/api/sessions/{session_id}/report")
async def report(session_id: str):
    return session_report(session_id)


@app.websocket("/ws/{session_id}")
async def interview_socket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = get_session(session_id)
    if not session:
        await websocket.close(code=1008, reason="Session not found")
        return
    problem = get_problem(session["problem_id"])
    if not problem:
        await websocket.close(code=1011, reason="Problem not found")
        return
    state = CoachState(problem=problem)
    await websocket.send_json(
        CoachMessage(type="status", message="Coach connected").model_dump()
    )
    try:
        while True:
            data = await websocket.receive_json()
            event = ClientEvent.model_validate(data)
            save_event(session_id, event.type, event.model_dump(exclude_none=True))
            message = await state.handle(event)
            if event.type == "complete":
                finish_session(session_id)
                await websocket.send_json(
                    CoachMessage(
                        type="report", payload=session_report(session_id)
                    ).model_dump()
                )
            elif message:
                await websocket.send_json(message.model_dump())
    except WebSocketDisconnect:
        pass
