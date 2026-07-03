from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.config import get_settings
from backend.app.main import app


def test_auth_and_profile_flow(tmp_path: Path):
    settings = get_settings()
    original_path = settings.database_path
    settings.database_path = str(tmp_path / "test_auth.db")
    try:
        with TestClient(app) as client:
            # 1. New user login (auto signup)
            res = client.post("/api/auth/login", json={"username": "alice", "password": "secretpassword"})
            assert res.status_code == 200
            data = res.json()
            assert data["username"] == "alice"
            assert data["completed_problems"] == []

            # 2. Login with incorrect password
            res_err = client.post("/api/auth/login", json={"username": "alice", "password": "wrongpassword"})
            assert res_err.status_code == 401

            # 3. Login with correct password
            res_ok = client.post("/api/auth/login", json={"username": "alice", "password": "secretpassword"})
            assert res_ok.status_code == 200

            # 4. Mark a problem completed
            res_comp = client.post("/api/users/alice/complete", json={"problem_id": "two-sum"})
            assert res_comp.status_code == 200
            assert "two-sum" in res_comp.json()["completed_problems"]

            # 5. Sync multiple problems
            res_sync = client.post("/api/users/alice/sync", json={"problem_ids": ["three-sum", "valid-parentheses"]})
            assert res_sync.status_code == 200
            completed = res_sync.json()["completed_problems"]
            assert "two-sum" in completed
            assert "three-sum" in completed
            assert "valid-parentheses" in completed

            # 6. Get profile
            res_prof = client.get("/api/users/alice/profile")
            assert res_prof.status_code == 200
            prof_data = res_prof.json()
            assert prof_data["username"] == "alice"
            assert prof_data["total_completed"] >= 1
    finally:
        settings.database_path = original_path
