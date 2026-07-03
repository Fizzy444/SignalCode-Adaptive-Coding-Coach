import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from .config import get_settings


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connection():
    path = Path(get_settings().database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize() -> None:
    with connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, language TEXT NOT NULL, problem_id TEXT NOT NULL,
                difficulty TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
                event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
            CREATE TABLE IF NOT EXISTS custom_problems (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, difficulty TEXT NOT NULL,
                topics TEXT NOT NULL, description TEXT NOT NULL, examples TEXT NOT NULL,
                starter_code TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, password TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_completed_problems (
                username TEXT NOT NULL, problem_id TEXT NOT NULL, completed_at TEXT NOT NULL,
                PRIMARY KEY (username, problem_id)
            );
            """
        )


def create_session(session_id: str, language: str, problem_id: str, difficulty: str) -> None:
    with connection() as db:
        db.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, NULL)",
            (session_id, language, problem_id, difficulty, now()),
        )


def get_session(session_id: str) -> dict | None:
    with connection() as db:
        row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    return dict(row) if row else None


def save_event(session_id: str, event_type: str, payload: dict) -> None:
    with connection() as db:
        db.execute(
            "INSERT INTO events(session_id,event_type,payload,created_at) VALUES(?,?,?,?)",
            (session_id, event_type, json.dumps(payload), now()),
        )


def finish_session(session_id: str) -> None:
    with connection() as db:
        db.execute("UPDATE sessions SET ended_at=? WHERE id=?", (now(), session_id))


def session_report(session_id: str) -> dict:
    with connection() as db:
        session = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        events = db.execute(
            "SELECT * FROM events WHERE session_id=? ORDER BY id", (session_id,)
        ).fetchall()
    if not session:
        return {"error": "Session not found"}
    parsed = [(e["event_type"], json.loads(e["payload"])) for e in events]
    runs = [p for t, p in parsed if t == "run_result"]
    attention = [p.get("attention_score") for t, p in parsed if t == "attention"]
    attention = [x for x in attention if x is not None]
    hints = sum(1 for t, _ in parsed if t == "hint_request")
    started = datetime.fromisoformat(session["started_at"])
    ended = datetime.fromisoformat(session["ended_at"] or now())
    return {
        "session_id": session_id,
        "problem_id": session["problem_id"],
        "language": session["language"],
        "duration_seconds": round((ended - started).total_seconds()),
        "runs": len(runs),
        "successful_runs": sum(bool(r.get("passed")) for r in runs),
        "hints_used": hints,
        "average_focus": round(sum(attention) / len(attention)) if attention else None,
        "summary": "You built and tested an approach under interview conditions.",
    }


def save_custom_problem(problem: dict) -> None:
    with connection() as db:
        db.execute(
            """
            INSERT INTO custom_problems
            (id,title,difficulty,topics,description,examples,starter_code,created_at)
            VALUES(?,?,?,?,?,?,?,?)
            """,
            (
                problem["id"],
                problem["title"],
                problem["difficulty"],
                json.dumps(problem["topics"]),
                problem["description"],
                json.dumps(problem["examples"]),
                json.dumps(problem["starter_code"]),
                now(),
            ),
        )


def load_custom_problems() -> list[dict]:
    with connection() as db:
        rows = db.execute(
            "SELECT * FROM custom_problems ORDER BY created_at DESC"
        ).fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "difficulty": row["difficulty"],
            "topics": json.loads(row["topics"]),
            "description": row["description"],
            "examples": json.loads(row["examples"]),
            "starter_code": json.loads(row["starter_code"]),
            "source": "Community",
            "is_custom": True,
        }
        for row in rows
    ]


def get_user_by_username(username: str) -> dict | None:
    with connection() as db:
        row = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    return dict(row) if row else None


def create_user(username: str, password_hash: str) -> dict:
    created_time = now()
    with connection() as db:
        db.execute(
            "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
            (username, password_hash, created_time),
        )
    return {"username": username, "password": password_hash, "created_at": created_time}


def add_user_completed_problem(username: str, problem_id: str) -> None:
    with connection() as db:
        db.execute(
            """
            INSERT OR IGNORE INTO user_completed_problems (username, problem_id, completed_at)
            VALUES (?, ?, ?)
            """,
            (username, problem_id, now()),
        )


def sync_user_completed_problems(username: str, problem_ids: list[str]) -> None:
    if not problem_ids:
        return
    time_str = now()
    with connection() as db:
        for pid in problem_ids:
            db.execute(
                """
                INSERT OR IGNORE INTO user_completed_problems (username, problem_id, completed_at)
                VALUES (?, ?, ?)
                """,
                (username, pid, time_str),
            )


def get_user_completed_problems(username: str) -> list[str]:
    with connection() as db:
        rows = db.execute(
            "SELECT problem_id FROM user_completed_problems WHERE username=? ORDER BY completed_at DESC",
            (username,),
        ).fetchall()
    return [row["problem_id"] for row in rows]
