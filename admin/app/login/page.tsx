"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000/api/auth/login";

// RFC-lite email regex (matches TECH_SPEC §5.1 and BACKEND_API §4.1).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

type FormState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error-credentials" }
  | { kind: "error-network" };

type FieldErrors = {
  email?: string;
  password?: string;
};

function validateEmail(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return "Email is required.";
  if (trimmed.length > EMAIL_MAX) return "Email is too long.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
  return undefined;
}

function validatePassword(raw: string): string | undefined {
  if (!raw) return "Password is required.";
  if (raw.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (raw.length > PASSWORD_MAX) return "Password is too long.";
  return undefined;
}

export default function LoginPage() {
  const router = useRouter();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formState, setFormState] = useState<FormState>({ kind: "idle" });
  // Until the auth-check effect resolves we suppress render to avoid flashing
  // the form for a signed-in user visiting /login (TECH_SPEC §2.2).
  const [checkingSession, setCheckingSession] = useState(true);

  // Already-signed-in guard: redirect to /dashboard if a session exists.
  useEffect(() => {
    let token: string | null = null;
    let user: string | null = null;
    try {
      token = localStorage.getItem("token");
      user = localStorage.getItem("user");
    } catch {
      // localStorage can throw (Safari private mode etc.) — fall through
      // and show the form.
    }
    if (token && user) {
      router.replace("/dashboard");
      return;
    }
    // Defer the state update out of the effect body to satisfy
    // react-hooks/set-state-in-effect; this still resolves on the next frame.
    const handle = requestAnimationFrame(() => {
      setCheckingSession(false);
      emailRef.current?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [router]);

  const pending = formState.kind === "pending";

  function clearBanner() {
    if (
      formState.kind === "error-credentials" ||
      formState.kind === "error-network"
    ) {
      setFormState({ kind: "idle" });
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    // Client-side validation — block network call on failure (TECH_SPEC §5.3).
    const nextErrors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    // Drop undefined entries so the UI doesn't render empty messages.
    const hasErrors = !!(nextErrors.email || nextErrors.password);
    setFieldErrors({
      email: nextErrors.email,
      password: nextErrors.password,
    });

    if (hasErrors) {
      // Move focus to the first invalid field (a11y — TECH_SPEC §3.3).
      if (nextErrors.email) {
        emailRef.current?.focus();
      } else if (nextErrors.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    setFormState({ kind: "pending" });

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
    } catch {
      // Network-level failure — fetch rejection, CORS, offline, etc.
      setFormState({ kind: "error-network" });
      setPassword("");
      return;
    }

    let body: {
      success?: boolean;
      data?: {
        token?: string;
        user?: { id: string; email: string };
        errors?: FieldErrors;
      } | null;
      message?: string;
    } | null = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.ok && body?.success && body.data?.token && body.data.user) {
      try {
        localStorage.setItem("token", body.data.token);
        localStorage.setItem("user", JSON.stringify(body.data.user));
      } catch {
        // Unable to persist — treat as network-style failure.
        setFormState({ kind: "error-network" });
        setPassword("");
        return;
      }
      router.replace("/dashboard");
      return;
    }

    if (response.status === 401) {
      setFormState({ kind: "error-credentials" });
      setPassword("");
      setFieldErrors({});
      // Focus returns to email (TECH_SPEC §3.2).
      requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }

    if (response.status === 422 && body?.data?.errors) {
      // Render per-field errors from server.
      setFieldErrors({
        email: body.data.errors.email,
        password: body.data.errors.password,
      });
      setFormState({ kind: "idle" });
      return;
    }

    // Any other status or malformed envelope → generic network banner.
    setFormState({ kind: "error-network" });
    setPassword("");
  }

  if (checkingSession) {
    // Render nothing while we decide whether to redirect. Matches TECH_SPEC
    // §3.5 / §3.6 "no protected content flash" guidance for /login.
    return <main aria-busy="true" className="min-h-dvh bg-slate-50" />;
  }

  const banner =
    formState.kind === "error-credentials"
      ? "Invalid email or password."
      : formState.kind === "error-network"
      ? "We couldn't reach the server. Please try again."
      : null;

  return (
    <main className="min-h-dvh bg-slate-50 flex items-center justify-center px-4 py-12">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white shadow-sm p-8"
      >
        <h1
          id="login-heading"
          className="sr-only"
        >
          Admin Panel
        </h1>
        <h2
          id="login-subheading"
          className="text-2xl font-bold text-slate-900 tracking-tight"
        >
          Sign in to Admin Panel
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Use your admin credentials.
        </p>

        {/*
          Live region stays mounted so assistive tech picks up changes without
          reattaching the node. The banner icon uses aria-hidden="true" to
          keep the cue non-color (TECH_SPEC §8.2).
        */}
        <div
          role="alert"
          aria-live="polite"
          className="mt-6 min-h-0"
        >
          {banner && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-600"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-3 w-3"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 6.5v4M10 13.5h.01"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="font-medium">{banner}</span>
            </div>
          )}
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className={banner ? "mt-4 space-y-5" : "mt-6 space-y-5"}
        >
          <Field
            id="email"
            label="Email"
            error={fieldErrors.email}
          >
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              disabled={pending}
              aria-invalid={fieldErrors.email ? "true" : undefined}
              aria-describedby={
                fieldErrors.email ? "email-error" : undefined
              }
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email)
                  setFieldErrors((f) => ({ ...f, email: undefined }));
                clearBanner();
              }}
              placeholder="admin@example.com"
              className={inputClasses(!!fieldErrors.email)}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={fieldErrors.password}
          >
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
              aria-invalid={fieldErrors.password ? "true" : undefined}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password)
                  setFieldErrors((f) => ({ ...f, password: undefined }));
                clearBanner();
              }}
              className={inputClasses(!!fieldErrors.password)}
            />
          </Field>

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending ? "true" : undefined}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-80"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-slate-900"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4 flex-none text-red-600"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M9.401 2.57a.75.75 0 011.198 0l7.5 11.25A.75.75 0 0117.5 15h-15a.75.75 0 01-.599-1.18l7.5-11.25zM10 7.25a.75.75 0 00-.75.75v3a.75.75 0 001.5 0V8A.75.75 0 0010 7.25zm0 5.5a.875.875 0 100 1.75.875.875 0 000-1.75z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function inputClasses(hasError: boolean): string {
  const base =
    "block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const ring = hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
    : "border-slate-300 focus:border-slate-900 focus:ring-slate-900/20";
  return `${base} ${ring}`;
}
