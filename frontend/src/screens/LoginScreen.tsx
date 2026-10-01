import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { loginUser } from "../api";
import type { User } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  onNavigate: (view: string) => void;
}

export default function LoginScreen({ onLoginSuccess, onNavigate }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await loginUser(username.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar user={null} onNavigate={onNavigate} />

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div className="glass-card panel-entry" style={{ width: "100%", maxWidth: "420px", padding: "36px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div className="stage-pill" style={{ marginBottom: "12px" }}>
              <span>●</span> Authentication
            </div>
            <h1 style={{ fontSize: "26px", marginBottom: "8px" }}>Welcome Back</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              Sign in to track your mock interview sessions and developer profile.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="filter-group-title" style={{ display: "block", marginBottom: "6px" }}>
                Username
              </label>
              <input
                type="text"
                placeholder="e.g. alex2026"
                className="chat-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: "100%" }}
                autoFocus
              />
            </div>

            <div>
              <label className="filter-group-title" style={{ display: "block", marginBottom: "6px" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="chat-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {error && (
              <div style={{ color: "var(--state-error)", fontSize: "12px", background: "rgba(241, 106, 106, 0.08)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--state-error-glow)" }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: "100%", padding: "10px", marginTop: "8px" }} disabled={loading}>
              {loading ? "Signing in..." : "Sign in to interview room"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--glass-border)", fontSize: "13px", color: "var(--text-secondary)" }}>
            Don't have an account?{" "}
            <button
              style={{ background: "none", border: "none", color: "var(--state-violet)", fontWeight: 600, padding: 0, cursor: "pointer", display: "inline" }}
              onClick={() => onNavigate("signup")}
            >
              Sign up free
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
