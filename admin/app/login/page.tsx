"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

const STRINGS = {
  heading: "Admin Panel",
  subheading: "Sign in to continue.",
  emailLabel: "Email",
  emailPlaceholder: "you@company.com",
  passwordLabel: "Password",
  passwordPlaceholder: "••••••••",
  submit: "Sign in",
  submitting: "Signing in…",
  errors: {
    emailRequired: "Email is required.",
    emailInvalid: "Enter a valid email address.",
    passwordRequired: "Password is required.",
    passwordTooShort: "Password must be at least 6 characters.",
    invalidCredentials: "Invalid email or password.",
    invalidRequest: "Something went wrong. Please check your input.",
    serverError: "Something went wrong. Please try again.",
    network: "We couldn't reach the server. Please try again.",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return STRINGS.errors.emailRequired;
  if (!EMAIL_REGEX.test(trimmed)) return STRINGS.errors.emailInvalid;
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return STRINGS.errors.passwordRequired;
  if (value.length < 6) return STRINGS.errors.passwordTooShort;
  return null;
}

function tokenIsValid(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

type FieldErrors = { email?: string | null; password?: string | null };
type LoginEnvelope = {
  success: boolean;
  data: { token: string; user: { id: string; email: string; full_name: string | null } } | null;
  message: string;
};

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (tokenIsValid(token)) {
      router.replace("/dashboard");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  function runFieldValidation(field: "email" | "password", value: string) {
    const msg =
      field === "email" ? validateEmail(value) : validatePassword(value);
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
    return msg;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const emailMsg = validateEmail(email);
    const passwordMsg = validatePassword(password);
    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailMsg, password: passwordMsg });
    setFormError(null);

    if (emailMsg || passwordMsg) {
      if (emailMsg) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      setPassword("");
      setFormError(STRINGS.errors.network);
      setSubmitting(false);
      return;
    }

    let body: LoginEnvelope;
    try {
      body = (await res.json()) as LoginEnvelope;
    } catch {
      setPassword("");
      setFormError(STRINGS.errors.network);
      setSubmitting(false);
      return;
    }

    if (res.ok && body.success && body.data) {
      localStorage.setItem("token", body.data.token);
      localStorage.setItem("user", JSON.stringify(body.data.user));
      router.replace("/dashboard");
      return;
    }

    if (res.status === 401) {
      setPassword("");
      setFormError(body.message || STRINGS.errors.invalidCredentials);
      emailRef.current?.focus();
    } else if (res.status === 422) {
      setFormError(STRINGS.errors.invalidRequest);
    } else {
      setFormError(body.message || STRINGS.errors.serverError);
    }
    setSubmitting(false);
  }

  if (!authChecked) return null;

  const emailError = touched.email ? fieldErrors.email : null;
  const passwordError = touched.password ? fieldErrors.password : null;

  const inputBase =
    "w-full h-11 px-3 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10";
  const inputNormal = "bg-white border border-gray-300 focus:border-gray-900";
  const inputErrorCls = "bg-white border border-red-600 focus:border-red-600";
  const inputDisabledCls =
    "bg-gray-100 border border-gray-300 cursor-not-allowed";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-6">
      <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-xl p-8 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)]">
        <h1 className="text-[28px] font-semibold text-gray-900 leading-tight">
          {STRINGS.heading}
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">{STRINGS.subheading}</p>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-gray-700"
            >
              {STRINGS.emailLabel}
            </label>
            <input
              id="email"
              ref={emailRef}
              type="email"
              autoComplete="email"
              autoFocus
              disabled={submitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) runFieldValidation("email", e.target.value);
              }}
              onBlur={(e) => {
                setTouched((t) => ({ ...t, email: true }));
                runFieldValidation("email", e.target.value);
              }}
              placeholder={STRINGS.emailPlaceholder}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className={[
                inputBase,
                submitting
                  ? inputDisabledCls
                  : emailError
                    ? inputErrorCls
                    : inputNormal,
              ].join(" ")}
            />
            {emailError && (
              <p
                id="email-error"
                className="text-[12px] font-medium text-red-600 flex items-center gap-1"
              >
                <span aria-hidden="true">⚠</span>
                <span>{emailError}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-gray-700"
            >
              {STRINGS.passwordLabel}
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              disabled={submitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password)
                  runFieldValidation("password", e.target.value);
              }}
              onBlur={(e) => {
                setTouched((t) => ({ ...t, password: true }));
                runFieldValidation("password", e.target.value);
              }}
              placeholder={STRINGS.passwordPlaceholder}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={[
                inputBase,
                submitting
                  ? inputDisabledCls
                  : passwordError
                    ? inputErrorCls
                    : inputNormal,
              ].join(" ")}
            />
            {passwordError && (
              <p
                id="password-error"
                className="text-[12px] font-medium text-red-600 flex items-center gap-1"
              >
                <span aria-hidden="true">⚠</span>
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          <div role="alert" aria-live="polite">
            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[13px] font-medium text-red-700 flex items-center gap-1.5">
                <span aria-hidden="true">⚠</span>
                <span>{formError}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={[
              "w-full h-11 rounded-lg text-[15px] font-semibold text-white transition-colors",
              submitting
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-gray-900 hover:bg-gray-800",
            ].join(" ")}
          >
            {submitting ? STRINGS.submitting : STRINGS.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
