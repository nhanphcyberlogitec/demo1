"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Unable to connect to server. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-lg bg-white p-8 shadow-sm mx-4"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#111827]">Welcome back</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Sign in to your account
            </p>
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              disabled={loading}
              placeholder="Enter your email"
              className="h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-base text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              disabled={loading}
              placeholder="Enter your password"
              className="h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-base text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="flex w-full items-center gap-2 text-sm text-[#DC2626]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2563EB] text-base font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
