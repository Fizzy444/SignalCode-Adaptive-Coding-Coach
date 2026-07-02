import type { CodeRunResult, Language } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function runCode(
  language: Language,
  code: string,
  problemId?: string,
  testCases?: { input: string; output: string }[]
): Promise<CodeRunResult> {
  const response = await fetch(`${API_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, problem_id: problemId, test_cases: testCases }),
  });
  if (!response.ok) {
    return {
      output: `Runner error: ${response.status} ${response.statusText}`,
      passed: false,
    };
  }
  return response.json();
}

