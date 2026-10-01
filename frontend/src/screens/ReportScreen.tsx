import React from "react";
import Navbar from "../components/Navbar";
import ListeningHalo from "../components/ListeningHalo";
import type { CoachMessage, Problem, Report, User } from "../types";

interface ReportScreenProps {
  user: User | null;
  report: Report;
  problem: Problem;
  finalCode: string;
  messages: CoachMessage[];
  onNavigate: (view: string) => void;
  onPracticeAgain: () => void;
  onLogout: () => void;
}

export default function ReportScreen({
  user,
  report,
  problem,
  finalCode,
  messages,
  onNavigate,
  onPracticeAgain,
  onLogout,
}: ReportScreenProps) {
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  const getEditorialDebrief = () => {
    if (report.successful_runs > 0 && report.hints_used === 0) {
      return `Outstanding execution on ${problem.title}. You established a clear algorithmic approach right from the start, verified your edge cases, and completed the implementation without requiring hints. Your focus consistency remained high throughout the session.`;
    }
    if (report.successful_runs > 0) {
      return `Solid problem-solving round on ${problem.title}. You navigated the problem constraints, made effective use of coaching hints (${report.hints_used} hint${report.hints_used > 1 ? "s" : ""} requested) to refine your approach, and achieved passing test cases.`;
    }
    return `Good effort tackling ${problem.title}. The interview was paused before all test cases passed, but you laid down a viable foundation. Review the problem's core pattern in the catalog and try implementing it again.`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="report-screen panel-entry">
        {/* Header */}
        <div className="report-header">
          <div style={{ marginBottom: "16px", display: "inline-block" }}>
            <ListeningHalo state="celebrating" size={60} label="AI" />
          </div>
          <div className="section-label">INTERVIEW DEBRIEF</div>
          <h1 className="report-title">{problem.title} — Session Review</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "540px", margin: "0 auto" }}>
            Here is your post-session breakdown, conversational debrief, and full transcript replay.
          </p>
        </div>

        {/* Big Editorial Debrief Callout */}
        <div className="debrief-box">
          <div className="debrief-box-title">Interviewer's Assessment</div>
          <p style={{ color: "var(--text-primary)", fontSize: "15px", lineHeight: "1.7" }}>
            "{getEditorialDebrief()}"
          </p>
        </div>

        {/* Score Metrics Grid */}
        <div className="score-metrics-grid">
          <div className="score-metric-card">
            <div className="metric-big-num" style={{ color: "var(--state-violet)" }}>
              {formatDuration(report.duration_seconds)}
            </div>
            <div className="metric-label">Session Duration</div>
          </div>

          <div className="score-metric-card">
            <div className="metric-big-num" style={{ color: "var(--state-cyan)" }}>
              {report.successful_runs}/{report.runs}
            </div>
            <div className="metric-label">Passed / Total Runs</div>
          </div>

          <div className="score-metric-card">
            <div className="metric-big-num" style={{ color: "var(--state-amber)" }}>
              {report.hints_used}
            </div>
            <div className="metric-label">Hints Requested</div>
          </div>

          <div className="score-metric-card">
            <div className="metric-big-num" style={{ color: "#38BDF8" }}>
              {report.average_focus !== null ? `${report.average_focus}%` : "N/A"}
            </div>
            <div className="metric-label">Avg Focus Signal</div>
          </div>
        </div>

        {/* Final Code Snapshot */}
        <div style={{ marginBottom: "36px" }}>
          <div className="filter-group-title" style={{ marginBottom: "10px" }}>
            Final Submitted Code
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px", overflowX: "auto" }}>
            <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.6" }}>
              {finalCode || "# No code was written"}
            </pre>
          </div>
        </div>

        {/* Transcript Replay */}
        <div style={{ marginBottom: "40px" }}>
          <div className="filter-group-title" style={{ marginBottom: "10px" }}>
            Interview Transcript Replay ({messages.length} exchanges)
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "16px", maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`transcript-entry ${m.type === "user" ? "user" : "coach"}`}
                style={{ padding: "8px 12px" }}
              >
                <div className="transcript-meta">
                  <span className="transcript-sender">{m.type === "user" ? "You" : "Interviewer"}</span>
                </div>
                <div className="transcript-body">{m.message}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Invitations: Subtle highlight on Explore More Problems */}
        <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            style={{ padding: "10px 22px", fontSize: "14px" }}
            onClick={() => onNavigate("library")}
          >
            Explore more problems →
          </button>
          <button
            className="btn-ghost"
            style={{ padding: "10px 18px", fontSize: "13px" }}
            onClick={onPracticeAgain}
          >
            Practice this problem again
          </button>
          {user && (
            <button
              className="btn-ghost"
              style={{ padding: "10px 18px", fontSize: "13px" }}
              onClick={() => onNavigate(`u/${user.username}`)}
            >
              View developer profile
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
