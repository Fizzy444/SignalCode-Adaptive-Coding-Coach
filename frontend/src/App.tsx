import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createSession,
  connectCoach,
  markProblemCompletedUser,
  syncCompletedProblemsUser,
} from "./api";
import { useAttention } from "./useAttention";
import LandingScreen from "./screens/LandingScreen";
import CatalogScreen from "./screens/CatalogScreen";
import InterviewScreen from "./screens/InterviewScreen";
import ReportScreen from "./screens/ReportScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import type { CoachMessage, CodeRunResult, Language, Problem, Report, User } from "./types";
import "./styles.css";

// Helper functions for persistent problem drafts
function getProblemDraftsMap(): Record<string, {
  language: Language;
  code: string;
  drafts: Partial<Record<Language, string>>;
  messages?: CoachMessage[];
  output?: string;
  runResult?: CodeRunResult | null;
  elapsed?: number;
  updatedAt?: number;
}> {
  try {
    const raw = localStorage.getItem("sc_problem_drafts");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getProblemSavedData(problemId?: string | null) {
  if (!problemId) return null;
  const map = getProblemDraftsMap();
  return map[problemId] || null;
}

function saveProblemDraft(
  problemId?: string | null,
  lang?: Language,
  codeStr?: string,
  allDrafts?: Partial<Record<Language, string>>,
  extra?: { messages?: CoachMessage[]; output?: string; runResult?: CodeRunResult | null; elapsed?: number }
) {
  if (!problemId || !lang || codeStr === undefined) return;
  try {
    const map = getProblemDraftsMap();
    const existing = map[problemId] || {};
    map[problemId] = {
      ...existing,
      language: lang,
      code: codeStr,
      drafts: {
        ...(existing.drafts || {}),
        ...(allDrafts || {}),
        [lang]: codeStr,
      },
      messages: extra?.messages ?? existing.messages ?? [],
      output: extra?.output ?? existing.output ?? "Run your code when you're ready.",
      runResult: extra?.runResult ?? existing.runResult ?? null,
      elapsed: extra?.elapsed ?? existing.elapsed ?? 0,
      updatedAt: Date.now(),
    };
    localStorage.setItem("sc_problem_drafts", JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save problem draft", e);
  }
}

export default function App() {
  const savedSession = useMemo(() => {
    try {
      const item = localStorage.getItem("sc_active_session");
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname === "/" ? "home" : location.pathname.slice(1);
  const setView = (v: string) => navigate(v === "home" ? "/" : "/" + v);

  const [language, setLanguage] = useState<Language>(() => savedSession?.language || "python");
  const [problem, setProblem] = useState<Problem | null>(() => savedSession?.problem || null);
  const [code, setCode] = useState(() => savedSession?.code || "");
  const [drafts, setDrafts] = useState<Partial<Record<Language, string>>>(() => (
    savedSession?.drafts || (savedSession?.code ? { [savedSession.language || "python"]: savedSession.code } : {})
  ));
  const [sessionId, setSessionId] = useState(() => savedSession?.sessionId || "");
  const [messages, setMessages] = useState<CoachMessage[]>(() => savedSession?.messages || []);
  const [elapsed, setElapsed] = useState(() => savedSession?.elapsed || 0);
  const [report, setReport] = useState<Report | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState(() => Boolean(savedSession?.cameraAllowed));
  const [returnView, setReturnView] = useState<string>(() => savedSession?.returnView || "home");

  const [completedProblems, setCompletedProblems] = useState<string[]>(() => {
    try {
      const item = localStorage.getItem("sc_completed_problems");
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const item = localStorage.getItem("sc_current_user");
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  });

  const socket = useRef<WebSocket | null>(null);

  function send(data: object) {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(data));
    }
  }

  const attention = useAttention((signal) => send({ type: "attention", ...signal }));

  // Camera toggle handler
  useEffect(() => {
    if (cameraAllowed && !attention.enabled && !attention.error) {
      void attention.start();
    } else if (!cameraAllowed && attention.enabled) {
      attention.stop();
    }
  }, [cameraAllowed, attention.enabled, attention.error, attention.start, attention.stop]);

  // Sync active session in localStorage
  useEffect(() => {
    if (problem && sessionId) {
      localStorage.setItem("sc_active_session", JSON.stringify({
        view, language, problem, code, drafts, sessionId, messages, elapsed, cameraAllowed, returnView
      }));
      saveProblemDraft(problem.id, language, code, drafts, {
        messages, elapsed
      });
    } else if (view === "library") {
      localStorage.setItem("sc_active_session", JSON.stringify({
        view: "library", language, drafts, cameraAllowed, returnView
      }));
    }
  }, [view, language, problem, code, drafts, sessionId, messages, elapsed, cameraAllowed, returnView]);

  // Re-connect WebSocket on reload if session exists
  useEffect(() => {
    if (sessionId && !socket.current) {
      const ws = connectCoach(sessionId);
      ws.onmessage = (event) => {
        const incoming: CoachMessage = JSON.parse(event.data);
        if (incoming.type === "report" && incoming.payload) {
          setReport(incoming.payload);
          if (incoming.payload.successful_runs > 0) {
            setCompletedProblems((prev) => {
              const currentProblemId = savedSession?.problem?.id || problem?.id;
              if (!currentProblemId || prev.includes(currentProblemId)) return prev;
              const next = [...prev, currentProblemId];
              localStorage.setItem("sc_completed_problems", JSON.stringify(next));
              return next;
            });
          }
        } else {
          setMessages((current) => [...current, incoming]);
        }
      };
      socket.current = ws;
    }
  }, [sessionId]);

  // Timer counter
  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => setElapsed((x: number) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  // Debounced code update sent to AI interviewer
  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(
      () => send({ type: "code_update", code, language }),
      900
    );
    return () => clearTimeout(timer);
  }, [code, language, sessionId]);

  // Protected route redirects
  useEffect(() => {
    if (!user && view !== "home" && view !== "login" && view !== "signup" && view !== "dashboard/signin" && !view.startsWith("profile") && !view.startsWith("u/")) {
      setReturnView(view);
      setView("dashboard/signin");
      if (problem) {
        setProblem(null);
        setSessionId("");
      }
    }
  }, [user, view, problem]);

  function handleLoginSuccess(loggedInUser: User) {
    setUser(loggedInUser);
    localStorage.setItem("sc_current_user", JSON.stringify(loggedInUser));
    if (completedProblems.length > 0) {
      syncCompletedProblemsUser(loggedInUser.username, completedProblems)
        .then((updatedUser) => {
          setUser(updatedUser);
          localStorage.setItem("sc_current_user", JSON.stringify(updatedUser));
          setCompletedProblems(updatedUser.completed_problems);
          localStorage.setItem("sc_completed_problems", JSON.stringify(updatedUser.completed_problems));
        })
        .catch(() => {});
    } else if (loggedInUser.completed_problems?.length > 0) {
      setCompletedProblems(loggedInUser.completed_problems);
      localStorage.setItem("sc_completed_problems", JSON.stringify(loggedInUser.completed_problems));
    }
    setView(returnView === "login" || returnView === "dashboard/signin" ? "home" : returnView);
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("sc_current_user");
    localStorage.removeItem("sc_active_session");
    setProblem(null);
    setSessionId("");
    setView("dashboard/signin");
  }

  function markCompleted(id: string) {
    setCompletedProblems((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem("sc_completed_problems", JSON.stringify(next));
      if (user) {
        markProblemCompletedUser(user.username, id)
          .then((updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem("sc_current_user", JSON.stringify(updatedUser));
          })
          .catch(() => {});
      }
      return next;
    });
  }

  // Start or resume interview session
  async function begin(selectedProblem?: Problem) {
    socket.current?.close();
    setReturnView(view.startsWith("u/") || view === "profile" ? view : (selectedProblem ? "library" : "home"));
    setView("home");
    setReport(null);

    const created = await createSession(language, selectedProblem?.id);
    const prob = created.problem;
    setProblem(prob);
    setSessionId(created.session_id);

    // Retrieve any saved drafts for this problem
    const savedDraftsForProblem = getProblemSavedData(prob.id);
    const targetLang = savedDraftsForProblem?.language ?? language;

    const starterDrafts: Partial<Record<Language, string>> = {
      python: savedDraftsForProblem?.drafts?.python ?? prob.starter_code.python,
      javascript: savedDraftsForProblem?.drafts?.javascript ?? prob.starter_code.javascript,
      java: savedDraftsForProblem?.drafts?.java ?? prob.starter_code.java,
      c: savedDraftsForProblem?.drafts?.c ?? prob.starter_code.c,
      cpp: savedDraftsForProblem?.drafts?.cpp ?? prob.starter_code.cpp,
    };

    setLanguage(targetLang);
    setDrafts(starterDrafts);
    setCode(starterDrafts[targetLang] ?? prob.starter_code[targetLang] ?? "");
    setMessages(savedDraftsForProblem?.messages || []);
    setElapsed(savedDraftsForProblem?.elapsed || 0);

    const ws = connectCoach(created.session_id);
    ws.onmessage = (event) => {
      const incoming: CoachMessage = JSON.parse(event.data);
      if (incoming.type === "report" && incoming.payload) {
        setReport(incoming.payload);
        if (incoming.payload.successful_runs > 0) {
          markCompleted(prob.id);
        }
      } else {
        setMessages((current) => [...current, incoming]);
      }
    };
    socket.current = ws;
  }

  function leaveInterview() {
    if (problem) {
      saveProblemDraft(problem.id, language, code, drafts, {
        messages,
        elapsed,
      });
    }
    localStorage.removeItem("sc_active_session");
    socket.current?.close();
    socket.current = null;
    attention.stop();
    setCameraAllowed(false);
    setProblem(null);
    setSessionId("");
    setReport(null);
    setView(returnView);
  }

  function switchLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    const nextDrafts = {
      ...drafts,
      [language]: code,
    };
    setDrafts(nextDrafts);
    setLanguage(nextLanguage);
    const savedForProblem = getProblemSavedData(problem?.id);
    const nextCode = nextDrafts[nextLanguage] ?? savedForProblem?.drafts?.[nextLanguage] ?? problem?.starter_code[nextLanguage] ?? "";
    setCode(nextCode);
    if (problem) {
      saveProblemDraft(problem.id, nextLanguage, nextCode, nextDrafts);
    }
  }

  function handleResetCode() {
    if (!problem) return;
    if (window.confirm("Reset your code to the original starter code for this challenge?")) {
      const starter = problem.starter_code[language] ?? "";
      setCode(starter);
      setDrafts((current) => {
        const next = { ...current, [language]: starter };
        saveProblemDraft(problem.id, language, starter, next);
        return next;
      });
    }
  }

  function handleSendMessage(msgText: string) {
    if (!msgText.trim()) return;
    setMessages((current) => [...current, { type: "user", level: "user", message: msgText }]);
    send({ type: "user_message", message: msgText, code, language });
  }

  function handleAskHint() {
    const hintMsg = "Can you give me a subtle hint on the approach?";
    setMessages((current) => [...current, { type: "user", level: "hint", message: hintMsg }]);
    send({ type: "hint_request", code, language });
  }

  function handleRunSuccess(result: CodeRunResult) {
    const passed = result.passed ?? !(/error|disabled/i.test(result.output) || result.exit_code !== 0);
    send({ type: "run_result", code, language, passed, output: result.output });
  }

  function submitSolution() {
    if (!problem) return;
    markCompleted(problem.id);
    send({ type: "complete" });
  }

  // --- Router Rendering ---

  if (view === "login" || view === "dashboard/signin") {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onNavigate={(v) => setView(v)}
      />
    );
  }

  if (view === "signup") {
    return (
      <SignupScreen
        onSignupSuccess={handleLoginSuccess}
        onNavigate={(v) => setView(v)}
      />
    );
  }

  if (view.startsWith("u/") || view === "profile") {
    const rawUser = view.startsWith("u/") ? view.slice(2) : user?.username;
    const targetUser = rawUser ? decodeURIComponent(rawUser).trim().replace(/^@+/, "") : "";
    if (!targetUser) {
      return (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigate={(v) => setView(v)}
        />
      );
    }
    return (
      <ProfileScreen
        user={user}
        targetUsername={targetUser}
        onSelectProblem={begin}
        onNavigate={(v) => setView(v)}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "library") {
    return (
      <CatalogScreen
        user={user}
        completedProblems={completedProblems}
        onSelectProblem={begin}
        onNavigate={(v) => setView(v)}
        onLogout={handleLogout}
      />
    );
  }

  // Home View: If report active -> show ReportScreen
  if (report && problem) {
    return (
      <ReportScreen
        user={user}
        report={report}
        problem={problem}
        finalCode={code}
        messages={messages}
        onNavigate={(v) => setView(v)}
        onPracticeAgain={() => begin(problem)}
        onLogout={handleLogout}
      />
    );
  }

  // Home View: If problem active -> show InterviewScreen
  if (problem) {
    return (
      <InterviewScreen
        user={user}
        problem={problem}
        language={language}
        code={code}
        drafts={drafts}
        sessionId={sessionId}
        messages={messages}
        elapsed={elapsed}
        attention={attention}
        cameraAllowed={cameraAllowed}
        onCodeChange={(nextCode) => {
          setCode(nextCode);
          setDrafts((current) => {
            const next = { ...current, [language]: nextCode };
            if (problem) saveProblemDraft(problem.id, language, nextCode, next);
            return next;
          });
        }}
        onLanguageChange={switchLanguage}
        onResetCode={handleResetCode}
        onSendMessage={handleSendMessage}
        onAskHint={handleAskHint}
        onRunSuccess={handleRunSuccess}
        onSubmitSolution={submitSolution}
        onLeaveInterview={leaveInterview}
        onToggleCamera={() => setCameraAllowed((prev) => !prev)}
        onNavigateProfile={() => setView(`u/${user?.username || ""}`)}
      />
    );
  }

  // Otherwise: Landing Page
  return (
    <LandingScreen
      user={user}
      onNavigate={(v) => setView(v)}
      onStartInterview={() => begin()}
      onLogout={handleLogout}
    />
  );
}
