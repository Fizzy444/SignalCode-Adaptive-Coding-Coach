import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signupUser } from "./api";
import type { User } from "./types";

interface SignupProps {
  onSignup: (user: User) => void;
}

export default function Signup({ onSignup }: SignupProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await signupUser(username.trim(), email.trim(), password);
      onSignup(user);
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
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
      </nav>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="hero-pill" style={{ marginBottom: "16px" }}>
              <span className="hero-pill-dot" />
              Private AI Coach Account
            </div>
            <h1 className="auth-title">Create an account</h1>
            <p className="auth-subtitle">
              Enter a username and password to create a new account.
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
              <label className="label" htmlFor="email-input">Email</label>
              <input
                id="email-input"
                type="email"
                className="form-input"
                placeholder="e.g. alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
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

            <div className="form-input-group">
              <label className="label" htmlFor="confirm-password-input">Confirm Password</label>
              <input
                id="confirm-password-input"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={loading || !username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()}
            >
              {loading ? "Creating account..." : "Sign Up →"}
            </button>
          </form>

          <div className="auth-footer">
            <p className="mono" style={{ fontSize: "14px", color: "var(--text)", marginBottom: "12px" }}>
              Already have an account? <Link to="/login" style={{ color: "var(--accent)" }}>Log in here</Link>.
            </p>
            <p className="mono" style={{ fontSize: "12px", color: "var(--text-3)" }}>
              🔒 Secure on-device & interview privacy guaranteed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
