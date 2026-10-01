import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { getUserProfile, searchUsers } from "../api";
import type { Problem, User, UserProfile, UserSearchResult } from "../types";

interface ProfileScreenProps {
  user: User | null;
  targetUsername: string;
  onSelectProblem: (problem: Problem) => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export default function ProfileScreen({
  user,
  targetUsername,
  onSelectProblem,
  onNavigate,
  onLogout,
}: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search input state (exclusive to profile area)
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const cleanUsername = targetUsername.trim().replace(/^@+/, "");
  const isOwnProfile = Boolean(user?.username && user.username.toLowerCase() === cleanUsername.toLowerCase());

  useEffect(() => {
    setLoading(true);
    getUserProfile(cleanUsername)
      .then((data) => {
        setProfile(data);
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Could not load developer profile");
      })
      .finally(() => setLoading(false));
  }, [cleanUsername]);

  // Live developer search autocomplete
  useEffect(() => {
    const clean = searchQuery.trim().replace(/^@+/, "");
    if (!clean) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => {
      searchUsers(clean)
        .then((results) => setSuggestions(results))
        .catch(() => setSuggestions([]))
        .finally(() => setSearchLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().replace(/^@+/, "");
    if (clean) {
      setShowDropdown(false);
      onNavigate(`u/${clean}`);
      setSearchQuery("");
    }
  };

  const handleSelectUser = (username: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    onNavigate(`u/${username}`);
  };

  const completed = profile?.completed_problems || [];
  const easyCount = completed.filter((p) => p.difficulty === "easy").length;
  const mediumCount = completed.filter((p) => p.difficulty === "medium").length;
  const hardCount = completed.filter((p) => p.difficulty === "hard").length;
  const totalCount = completed.length;

  const topicsSet = new Set<string>();
  completed.forEach((p) => p.topics.forEach((t) => topicsSet.add(t)));
  const topicsList = Array.from(topicsSet).sort();

  let rank = "Novice";
  let rankClass = "easy";
  if (totalCount >= 30) {
    rank = "Master";
    rankClass = "hard";
  } else if (totalCount >= 15) {
    rank = "Scholar";
    rankClass = "medium";
  } else if (totalCount >= 5) {
    rank = "Apprentice";
    rankClass = "easy";
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/u/${profile?.username || cleanUsername}`);
    alert("Profile link copied to clipboard!");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="profile-screen panel-entry">
        {/* Profile Hero Header */}
        <div className="profile-hero">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "36px" }}>@{profile?.username || cleanUsername}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "var(--radius-full)", background: "var(--surface)", border: "1px solid var(--glass-border)" }}>
                <span className={`difficulty-dot ${rankClass}`} />
                <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {rank}
                </span>
              </div>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "8px" }}>
              {isOwnProfile
                ? "Track your completed interview rounds, topic mastery, and algorithmic progression."
                : `Viewing @${profile?.username || cleanUsername}'s interview completions and solved challenges.`}
            </p>
          </div>

          {/* Profile Actions: Search Developer & Share Link */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
            <div className="user-search-wrapper" ref={searchContainerRef}>
              <form className="user-search-form" onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  placeholder="Search another user..."
                  className="user-search-input"
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowDropdown(false);
                  }}
                />
                <button type="submit" className="user-search-btn" title="Search profile">
                  🔍
                </button>
              </form>

              {showDropdown && searchQuery.trim() && (
                <div className="user-search-dropdown">
                  <div className="user-search-dropdown-header">
                    {searchLoading ? "Searching..." : `Users matching "${searchQuery}"`}
                  </div>
                  {suggestions.length > 0 ? (
                    <ul className="user-search-list">
                      {suggestions.map((u) => (
                        <li
                          key={u.username}
                          className="user-search-item"
                          onClick={() => handleSelectUser(u.username)}
                        >
                          <div className="user-search-item-left">
                            <div className="user-search-avatar">
                              {u.username.slice(0, 2)}
                            </div>
                            <span className="user-search-name">@{u.username}</span>
                          </div>
                          <span className="user-search-count">
                            {u.total_completed} solved
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : !searchLoading ? (
                    <div className="user-search-empty">
                      <div>No user found</div>
                      <button
                        className="btn-ghost"
                        style={{ marginTop: "6px", fontSize: "11px", padding: "3px 8px" }}
                        onClick={handleSearchSubmit}
                      >
                        Search "@{searchQuery.trim().replace(/^@+/, "")}" anyway →
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={handleShare}>
              🔗 Copy link
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-secondary)" }}>
            Loading developer profile...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--glass-border)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ color: "var(--state-error)", fontSize: "18px", marginBottom: "8px" }}>{error}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "420px", margin: "0 auto 20px" }}>
              Could not find a developer profile for "@{cleanUsername}". Check the spelling or search for another developer above.
            </p>
            <button className="btn-ghost" onClick={() => onNavigate("library")}>
              Browse problem catalog →
            </button>
          </div>
        ) : (
          <>
            {/* Score Metrics Breakdown */}
            <div className="score-metrics-grid" style={{ marginBottom: "36px" }}>
              <div className="score-metric-card">
                <div className="metric-big-num" style={{ color: "var(--state-violet)" }}>{totalCount}</div>
                <div className="metric-label">Challenges Solved</div>
              </div>
              <div className="score-metric-card">
                <div className="metric-big-num" style={{ color: "var(--diff-easy)" }}>{easyCount}</div>
                <div className="metric-label">Fundamentals (Easy)</div>
              </div>
              <div className="score-metric-card">
                <div className="metric-big-num" style={{ color: "var(--diff-medium)" }}>{mediumCount}</div>
                <div className="metric-label">Core Algorithms (Med)</div>
              </div>
              <div className="score-metric-card">
                <div className="metric-big-num" style={{ color: "var(--diff-hard)" }}>{hardCount}</div>
                <div className="metric-label">Advanced Mastery (Hard)</div>
              </div>
            </div>

            {/* Mastered Topics Tags */}
            {topicsList.length > 0 && (
              <div style={{ marginBottom: "36px", background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
                <div className="filter-group-title" style={{ marginBottom: "12px" }}>
                  Mastered Topics ({topicsList.length})
                </div>
                <div className="tag-list" style={{ gap: "8px" }}>
                  {topicsList.map((t) => (
                    <span key={t} className="tag-chip" style={{ padding: "4px 12px", fontSize: "12px" }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Completed Sessions Timeline */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                <div className="filter-group-title">
                  Completed Challenge Timeline ({totalCount})
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Chronological record
                </span>
              </div>

              {totalCount === 0 ? (
                <div className="empty-profile-card">
                  <h3 style={{ fontSize: "17px", marginBottom: "8px" }}>No completed challenges yet</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "400px", margin: "0 auto 20px" }}>
                    Step into the problem catalog to begin an interview round with your adaptive AI coach.
                  </p>
                  <button className="btn-primary" onClick={() => onNavigate("library")}>
                    Explore problem catalog →
                  </button>
                </div>
              ) : (
                <div className="timeline-feed">
                  {completed.map((item, idx) => (
                    <div
                      key={item.id}
                      className="timeline-item"
                      onClick={() => onSelectProblem(item)}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--text-muted)", minWidth: "28px" }}>
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--state-cyan)", fontWeight: 600 }}>✓ Solved</span>
                          </div>
                          <div className="tag-list" style={{ marginTop: "6px" }}>
                            {item.topics.slice(0, 3).map((t, i) => (
                              <span key={i} className="tag-chip" style={{ fontSize: "10px" }}>#{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={`difficulty-dot ${item.difficulty}`} />
                          <span style={{ fontSize: "12px", textTransform: "capitalize", color: "var(--text-secondary)" }}>
                            {item.difficulty}
                          </span>
                        </div>
                        <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }}>
                          Practice again →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
