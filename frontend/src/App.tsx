import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { addProblem, connectCoach, createSession, getProblems, importProblem } from "./api";
import { runCode } from "./runner";
import type { CoachMessage, CodeRunResult, Language, Problem, Report } from "./types";
import { useAttention } from "./useAttention";
import "./styles.css";

export default function App() {
  const [view, setView] = useState<"home" | "library">("home");
  const [language, setLanguage] = useState<Language>("python");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [output, setOutput] = useState("Run your code when you're ready.");
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [returnView, setReturnView] = useState<"home" | "library">("home");
  const socket = useRef<WebSocket | null>(null);

  const send = (payload: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  };
  const attention = useAttention((signal) => send({ type: "attention", ...signal }));

  useEffect(() => {
    if (!cameraAllowed) attention.stop();
  }, [cameraAllowed, attention.stop]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => setElapsed((x) => x + 1), 1000);
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
        <ProblemLibrary
          language={language}
          onLanguage={setLanguage}
          onBack={() => setView("home")}
          onPractice={begin}
        />
      );
    }
    return (
      <main className="landing">
        <nav className="site-nav">
          <div className="brand"><span>●</span> SignalCode</div>
          <button className="quiet" onClick={() => setView("library")}>Browse problems</button>
        </nav>
        <section className="hero">
          <p className="eyebrow">ADAPTIVE INTERVIEW PRACTICE</p>
          <h1>Practice the problem.<br /><em>Train the moment.</em></h1>
          <p className="lede">
            A private AI coach that watches your process—not your personality—and
            gives the smallest useful hint at the right time.
          </p>
          <div className="start-row">
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <button className="primary" onClick={() => begin()}>Start practice →</button>
          </div>
          <label className="camera-choice">
            <input
              type="checkbox"
              checked={cameraAllowed}
              onChange={(event) => setCameraAllowed(event.target.checked)}
            />
            Use optional on-device camera attention signals
          </label>
          <p className="privacy">Camera is optional. Raw video never leaves your browser.</p>
        </section>
        <div className="feature-strip">
          <span>01 · Real-time coaching</span>
          <span>02 · Adaptive difficulty</span>
          <span>03 · Private attention signals</span>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header>
        <div className="workspace-nav">
          <button className="quiet back-button" onClick={leaveInterview}>← Back</button>
          <div className="brand"><span>●</span> SignalCode</div>
        </div>
        <div className="session-meta">
          <span className="live">LIVE</span><span>{mins}:{secs}</span>
          <button
            className={`quiet camera-toggle ${attention.enabled ? "camera-on" : ""}`}
            title={attention.error || "Camera controls"}
            onClick={() => {
              if (attention.enabled) {
                attention.stop();
                setCameraAllowed(false);
              } else {
                setCameraAllowed(true);
                window.requestAnimationFrame(() => void attention.start());
              }
            }}
          >
            {attention.enabled ? "● Camera on · Turn off" : "Camera off · Enable"}
          </button>
          <button className="quiet" onClick={() => send({ type: "complete" })}>End session</button>
        </div>
      </header>
      <div className="grid">
        <aside className="problem">
          <p className="eyebrow">{problem.difficulty} · {problem.topics.join(" / ")}</p>
          <h2>{problem.title}</h2>
          <p>{problem.description}</p>
          <h3>Example</h3>
          <code>{problem.examples[0].input}<br />→ {problem.examples[0].output}</code>
          <div className="camera">
            {cameraAllowed ? (
              <>
                <video ref={attention.videoRef} muted playsInline />
                <div><strong>Focus signal {attention.score}</strong><small>On-device estimate · not an emotion score</small></div>
                {attention.error && <small className="camera-error">{attention.error}</small>}
                <button
                  className="quiet"
                  onClick={attention.enabled
                    ? () => setCameraAllowed(false)
                    : attention.start}
                >
                  {attention.enabled ? "Disable camera" : "Start camera"}
                </button>
              </>
            ) : (
              <>
                <div><strong>Camera disabled</strong><small>No camera permission or video processing is active.</small></div>
                {attention.error && <small className="camera-error">{attention.error}</small>}
                <button
                  className="quiet"
                  onClick={() => {
                    setCameraAllowed(true);
                    window.requestAnimationFrame(() => void attention.start());
                  }}
                >
                  Enable camera
                </button>
              </>
            )}
          </div>
        </aside>
        <section className="editor-panel">
          <div className="toolbar">
            <select value={language} disabled><option>{language}</option></select>
            <button onClick={execute}>▶ Run</button>
          </div>
          <Editor
            height="58vh"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{ fontSize: 15, minimap: { enabled: false }, padding: { top: 18 } }}
          />
          <div className="output-panel">
            {runResult?.test_results ? (
              <div className="test-results">
                <div className="test-results-header">
                  <span>Test Results:</span>
                  <span className={`status-badge ${runResult.passed ? "passed" : "failed"}`}>
                    {runResult.passed ? "✓ All Passed" : "✗ Some Failed"}
                  </span>
                </div>
                <div className="test-cases-list">
                  {runResult.test_results.map((tc, idx) => (
                    <div key={idx} className={`test-case-item ${tc.passed ? "tc-passed" : "tc-failed"}`}>
                      <div className="tc-header">
                        <strong>{tc.name}</strong>
                        <span>{tc.passed ? "✓ PASS" : "✗ FAIL"}</span>
                      </div>
                      <div className="tc-details">
                        <div><small>Input:</small> <code>{tc.input}</code></div>
                        <div><small>Expected:</small> <code>{tc.expected}</code></div>
                        <div><small>Actual:</small> <code>{tc.actual}</code></div>
                        {tc.error && <div className="tc-error"><small>Error:</small> {tc.error}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {runResult.output && runResult.output !== "Code ran successfully with no output." && runResult.output !== "Code ran successfully with no console output." && (
                  <div className="console-output">
                    <small>Console Output:</small>
                    <pre>{runResult.output}</pre>
                  </div>
                )}
              </div>
            ) : (
              <pre className="output">{runResult?.output || output}</pre>
            )}
          </div>
        </section>
        <aside className="coach">
          <p className="eyebrow">COACH FEED</p>
          <div className="coach-orb">S</div>
          <div className="coach-messages">
            {messages.length === 0 && <p className="muted">I’ll stay quiet until a nudge is useful.</p>}
            {messages.map((m, index) => (
              <div className={`message ${m.level}`} key={index}>
                {m.level === "user" && <span className="msg-sender">You: </span>}
                {m.message}
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="Explain complexity, invariants, or ask a question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" disabled={!chatInput.trim()}>Send</button>
          </form>
          <button className="primary hint" onClick={() => send({ type: "hint_request", code, language })}>
            Give me a hint
          </button>
        </aside>
      </div>
      {report && (
        <div className="modal">
          <div className="report">
            <p className="eyebrow">SESSION COMPLETE</p>
            <h2>Your practice, in signals.</h2>
            <div className="stats">
              <span><strong>{Math.round(report.duration_seconds / 60)}m</strong>time</span>
              <span><strong>{report.runs}</strong>runs</span>
              <span><strong>{report.hints_used}</strong>hints</span>
              <span><strong>{report.average_focus ?? "—"}</strong>focus</span>
            </div>
            <p>{report.summary}</p>
            <button className="primary" onClick={leaveInterview}>Practice another</button>
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
      <nav className="site-nav">
        <button className="brand brand-button" onClick={onBack}><span>●</span> SignalCode</button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="quiet" onClick={() => { setImporting(true); setCreating(false); setError(""); }}>📥 Import LeetCode</button>
          <button className="primary" onClick={() => { setCreating(true); setImporting(false); setError(""); }}>＋ Add a question</button>
        </div>
      </nav>
      <section className="library-hero">
        <p className="eyebrow">PROBLEM LIBRARY</p>
        <h1>Find your next<br /><em>useful struggle.</em></h1>
        <p className="lede">Search licensed catalog problems by concept, or bring a question of your own.</p>
      </section>
      <section className="catalog">
        <div className="catalog-tools">
          <input
            aria-label="Search problems"
            placeholder="Search title, description, or tag…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="all">All tags</option>
            {tags.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={language} onChange={(event) => onLanguage(event.target.value as Language)}>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="problem-list">
          {visible.map((item) => (
            <article className="problem-card" key={item.id}>
              <div>
                <p className="eyebrow">{item.difficulty} · {item.topics.join(" / ")}</p>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <small>{item.source}{item.license ? ` · ${item.license}` : ""}</small>
              </div>
              <button className="primary" onClick={() => onPractice(item)}>Practice →</button>
            </article>
          ))}
          {!visible.length && <p className="empty-state">No problems match that search.</p>}
        </div>
      </section>
      {creating && (
        <div className="modal">
          <form
            className="question-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create(event.currentTarget);
            }}
          >
            <div className="form-heading">
              <div><p className="eyebrow">CUSTOM PROBLEM</p><h2>Add a question</h2></div>
              <button type="button" className="quiet" onClick={() => setCreating(false)}>Close</button>
            </div>
            <label>Title<input name="title" minLength={3} required /></label>
            <label>Description<textarea name="description" rows={7} minLength={10} required /></label>
            <div className="form-row">
              <label>Difficulty<select name="difficulty"><option>easy</option><option>medium</option><option>hard</option></select></label>
              <label>Tags<input name="topics" placeholder="arrays, dynamic-programming" /></label>
            </div>
            <div className="form-row">
              <label>Example input<textarea name="exampleInput" rows={3} /></label>
              <label>Expected output<textarea name="exampleOutput" rows={3} /></label>
            </div>
            <button className="primary" type="submit">Save question</button>
          </form>
        </div>
      )}
      {importing && (
        <div className="modal">
          <form className="question-form" onSubmit={handleImport}>
            <div className="form-heading">
              <h2>Import from LeetCode</h2>
              <button type="button" className="quiet" onClick={() => setImporting(false)}>✕ Close</button>
            </div>
            <p className="lede" style={{ margin: "14px 0" }}>
              Enter a LeetCode problem title slug (e.g., <code>two-sum</code>, <code>valid-anagram</code>), a full LeetCode problem URL, or type <code>daily</code> to fetch today's Daily Challenge via Alfa LeetCode API.
            </p>
            {error && <p className="form-error">{error}</p>}
            <label>
              LeetCode Slug or URL
              <input
                type="text"
                placeholder="e.g. two-sum or daily"
                value={importSlug}
                onChange={(e) => setImportSlug(e.target.value)}
                disabled={importLoading}
                required
              />
            </label>
            <div className="form-row" style={{ marginTop: "20px" }}>
              <button type="submit" className="primary" disabled={importLoading || !importSlug.trim()}>
                {importLoading ? "Fetching from LeetCode API..." : "📥 Import Question"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
