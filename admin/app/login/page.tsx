"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_URL = "http://localhost:8000/api/auth/login";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginResponse = {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      created_at: string;
      updated_at: string;
    };
  } | null;
  message: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let body: LoginResponse | null = null;
      try {
        body = (await res.json()) as LoginResponse;
      } catch {
        body = null;
      }

      if (res.status === 200 && body?.success && body.data) {
        localStorage.setItem("token", body.data.token);
        localStorage.setItem("user", JSON.stringify(body.data.user));
        router.push("/dashboard");
        return;
      }

      if (res.status === 401) {
        setError("Invalid email or password.");
      } else if (res.status === 422) {
        if (!EMAIL_REGEX.test(email.trim())) {
          setError("Please enter a valid email address.");
        } else if (password.length < 6) {
          setError("Password must be at least 6 characters.");
        } else {
          setError(body?.message || "Please check your input and try again.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f5f5f5] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-10 shadow-sm">
        <header className="mb-8">
          <p className="text-sm font-normal text-[#6b7280]">Admin Panel</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#111827]">
            Sign In
          </h1>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] font-medium text-[#374151]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={submitting}
              className="h-11 w-full rounded-lg border border-[#d1d5db] bg-white px-3.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>

          <div className="mb-5">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-medium text-[#374151]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              readOnly={submitting}
              className="h-11 w-full rounded-lg border border-[#d1d5db] bg-white px-3.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5 text-[13px] text-[#b91c1c]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-lg bg-[#111827] text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-[11px] text-[#9ca3af]">
          Use admin@example.com / password123 for the seeded admin.
        </p>
      </div>
    </div>
  );
}
