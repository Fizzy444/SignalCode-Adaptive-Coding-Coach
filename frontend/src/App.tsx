import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { addProblem, connectCoach, createSession, getProblems, importProblem } from "./api";
import { runCode } from "./runner";
import type { CoachMessage, CodeRunResult, Language, Problem, Report } from "./types";
import { useAttention } from "./useAttention";
import "./styles.css";

export default function App() {
  const savedSession = useMemo(() => {
    try {
      const item = localStorage.getItem("sc_active_session");
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, []);

  const [view, setView] = useState<"home" | "library">(() => savedSession?.view || "home");
  const [language, setLanguage] = useState<Language>(() => savedSession?.language || "python");
  const [problem, setProblem] = useState<Problem | null>(() => savedSession?.problem || null);
  const [code, setCode] = useState(() => savedSession?.code || "");
  const [sessionId, setSessionId] = useState(() => savedSession?.sessionId || "");
  const [messages, setMessages] = useState<CoachMessage[]>(() => savedSession?.messages || []);
  const [output, setOutput] = useState(() => savedSession?.output || "Run your code when you're ready.");
  const [runResult, setRunResult] = useState<CodeRunResult | null>(() => savedSession?.runResult || null);
  const [chatInput, setChatInput] = useState("");
  const [elapsed, setElapsed] = useState(() => savedSession?.elapsed || 0);
  const [report, setReport] = useState<Report | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState(() => Boolean(savedSession?.cameraAllowed));
  const [returnView, setReturnView] = useState<"home" | "library">(() => savedSession?.returnView || "home");
  const [leftWidth, setLeftWidth] = useState(() => Number(localStorage.getItem("sc_left_width")) || 300);
  const [rightWidth, setRightWidth] = useState(() => Number(localStorage.getItem("sc_right_width")) || 320);
  const [bottomHeight, setBottomHeight] = useState(() => Number(localStorage.getItem("sc_bottom_height")) || 240);
  const [dragging, setDragging] = useState<"left" | "right" | "bottom" | null>(null);
  const socket = useRef<WebSocket | null>(null);

  const handleMouseDown = (type: "left" | "right" | "bottom") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(type);
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const startBottom = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (type === "left") {
        const next = Math.max(200, Math.min(window.innerWidth - rightWidth - 360, startLeft + (moveEvent.clientX - startX)));
        setLeftWidth(next);
        localStorage.setItem("sc_left_width", String(next));
      } else if (type === "right") {
        const next = Math.max(240, Math.min(window.innerWidth - leftWidth - 360, startRight - (moveEvent.clientX - startX)));
        setRightWidth(next);
        localStorage.setItem("sc_right_width", String(next));
      } else if (type === "bottom") {
        const next = Math.max(80, Math.min(window.innerHeight - 200, startBottom - (moveEvent.clientY - startY)));
        setBottomHeight(next);
        localStorage.setItem("sc_bottom_height", String(next));
      }
    };

    const onMouseUp = () => {
      setDragging(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const send = (payload: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  };
  const attention = useAttention((signal) => send({ type: "attention", ...signal }));

  useEffect(() => {
    if (cameraAllowed && !attention.enabled && !attention.error) {
      void attention.start();
    } else if (!cameraAllowed && attention.enabled) {
      attention.stop();
    }
  }, [cameraAllowed, attention]);

  useEffect(() => {
    if (problem && sessionId) {
      localStorage.setItem("sc_active_session", JSON.stringify({
        view, language, problem, code, sessionId, messages, output, runResult, elapsed, cameraAllowed, returnView
      }));
    } else if (view === "library") {
      localStorage.setItem("sc_active_session", JSON.stringify({
        view: "library", language, cameraAllowed, returnView
      }));
    } else if (!problem && view === "home") {
      localStorage.removeItem("sc_active_session");
    }
  }, [view, language, problem, code, sessionId, messages, output, runResult, elapsed, cameraAllowed, returnView]);

  useEffect(() => {
    if (sessionId && !socket.current) {
      const ws = connectCoach(sessionId);
      ws.onmessage = (event) => {
        const incoming: CoachMessage = JSON.parse(event.data);
        if (incoming.type === "report" && incoming.payload) setReport(incoming.payload);
        else setMessages((current) => [...current.slice(-5), incoming]);
      };
      socket.current = ws;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => setElapsed((x: number) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(
      () => send({ type: "code_update", code, language }),
      900
    );
    return () => clearTimeout(timer);
  }, [code, language, sessionId]);

  async function begin(selectedProblem?: Problem) {
    socket.current?.close();
    setReturnView(selectedProblem ? "library" : "home");
    const created = await createSession(language, selectedProblem?.id);
    setProblem(created.problem);
    setSessionId(created.session_id);
    setCode(created.problem.starter_code[language]);
    setMessages([]);
    setReport(null);
    setElapsed(0);
    setRunResult(null);
    setChatInput("");
    const ws = connectCoach(created.session_id);
    ws.onmessage = (event) => {
      const incoming: CoachMessage = JSON.parse(event.data);
      if (incoming.type === "report" && incoming.payload) setReport(incoming.payload);
      else setMessages((current) => [...current.slice(-5), incoming]);
    };
    socket.current = ws;
  }

  function leaveInterview() {
    localStorage.removeItem("sc_active_session");
    socket.current?.close();
    socket.current = null;
    attention.stop();
    setCameraAllowed(false);
    setProblem(null);
    setSessionId("");
    setCode("");
    setMessages([]);
    setReport(null);
    setOutput("Run your code when you're ready.");
    setRunResult(null);
    setChatInput("");
    setElapsed(0);
    setView(returnView);
  }

  async function execute() {
    if (problem && code.trim() === problem.starter_code[language].trim()) {
      setOutput("Write some solution code before running.");
      setRunResult({ output: "Write some solution code before running.", passed: false });
      return;
    }
    setOutput("Running code and test cases...");
    setRunResult({ output: "Running code and test cases...", passed: null });
    const result = await runCode(language, code, problem?.id, problem?.test_cases || problem?.examples);
    setOutput(result.output);
    setRunResult(result);
    const passed = result.passed ?? !(/error|disabled/i.test(result.output) || result.exit_code !== 0);
    send({ type: "run_result", code, language, passed, output: result.output });
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setMessages((current) => [...current, { type: "user", level: "user", message: msg }]);
    send({ type: "user_message", message: msg, code, language });
    setChatInput("");
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  if (!problem) {
    if (view === "library") {
      return (
        <>
          <video ref={attention.videoRef} muted playsInline style={{ display: "none" }} />
          <ProblemLibrary
            language={language}
            onLanguage={setLanguage}
            onBack={() => setView("home")}
            onPractice={begin}
          />
        </>
      );
    }
    return (
      <main className="landing">
        <video ref={attention.videoRef} muted playsInline style={{ display: "none" }} />
        <nav className="site-nav">
          <div className="brand">
            <span className="brand-dot" />
            SignalCode
          </div>
          <button className="btn-ghost" onClick={() => setView("library")}>Browse problems</button>
        </nav>

        <div className="hero-section">
          <div className="hero-pill">
            <span className="hero-pill-dot" />
            AI-Powered Interview Sandbox
          </div>
          <h1 className="hero-title">Practice smarter.<br /><em>Ship faster.</em></h1>
          <p className="hero-subtitle">
            A private AI coach that watches your process—not your personality—and delivers the smallest useful hint at exactly the right moment.
          </p>
          <div className="hero-actions">
            <select
              className="form-select"
              style={{ width: "auto" }}
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <button className="btn-primary" onClick={() => setView("library")}>
              Browse Problems →
            </button>
          </div>
          <p className="hero-meta">
            <label>
              <input
                type="checkbox"
                checked={cameraAllowed}
                onChange={(event) => setCameraAllowed(event.target.checked)}
              />
              Enable on-device focus tracking (camera stays local)
            </label>
          </p>
        </div>

        <div className="stats-strip">
          <div className="stat-item">
            <span className="stat-num">18+</span>
            <span className="stat-label">Classic Problems</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">&lt;10ms</span>
            <span className="stat-label">Code Execution</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">100%</span>
            <span className="stat-label">Local & Private</span>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Adaptive Hint Engine</h3>
            <p>Analyzes your approach in real-time and nudges you without giving away the solution.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👁️</div>
            <h3>On-Device Focus Signal</h3>
            <p>MediaPipe AI tracks your focus locally—no video leaves your browser.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Instant Test Sandbox</h3>
            <p>Run Python or JavaScript code with automated test case validation in milliseconds.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Session Reports</h3>
            <p>Post-session breakdown of runs, hints used, focus metrics, and complexity analysis.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace">
      {dragging && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            cursor: dragging === "bottom" ? "row-resize" : "col-resize",
            userSelect: "none",
          }}
        />
      )}
      <header className="ws-header">
        <div className="ws-header-left">
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={leaveInterview}>
            ← Back
          </button>
          <div className="ws-brand">
            <span className="brand-dot" />
            SignalCode
          </div>
        </div>
        <div className="ws-header-right">
          <div className="session-timer">
            <span className="live-dot" />
            <span>{mins}:{secs}</span>
          </div>
          <button
            className={`btn-icon${attention.enabled ? " active" : ""}`}
            title={attention.error || "Toggle camera focus tracking"}
            onClick={() => setCameraAllowed((prev) => !prev)}
          >
            {attention.enabled ? "● Cam On" : "○ Cam Off"}
          </button>
          <button className="btn-ghost" style={{ fontSize: "13px" }} onClick={() => send({ type: "complete" })}>
            End session
          </button>
        </div>
      </header>

      <div
        className="ws-grid"
        style={{
          gridTemplateColumns: `${leftWidth}px 5px minmax(340px,1fr) 5px ${rightWidth}px`,
          height: "calc(100vh - 52px)",
        }}
      >
        <aside className="panel-problem">
          <div className="prob-meta">
            <span className={`diff-badge diff-${problem.difficulty}`}>{problem.difficulty}</span>
            {problem.topics.slice(0, 4).map((t, i) => (
              <span key={i} className="tag-chip">{t}</span>
            ))}
          </div>
          <h2 className="prob-title">{problem.title}</h2>
          <div className="prob-desc">{problem.description}</div>

          {(!problem.description.toLowerCase().includes("example 1:") &&
            !problem.description.toLowerCase().includes("input:") &&
            problem.examples?.length > 0) && (
            <div className="prob-examples">
              <h3>Examples</h3>
              {problem.examples.map((ex, i) => (
                <div key={i} className="prob-example-block">
                  <div><strong>Input:</strong> {ex.input}</div>
                  <div><strong>Output:</strong> {ex.output}</div>
                </div>
              ))}
            </div>
          )}

          <div className="camera-section">
            <h3>Focus Tracking</h3>
            <video
              ref={attention.videoRef}
              muted playsInline
              className="camera-video"
              style={{ display: cameraAllowed ? "block" : "none" }}
            />
            {cameraAllowed ? (
              <>
                <div className="focus-bar">
                  <span className="focus-bar-label">Focus signal</span>
                  <span className="focus-bar-score">{attention.score}</span>
                </div>
                {attention.error && (
                  <small style={{ color: "var(--red)", fontSize: "12px", display: "block", marginBottom: "8px" }}>
                    {attention.error}
                  </small>
                )}
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "12px" }} onClick={() => setCameraAllowed(false)}>
                  Disable camera
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "10px" }}>
                  On-device only · no video leaves your browser
                </p>
                {attention.error && (
                  <small style={{ color: "var(--red)", fontSize: "12px", display: "block", marginBottom: "8px" }}>
                    {attention.error}
                  </small>
                )}
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "12px" }} onClick={() => setCameraAllowed(true)}>
                  Enable focus camera
                </button>
              </>
            )}
          </div>
        </aside>

        <div className={`resizer resizer-col${dragging === "left" ? " dragging" : ""}`} onMouseDown={handleMouseDown("left")} />

        <section className="panel-editor">
          <div className="editor-toolbar">
            <span className="label" style={{ fontSize: "12px" }}>{language === "python" ? "Python 3" : "JavaScript"}</span>
            <button className="run-btn" onClick={execute}>▶ Run Code</button>
          </div>
          <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{ fontSize: 14, minimap: { enabled: false }, padding: { top: 16 }, automaticLayout: true, lineNumbersMinChars: 3, scrollBeyondLastLine: false }}
            />
          </div>
          <div className={`resizer resizer-row${dragging === "bottom" ? " dragging" : ""}`} onMouseDown={handleMouseDown("bottom")} />
          <div className="panel-output" style={{ height: `${bottomHeight}px` }}>
            {runResult?.test_results ? (
              <div className="test-results">
                <div className="test-results-header">
                  <span className="label">Test Results</span>
                  <span className={`result-badge ${runResult.passed ? "passed" : "failed"}`}>
                    {runResult.passed ? "✓ All Passed" : "✗ Some Failed"}
                  </span>
                </div>
                {runResult.test_results.map((tc, idx) => (
                  <div key={idx} className={`tc-row ${tc.passed ? "tc-pass" : "tc-fail"}`}>
                    <div className="tc-row-header">
                      <strong>{tc.name}</strong>
                      <span style={{ color: tc.passed ? "var(--green)" : "var(--red)" }}>{tc.passed ? "✓" : "✗"}</span>
                    </div>
                    <div className="tc-row-body">
                      <div><span className="key">Input</span><code>{tc.input}</code></div>
                      <div><span className="key">Expected</span><code>{tc.expected}</code></div>
                      <div><span className="key">Actual</span><code>{tc.actual}</code></div>
                      {tc.error && <div className="tc-err">{tc.error}</div>}
                    </div>
                  </div>
                ))}
                {runResult.output &&
                  runResult.output !== "Code ran successfully with no output." &&
                  runResult.output !== "Code ran successfully with no console output." && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
                      <span className="label">Console</span>
                      <pre style={{ marginTop: "6px", color: "var(--text-2)" }}>{runResult.output}</pre>
                    </div>
                  )}
              </div>
            ) : (
              <div className="output-content"><pre>{runResult?.output || output}</pre></div>
            )}
          </div>
        </section>

        <div className={`resizer resizer-col${dragging === "right" ? " dragging" : ""}`} onMouseDown={handleMouseDown("right")} />

        <aside className="panel-coach">
          <div className="coach-header">
            <div className="coach-avatar">S</div>
            <div className="coach-meta">
              <div className="coach-name">SignalCode Coach</div>
              <div className="coach-status">Watching your process</div>
            </div>
          </div>
          <div className="coach-messages">
            {messages.length === 0 && <p className="empty-coach">I'll stay quiet until a nudge is useful.</p>}
            {messages.map((m, index) => (
              <div className={`msg msg-${m.level}`} key={index}>
                {m.level === "user"
                  ? <div className="msg-from">You</div>
                  : m.level !== "info" && <div className="msg-from">Coach</div>}
                {m.message}
              </div>
            ))}
          </div>
          <div className="coach-footer">
            <form className="chat-input-row" onSubmit={handleSendMessage}>
              <input
                className="chat-input"
                type="text"
                placeholder="Ask about complexity, approach..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button className="chat-send" type="submit" disabled={!chatInput.trim()}>Send</button>
            </form>
            <button className="hint-btn" onClick={() => send({ type: "hint_request", code, language })}>
              💡 Give me a hint
            </button>
          </div>
        </aside>
      </div>

      {report && (
        <div className="modal-overlay">
          <div className="modal-box report-box">
            <div className="modal-head">
              <div>
                <span className="label">Session Complete</span>
                <h2 style={{ marginTop: "6px" }}>Your practice, in signals.</h2>
              </div>
            </div>
            <div className="report-stats">
              <div className="report-stat">
                <strong>{Math.round(report.duration_seconds / 60)}<span style={{ fontSize: "18px" }}>m</span></strong>
                <span>Time spent</span>
              </div>
              <div className="report-stat">
                <strong>{report.runs}</strong>
                <span>Code runs</span>
              </div>
              <div className="report-stat">
                <strong>{report.hints_used}</strong>
                <span>Hints used</span>
              </div>
              <div className="report-stat">
                <strong>{report.average_focus ?? "—"}</strong>
                <span>Avg focus</span>
              </div>
            </div>
            <p className="report-summary">{report.summary}</p>
            <button className="btn-primary" onClick={leaveInterview}>Practice another →</button>
          </div>
        </div>
      )}
    </main>
  );
}

