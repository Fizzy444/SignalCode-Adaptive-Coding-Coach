from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.main import app


def test_problem_catalog_search_and_custom_problem(tmp_path: Path):
    settings = get_settings()
    original_path = settings.database_path
    settings.database_path = str(tmp_path / "test.db")
    try:
        with TestClient(app) as client:
            catalog = client.get("/api/problems")
            assert catalog.status_code == 200
            assert any(
                problem["source"].startswith("Google DeepMind")
                for problem in catalog.json()
            )

            created = client.post(
                "/api/problems",
                json={
                    "title": "Reverse a tiny list",
                    "difficulty": "easy",
                    "topics": ["arrays"],
                    "description": "Return the values in reverse order.",
                    "examples": [{"input": "[1, 2]", "output": "[2, 1]"}],
                    "starter_code": {
                        "python": "def reverse(values):\n    pass\n",
                        "javascript": "function reverse(values) {}\n",
                    },
                },
            )
            assert created.status_code == 201
            problem_id = created.json()["id"]
            assert client.get(f"/api/problems/{problem_id}").status_code == 200

            session = client.post(
                "/api/sessions",
                json={"language": "python", "problem_id": problem_id},
            )
            assert session.status_code == 200
            assert session.json()["problem"]["id"] == problem_id
    finally:
        settings.database_path = original_path


from unittest.mock import MagicMock, patch


def test_leetcode_import(tmp_path: Path):
    settings = get_settings()
    original_path = settings.database_path
    settings.database_path = str(tmp_path / "test_import.db")
    try:
        with patch("httpx.AsyncClient.get") as mock_get, patch("httpx.AsyncClient.post") as mock_post:
            mock_res_get = MagicMock()
            mock_res_get.status_code = 200
            mock_res_get.json.return_value = {
                "questionTitle": "Three Sum Closest",
                "titleSlug": "three-sum-closest",
                "difficulty": "Medium",
                "topicTags": [{"name": "Array"}, {"name": "Two Pointers"}],
                "question": "<p>Given an integer array nums of length n and an integer target, find three integers.</p><pre>Input: nums = [-1,2,1,-4], target = 1\nOutput: 2</pre>"
            }
            mock_res_get.raise_for_status = lambda: None
            mock_get.return_value = mock_res_get

            mock_res_post = MagicMock()
            mock_res_post.status_code = 200
            mock_res_post.json.return_value = {
                "data": {
                    "question": {
                        "codeSnippets": [
                            {"langSlug": "python3", "code": "def threeSumClosest(nums, target):\n    pass\n"},
                            {"langSlug": "javascript", "code": "function threeSumClosest(nums, target) {}\n"}
                        ]
                    }
                }
            }
            mock_post.return_value = mock_res_post


            with TestClient(app) as client:
                res = client.post("/api/problems/import", json={"slug": "three-sum-closest"})
                assert res.status_code == 201
                data = res.json()
                assert data["title"] == "Three Sum Closest"
                assert data["difficulty"] == "medium"
                assert "array" in data["topics"]
                assert data["starter_code"]["python"] == "def threeSumClosest(nums, target):\n    pass\n"
                assert len(data["examples"]) == 1
                assert data["examples"][0]["output"] == "2"

    finally:
        settings.database_path = original_path

