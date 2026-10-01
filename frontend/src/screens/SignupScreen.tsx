import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { signupUser } from "../api";
import type { User } from "../types";

interface SignupScreenProps {
  onSignupSuccess: (user: User) => void;
  onNavigate: (view: string) => void;
}

export default function SignupScreen({ onSignupSuccess, onNavigate }: SignupScreenProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await signupUser(username.trim(), email.trim(), password);
      onSignupSuccess(user);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try a different username or email.");
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
              <span>●</span> Join SignalCode
            </div>
            <h1 style={{ fontSize: "26px", marginBottom: "8px" }}>Create Account</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              Start practicing in privacy-aware AI coding interview rooms.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="filter-group-title" style={{ display: "block", marginBottom: "6px" }}>
                Username
              </label>
              <input
                type="text"
                placeholder="e.g. dev_sarah"
                className="chat-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: "100%" }}
                autoFocus
              />
            </div>

            <div>
              <label className="filter-group-title" style={{ display: "block", marginBottom: "6px" }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="sarah@example.com"
                className="chat-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%" }}
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
              {loading ? "Creating account..." : "Complete registration"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--glass-border)", fontSize: "13px", color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <button
              style={{ background: "none", border: "none", color: "var(--state-violet)", fontWeight: 600, padding: 0, cursor: "pointer", display: "inline" }}
              onClick={() => onNavigate("dashboard/signin")}
            >
              Sign in here
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
