import React from "react";
import Navbar from "../components/Navbar";
import ListeningHalo from "../components/ListeningHalo";
import type { User } from "../types";

interface LandingScreenProps {
  user: User | null;
  onNavigate: (view: string) => void;
  onStartInterview: () => void;
  onLogout: () => void;
}

export default function LandingScreen({
  user,
  onNavigate,
  onStartInterview,
  onLogout,
}: LandingScreenProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="landing-hero panel-entry">
          <div className="stage-pill">
            <span>●</span> Adaptive AI Mock Interview Room
          </div>

          <h1 className="landing-title">
            The coding interview room that listens, watches focus, and coaches in real time.
          </h1>

          <p className="landing-subtitle">
            Walk into an interactive interview environment with an adaptive AI coach that observes your problem-solving rhythm, provides Socratic nudges, and delivers deep post-session debriefs.
          </p>

          <div className="landing-cta-group">
            <button className="btn-primary" style={{ padding: "12px 24px", fontSize: "15px" }} onClick={onStartInterview}>
              Start quick interview →
            </button>
            <button className="btn-ghost" style={{ padding: "12px 24px", fontSize: "15px" }} onClick={() => onNavigate("library")}>
              Browse problem catalog
            </button>
          </div>
        </section>

        {/* Live-Looking Interactive Room Preview */}
        <section className="room-preview-container panel-entry" style={{ animationDelay: "60ms" }}>
          <div className="room-preview-frame">
            <div className="room-preview-header">
              <div className="window-dots">
                <div className="window-dot" style={{ background: "#F16A6A" }} />
                <div className="window-dot" style={{ background: "#F5A623" }} />
                <div className="window-dot" style={{ background: "#38BDF8" }} />
              </div>
              <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Interview Room #8241 · Two Sum (Warm-up)
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span className="stage-step active">
                  <span className="stage-dot" /> Focus: 94%
                </span>
              </div>
            </div>

            <div className="preview-grid">
              {/* Left AI Interviewer Pane */}
              <div className="preview-ai-pane">
                <div style={{ marginBottom: "16px" }}>
                  <ListeningHalo state="listening" size={68} label="AI" />
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--state-violet)", marginBottom: "4px" }}>
                  Interviewer Listening
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  "I see you're building a dictionary for index lookup. What is the expected time complexity?"
                </p>

                <div style={{ width: "100%", textAlign: "left", background: "var(--glass-bg)", borderRadius: "var(--radius-sm)", padding: "10px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    [03:42] STAGE: CODING ROUND
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                    Candidate is writing solution in Python 3.
                  </div>
                </div>
              </div>

              {/* Right Code Editor Pane */}
              <div className="preview-code-pane">
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "12px" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>solution.py</span>
                  <span style={{ color: "var(--state-cyan)" }}>Python 3</span>
                </div>
                <pre style={{ margin: 0, overflowX: "auto" }}>
{`def two_sum(nums: list[int], target: int) -> list[int]:
    # Hash map to store seen values and their indices
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`}
                </pre>
                <div style={{ marginTop: "24px", padding: "10px 14px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "var(--radius-sm)", color: "var(--state-cyan)", fontSize: "12px" }}>
                  ✓ Passed 3/3 visible test cases · Ready for debrief
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Stage Sequenced Process Flow */}
        <section className="stage-flow-section panel-entry" style={{ animationDelay: "120ms" }}>
          <div className="section-label">THE INTERVIEW PIPELINE</div>
          <h2 className="section-heading">Three orchestrated stages from problem to debrief.</h2>

          <div className="stage-cards-grid">
            <div className="glass-card">
              <div className="stage-num-badge">01</div>
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Warm-up & Alignment</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6" }}>
                Clarify inputs, edge cases, and time constraints before coding. The AI coach ensures you don't jump into implementation without an invariant.
              </p>
            </div>

            <div className="glass-card">
              <div className="stage-num-badge" style={{ color: "var(--state-amber)" }}>02</div>
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Live Coding Round</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6" }}>
                Write clean solutions in Monaco with real-time Socratic hints, test case executions, and privacy-preserving camera attention tracking.
              </p>
            </div>

            <div className="glass-card">
              <div className="stage-num-badge" style={{ color: "var(--state-cyan)" }}>03</div>
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Detailed Debrief</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6" }}>
                Receive structured post-session reports, complexity breakdowns, attempt diffs, and conversational interviewer feedback.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
