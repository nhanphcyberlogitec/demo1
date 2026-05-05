"use client";

import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 255;

const ERR_INVALID_CREDENTIALS = "Invalid email or password. Please try again.";
const ERR_GENERIC = "Something went wrong. Please try again.";

type FieldErrors = {
  email?: string;
  password?: string;
};

function validateEmail(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return "Email is required";
  if (value.length > EMAIL_MAX) return "Email is too long";
  if (!EMAIL_REGEX.test(value)) return "Enter a valid email address";
  return undefined;
}

function validatePassword(raw: string): string | undefined {
  if (!raw) return "Password is required";
  if (raw.length < PASSWORD_MIN)
    return "Password must be at least 8 characters";
  if (raw.length > PASSWORD_MAX) return "Password is too long";
  return undefined;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailErrId = useId();
  const passwordErrId = useId();
  const formErrId = useId();

  // BR-11 / AC-3: redirect to /dashboard if already authenticated.
  useEffect(() => {
    try {
      const token = window.localStorage.getItem("token");
      if (token) router.replace("/dashboard");
    } catch {
      // ignore — fall through to render login form
    }
  }, [router]);

  // Autofocus the email field on mount.
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Re-validate on change once the user has tried to submit.
  function handleEmailChange(value: string) {
    setEmail(value);
    if (submitted) {
      const err = validateEmail(value);
      setFieldErrors((prev) => ({ ...prev, email: err }));
    }
  }
  function handlePasswordChange(value: string) {
    setPassword(value);
    if (submitted) {
      const err = validatePassword(value);
      setFieldErrors((prev) => ({ ...prev, password: err }));
    }
  }

  function handleEmailBlur() {
    if (!submitted) return;
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  }
  function handlePasswordBlur() {
    if (!submitted) return;
    setFieldErrors((prev) => ({
      ...prev,
      password: validatePassword(password),
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setFieldErrors({ email: emailErr, password: passwordErr });

    if (emailErr || passwordErr) {
      // Move focus to the first invalid field.
      if (emailErr) emailRef.current?.focus();
      else if (passwordErr) passwordRef.current?.focus();
      return;
    }

    // Clear any prior form-level error before a new attempt.
    setFormError(null);
    setSubmitting(true);

    const normalisedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalisedEmail, password }),
      });

      // 200 happy path
      if (res.ok) {
        let json: {
          success?: boolean;
          data?: {
            token?: string;
            user?: { id: string; email: string; name: string | null };
          };
        };
        try {
          json = await res.json();
        } catch {
          setFormError(ERR_GENERIC);
          return;
        }
        if (!json?.success || !json?.data?.token || !json?.data?.user) {
          setFormError(ERR_GENERIC);
          return;
        }
        try {
          window.localStorage.setItem("token", json.data.token);
          window.localStorage.setItem("user", JSON.stringify(json.data.user));
        } catch {
          // localStorage unavailable — surface generic error.
          setFormError(ERR_GENERIC);
          return;
        }
        router.replace("/dashboard");
        return;
      }

      // 401 — invalid credentials
      if (res.status === 401) {
        setFormError(ERR_INVALID_CREDENTIALS);
        // Re-focus the password field per TECH_SPEC §2.5.
        requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }

      // 422 — server-side validation. Surface a generic error so the form
      // doesn't go silent (client-side rules already prevent this in practice).
      if (res.status === 422) {
        try {
          const json = (await res.json()) as {
            errors?: { field: string; message: string }[];
          };
          if (json?.errors?.length) {
            const next: FieldErrors = {};
            for (const item of json.errors) {
              if (item.field === "email" && !next.email) next.email = item.message;
              if (item.field === "password" && !next.password)
                next.password = item.message;
            }
            setFieldErrors((prev) => ({ ...prev, ...next }));
            return;
          }
        } catch {
          // fall through
        }
        setFormError(ERR_GENERIC);
        return;
      }

      // 400 / 5xx / anything else → generic error.
      setFormError(ERR_GENERIC);
    } catch {
      // Network failure / fetch rejection.
      setFormError(ERR_GENERIC);
    } finally {
      setSubmitting(false);
    }
  }

  const emailInvalid = Boolean(fieldErrors.email);
  const passwordInvalid = Boolean(fieldErrors.password);

  return (
    <main className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] rounded-xl border border-[#e2e8f0] bg-white px-8 py-8 shadow-sm">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-semibold leading-tight text-[#0f172a]">
            Sign in to Admin Panel
          </h1>
          <p className="mt-2 text-[14px] font-normal text-[#64748b]">
            Use your admin credentials.
          </p>
        </div>

        {/* Form-level error banner */}
        {formError && (
          <div
            id={formErrId}
            role="alert"
            aria-live="polite"
            className="mb-4 flex items-start gap-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5"
          >
            <span
              aria-hidden="true"
              className="mt-1 block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#dc2626]"
            />
            <span className="text-[13px] font-medium leading-5 text-[#991b1b]">
              {formError}
            </span>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col">
            <label
              htmlFor="email"
              className="mb-1.5 text-[13px] font-medium text-[#334155]"
            >
              Email
            </label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              aria-required="true"
              aria-invalid={emailInvalid || undefined}
              aria-describedby={emailInvalid ? emailErrId : undefined}
              className={`h-[42px] w-full rounded-lg border bg-white px-3 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:ring-2 focus:ring-[#0f172a] focus:ring-offset-0 ${
                emailInvalid ? "border-[#dc2626]" : "border-[#cbd5e1]"
              }`}
            />
            {emailInvalid && (
              <p
                id={emailErrId}
                className="mt-1.5 text-[12px] font-medium text-[#b91c1c]"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col">
            <label
              htmlFor="password"
              className="mb-1.5 text-[13px] font-medium text-[#334155]"
            >
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={handlePasswordBlur}
                aria-required="true"
                aria-invalid={passwordInvalid || undefined}
                aria-describedby={
                  passwordInvalid ? passwordErrId : undefined
                }
                className={`h-[42px] w-full rounded-lg border bg-white pl-3 pr-12 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:ring-2 focus:ring-[#0f172a] focus:ring-offset-0 ${
                  passwordInvalid ? "border-[#dc2626]" : "border-[#cbd5e1]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-medium text-[#334155] hover:bg-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {passwordInvalid && (
              <p
                id={passwordErrId}
                className="mt-1.5 text-[12px] font-medium text-[#b91c1c]"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0f172a] ${
              submitting
                ? "cursor-not-allowed bg-[#64748b]"
                : "bg-[#0f172a] hover:bg-[#1e293b]"
            }`}
          >
            {submitting && (
              <svg
                aria-hidden="true"
                className="h-4 w-4 animate-spin text-white"
                viewBox="0 0 24 24"
                fill="none"
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
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                />
              </svg>
            )}
            <span>{submitting ? "Signing in…" : "Sign in"}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