function ProblemLibrary({
  language,
  onLanguage,
  onBack,
  onPractice,
}: {
  language: Language;
  onLanguage: (language: Language) => void;
  onBack: () => void;
  onPractice: (problem: Problem) => void;
}) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSlug, setImportSlug] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProblems().then(setProblems).catch((reason) => setError(reason.message));
  }, []);

  const tags = [...new Set(problems.flatMap((item) => item.topics))].sort();
  const visible = problems.filter((item) => {
    const text = `${item.title} ${item.description} ${item.topics.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (tag === "all" || item.topics.includes(tag));
  });

  async function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const title = String(data.get("title") || "");
    const description = String(data.get("description") || "");
    const topics = String(data.get("topics") || "")
      .split(",").map((topic) => topic.trim().toLowerCase()).filter(Boolean);
    const exampleInput = String(data.get("exampleInput") || "");
    const exampleOutput = String(data.get("exampleOutput") || "");
    try {
      const added = await addProblem({
        title,
        description,
        topics,
        difficulty: String(data.get("difficulty")) as Problem["difficulty"],
        examples: exampleInput || exampleOutput
          ? [{ input: exampleInput, output: exampleOutput }]
          : [],
        starter_code: {
          python: "# Write your solution here\n",
          javascript: "// Write your solution here\n",
        },
      });
      setProblems((current) => [added, ...current]);
      setCreating(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the problem");
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importSlug.trim()) return;
    setImportLoading(true);
    setError("");
    try {
      const added = await importProblem(importSlug.trim());
      setProblems((current) => [added, ...current.filter((p) => p.id !== added.id)]);
      setImporting(false);
      setImportSlug("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import problem from LeetCode");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <main className="library-page">
      <nav className="lib-header">
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <div className="brand">
            <span className="brand-dot" />
            SignalCode
          </div>
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn-ghost" onClick={() => { setImporting(true); setCreating(false); setError(""); }}>
            ↓ Import from LeetCode
          </button>
          <button className="btn-primary" onClick={() => { setCreating(true); setImporting(false); setError(""); }}>
            + Add problem
          </button>
        </div>
      </nav>

      <div className="lib-body">
        <div className="lib-title-row">
          <div>
            <h1 className="lib-title">Problem Library</h1>
            <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "6px" }}>
              Browse, search, and practice classic algorithm problems
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              className="form-select"
              style={{ width: "auto" }}
              value={language}
              onChange={(event) => onLanguage(event.target.value as Language)}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
        </div>

        <div className="lib-filters">
          <input
            className="lib-search"
            aria-label="Search problems"
            placeholder="Search problems by title or topic…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="form-select"
            style={{ width: "auto", minWidth: "140px" }}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">All topics</option>
            {tags.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {error && <p className="form-error" style={{ marginBottom: "16px" }}>{error}</p>}

        <div className="prob-table">
          {visible.map((item, n) => (
            <div className="prob-row" key={item.id} onClick={() => onPractice(item)}>
              <div className="prob-row-left">
                <span className="prob-num">{String(n + 1).padStart(2, "0")}</span>
                <div className="prob-info">
                  <div className="prob-name">{item.title}</div>
                  <div className="prob-tags">
                    {item.topics.slice(0, 4).map((t, i) => (
                      <span key={i} className="tag-chip">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="prob-row-right">
                <span className={`diff-badge diff-${item.difficulty}`}>{item.difficulty}</span>
                <button
                  className="btn-primary"
                  style={{ padding: "7px 14px", fontSize: "13px" }}
                  onClick={(e) => { e.stopPropagation(); onPractice(item); }}
                >
                  Practice
                </button>
              </div>
            </div>
          ))}
          {!visible.length && <div className="empty-state">No problems match your search.</div>}
        </div>
      </div>

      {creating && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <div>
                <span className="label">Custom Problem</span>
                <h2 style={{ marginTop: "6px" }}>Add a problem</h2>
              </div>
              <button className="btn-ghost" style={{ fontSize: "13px" }} onClick={() => setCreating(false)}>✕ Close</button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create(event.currentTarget);
              }}
            >
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" name="title" minLength={3} required placeholder="e.g. Two Sum" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" name="description" rows={6} minLength={10} required placeholder="Problem description..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select className="form-select" name="difficulty">
                    <option>easy</option><option>medium</option><option>hard</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input className="form-input" name="topics" placeholder="arrays, hash-map" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Example Input</label>
                  <textarea className="form-textarea" name="exampleInput" rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Output</label>
                  <textarea className="form-textarea" name="exampleOutput" rows={3} />
                </div>
              </div>
              <button className="btn-primary" type="submit">Save problem</button>
            </form>
          </div>
        </div>
      )}

      {importing && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: "480px" }}>
            <div className="modal-head">
              <div>
                <span className="label">Import</span>
                <h2 style={{ marginTop: "6px" }}>Import from LeetCode</h2>
              </div>
              <button className="btn-ghost" style={{ fontSize: "13px" }} onClick={() => setImporting(false)}>✕</button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "20px" }}>
              Enter a problem slug (e.g. <code style={{ fontFamily: "JetBrains Mono", color: "var(--accent-2)" }}>two-sum</code>), a full LeetCode URL, or type <code style={{ fontFamily: "JetBrains Mono", color: "var(--accent-2)" }}>daily</code> to fetch today's challenge.
            </p>
            {error && <p className="form-error">{error}</p>}
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label className="form-label">Problem slug or URL</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. two-sum"
                  value={importSlug}
                  onChange={(e) => setImportSlug(e.target.value)}
                  disabled={importLoading}
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={importLoading || !importSlug.trim()}>
                {importLoading ? "Fetching…" : "↓ Import Problem"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
