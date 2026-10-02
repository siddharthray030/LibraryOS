import { useState, useId, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginWithEmail } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { useRateLimit } from "../hooks/useRateLimit";

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export default function Login() {
  const { authError } = useAuth();
  const emailId    = useId();
  const passwordId = useId();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [shakeKey, setShakeKey] = useState(0); // retrigger shake

  const { check, recordFailure, recordSuccess, blocked, remaining } = useRateLimit();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { allowed, delay } = check();
    if (!allowed) return;

    if (!email.trim() || !password) {
      setError("Invalid email or password.");
      setShakeKey(k => k + 1);
      return;
    }

    setLoading(true);
    if (delay > 0) await sleep(delay);

    try {
      await loginWithEmail(email.trim(), password);
      recordSuccess();
    } catch (err) {
      recordFailure();
      setError(err.message || "Invalid email or password.");
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled   = loading || blocked;
  const displayError = authError || error;

  return (
    <>
      <style>{`
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-4px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
          90%       { transform: translateX(2px); }
        }
        .login-shake { animation: loginShake 0.4s ease both; }
      `}</style>

      {/* Full-screen background */}
      <div
        className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
        style={{ background: "#090d19" }}
      >
        {/* Warm amber radial glow — centre-left */}
        <div style={{
          position: "absolute", top: "50%", left: "30%",
          transform: "translate(-50%, -55%)",
          width: 560, height: 560, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,120,20,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Cool blue glow — right */}
        <div style={{
          position: "absolute", bottom: "10%", right: "-5%",
          width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,80,180,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div
          className="relative z-10 w-full"
          style={{
            maxWidth: 400,
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        >
          {/* Logo + Title — fades up with stagger */}
          <div className="anim-fade-up flex flex-col items-center text-center mb-7" style={{ animationDelay: "0ms" }}>
            <div
              className="anim-scale-in"
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: "linear-gradient(135deg, #f5a623 0%, #e08910 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
                boxShadow: "0 8px 32px rgba(245,166,35,0.28)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                <div style={{ width: 11, height: 11, borderRadius: 2, background: "#22c55e" }} />
                <div style={{ width: 11, height: 11, borderRadius: 2, background: "#3b82f6" }} />
                <div style={{ width: 11, height: 11, borderRadius: 2, background: "#f97316" }} />
                <div style={{ width: 11, height: 11, borderRadius: 2, background: "#a855f7" }} />
              </div>
            </div>

            <h1 style={{ color: "#fff", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>
              LibraryOS
            </h1>
            <p style={{ color: "#6b7280", fontSize: "0.8rem", marginTop: 8, letterSpacing: "0.02em" }}>
              School Library Management System
            </p>
          </div>

          {/* Login Card — slightly delayed fade-up */}
          <div
            className="anim-fade-up"
            style={{
              animationDelay: "80ms",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: "2rem 2rem 1.75rem",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <h2 style={{
              color: "#fff", fontSize: "1.2rem", fontWeight: 700,
              marginBottom: "1.5rem", fontStyle: "italic", letterSpacing: "0.01em",
            }}>
              Admin Sign In
            </h2>

            {/* Auth / role error */}
            {authError && (
              <div role="alert" style={{
                marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: 8,
                background: "rgba(127,29,29,0.5)", border: "1px solid rgba(153,27,27,0.5)",
                color: "#fca5a5", fontSize: "0.82rem",
              }}>
                {authError}
              </div>
            )}

            {/* Lockout */}
            {blocked && (
              <div role="alert" aria-live="polite" style={{
                marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: 8,
                background: "rgba(120,53,15,0.4)", border: "1px solid rgba(180,83,9,0.4)",
                color: "#fbbf24", fontSize: "0.82rem",
              }}>
                Too many attempts. Try again in{" "}
                <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong>.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div style={{ marginBottom: "1rem" }} className="anim-fade-up anim-delay-2">
                <label
                  htmlFor={emailId}
                  style={{ display: "block", color: "#9ca3af", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}
                >
                  Username
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={isDisabled}
                  placeholder="admin"
                  aria-required="true"
                  className="login-input"
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: "1.25rem" }} className="anim-fade-up anim-delay-3">
                <label
                  htmlFor={passwordId}
                  style={{ display: "block", color: "#9ca3af", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id={passwordId}
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isDisabled}
                    placeholder="••••••••"
                    aria-required="true"
                    className="login-input"
                    style={{ paddingRight: "3rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    disabled={isDisabled}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: 12, top: "50%",
                      transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#4b5563", padding: 4,
                      display: "flex", alignItems: "center",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error — shake animation on key change */}
              {displayError && !authError && (
                <div
                  key={shakeKey}
                  role="alert"
                  aria-live="assertive"
                  className={shakeKey > 0 ? "login-shake" : ""}
                  style={{
                    marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: 8,
                    background: "rgba(127,29,29,0.5)", border: "1px solid rgba(153,27,27,0.5)",
                    color: "#fca5a5", fontSize: "0.82rem",
                  }}
                >
                  {displayError}
                </div>
              )}

              {/* Sign In button */}
              <button
                type="submit"
                disabled={isDisabled}
                className="anim-fade-up anim-delay-4"
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  background: isDisabled
                    ? "rgba(245,166,35,0.4)"
                    : "linear-gradient(90deg, #f5a623 0%, #e08910 100%)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  borderRadius: 8,
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "opacity 0.2s ease, transform 0.12s ease, box-shadow 0.15s ease",
                  boxShadow: isDisabled ? "none" : "0 4px 20px rgba(245,166,35,0.3)",
                  transform: "translateY(0)",
                }}
                onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                onMouseDown={e => { if (!isDisabled) e.currentTarget.style.transform = "scale(0.97)"; }}
                onMouseUp={e => { if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
              >
                {loading
                  ? <><Loader2 size={16} className="anim-spin" /> Signing in...</>
                  : "Sign In →"
                }
              </button>
            </form>
          </div>

          {/* Footer */}
          <p
            className="anim-fade-up"
            style={{ animationDelay: "160ms", textAlign: "center", color: "#374151", fontSize: "0.72rem", marginTop: "1.5rem" }}
          >
            LibraryOS v2.0 · Admin access only
          </p>
        </div>
      </div>
    </>
  );
}
