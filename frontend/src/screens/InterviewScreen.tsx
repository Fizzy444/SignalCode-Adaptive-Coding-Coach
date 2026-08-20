import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import ListeningHalo, { HaloState } from "../components/ListeningHalo";
import { runCode } from "../runner";
import type { CoachMessage, CodeRunResult, Language, Problem, User } from "../types";

interface InterviewScreenProps {
  user: User | null;
  problem: Problem;
  language: Language;
  code: string;
  drafts: Partial<Record<Language, string>>;
  sessionId: string;
  messages: CoachMessage[];
  elapsed: number;
  attention: {
    enabled: boolean;
    error: string | null;
    score: number;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    start: () => Promise<boolean>;
    stop: () => void;
  };
  cameraAllowed: boolean;
  onCodeChange: (nextCode: string) => void;
  onLanguageChange: (nextLang: Language) => void;
  onResetCode: () => void;
  onSendMessage: (msg: string) => void;
  onAskHint: () => void;
  onRunSuccess: (result: CodeRunResult) => void;
  onSubmitSolution: () => void;
  onLeaveInterview: () => void;
  onToggleCamera: () => void;
  onNavigateProfile: () => void;
}

export default function InterviewScreen({
  user,
  problem,
  language,
  code,
  drafts,
  sessionId,
  messages,
  elapsed,
  attention,
  cameraAllowed,
  onCodeChange,
  onLanguageChange,
  onResetCode,
  onSendMessage,
  onAskHint,
  onRunSuccess,
  onSubmitSolution,
  onLeaveInterview,
  onToggleCamera,
  onNavigateProfile,
}: InterviewScreenProps) {
  // Left Panel Tabs: "statement" or "coach"
  const [leftTab, setLeftTab] = useState<"statement" | "coach">("statement");
  
  // Resizing state
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    return Number(localStorage.getItem("sc_left_width")) || 380;
  });
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    return Number(localStorage.getItem("sc_bottom_height")) || 220;
  });
  const [dragging, setDragging] = useState<"left" | "bottom" | null>(null);

  const [output, setOutput] = useState<string>("Run your code when you're ready.");
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [chatText, setChatText] = useState("");
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Determine Halo State
  const haloState: HaloState = evaluating
    ? "evaluating"
    : runResult?.passed
    ? "celebrating"
    : messages.length > 0 && messages[messages.length - 1]?.type === "coach"
    ? "speaking"
    : "listening";

  // Mouse move listener for dragging resizers
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging === "left") {
        const next = Math.max(260, Math.min(e.clientX, window.innerWidth - 360));
        setLeftWidth(next);
        localStorage.setItem("sc_left_width", String(next));
      } else if (dragging === "bottom") {
        const next = Math.max(90, Math.min(window.innerHeight - e.clientY, window.innerHeight - 140));
        setBottomHeight(next);
        localStorage.setItem("sc_bottom_height", String(next));
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // Auto-scroll transcript when on coach tab
  useEffect(() => {
    if (leftTab === "coach") {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, leftTab]);

  // Format Elapsed Time (MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const handleExecute = async () => {
    setEvaluating(true);
    setOutput("Evaluating code across test suite...");
    setRunResult({ output: "Evaluating code across test suite...", passed: null });

    const testCasesToRun = problem.test_cases || problem.examples || [];
    try {
      const result = await runCode(language, code, problem.id, testCasesToRun);
      setRunResult(result);
      setOutput(result.output);
      onRunSuccess(result);
    } catch (err: any) {
      const failedResult: CodeRunResult = {
        output: err.message || "Code execution failed",
        passed: false,
      };
      setRunResult(failedResult);
      setOutput(failedResult.output);
      onRunSuccess(failedResult);
    } finally {
      setEvaluating(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendMessage(chatText.trim());
    setChatText("");
  };

  // Determine Current Interview Stage
  const currentStage = runResult?.passed
    ? "Debrief"
    : messages.some((m) => m.type === "coach" && m.level === "hint") || code.length > 50
    ? "Coding Round"
    : "Warm-up";

  return (
    <div className="interview-workspace">
      {/* Dragging Overlay to prevent Monaco from swallowing mouse events */}
      {dragging && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            cursor: dragging === "bottom" ? "row-resize" : "col-resize",
            userSelect: "none",
          }}
        />
      )}

      {/* Top Bar */}
      <header className="workspace-topbar">
        <div className="topbar-left">
          <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: "12px" }} onClick={onLeaveInterview}>
            ← Leave interview
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, fontFamily: "var(--font-display)" }}>{problem.title}</span>
            <span className={`difficulty-dot ${problem.difficulty}`} />
          </div>

          {/* Stage Progress Tracker */}
          <div className="stage-tracker" style={{ marginLeft: "12px" }}>
            <span className={`stage-step ${currentStage === "Warm-up" ? "active" : ""}`}>
              <span className="stage-dot" /> 1. Warm-up
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>›</span>
            <span className={`stage-step ${currentStage === "Coding Round" ? "active" : ""}`}>
              <span className="stage-dot" /> 2. Coding Round
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>›</span>
            <span className={`stage-step ${currentStage === "Debrief" ? "active" : ""}`}>
              <span className="stage-dot" /> 3. Debrief
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {/* Attention / Focus Indicator */}
          <div className="focus-badge" title="On-device attention indicator derived from camera signals">
            <span className="focus-dot" />
            <span>Focus: {cameraAllowed && attention.score !== null ? `${Math.round(attention.score)}%` : "Camera Off"}</span>
          </div>

          {user && (
            <button className="user-badge" onClick={onNavigateProfile}>
              <div className="user-avatar-sm">{user.username.slice(0, 2)}</div>
              <span>@{user.username}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div
        className="workspace-split"
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Panel: Problem Statement & AI Coach */}
        <aside
          className="ai-panel"
          style={{ width: `${leftWidth}px`, flexShrink: 0, minWidth: "260px" }}
        >
          {/* Tab Switcher: Problem Statement vs AI Interviewer */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", background: "#0D101C" }}>
            <button
              className={`filter-item-btn ${leftTab === "statement" ? "active" : ""}`}
              style={{
                flex: 1,
                borderRadius: 0,
                padding: "10px 14px",
                borderBottom: leftTab === "statement" ? "2px solid var(--state-cyan)" : "2px solid transparent",
                justifyContent: "center",
              }}
              onClick={() => setLeftTab("statement")}
            >
              📄 Problem Statement
            </button>
            <button
              className={`filter-item-btn ${leftTab === "coach" ? "active" : ""}`}
              style={{
                flex: 1,
                borderRadius: 0,
                padding: "10px 14px",
                borderBottom: leftTab === "coach" ? "2px solid var(--state-violet)" : "2px solid transparent",
                justifyContent: "center",
                position: "relative",
              }}
              onClick={() => setLeftTab("coach")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🎙️ AI Interviewer</span>
                {messages.length > 0 && (
                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--state-violet)", color: "#fff" }}>
                    {messages.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* TAB 1: Problem Statement View */}
          {leftTab === "statement" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span className={`difficulty-dot ${problem.difficulty}`} />
                  <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "capitalize", color: "var(--text-secondary)" }}>
                    {problem.difficulty}
                  </span>
                  {problem.source && (
                    <span className="tag-chip" style={{ marginLeft: "auto", fontSize: "10px" }}>
                      {problem.source}
                    </span>
                  )}
                </div>

                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                  {problem.title}
                </h2>

                <div className="tag-list" style={{ marginBottom: "16px" }}>
                  {problem.topics.map((t, idx) => (
                    <span key={idx} className="tag-chip">#{t}</span>
                  ))}
                </div>
              </div>

              {/* Problem Description */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
                <div className="filter-group-title" style={{ marginBottom: "8px" }}>Description</div>
                <p style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {problem.description}
                </p>
              </div>

              {/* Examples */}
              {problem.examples && problem.examples.length > 0 && (
                <div>
                  <div className="filter-group-title" style={{ marginBottom: "10px" }}>Examples</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {problem.examples.map((ex, idx) => (
                      <div
                        key={idx}
                        style={{ background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: "13px" }}
                      >
                        <div style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "11px", marginBottom: "6px" }}>
                          Example {idx + 1}
                        </div>
                        <div style={{ marginBottom: "4px" }}>
                          <strong style={{ color: "var(--text-secondary)" }}>Input: </strong>
                          <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{ex.input}</code>
                        </div>
                        <div>
                          <strong style={{ color: "var(--text-secondary)" }}>Output: </strong>
                          <code style={{ fontFamily: "var(--font-mono)", color: "var(--state-cyan)" }}>{ex.output}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Switch to Coach Prompt */}
              <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Need guidance on the approach?
                </span>
                <button className="btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => setLeftTab("coach")}>
                  Talk with Interviewer →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI Coach & Live Transcript View */}
          {leftTab === "coach" && (
            <>
              {/* Transcript Feed with Mono Timestamps */}
              <div className="transcript-feed">
                <div className="transcript-entry coach">
                  <div className="transcript-meta">
                    <span className="transcript-sender">Interviewer</span>
                    <span className="transcript-time">[00:00]</span>
                  </div>
                  <div className="transcript-body">
                    Welcome to your coding round for <strong>{problem.title}</strong>. Take a moment to read the problem, clarify edge cases, and run your code whenever you're ready.
                  </div>
                </div>

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`transcript-entry ${msg.type === "user" ? "user" : "coach"}`}
                  >
                    <div className="transcript-meta">
                      <span className="transcript-sender">
                        {msg.type === "user" ? "You" : "Interviewer"}
                      </span>
                      <span className="transcript-time">
                        [{formatTime(Math.min(elapsed, (idx + 1) * 35))}]
                      </span>
                    </div>
                    <div className="transcript-body">{msg.message}</div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>

              {/* Camera Focus Preview & Chat Form */}
              <div className="ai-panel-footer">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                    onClick={onToggleCamera}
                  >
                    {cameraAllowed ? "● Focus Camera Active" : "○ Enable Focus Camera"}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "11px", padding: "4px 8px", color: "var(--state-amber)" }}
                    onClick={onAskHint}
                  >
                    💡 Ask for Hint
                  </button>
                </div>

                {/* Hidden Video for MediaPipe Landmarker */}
                <video
                  ref={attention.videoRef}
                  muted
                  playsInline
                  style={{ display: "none" }}
                />

                <form className="chat-input-form" onSubmit={handleChatSubmit}>
                  <input
                    type="text"
                    placeholder="Talk to interviewer or ask questions..."
                    className="chat-input"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: "0 14px" }}>
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>

        {/* Vertical Column Resizer */}
        <div
          className={`resizer resizer-col ${dragging === "left" ? "dragging" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging("left");
          }}
          title="Drag to resize side panel"
        />

        {/* Right Editor & Console Area */}
        <section className={`editor-area ${evaluating ? "evaluating" : ""}`} style={{ flex: 1, minWidth: 0 }}>
          {/* Editor Header Toolbar */}
          <div className="editor-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select
                className="chat-input"
                style={{ width: "auto", padding: "4px 10px", fontSize: "12px" }}
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
              >
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
              </select>

              <button
                className="btn-ghost"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={onResetCode}
                title="Reset editor back to starter code"
              >
                ↺ Reset code
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="btn-amber"
                style={{ padding: "6px 14px", fontSize: "12px" }}
                onClick={handleExecute}
                disabled={evaluating}
              >
                ▶ Run code
              </button>

              {runResult?.passed && (
                <button
                  className="btn-cyan"
                  style={{ padding: "6px 16px", fontSize: "12px" }}
                  onClick={onSubmitSolution}
                >
                  ✓ Submit solution
                </button>
              )}
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="monaco-wrapper" style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(val) => onCodeChange(val || "")}
              options={{
                fontSize: 14,
                fontFamily: "JetBrains Mono, monospace",
                minimap: { enabled: false },
                padding: { top: 16 },
                automaticLayout: true,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          {/* Horizontal Row Resizer */}
          <div
            className={`resizer resizer-row ${dragging === "bottom" ? "dragging" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging("bottom");
            }}
            title="Drag to resize console output"
          />

          {/* Always Visible Resizable Console Drawer */}
          <div
            className="console-drawer"
            style={{ height: `${bottomHeight}px`, flexShrink: 0 }}
          >
            <div className="console-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Test Execution & Output</span>
                {runResult && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: runResult.passed ? "var(--state-cyan)" : "var(--state-error)",
                    }}
                  >
                    {runResult.passed ? "✓ Passed all test cases" : "✕ Test suite failed"}
                  </span>
                )}
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                Drag bar above to resize
              </span>
            </div>

            <div className="console-body">
              {runResult?.test_results && runResult.test_results.length > 0 ? (
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    {runResult.test_results.map((tc, idx) => (
                      <button
                        key={idx}
                        className={`filter-item-btn ${activeTestCaseIndex === idx ? "active" : ""}`}
                        style={{ width: "auto", padding: "4px 10px", fontSize: "11px" }}
                        onClick={() => setActiveTestCaseIndex(idx)}
                      >
                        <span
                          style={{
                            color: tc.passed ? "var(--state-cyan)" : "var(--state-error)",
                            marginRight: "4px",
                          }}
                        >
                          {tc.passed ? "✓" : "✕"}
                        </span>
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {runResult.test_results[activeTestCaseIndex] && (
                    <div style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)" }}>
                      <div style={{ marginBottom: "6px" }}>
                        <strong style={{ color: "var(--text-secondary)" }}>Input: </strong>
                        <code>{runResult.test_results[activeTestCaseIndex].input}</code>
                      </div>
                      <div style={{ marginBottom: "6px" }}>
                        <strong style={{ color: "var(--text-secondary)" }}>Expected: </strong>
                        <code>{runResult.test_results[activeTestCaseIndex].expected}</code>
                      </div>
                      <div>
                        <strong style={{ color: "var(--text-secondary)" }}>Actual: </strong>
                        <code style={{ color: runResult.test_results[activeTestCaseIndex].passed ? "var(--state-cyan)" : "var(--state-error)" }}>
                          {runResult.test_results[activeTestCaseIndex].actual || (runResult.test_results[activeTestCaseIndex].passed ? "None" : "No return value")}
                        </code>
                      </div>
                      {runResult.test_results[activeTestCaseIndex].error && (
                        <div style={{ marginTop: "6px", color: "var(--state-error)", fontSize: "12px", background: "rgba(241, 106, 106, 0.08)", padding: "6px 8px", borderRadius: "var(--radius-sm)" }}>
                          <strong>Error: </strong>
                          <code>{runResult.test_results[activeTestCaseIndex].error}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{output}</pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
