import React from "react";
import { Link } from "react-router-dom";
import type { User } from "../types";

interface NavbarProps {
  user: User | null;
  onNavigate: (view: string) => void;
  onLogout?: () => void;
}

export default function Navbar({ user, onNavigate, onLogout }: NavbarProps) {
  return (
    <nav className="app-nav">
      <Link to="/" style={{ textDecoration: "none" }} onClick={() => onNavigate("home")}>
        <div className="brand">
          <span className="brand-dot" />
          SignalCode
        </div>
      </Link>

      <div className="nav-actions">
        <button className="btn-ghost" onClick={() => onNavigate("library")}>
          Problem Catalog
        </button>

        {user ? (
          <>
            <button
              className="user-badge"
              onClick={() => onNavigate(`u/${user.username}`)}
              title="View your profile"
            >
              <div className="user-avatar-sm">{user.username.slice(0, 2)}</div>
              <span>@{user.username}</span>
            </button>
            {onLogout && (
              <button
                className="btn-ghost"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={onLogout}
              >
                Sign out
              </button>
            )}
          </>
        ) : (
          <button className="btn-primary" onClick={() => onNavigate("dashboard/signin")}>
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
