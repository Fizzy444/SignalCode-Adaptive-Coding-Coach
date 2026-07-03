import React, { useState } from "react";
import { loginUser } from "./api";
import type { User } from "./types";

interface LoginProps {
  onLogin: (user: User) => void;
  onBack: () => void;
}

export default function Login({ onLogin, onBack }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await loginUser(username.trim(), password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
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
      </nav>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="hero-pill" style={{ marginBottom: "16px" }}>
              <span className="hero-pill-dot" />
              Private AI Coach Account
            </div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">
              Enter your username and password to log in. If your username is new, an account will be created automatically.
            </p>
          </div>

          {error && <div className="auth-error-badge">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-input-group">
              <label className="label" htmlFor="username-input">Username</label>
              <input
                id="username-input"
                type="text"
                className="form-input"
                placeholder="e.g. alex_dev"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <div className="form-input-group">
              <label className="label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? "Authenticating..." : "Continue →"}
            </button>
          </form>

          <div className="auth-footer">
            <p className="mono" style={{ fontSize: "12px", color: "var(--text-3)" }}>
              🔒 Secure on-device & interview privacy guaranteed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
