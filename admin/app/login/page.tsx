"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000/api/auth/login";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MSG_EMAIL_REQUIRED = "Email is required";
const MSG_EMAIL_INVALID = "Please enter a valid email address";
const MSG_PASSWORD_REQUIRED = "Password is required";
const MSG_AUTH_FAILED = "Invalid email or password";
const MSG_INVALID_BODY = "Invalid request body";
const MSG_SERVER_ERROR = "Something went wrong. Please try again.";
const MSG_NETWORK_ERROR =
  "Unable to reach the server. Check your connection and try again.";

type ApiEnvelope = {
  success: boolean;
  data: { token: string; user: { id: string; email: string; name: string | null } } | null;
  message: string;
};

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("token");
    if (token) {
      router.replace("/dashboard");
      return;
    }
    setMounted(true);
  }, [router]);

  useEffect(() => {
    if (mounted) {
      emailRef.current?.focus();
    }
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  const validateClient = (): { emailMsg: string | null; passwordMsg: string | null } => {
    let emailMsg: string | null = null;
    let passwordMsg: string | null = null;

    if (email.trim().length === 0) {
      emailMsg = MSG_EMAIL_REQUIRED;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      emailMsg = MSG_EMAIL_INVALID;
    }

    if (password.length === 0) {
      passwordMsg = MSG_PASSWORD_REQUIRED;
    }

    return { emailMsg, passwordMsg };
  };

  const applyServer422 = (message: string) => {
    if (message === MSG_EMAIL_REQUIRED || message === MSG_EMAIL_INVALID) {
      setEmailError(message);
      setPasswordError(null);
      setBannerError(null);
      emailRef.current?.focus();
    } else if (message === MSG_PASSWORD_REQUIRED) {
      setEmailError(null);
      setPasswordError(message);
      setBannerError(null);
      passwordRef.current?.focus();
    } else {
      setEmailError(null);
      setPasswordError(null);
      setBannerError(message || MSG_INVALID_BODY);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const { emailMsg, passwordMsg } = validateClient();
    setEmailError(emailMsg);
    setPasswordError(passwordMsg);
    setBannerError(null);

    if (emailMsg || passwordMsg) {
      if (emailMsg) {
        emailRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }

    setSubmitting(true);

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      setBannerError(MSG_NETWORK_ERROR);
      setSubmitting(false);
      return;
    }

    let body: ApiEnvelope | null = null;
    try {
      body = (await response.json()) as ApiEnvelope;
    } catch {
      setBannerError(MSG_SERVER_ERROR);
      setSubmitting(false);
      return;
    }

    if (response.status === 200 && body?.success && body.data) {
      try {
        window.localStorage.setItem("token", body.data.token);
        window.localStorage.setItem("user", JSON.stringify(body.data.user));
      } catch {
        setBannerError(MSG_SERVER_ERROR);
        setSubmitting(false);
        return;
      }
      router.replace("/dashboard");
      return;
    }

    if (response.status === 401) {
      setEmailError(null);
      setPasswordError(null);
      setBannerError(MSG_AUTH_FAILED);
      setSubmitting(false);
      emailRef.current?.focus();
      return;
    }

    if (response.status === 422) {
      applyServer422(body?.message ?? MSG_INVALID_BODY);
      setSubmitting(false);
      return;
    }

    setBannerError(MSG_SERVER_ERROR);
    setSubmitting(false);
  };

  const emailInvalid = Boolean(emailError);
  const passwordInvalid = Boolean(passwordError);

  return (
    <main className="min-h-screen w-full bg-[#f9fafb] flex items-center justify-center px-5 py-15">
      <div className="w-full max-w-[460px]">
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
          <h1 className="text-[24px] font-semibold leading-tight text-[#111827]">
            Sign in to Admin Panel
          </h1>
          <p className="mt-3 text-sm text-[#6b7280]">
            Enter your credentials to continue.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#111827]"
              >
                Email
              </label>
              <input
                id="email"
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={emailInvalid}
                aria-describedby={emailInvalid ? "email-error" : undefined}
                disabled={submitting}
                placeholder="you@example.com"
                className={`mt-2 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] shadow-sm outline-none transition focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[#f9fafb] ${
                  emailInvalid
                    ? "border-[#dc2626] focus:border-[#dc2626] focus:ring-[#fecaca]"
                    : "border-[#e5e7eb] focus:border-[#2563eb] focus:ring-[#bfdbfe]"
                }`}
              />
              {emailInvalid && (
                <p
                  id="email-error"
                  role="alert"
                  className="mt-1.5 text-sm text-[#dc2626]"
                >
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#111827]"
              >
                Password
              </label>
              <input
                id="password"
                ref={passwordRef}
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={passwordInvalid}
                aria-describedby={passwordInvalid ? "password-error" : undefined}
                disabled={submitting}
                placeholder="••••••••"
                className={`mt-2 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] shadow-sm outline-none transition focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[#f9fafb] ${
                  passwordInvalid
                    ? "border-[#dc2626] focus:border-[#dc2626] focus:ring-[#fecaca]"
                    : "border-[#e5e7eb] focus:border-[#2563eb] focus:ring-[#bfdbfe]"
                }`}
              />
              {passwordInvalid && (
                <p
                  id="password-error"
                  role="alert"
                  className="mt-1.5 text-sm text-[#dc2626]"
                >
                  {passwordError}
                </p>
              )}
            </div>

            {bannerError && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-sm font-medium text-[#b91c1c]"
              >
                {bannerError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#93c5fd] sm:w-full"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#9ca3af]">
            Contact your administrator if you cannot sign in.
          </p>
        </div>
      </div>
    </main>
  );
}
