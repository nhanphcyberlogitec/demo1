"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_URL = "http://localhost:8000/api/auth/login";

type FieldErrors = { email?: string; password?: string };

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email is required.";
  if (!EMAIL_PATTERN.test(value.trim())) return "Enter a valid email address.";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return undefined;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      router.replace("/dashboard");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />
    );
  }

  const onBlurEmail = () => {
    setTouched((t) => ({ ...t, email: true }));
    setErrors((e) => ({ ...e, email: validateEmail(email) }));
  };

  const onBlurPassword = () => {
    setTouched((t) => ({ ...t, password: true }));
    setErrors((e) => ({ ...e, password: validatePassword(password) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      if (emailError) emailRef.current?.focus();
      else if (passwordError) passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let payload: {
        success?: boolean;
        data?: { token: string; user: { id: string; email: string } } | null;
        message?: string;
      } = {};
      try {
        payload = await response.json();
      } catch {
        // fall through to generic error
      }

      if (response.ok && payload.success && payload.data) {
        localStorage.setItem("token", payload.data.token);
        localStorage.setItem("user", JSON.stringify(payload.data.user));
        router.replace("/dashboard");
        return;
      }

      if (response.status === 401) {
        setFormError(payload.message || "Invalid email or password");
      } else if (response.status === 422) {
        setFormError(payload.message || "Invalid email or password format.");
      } else {
        setFormError(
          payload.message || "Something went wrong. Please try again."
        );
      }
      setPassword("");
      passwordRef.current?.focus();
    } catch {
      setFormError("Something went wrong. Please try again.");
      setPassword("");
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const emailInvalid = touched.email && !!errors.email;
  const passwordInvalid = touched.password && !!errors.password;

  return (
    <div className="flex flex-1 items-center justify-center bg-[#f9fafb] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-[#111827]">Admin Panel</h1>

        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={handleSubmit}
          noValidate
        >
          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]"
            >
              <span aria-hidden="true" className="mt-[1px]">⚠</span>
              <span>{formError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-[#374151]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) {
                  setErrors((prev) => ({
                    ...prev,
                    email: validateEmail(e.target.value),
                  }));
                }
              }}
              onBlur={onBlurEmail}
              disabled={submitting}
              aria-invalid={emailInvalid ? "true" : "false"}
              aria-describedby={emailInvalid ? "email-error" : undefined}
              ref={emailRef}
              className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] disabled:text-[#6b7280] ${
                emailInvalid
                  ? "border-[#dc2626] focus:border-[#dc2626]"
                  : "border-[#d1d5db] focus:border-[#2563eb]"
              }`}
            />
            {emailInvalid && (
              <p id="email-error" className="text-sm text-[#dc2626]">
                {errors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#374151]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setErrors((prev) => ({
                    ...prev,
                    password: validatePassword(e.target.value),
                  }));
                }
              }}
              onBlur={onBlurPassword}
              disabled={submitting}
              aria-invalid={passwordInvalid ? "true" : "false"}
              aria-describedby={
                passwordInvalid ? "password-error" : undefined
              }
              ref={passwordRef}
              className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] disabled:text-[#6b7280] ${
                passwordInvalid
                  ? "border-[#dc2626] focus:border-[#dc2626]"
                  : "border-[#d1d5db] focus:border-[#2563eb]"
              }`}
            />
            {passwordInvalid && (
              <p id="password-error" className="text-sm text-[#dc2626]">
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] text-[15px] font-bold text-white transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {submitting && (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
              />
            )}
            <span>{submitting ? "Signing in…" : "Sign In"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
