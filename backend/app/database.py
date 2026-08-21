import json
import re
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


def cleanup_duplicate_problems(db) -> None:
    """Deduplicate problems in custom_problems by title / slug prefix and sanitize descriptions."""
    try:
        rows = db.execute("SELECT id, title, description, created_at FROM custom_problems").fetchall()
        by_title = {}
        for r in rows:
            norm_title = r["title"].strip().lower()
            by_title.setdefault(norm_title, []).append(dict(r))

        for title, items in by_title.items():
            if len(items) <= 1:
                continue

            # Determine clean canonical ID
            clean_slug = "-".join(items[0]["title"].lower().split())[:80]
            clean_id = f"custom-{clean_slug}"
            
            canonical_item = next((it for it in items if it["id"] == clean_id), None)
            if not canonical_item:
                # Pick the latest created or shortest id
                items_sorted = sorted(items, key=lambda x: (len(x["id"]), x["created_at"]))
                canonical_item = items_sorted[0]
                if canonical_item["id"] != clean_id:
                    db.execute("UPDATE custom_problems SET id = ? WHERE id = ?", (clean_id, canonical_item["id"]))
                    db.execute("UPDATE user_completed_problems SET problem_id = ? WHERE problem_id = ?", (clean_id, canonical_item["id"]))
                    db.execute("UPDATE sessions SET problem_id = ? WHERE problem_id = ?", (clean_id, canonical_item["id"]))
                    canonical_item["id"] = clean_id

            canonical_id = canonical_item["id"]

            for item in items:
                if item["id"] != canonical_id:
                    db.execute("UPDATE OR IGNORE user_completed_problems SET problem_id = ? WHERE problem_id = ?", (canonical_id, item["id"]))
                    db.execute("DELETE FROM user_completed_problems WHERE problem_id = ?", (item["id"],))
                    db.execute("UPDATE sessions SET problem_id = ? WHERE problem_id = ?", (canonical_id, item["id"]))
                    db.execute("DELETE FROM custom_problems WHERE id = ?", (item["id"],))

        # Sanitize descriptions and separate visible examples from full test suite
        all_custom = db.execute("SELECT id, title, description, examples FROM custom_problems").fetchall()
        for c in all_custom:
            desc = c["description"] or ""
            # Extract Constraints if present
            c_match = re.search(r"\b(\*{0,2}Constraints:.*)", desc, flags=re.IGNORECASE | re.DOTALL)
            c_text = c_match.group(1).strip() if c_match else ""
            if c_text:
                c_text = re.split(r"\bFollow-up:", c_text, flags=re.IGNORECASE)[0].strip()
            
            i_match = re.split(r"\b\*{0,2}Example(?:\s+\d+)?:", desc, flags=re.IGNORECASE)
            i_text = i_match[0].strip() if i_match else desc.strip()
            i_text = re.split(r"\bFollow-up:", i_text, flags=re.IGNORECASE)[0].strip()
            
            sanitized = f"{i_text}\n\n{c_text}" if (i_text and c_text) else (i_text or desc)
            sanitized = re.split(r"\bFollow-up:", sanitized, flags=re.IGNORECASE)[0].strip()
            sanitized = re.sub(r"```+", "", sanitized)
            sanitized = sanitized.replace("*", "")
            sanitized = re.sub(r"\n{3,}", "\n\n", sanitized).strip()
            
            if "reverse" in c["title"].lower() and "k-group" in c["title"].lower():
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
                db.execute(
                    "UPDATE custom_problems SET description = ?, examples = ?, test_cases = ? WHERE id = ?",
                    (sanitized, json.dumps(visible_examples), json.dumps(full_test_cases), c["id"]),
                )
            else:
                db.execute("UPDATE custom_problems SET description = ? WHERE id = ?", (sanitized, c["id"]))
    except Exception:
        pass


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
                starter_code TEXT NOT NULL, created_at TEXT NOT NULL, test_cases TEXT
            );
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, password TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_completed_problems (
                username TEXT NOT NULL, problem_id TEXT NOT NULL, completed_at TEXT NOT NULL,
                PRIMARY KEY (username, problem_id)
            );
            """
        )
        try:
            db.execute("ALTER TABLE custom_problems ADD COLUMN test_cases TEXT")
        except Exception:
            pass
        cleanup_duplicate_problems(db)


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


def upsert_custom_problem(problem: dict) -> None:
    """Insert or replace a custom problem, preserving created_at and removing duplicate legacy rows."""
    with connection() as db:
        existing = db.execute(
            "SELECT created_at FROM custom_problems WHERE id = ?", (problem["id"],)
        ).fetchone()
        created = existing["created_at"] if existing else now()
        test_cases_json = json.dumps(problem.get("test_cases") or problem.get("examples") or [])
        db.execute(
            """
            INSERT OR REPLACE INTO custom_problems
            (id,title,difficulty,topics,description,examples,starter_code,created_at,test_cases)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                problem["id"],
                problem["title"],
                problem["difficulty"],
                json.dumps(problem["topics"]),
                problem["description"],
                json.dumps(problem["examples"]),
                json.dumps(problem["starter_code"]),
                created,
                test_cases_json,
            ),
        )
        # Delete any legacy variants (e.g. custom-slug-XXXXX) or matching titles with different IDs
        legacy_rows = db.execute(
            "SELECT id FROM custom_problems WHERE (id LIKE ? OR title = ?) AND id != ?",
            (f"{problem['id']}-%", problem["title"], problem["id"]),
        ).fetchall()
        for leg in legacy_rows:
            leg_id = leg["id"]
            db.execute("UPDATE OR IGNORE user_completed_problems SET problem_id = ? WHERE problem_id = ?", (problem["id"], leg_id))
            db.execute("DELETE FROM user_completed_problems WHERE problem_id = ?", (leg_id,))
            db.execute("UPDATE sessions SET problem_id = ? WHERE problem_id = ?", (problem["id"], leg_id))
            db.execute("DELETE FROM custom_problems WHERE id = ?", (leg_id,))


