import type { Language, Problem } from "./types";

const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const isNetworkHost = host !== "localhost" && host !== "127.0.0.1";
const envApi = import.meta.env.VITE_API_URL;
const envWs = import.meta.env.VITE_WS_URL;
const API_URL = (isNetworkHost && envApi?.includes("localhost")) ? `http://${host}:8000` : (envApi || `http://${host}:8000`);
const WS_URL = (isNetworkHost && envWs?.includes("localhost")) ? `ws://${host}:8000` : (envWs || `ws://${host}:8000`);

export async function createSession(language: Language, problemId?: string): Promise<{
  session_id: string;
  problem: Problem;
}> {
  const response = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, difficulty: "easy", problem_id: problemId }),
  });
  if (!response.ok) throw new Error("Could not start a session");
  return response.json();
}

export async function getProblems(): Promise<Problem[]> {
  const response = await fetch(`${API_URL}/api/problems`);
  if (!response.ok) throw new Error("Could not load the problem library");
  return response.json();
}

export async function addProblem(
  problem: Omit<Problem, "id" | "source" | "source_url" | "license" | "is_custom">
): Promise<Problem> {
  const response = await fetch(`${API_URL}/api/problems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problem),
  });
  if (!response.ok) throw new Error("Could not save the problem");
  return response.json();
}

export async function importProblem(slug: string): Promise<Problem> {
  const response = await fetch(`${API_URL}/api/problems/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Could not import problem from LeetCode");
  }
  return response.json();
}

export function connectCoach(sessionId: string): WebSocket {
  return new WebSocket(`${WS_URL}/ws/${sessionId}`);
}

