"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      avatarUrl: string | null;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// ─── SVG Components ──────────────────────────────────────────────────────────

function AnchorIcon({ size = 28, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="14" cy="7" r="3" stroke={color} strokeWidth="2" fill="none" />
      <line x1="14" y1="10" x2="14" y2="24" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M7 15 C7 22 21 22 21 15" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="7" y1="15" x2="4" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="15" x2="24" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CompassRose() {
  return (
    <svg
      width="320"
      height="320"
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="opacity-20"
    >
      {/* Concentric rings */}
      <circle cx="160" cy="160" r="150" stroke="#2E6DA4" strokeWidth="1" />
      <circle cx="160" cy="160" r="120" stroke="#2E6DA4" strokeWidth="1" />
      <circle cx="160" cy="160" r="90" stroke="#2E6DA4" strokeWidth="1" />
      <circle cx="160" cy="160" r="60" stroke="#2E6DA4" strokeWidth="1.5" />
      <circle cx="160" cy="160" r="30" stroke="#2E6DA4" strokeWidth="1.5" />
      {/* Crosshairs */}
      <line x1="160" y1="10" x2="160" y2="310" stroke="#2E6DA4" strokeWidth="1" />
      <line x1="10" y1="160" x2="310" y2="160" stroke="#2E6DA4" strokeWidth="1" />
      <line x1="54" y1="54" x2="266" y2="266" stroke="#2E6DA4" strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="266" y1="54" x2="54" y2="266" stroke="#2E6DA4" strokeWidth="0.5" strokeDasharray="4 4" />
      {/* Cardinal direction points */}
      <polygon points="160,10 153,50 167,50" fill="#E8761A" />
      <polygon points="160,310 153,270 167,270" fill="#2E6DA4" />
      <polygon points="10,160 50,153 50,167" fill="#2E6DA4" />
      <polygon points="310,160 270,153 270,167" fill="#2E6DA4" />
      {/* Center dot */}
      <circle cx="160" cy="160" r="6" fill="#E8761A" />
      {/* Tick marks */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 160 + 148 * Math.sin(rad);
        const y1 = 160 - 148 * Math.cos(rad);
        const x2 = 160 + 140 * Math.sin(rad);
        const y2 = 160 - 140 * Math.cos(rad);
        return (
          <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2E6DA4" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}

function DotGrid({
  cols = 6,
  rows = 6,
  color = "#2E6DA4",
  className = "",
}: {
  cols?: number;
  rows?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={cols * 16}
      height={rows * 16}
      viewBox={`0 0 ${cols * 16} ${rows * 16}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 16 + 8} cy={r * 16 + 8} r="2" fill={color} />
        ))
      )}
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z"
        stroke="#A0B9D2"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="9" cy="9" r="2.5" stroke="#A0B9D2" strokeWidth="1.5" fill="none" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z"
        stroke="#A0B9D2"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="9" cy="9" r="2.5" stroke="#A0B9D2" strokeWidth="1.5" fill="none" />
      <line x1="2" y1="2" x2="16" y2="16" stroke="#A0B9D2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-label="Loading"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      />
      <path
        d="M10 2 A8 8 0 0 1 18 10"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side email validation
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client-side validation
    if (!isValidEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const json: LoginResponse = await res.json();

      if (json.success && json.data) {
        const { token } = json.data;
        if (rememberMe) {
          localStorage.setItem("shiptrack_token", token);
        } else {
          sessionStorage.setItem("shiptrack_token", token);
        }
        router.push("/dashboard");
      } else {
        setErrorMessage(
          json.error?.message ?? "An unexpected error occurred. Please try again."
        );
      }
    } catch {
      setErrorMessage("Unable to connect to the server. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: "#0A1628", fontFamily: "Inter, Arial, sans-serif" }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{
          width: "55%",
          background: "linear-gradient(160deg, #0A1628 0%, #1A3A5C 100%)",
          padding: "56px 64px",
        }}
      >
        {/* Dot grid top-left */}
        <div className="absolute top-8 left-8 opacity-30">
          <DotGrid cols={8} rows={6} color="#2E6DA4" />
        </div>

        {/* Dot grid bottom-right (orange accent) */}
        <div className="absolute bottom-10 right-10 opacity-20">
          <DotGrid cols={6} rows={5} color="#E8761A" />
        </div>

        {/* Compass rose — centered in panel */}
        <div
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <CompassRose />
        </div>

        {/* Header: anchor badge + company name */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 52,
                height: 52,
                backgroundColor: "#E8761A",
              }}
              aria-label="ShipTrack Pro anchor badge"
            >
              <AnchorIcon size={28} color="#FFFFFF" />
            </div>
          </div>
          <h1
            className="text-white mb-3"
            style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1 }}
          >
            ShipTrack Pro
          </h1>
          <p
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: "#2E6DA4",
              marginBottom: 20,
            }}
          >
            Freight &amp; Logistics Management Platform
          </p>

          {/* Orange divider */}
          <div
            style={{ width: 60, height: 3, backgroundColor: "#E8761A", borderRadius: 2 }}
          />
        </div>

        {/* Feature bullets */}
        <div className="relative z-10">
          {[
            { title: "Real-Time Shipment Tracking", desc: "Monitor every vessel and freight movement live." },
            { title: "Smart Route Optimization", desc: "AI-powered routing to cut transit times and costs." },
            { title: "Unified Freight Dashboard", desc: "All carriers, ports, and documents in one place." },
          ].map(({ title, desc }) => (
            <div key={title} className="flex items-start gap-3 mb-5">
              <span
                className="flex-shrink-0 rounded-full mt-1"
                style={{ width: 8, height: 8, backgroundColor: "#E8761A", marginTop: 6 }}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#FFFFFF", marginBottom: 2 }}>
                  {title}
                </p>
                <p style={{ fontSize: 13, fontWeight: 400, color: "#A0B9D2" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ backgroundColor: "#0F1E35" }}
      >
        {/* Mobile: top banner (shown only on small screens) */}
        <div
          className="lg:hidden absolute top-0 left-0 right-0 flex items-center gap-3 px-6 py-4"
          style={{ backgroundColor: "#0A1628", borderBottom: "1px solid #1A3A5C" }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, backgroundColor: "#E8761A" }}
          >
            <AnchorIcon size={20} color="#FFFFFF" />
          </div>
          <span
            className="text-white font-bold"
            style={{ fontSize: 20 }}
          >
            ShipTrack Pro
          </span>
        </div>

        {/* Login Card */}
        <div
          className="w-full"
          style={{
            maxWidth: 440,
            backgroundColor: "#14264A",
            borderRadius: 16,
            padding: "48px 40px 40px",
            boxShadow: "0px 20px 60px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Card header */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-full mb-4"
              style={{ width: 48, height: 48, backgroundColor: "#E8761A" }}
              aria-label="ShipTrack Pro"
            >
              <AnchorIcon size={26} color="#FFFFFF" />
            </div>
            <h2
              className="text-white text-center"
              style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}
            >
              Welcome Back
            </h2>
            <p
              className="text-center"
              style={{ fontSize: 14, color: "#A0B9D2" }}
            >
              Sign in to your ShipTrack Pro account
            </p>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.12)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                color: "#FCA5A5",
                fontSize: 13,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Email field */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="block mb-2"
                style={{ fontSize: 13, fontWeight: 500, color: "#A0B9D2" }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="captain@shiptrackpro.com"
                disabled={isLoading}
                required
                className="w-full outline-none transition-all"
                style={{
                  height: 48,
                  backgroundColor: "#0A1628",
                  border: "1px solid #2E6DA4",
                  borderRadius: 8,
                  padding: "0 16px",
                  fontSize: 14,
                  color: "#FFFFFF",
                  caretColor: "#E8761A",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#E8761A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2E6DA4")}
              />
            </div>

            {/* Password field */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block mb-2"
                style={{ fontSize: 13, fontWeight: 500, color: "#A0B9D2" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                  className="w-full outline-none transition-all"
                  style={{
                    height: 48,
                    backgroundColor: "#0A1628",
                    border: "1px solid #2E6DA4",
                    borderRadius: 8,
                    padding: "0 48px 0 16px",
                    fontSize: 14,
                    color: "#FFFFFF",
                    caretColor: "#E8761A",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#E8761A")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2E6DA4")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between mb-7">
              <label
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{ fontSize: 13, color: "#A0B9D2" }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="rounded"
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: "#E8761A",
                    cursor: "pointer",
                  }}
                />
                Remember me
              </label>

              <a
                href="/auth/forgot-password"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#E8761A",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F5A623")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#E8761A")}
              >
                Forgot password?
              </a>
            </div>

            {/* Login CTA button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 transition-colors"
              style={{
                height: 52,
                backgroundColor: isLoading ? "#c46314" : "#E8761A",
                borderRadius: 8,
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#FFFFFF",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = "#F5A623";
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = "#E8761A";
              }}
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  <span>SIGNING IN...</span>
                </>
              ) : (
                "LOGIN"
              )}
            </button>
          </form>

          {/* Footer */}
          <p
            className="text-center mt-8"
            style={{ fontSize: 12, color: "#3C5A7D" }}
          >
            &copy; 2026 ShipTrack Pro. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
