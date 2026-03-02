import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Mail, Lock } from "lucide-react";
import "../auth.css";
import BackButton from "../components/BackButton";

const API = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/auth`;

export default function Login() {
  const { role } = useParams();
  const navigate = useNavigate();
  const selectedRole = String(role || "user");
  const roleLabel = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);

  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetFields = () => {
    setUsername("");
    setEmail("");
    setPassword("");
  };

  const handleSignUp = async () => {
    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setMessage("Account created successfully. Please sign in.");
      setMode("signin");
      resetFields();
    } catch {
      setError("Server error");
    }
  };

  const handleLogin = async () => {
    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, email, password, role })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("authEmail", email);
      if (data.role === "manufacturer") {
        localStorage.setItem("manufacturerId", email);
      }

      navigate(`/dashboard/${data.role}`);
    } catch {
      setError("Server error");
    }
  };

  return (
    <div className="auth-page">
      <BackButton to="/roles" />
      <div className="auth-shell">
        <section className="auth-card">
          <h2 className="auth-title">{mode === "signin" ? "Welcome Back" : "Create Account"}</h2>
          <p className="auth-subtitle">
            {mode === "signin"
              ? "Sign in to your TrustChain workspace."
              : "Register your TrustChain account."}
          </p>
          <div className="auth-role-badge">Selected Role: {roleLabel}</div>

          <div className={`auth-switch ${mode}`}>
            <span className="auth-switch-slider" aria-hidden="true" />
            <button
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                resetFields();
                setError("");
                setMessage("");
              }}
            >
              Sign In
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                resetFields();
                setError("");
                setMessage("");
              }}
            >
              Register
            </button>
          </div>

          <div className="auth-form">
            {mode === "signup" ? (
              <div className="auth-input">
                <User size={18} />
                <input
                  autoComplete="off"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            ) : (
              <div className="auth-input">
                <Mail size={18} />
                <input
                  autoComplete="off"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="auth-input">
                <Mail size={18} />
                <input
                  autoComplete="off"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div className="auth-input">
              <Lock size={18} />
              <input
                autoComplete="new-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}

            {mode === "signup" ? (
              <button className="auth-btn" onClick={handleSignUp}>
                Create Account
              </button>
            ) : (
              <button className="auth-btn" onClick={handleLogin}>
                Sign In
              </button>
            )}
          </div>

          {mode === "signin" && (
            <p className="auth-hint">
              Don't have an account?
              <span onClick={() => setMode("signup")}> Register</span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

