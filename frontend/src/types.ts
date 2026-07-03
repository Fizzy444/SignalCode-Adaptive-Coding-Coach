export type Language = "python" | "javascript" | "java";

export interface TestCaseResult {
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string | null;
}

export interface CodeRunResult {
  output: string;
  exit_code?: number | null;
  timed_out?: boolean;
  passed?: boolean | null;
  test_results?: TestCaseResult[] | null;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  description: string;
  examples: { input: string; output: string }[];
  test_cases?: { input: string; output: string }[];
  starter_code: Record<Language, string>;
  source: string;
  source_url?: string;
  license?: string;
  is_custom: boolean;
}

export interface Report {
  duration_seconds: number;
  runs: number;
  successful_runs: number;
  hints_used: number;
  average_focus: number | null;
  summary: string;
}

export interface CoachMessage {
  type: "coach" | "status" | "problem" | "report" | "user";
  message: string;
  level: "info" | "nudge" | "hint" | "celebrate" | "user";
  payload?: Report;
}

export interface User {
  username: string;
  completed_problems: string[];
}

export interface UserProfile {
  username: string;
  completed_problems: Problem[];
  total_completed: number;
}

