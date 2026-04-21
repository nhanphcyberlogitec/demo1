"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const LOGIN_URL = "http://localhost:8000/api/auth/login";

// Mirrors the server regex from BACKEND_API.md §3.1 rule 4.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginUser = {
  id: string;
  email: string;
  name: string | null;
};

type LoginEnvelope = {
  success?: boolean;
  data?: {
    token?: string;
    user?: LoginUser;
  } | null;
  message?: string;
};

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusEmail, setFocusEmail] = useState(0);

  // If a session already exists in localStorage, skip the form and go
  // straight to the dashboard. Matches TC-E-13.
  useEffect(() => {
    try {
      const token = window.localStorage.getItem("token");
      const user = window.localStorage.getItem("user");
      if (token && user) {
        router.replace("/dashboard");
      }
    } catch {
      // localStorage unavailable — ignore and render the form.
    }
  }, [router]);

  // Re-focus the email field after a failed submit. We wait for the
  // next frame so that `disabled` has been flipped back to `false` in
  // the DOM; calling `.focus()` on a still-disabled input is a no-op.
  useEffect(() => {
    if (focusEmail === 0) return;
    const raf = requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [focusEmail]);

  function validateClient(
    emailValue: string,
    passwordValue: string
  ): FieldErrors {
    const errs: FieldErrors = {};
    if (!emailValue) {
      errs.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(emailValue)) {
      errs.email = "Enter a valid email address.";
    }
    if (!passwordValue) {
      errs.password = "Password is required.";
    } else if (passwordValue.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    return errs;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    const errs = validateClient(normalizedEmail, password);
    setFieldErrors(errs);
    setBanner(null);

    if (errs.email || errs.password) {
      return;
    }

    setSubmitting(true);

    let nextBanner: string | null = null;
    let success = false;
    let token: string | null = null;
    let user: LoginUser | null = null;

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let body: LoginEnvelope | null = null;
      try {
        body = (await res.json()) as LoginEnvelope;
      } catch {
        body = null;
      }

      if (
        res.ok &&
        body?.success === true &&
        body.data?.token &&
        body.data.user
      ) {
        success = true;
        token = body.data.token;
        user = body.data.user;
      } else if (res.status === 401) {
        // Never echo the server copy here — present the friendly,
        // anti-enumeration message from TECH_SPEC §7.
        nextBanner = "Invalid email or password.";
      } else if (res.status === 422) {
        nextBanner =
          (body && typeof body.message === "string" && body.message) ||
          "Please check your inputs and try again.";
      } else if (res.status === 429) {
        nextBanner =
          (body && typeof body.message === "string" && body.message) ||
          "Too many login attempts. Try again in 60 seconds.";
      } else {
        nextBanner = "Something went wrong. Please try again.";
      }
    } catch {
      // Network / fetch failure (offline, CORS, DNS, server down).
      nextBanner = "We couldn't reach the server. Please try again.";
    }

    if (success && token && user) {
      try {
        window.localStorage.setItem("token", token);
        window.localStorage.setItem("user", JSON.stringify(user));
      } catch {
        // Storage unavailable — fall back to an error banner.
        setSubmitting(false);
        setBanner("Something went wrong. Please try again.");
        setPassword("");
        setFocusEmail((n) => n + 1);
        return;
      }
      router.push("/dashboard");
      return;
    }

    setSubmitting(false);
    setBanner(nextBanner);
    setPassword("");
    setFocusEmail((n) => n + 1);
  }

  return (
    <main className="min-h-screen w-full bg-[#f5f7fa] flex items-start justify-center px-4 py-12 sm:items-center sm:px-10 sm:py-[120px]">
      <div className="w-full max-w-[440px] rounded-[12px] border border-[#e2e8f0] bg-white p-6 pb-8 sm:p-10 sm:pb-8">
        {/* Brand */}
        <header className="mb-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2563eb]">
            Admin Panel
          </p>
          <h1 className="mt-[6px] text-[24px] font-semibold leading-[1.2] text-[#0f172a]">
            Sign in to Admin Panel
          </h1>
          <p className="mt-2 text-[14px] leading-[1.4] text-[#475569]">
            Enter your credentials to continue.
          </p>
        </header>

        {/*
          Alert region is always attached so screen readers can announce
          async errors (AC-22 / TC-E-17). Visually hidden when empty.
        */}
        <div
          role="alert"
          aria-live="polite"
          className={
            banner
              ? "mb-6 flex items-start gap-2 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-[14px] py-3 text-[13px] font-medium text-[#b91c1c]"
              : "sr-only"
          }
        >
          {banner ? (
            <>
              <span aria-hidden="true" className="mt-[1px] select-none">
                ⚠
              </span>
              <span>{banner}</span>
            </>
          ) : null}
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-[6px]">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-[#0f172a]"
            >
              Email
            </label>
            <input
              id="email"
              ref={emailInputRef}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              placeholder="admin@example.com"
              value={email}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "email-error" : undefined
              }
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
                if (banner) setBanner(null);
              }}
              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] text-[14px] text-[#0f172a] placeholder-[#94a3b8] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:cursor-not-allowed disabled:bg-[#f8fafc] aria-invalid:border-[#b91c1c]"
            />
            {fieldErrors.email ? (
              <p
                id="email-error"
                className="flex items-center gap-1 text-[12px] font-medium text-[#b91c1c]"
              >
                <span aria-hidden="true">⚠</span>
                <span>{fieldErrors.email}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-[6px]">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-[#0f172a]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    password: undefined,
                  }));
                }
                if (banner) setBanner(null);
              }}
              className="h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] text-[14px] text-[#0f172a] placeholder-[#94a3b8] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:cursor-not-allowed disabled:bg-[#f8fafc] aria-invalid:border-[#b91c1c]"
            />
            {fieldErrors.password ? (
              <p
                id="password-error"
                className="flex items-center gap-1 text-[12px] font-medium text-[#b91c1c]"
              >
                <span aria-hidden="true">⚠</span>
                <span>{fieldErrors.password}</span>
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] text-[14px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80"
          >
            {submitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        <p className="mt-7 text-center text-[12px] text-[#94a3b8]">
          © 2026 Admin Panel
        </p>
      </div>
    </main>
  );
}