def find_custom_problem_by_slug(slug: str) -> dict | None:
    """Find a custom problem whose id is exactly 'custom-{slug}' or starts with 'custom-{slug}-'."""
    with connection() as db:
        row = db.execute(
            "SELECT * FROM custom_problems WHERE id = ? OR id LIKE ?",
            (f"custom-{slug}", f"custom-{slug}-%"),
        ).fetchone()
    if not row:
        return None
    test_cases_data = None
    if "test_cases" in row.keys() and row["test_cases"]:
        try:
            test_cases_data = json.loads(row["test_cases"])
        except Exception:
            pass
    return {
        "id": row["id"],
        "title": row["title"],
        "difficulty": row["difficulty"],
        "topics": json.loads(row["topics"]),
        "description": row["description"],
        "examples": json.loads(row["examples"]),
        "test_cases": test_cases_data or json.loads(row["examples"]),
        "starter_code": json.loads(row["starter_code"]),
        "source": "LeetCode",
        "is_custom": True,
    }


def load_custom_problems() -> list[dict]:
    with connection() as db:
        rows = db.execute(
            "SELECT * FROM custom_problems ORDER BY created_at DESC"
        ).fetchall()
    result = []
    for row in rows:
        test_cases_data = None
        if "test_cases" in row.keys() and row["test_cases"]:
            try:
                test_cases_data = json.loads(row["test_cases"])
            except Exception:
                pass
        result.append({
            "id": row["id"],
            "title": row["title"],
            "difficulty": row["difficulty"],
            "topics": json.loads(row["topics"]),
            "description": row["description"],
            "examples": json.loads(row["examples"]),
            "test_cases": test_cases_data or json.loads(row["examples"]),
            "starter_code": json.loads(row["starter_code"]),
            "source": "LeetCode" if row["id"].startswith("custom-") else "Community",
            "is_custom": True,
        })
    return result


def get_user_by_username(username: str) -> dict | None:
    clean = username.strip().lstrip("@")
    with connection() as db:
        row = db.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (clean,)).fetchone()
    return dict(row) if row else None


def search_users(query: str = "", limit: int = 10) -> list[dict]:
    clean = query.strip().lstrip("@")
    with connection() as db:
        if clean:
            rows = db.execute(
                """
                SELECT u.username, u.created_at, COUNT(c.problem_id) as total_completed
                FROM users u
                LEFT JOIN user_completed_problems c ON u.username = c.username COLLATE NOCASE
                WHERE u.username LIKE ? COLLATE NOCASE
                GROUP BY u.username
                ORDER BY total_completed DESC, u.username ASC
                LIMIT ?
                """,
                (f"%{clean}%", limit),
            ).fetchall()
        else:
            rows = db.execute(
                """
                SELECT u.username, u.created_at, COUNT(c.problem_id) as total_completed
                FROM users u
                LEFT JOIN user_completed_problems c ON u.username = c.username COLLATE NOCASE
                GROUP BY u.username
                ORDER BY total_completed DESC, u.username ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(row) for row in rows]


def create_user(username: str, password_hash: str, email: str) -> dict:
    created_time = now()
    with connection() as db:
        db.execute(
            "INSERT INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)",
            (username, password_hash, email, created_time),
        )
    return {"username": username, "password": password_hash, "email": email, "created_at": created_time}


def add_user_completed_problem(username: str, problem_id: str) -> None:
    clean = username.strip().lstrip("@")
    with connection() as db:
        # Get the canonical casing for the username
        row = db.execute("SELECT username FROM users WHERE username = ? COLLATE NOCASE", (clean,)).fetchone()
        canonical_username = row["username"] if row else clean
        db.execute(
            """
            INSERT OR IGNORE INTO user_completed_problems (username, problem_id, completed_at)
            VALUES (?, ?, ?)
            """,
            (canonical_username, problem_id, now()),
        )


def sync_user_completed_problems(username: str, problem_ids: list[str]) -> None:
    if not problem_ids:
        return
    clean = username.strip().lstrip("@")
    time_str = now()
    with connection() as db:
        row = db.execute("SELECT username FROM users WHERE username = ? COLLATE NOCASE", (clean,)).fetchone()
        canonical_username = row["username"] if row else clean
        for pid in problem_ids:
            db.execute(
                """
                INSERT OR IGNORE INTO user_completed_problems (username, problem_id, completed_at)
                VALUES (?, ?, ?)
                """,
                (canonical_username, pid, time_str),
            )


def get_user_completed_problems(username: str) -> list[str]:
    clean = username.strip().lstrip("@")
    with connection() as db:
        rows = db.execute(
            "SELECT problem_id FROM user_completed_problems WHERE username = ? COLLATE NOCASE ORDER BY completed_at DESC",
            (clean,),
        ).fetchall()
    return [row["problem_id"] for row in rows]
