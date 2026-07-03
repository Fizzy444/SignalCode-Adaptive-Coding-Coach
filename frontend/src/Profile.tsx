import { useEffect, useState } from "react";
import { getUserProfile } from "./api";
import type { Problem, UserProfile } from "./types";

interface ProfileProps {
  username: string;
  onBack: () => void;
  onSelectProblem: (problem: Problem) => void;
  onBrowse: () => void;
}

export default function Profile({ username, onBack, onSelectProblem, onBrowse }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getUserProfile(username)
      .then((data) => {
        setProfile(data);
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Failed to load user profile.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [username]);

  const completed = profile?.completed_problems || [];
  const easyCount = completed.filter((p) => p.difficulty === "easy").length;
  const mediumCount = completed.filter((p) => p.difficulty === "medium").length;
  const hardCount = completed.filter((p) => p.difficulty === "hard").length;
  const totalCount = completed.length;

  const topicsSet = new Set<string>();
  completed.forEach((p) => p.topics.forEach((t) => topicsSet.add(t)));
  const topicsList = Array.from(topicsSet).sort();

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
        <div className="lib-header-actions">
          <button className="btn-ghost" onClick={onBrowse}>
            Browse library →
          </button>
        </div>
      </nav>

      <div className="lib-body">
        <div className="lib-title-row">
          <div>
            <div className="hero-pill" style={{ marginBottom: "12px", padding: "4px 12px", fontSize: "11px" }}>
              <span className="hero-pill-dot" />
              Developer Profile
            </div>
            <h1 className="lib-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span>@{username}</span>
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "6px" }}>
              Track your interview problem completions, difficulty progression, and mastery.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-2)" }}>
            Loading developer statistics...
          </div>
        ) : error ? (
          <div className="form-error" style={{ margin: "24px 0" }}>{error}</div>
        ) : (
          <>
            <div className="profile-stats-grid">
              <div className="stat-card">
                <span className="stat-card-num">{totalCount}</span>
                <span className="stat-card-label">Total Solved</span>
                <div className="stat-card-desc">Interview challenges completed</div>
              </div>

              <div className="stat-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="stat-card-num" style={{ color: "var(--green)" }}>{easyCount}</span>
                  <span className="diff-badge diff-easy" style={{ margin: 0 }}>Easy</span>
                </div>
                <span className="stat-card-label">Fundamentals</span>
                <div className="stat-progress-bar">
                  <div
                    className="stat-progress-fill"
                    style={{
                      width: `${totalCount ? Math.round((easyCount / totalCount) * 100) : 0}%`,
                      background: "var(--green)"
                    }}
                  />
                </div>
              </div>

              <div className="stat-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="stat-card-num" style={{ color: "var(--yellow)" }}>{mediumCount}</span>
                  <span className="diff-badge diff-medium" style={{ margin: 0 }}>Medium</span>
                </div>
                <span className="stat-card-label">Core Algorithms</span>
                <div className="stat-progress-bar">
                  <div
                    className="stat-progress-fill"
                    style={{
                      width: `${totalCount ? Math.round((mediumCount / totalCount) * 100) : 0}%`,
                      background: "var(--yellow)"
                    }}
                  />
                </div>
              </div>

              <div className="stat-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="stat-card-num" style={{ color: "var(--red)" }}>{hardCount}</span>
                  <span className="diff-badge diff-hard" style={{ margin: 0 }}>Hard</span>
                </div>
                <span className="stat-card-label">Advanced Mastery</span>
                <div className="stat-progress-bar">
                  <div
                    className="stat-progress-fill"
                    style={{
                      width: `${totalCount ? Math.round((hardCount / totalCount) * 100) : 0}%`,
                      background: "var(--red)"
                    }}
                  />
                </div>
              </div>
            </div>

            {topicsList.length > 0 && (
              <div className="profile-topics-section">
                <h3 className="label" style={{ marginBottom: "12px" }}>Mastered Topics ({topicsList.length})</h3>
                <div className="prob-tags" style={{ gap: "8px", flexWrap: "wrap" }}>
                  {topicsList.map((t) => (
                    <span key={t} className="tag-chip" style={{ padding: "6px 12px", fontSize: "13px", background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                      # {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="prob-table" style={{ marginTop: "32px" }}>
              <div className="prob-section">
                <div className="prob-section-label">
                  Completed Problems ({totalCount})
                </div>

                {totalCount === 0 ? (
                  <div className="empty-profile-card">
                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎯</div>
                    <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>No completed problems yet</h2>
                    <p style={{ color: "var(--text-2)", fontSize: "14px", maxWidth: "420px", margin: "0 auto 20px", lineHeight: "1.6" }}>
                      You haven't marked any problems as solved yet. Dive into the problem library and start practicing with your AI coach!
                    </p>
                    <button className="btn-primary" onClick={onBrowse}>
                      Explore Problem Library →
                    </button>
                  </div>
                ) : (
                  completed.map((item, n) => (
                    <div className="prob-row" key={item.id} onClick={() => onSelectProblem(item)}>
                      <div className="prob-row-left">
                        <span className="prob-num">{String(n + 1).padStart(2, "0")}</span>
                        <div className="prob-info">
                          <div className="prob-name">
                            {item.title}
                            <span className="completed-badge" title="Completed">✓ Solved</span>
                          </div>
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
                          className="btn-ghost"
                          style={{ padding: "7px 14px", fontSize: "13px" }}
                          onClick={(e) => { e.stopPropagation(); onSelectProblem(item); }}
                        >
                          Practice again
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
