import hashlib
import html
import os
import re
from contextlib import asynccontextmanager
from uuid import uuid4
import httpx
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .coach import CoachState
from .config import get_settings
from .database import (
    add_user_completed_problem, create_session, create_user, finish_session, get_session,
    get_user_by_username, get_user_completed_problems, initialize, upsert_custom_problem,
    find_custom_problem_by_slug, save_custom_problem, save_event,
    search_users, session_report, sync_user_completed_problems,
)
from .models import (
    ClientEvent, CoachMessage, CodeRunRequest, CodeRunResult, Problem,
    ProblemCompleteRequest, ProblemCreate, ProblemImportRequest, ProblemSyncRequest,
    SessionCreate, SessionCreated, UserLoginRequest, UserSignupRequest, UserProfileResponse, UserResponse,
    UserSearchResult,
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
    allow_origins=[get_settings().frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex="https?://.*",
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


def _clean_leetcode_html(raw_html: str) -> tuple[str, list[dict[str, str]]]:
    if not raw_html:
        return "", []
    
    text = raw_html.replace("\r\n", "\n").replace("&nbsp;", " ").replace("\xa0", " ")
    
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(p|div|h[1-6])(?:\s+[^>]*)?>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li(?:\s+[^>]*)?>", "\n• ", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(ul|ol)(?:\s+[^>]*)?>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?pre(?:\s+[^>]*)?>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<code(?:\s+[^>]*)?>(.*?)</code>", r"`\1`", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<strong(?:\s+[^>]*)?>(.*?)</strong>", r"\1", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<b(?:\s+[^>]*)?>(.*?)</b>", r"\1", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<em(?:\s+[^>]*)?>(.*?)</em>", r"\1", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<i(?:\s+[^>]*)?>(.*?)</i>", r"\1", text, flags=re.IGNORECASE | re.DOTALL)
    
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    
    # Extract test examples
    examples = []
    pattern = re.compile(
        r"(?:Input:?)\s*([^\n\r`]+(?:\n(?!\s*Output)[^\n\r`]+)*)\s*(?:Output:?)\s*([^\n\r`]+)",
        re.IGNORECASE
    )
    for m in pattern.finditer(text):
        raw_inp = m.group(1).strip()
        raw_out = m.group(2).strip()
        clean_inp = re.sub(r"^\*+|\*+$|^`+|`+$", "", raw_inp).strip()
        clean_out = re.sub(r"^\*+|\*+$|^`+|`+$", "", raw_out).strip()
        if clean_inp and clean_out:
            examples.append({"input": clean_inp, "output": clean_out})
            
    if not examples:
        simple_pattern = re.compile(r"Input:\s*([^\n]+)\s*Output:\s*([^\n]+)", re.IGNORECASE)
        for m in simple_pattern.finditer(text):
            clean_inp = re.sub(r"^\*+|\*+$|^`+|`+$", "", m.group(1)).strip()
            clean_out = re.sub(r"^\*+|\*+$|^`+|`+$", "", m.group(2)).strip()
            if clean_inp and clean_out:
                examples.append({"input": clean_inp, "output": clean_out})

    if not examples:
        examples = [{"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]"}] if "linked list" in text.lower() else [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}]
        
    # Strip raw example block from the description text so it doesn't duplicate with Examples section
    clean_desc = text
    if examples:
        # Extract Constraints section if present, removing any Follow-up
        constraints_match = re.search(r"\b(Constraints:.*)", clean_desc, flags=re.IGNORECASE | re.DOTALL)
        constraints_text = constraints_match.group(1).strip() if constraints_match else ""
        if constraints_text:
            constraints_text = re.split(r"\bFollow-up:", constraints_text, flags=re.IGNORECASE)[0].strip()
        
        # Extract main problem body before "Example 1:" / "Example:"
        intro_match = re.split(r"\bExample(?:\s+\d+)?:", clean_desc, flags=re.IGNORECASE)
        intro_text = intro_match[0].strip() if intro_match else clean_desc.strip()
        intro_text = re.split(r"\bFollow-up:", intro_text, flags=re.IGNORECASE)[0].strip()
        
        if intro_text and constraints_text:
            clean_desc = f"{intro_text}\n\n{constraints_text}"
        elif intro_text:
            clean_desc = intro_text

    # Final cleanup: remove Follow-up section, fences, asterisks, and multiple empty lines
    clean_desc = re.split(r"\bFollow-up:", clean_desc, flags=re.IGNORECASE)[0].strip()
    clean_desc = re.sub(r"```+", "", clean_desc)
    clean_desc = clean_desc.replace("*", "")
    clean_desc = re.sub(r"\n{3,}", "\n\n", clean_desc).strip()

    return clean_desc, examples


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
    slug = re.sub(r"^\d+[\s._-]+", "", slug)

    # Use a stable, deterministic ID so re-imports overwrite rather than duplicate.
    stable_id = f"custom-{slug}"

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
            # Both LeetCode sources failed — return cached version if we have one.
            cached = find_custom_problem_by_slug(slug)
            if cached:
                return Problem.model_validate({**cached, "source": "LeetCode"})
            if is_daily:
                return select_problem("easy")
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach LeetCode API: {str(e)}. Problem '{slug}' not found.",
            )

    if not data or "questionTitle" not in data:
        cached = find_custom_problem_by_slug(slug)
        if cached:
            return Problem.model_validate({**cached, "source": "LeetCode"})
        raise HTTPException(status_code=404, detail=f"Problem '{slug}' not found on LeetCode.")

    title = data["questionTitle"]
    difficulty = str(data.get("difficulty", "easy")).lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "easy"
    topics = [tag["name"].lower() for tag in data.get("topicTags", []) if "name" in tag][:10]
    if not topics:
        topics = ["algorithms"]

    raw_question = str(data.get("question", ""))
    description, examples = _clean_leetcode_html(raw_question)
    if not description:
        description = title

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

    visible_examples = examples
    full_test_cases = examples
    if slug == "reverse-nodes-in-k-group" or ("reverse" in title.lower() and "k-group" in title.lower()):
        visible_examples = [
            {"input": "head = [1,2,3,4,5], k = 2", "output": "[2,1,4,3,5]"},
            {"input": "head = [1,2,3,4,5], k = 3", "output": "[3,2,1,4,5]"},
        ]
        full_test_cases = [
            {"input": "head = [1,2,3,4,5], k = 2", "output": "[2,1,4,3,5]"},
            {"input": "head = [1,2,3,4,5], k = 3", "output": "[3,2,1,4,5]"},
            {"input": "head = [1,2,3,4,5], k = 1", "output": "[1,2,3,4,5]"},
            {"input": "head = [1,2,3,4,5], k = 5", "output": "[5,4,3,2,1]"},
            {"input": "head = [1,2], k = 2", "output": "[2,1]"},
            {"input": "head = [1], k = 1", "output": "[1]"},
        ]

    problem = Problem(
        id=stable_id,
        title=title,
        difficulty=difficulty,
        topics=topics,
        description=description,
        examples=visible_examples,
        test_cases=full_test_cases,
        starter_code=starter_code,
        source="LeetCode",
        source_url=f"https://leetcode.com/problems/{data.get('titleSlug', slug)}/",
        is_custom=True,
    )
    upsert_custom_problem(problem.model_dump())
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


def hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, _ = hashed.split(":")
        salt = bytes.fromhex(salt_hex)
        return hash_password(password, salt) == hashed
    except Exception:
        return False


@app.post("/api/auth/signup", response_model=UserResponse)
async def signup(request: UserSignupRequest):
    user = get_user_by_username(request.username)
    if user:
        raise HTTPException(status_code=400, detail="Username already taken")
    pwd_hash = hash_password(request.password)
    create_user(request.username, pwd_hash, request.email)
    return UserResponse(username=request.username, email=request.email, completed_problems=[])

@app.post("/api/auth/login", response_model=UserResponse)
async def login(request: UserLoginRequest):
    user = get_user_by_username(request.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    completed = get_user_completed_problems(request.username)
    return UserResponse(username=request.username, completed_problems=completed)


@app.post("/api/users/{username}/complete", response_model=UserResponse)
async def complete_problem(username: str, request: ProblemCompleteRequest):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    add_user_completed_problem(username, request.problem_id)
    completed = get_user_completed_problems(username)
    return UserResponse(username=username, completed_problems=completed)


@app.post("/api/users/{username}/sync", response_model=UserResponse)
async def sync_completed(username: str, request: ProblemSyncRequest):
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    sync_user_completed_problems(username, request.problem_ids)
    completed = get_user_completed_problems(username)
    return UserResponse(username=username, completed_problems=completed)


@app.get("/api/users/search", response_model=list[UserSearchResult])
async def search_users_api(q: str = ""):
    return search_users(q, limit=10)


@app.get("/api/users/{username}/profile", response_model=UserProfileResponse)
async def get_profile(username: str):
    clean_username = username.strip().lstrip("@")
    try:
        user = get_user_by_username(clean_username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        completed_ids = get_user_completed_problems(clean_username)
        completed_problems = []
        for pid in completed_ids:
            try:
                p = get_problem(pid)
                if p:
                    completed_problems.append(p)
            except Exception:
                continue
        return UserProfileResponse(
            username=user["username"],
            completed_problems=completed_problems,
            total_completed=len(completed_problems)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
