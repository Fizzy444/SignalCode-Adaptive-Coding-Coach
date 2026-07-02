import type { CodeRunResult, Language } from "./types";

const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const isNetworkHost = host !== "localhost" && host !== "127.0.0.1";
const envApi = import.meta.env.VITE_API_URL;
const API_URL = (isNetworkHost && envApi?.includes("localhost")) ? `http://${host}:8000` : (envApi || `http://${host}:8000`);

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

