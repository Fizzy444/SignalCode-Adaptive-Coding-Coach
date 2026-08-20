import React, { useState, useMemo, useEffect } from "react";
import Navbar from "../components/Navbar";
import { getProblems, importProblem, addProblem } from "../api";
import type { Problem, Language, User } from "../types";

interface CatalogScreenProps {
  user: User | null;
  completedProblems: string[];
  onSelectProblem: (problem: Problem) => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export default function CatalogScreen({
  user,
  completedProblems,
  onSelectProblem,
  onNavigate,
  onLogout,
}: CatalogScreenProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Custom Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSlug, setImportSlug] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    setLoading(true);
    getProblems()
      .then((data) => {
        setProblems(data);
        setError("");
      })
      .catch((err) => setError(err.message || "Failed to load problem catalog"))
      .finally(() => setLoading(false));
  }, []);

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [problems]);

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (selectedDifficulty !== "all" && p.difficulty !== selectedDifficulty) {
        return false;
      }
      if (selectedTopic !== "all" && !p.topics.includes(selectedTopic)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesTopic = p.topics.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTopic) return false;
      }
      return true;
    });
  }, [problems, selectedDifficulty, selectedTopic, searchQuery]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importSlug.trim()) return;
    setImportLoading(true);
    setImportError("");
    try {
      const created = await importProblem(importSlug.trim());
      setProblems((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setShowImportModal(false);
      setImportSlug("");
      onSelectProblem(created);
    } catch (err: any) {
      setImportError(err.message || "Failed to import problem from LeetCode");
    } finally {
      setImportLoading(false);
    }
  };

  const estimateLength = (difficulty: string) => {
    if (difficulty === "hard") return "45m interview";
    if (difficulty === "medium") return "25m interview";
    return "15m interview";
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <div className="catalog-layout">
        {/* Slim Sticky Sidebar */}
        <aside className="catalog-sidebar panel-entry">
          <div>
            <div className="filter-group-title">Search Challenges</div>
            <input
              type="text"
              placeholder="Filter by keyword..."
              className="chat-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", marginBottom: "16px" }}
            />
          </div>

          <div>
            <div className="filter-group-title">Difficulty</div>
            <div className="filter-btn-list">
              <button
                className={`filter-item-btn ${selectedDifficulty === "all" ? "active" : ""}`}
                onClick={() => setSelectedDifficulty("all")}
              >
                <span>All Difficulties</span>
                <span className="length-indicator">{problems.length}</span>
              </button>
              <button
                className={`filter-item-btn ${selectedDifficulty === "easy" ? "active" : ""}`}
                onClick={() => setSelectedDifficulty("easy")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="difficulty-dot easy" />
                  <span>Fundamentals</span>
                </div>
                <span className="length-indicator">
                  {problems.filter((p) => p.difficulty === "easy").length}
                </span>
              </button>
              <button
                className={`filter-item-btn ${selectedDifficulty === "medium" ? "active" : ""}`}
                onClick={() => setSelectedDifficulty("medium")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="difficulty-dot medium" />
                  <span>Core Algorithms</span>
                </div>
                <span className="length-indicator">
                  {problems.filter((p) => p.difficulty === "medium").length}
                </span>
              </button>
              <button
                className={`filter-item-btn ${selectedDifficulty === "hard" ? "active" : ""}`}
                onClick={() => setSelectedDifficulty("hard")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="difficulty-dot hard" />
                  <span>Advanced Mastery</span>
                </div>
                <span className="length-indicator">
                  {problems.filter((p) => p.difficulty === "hard").length}
                </span>
              </button>
            </div>
          </div>

          <div>
            <div className="filter-group-title">Topics</div>
            <div className="filter-btn-list" style={{ maxHeight: "240px", overflowY: "auto" }}>
              <button
                className={`filter-item-btn ${selectedTopic === "all" ? "active" : ""}`}
                onClick={() => setSelectedTopic("all")}
              >
                <span>All Topics</span>
              </button>
              {allTopics.map((t) => (
                <button
                  key={t}
                  className={`filter-item-btn ${selectedTopic === t ? "active" : ""}`}
                  onClick={() => setSelectedTopic(t)}
                >
                  <span>#{t}</span>
                  <span className="length-indicator">
                    {problems.filter((p) => p.topics.includes(t)).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ paddingTop: "12px", borderTop: "1px solid var(--glass-border)" }}>
            <button
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setShowImportModal(true)}
            >
              + Import from LeetCode
            </button>
          </div>
        </aside>

        {/* Main Problems Grid */}
        <main className="panel-entry" style={{ animationDelay: "40ms" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Problem Catalog</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Select a problem to step into an orchestrated interview room.
              </p>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
              {filteredProblems.length} available challenges
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-secondary)" }}>
              Loading problem catalog...
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--state-error)" }}>
              <div style={{ color: "var(--state-error)", fontWeight: 600, marginBottom: "8px" }}>{error}</div>
              <button className="btn-ghost" onClick={() => window.location.reload()}>Retry loading</button>
            </div>
          ) : filteredProblems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--glass-border)" }}>
              <h3 style={{ marginBottom: "8px" }}>No challenges match this filter</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
                Try selecting "All Difficulties" or clearing your search term to see more interview challenges.
              </p>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedDifficulty("all");
                  setSelectedTopic("all");
                  setSearchQuery("");
                }}
              >
                Reset catalog filters
              </button>
            </div>
          ) : (
            <div className="problem-grid">
              {filteredProblems.map((problem) => {
                const isSolved = completedProblems.includes(problem.id);
                return (
                  <div
                    key={problem.id}
                    className="glass-card problem-card"
                    onClick={() => onSelectProblem(problem)}
                  >
                    <div>
                      <div className="problem-card-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={`difficulty-dot ${problem.difficulty}`} />
                          <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "capitalize", color: "var(--text-secondary)" }}>
                            {problem.difficulty}
                          </span>
                        </div>
                        {isSolved ? (
                          <span style={{ fontSize: "11px", color: "var(--state-cyan)", fontWeight: 600 }}>✓ Solved</span>
                        ) : (
                          <span className="length-indicator">{estimateLength(problem.difficulty)}</span>
                        )}
                      </div>

                      <h3 className="problem-card-title">{problem.title}</h3>
                      <p className="problem-card-desc">{problem.description}</p>
                    </div>

                    <div className="problem-card-footer">
                      <div className="tag-list">
                        {problem.topics.slice(0, 3).map((t, idx) => (
                          <span key={idx} className="tag-chip">#{t}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--state-violet)", fontWeight: 600 }}>
                        Start →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "480px", padding: "28px" }}>
            <h3 style={{ fontSize: "20px", marginBottom: "8px" }}>Import Challenge from LeetCode</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
              Enter any LeetCode URL slug (e.g. <code>trapping-rain-water</code> or <code>lru-cache</code>) to import it into your live mock interview room.
            </p>

            <form onSubmit={handleImport}>
              <input
                type="text"
                placeholder="slug (e.g. coin-change)"
                className="chat-input"
                value={importSlug}
                onChange={(e) => setImportSlug(e.target.value)}
                style={{ width: "100%", marginBottom: "16px" }}
                autoFocus
              />

              {importError && (
                <div style={{ color: "var(--state-error)", fontSize: "12px", marginBottom: "14px" }}>
                  {importError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportError("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={importLoading}>
                  {importLoading ? "Importing..." : "Import and Start"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
