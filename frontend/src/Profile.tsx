import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getUserProfile, searchUsers } from "./api";
import type { Problem, UserProfile, UserSearchResult } from "./types";

interface ProfileProps {
  username: string;
  onSelectProblem: (problem: Problem) => void;
  onBrowse: () => void;
  onSearch: (username: string) => void;
  isOwnProfile: boolean;
}

export default function Profile({ username, onSelectProblem, onBrowse, onSearch, isOwnProfile }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Live search suggestions with debounce
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
        .then((results) => {
          setSuggestions(results);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const completed = profile?.completed_problems || [];
  const easyCount = completed.filter((p) => p.difficulty === "easy").length;
  const mediumCount = completed.filter((p) => p.difficulty === "medium").length;
  const hardCount = completed.filter((p) => p.difficulty === "hard").length;
  const totalCount = completed.length;

  const topicsSet = new Set<string>();
  completed.forEach((p) => p.topics.forEach((t) => topicsSet.add(t)));
  const topicsList = Array.from(topicsSet).sort();

  let rank = "Novice";
  if (totalCount >= 30) rank = "Master";
  else if (totalCount >= 15) rank = "Scholar";
  else if (totalCount >= 5) rank = "Apprentice";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().replace(/^@+/, "");
    if (clean) {
      setShowDropdown(false);
      onSearch(clean);
      setSearchQuery("");
    }
  };

  const handleSelectUser = (selectedUsername: string) => {
    setShowDropdown(false);
    setSearchQuery("");
    onSearch(selectedUsername);
  };

  const shareProfile = () => {
    navigator.clipboard.writeText(window.location.origin + "/u/" + (profile?.username || username));
    alert("Profile link copied to clipboard!");
  };

  return (
    <main className="library-page">
      <nav className="lib-header">
        <Link
          to="/"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <div className="brand">
            <span className="brand-dot" />
            SignalCode
          </div>
        </Link>
        <div className="lib-header-actions">
          <div className="user-search-wrapper" ref={searchContainerRef}>
            <form className="user-search-form" onSubmit={handleSearchSubmit}>
              <input
                type="text"
                placeholder="Search developer..."
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
                  {searchLoading ? "Searching..." : `Developers matching "${searchQuery}"`}
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
              {isOwnProfile ? "Your Profile" : "Developer Profile"}
            </div>
            <h1 className="lib-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span>@{profile?.username || username}</span>
              <span className={`diff-badge diff-${rank === 'Master' ? 'hard' : rank === 'Scholar' ? 'medium' : 'easy'}`} style={{ fontSize: "12px" }}>
                {rank}
              </span>
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "6px" }}>
              {isOwnProfile ? "Track your interview problem completions, difficulty progression, and mastery." : `View ${profile?.username || username}'s problem completions and mastery.`}
            </p>
          </div>
          <div>
            <button className="btn-primary" onClick={shareProfile} style={{ padding: "8px 16px" }}>
              🔗 Copy Link
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-2)" }}>
            Loading developer statistics...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--bg-2)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border-2)", margin: "24px 0" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ fontSize: "18px", color: "var(--red)", marginBottom: "8px" }}>{error}</h3>
            <p style={{ color: "var(--text-3)", fontSize: "14px", maxWidth: "420px", margin: "0 auto 16px" }}>
              Could not find a developer profile for "@{username}". Check the spelling or search for another developer above.
            </p>
            <button className="btn-ghost" onClick={onBrowse}>
              Browse Problem Library →
            </button>
          </div>
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
                    <div className="prob-row" key={item.id} onClick={() => { if (isOwnProfile) onSelectProblem(item); }}>
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
                        {isOwnProfile && (
                          <button
                            className="btn-ghost"
                            style={{ padding: "7px 14px", fontSize: "13px" }}
                            onClick={(e) => { e.stopPropagation(); onSelectProblem(item); }}
                          >
                            Practice again
                          </button>
                        )}
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
