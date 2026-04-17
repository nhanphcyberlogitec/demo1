"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_URL = "http://localhost:8000/api/auth/register";

type FieldKey = "name" | "email" | "password" | "confirm_password";
type FieldErrors = Partial<Record<FieldKey, string>>;
type Touched = Record<FieldKey, boolean>;

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length > 100) return "Name must be 1–100 characters.";
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Please enter a valid email address.";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (value.length < 8 || value.length > 128)
    return "Password must be between 8 and 128 characters.";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
    return "Password must include at least one letter and one number.";
  return undefined;
}

function validateConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return "Please confirm your password.";
  if (confirm !== password) return "Passwords do not match.";
  return undefined;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({
    name: false,
    email: false,
    password: false,
    confirm_password: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showDuplicateLink, setShowDuplicateLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const focusTargetRef = useRef<FieldKey | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      router.replace("/dashboard");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (!submitting && focusTargetRef.current) {
      const target = focusTargetRef.current;
      focusTargetRef.current = null;
      const id = requestAnimationFrame(() => {
        const refMap: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
          name: nameRef,
          email: emailRef,
          password: passwordRef,
          confirm_password: confirmRef,
        };
        refMap[target].current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [submitting, formError, errors]);

  if (checkingAuth) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />
    );
  }

  const firstInvalidField = (fe: FieldErrors): FieldKey | null => {
    const order: FieldKey[] = ["name", "email", "password", "confirm_password"];
    for (const key of order) if (fe[key]) return key;
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setShowDuplicateLink(false);

    const clientErrors: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm_password: validateConfirm(password, confirmPassword),
    };

    setErrors(clientErrors);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirm_password: true,
    });

    const firstBad = firstInvalidField(clientErrors);
    if (firstBad) {
      focusTargetRef.current = firstBad;
      // trigger focus effect even though submitting never flipped
      setSubmitting(false);
      requestAnimationFrame(() => {
        const refMap: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
          name: nameRef,
          email: emailRef,
          password: passwordRef,
          confirm_password: confirmRef,
        };
        refMap[firstBad].current?.focus();
      });
      focusTargetRef.current = null;
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });

      let payload: {
        success?: boolean;
        data?:
          | { token: string; user: { id: string; email: string } }
          | { errors?: Partial<Record<FieldKey, string>> }
          | null;
        message?: string;
      } = {};
      try {
        payload = await response.json();
      } catch {
        // fall through
      }

      if (
        response.ok &&
        payload.success &&
        payload.data &&
        "token" in payload.data
      ) {
        localStorage.setItem("token", payload.data.token);
        localStorage.setItem("user", JSON.stringify(payload.data.user));
        router.replace("/dashboard");
        return;
      }

      if (response.status === 422) {
        const serverErrors =
          (payload.data &&
            "errors" in payload.data &&
            payload.data.errors) ||
          {};
        const nextErrors: FieldErrors = { ...serverErrors };
        setErrors(nextErrors);
        setTouched({
          name: true,
          email: true,
          password: true,
          confirm_password: true,
        });
        const firstServerBad = firstInvalidField(nextErrors);
        focusTargetRef.current = firstServerBad ?? "password";
      } else if (response.status === 409) {
        setFormError(
          payload.message || "An account with this email already exists"
        );
        setShowDuplicateLink(true);
        focusTargetRef.current = "password";
      } else {
        setFormError("Something went wrong. Please try again.");
        focusTargetRef.current = "password";
      }

      setPassword("");
      setConfirmPassword("");
    } catch {
      setFormError("Something went wrong. Please try again.");
      setPassword("");
      setConfirmPassword("");
      focusTargetRef.current = "password";
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = (invalid: boolean) =>
    `h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] disabled:text-[#6b7280] ${
      invalid
        ? "border-[#dc2626] focus:border-[#dc2626]"
        : "border-[#d1d5db] focus:border-[#2563eb]"
    }`;

  const nameInvalid = touched.name && !!errors.name;
  const emailInvalid = touched.email && !!errors.email;
  const passwordInvalid = touched.password && !!errors.password;
  const confirmInvalid = touched.confirm_password && !!errors.confirm_password;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#f9fafb] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-10">
        <form
          className="flex flex-col gap-6"
          onSubmit={handleSubmit}
          noValidate
        >
          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex flex-col gap-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]"
            >
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-[1px]">
                  ⚠
                </span>
                <span>{formError}</span>
              </div>
              {showDuplicateLink && (
                <Link
                  href="/login"
                  className="ml-6 font-medium underline hover:text-[#991b1b]"
                >
                  Sign in instead
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-[#374151]"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (touched.name) {
                  setErrors((prev) => ({
                    ...prev,
                    name: validateName(e.target.value),
                  }));
                }
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, name: true }));
                setErrors((e) => ({ ...e, name: validateName(name) }));
              }}
              disabled={submitting}
              aria-invalid={nameInvalid ? "true" : "false"}
              aria-describedby={nameInvalid ? "name-error" : undefined}
              ref={nameRef}
              className={inputClasses(nameInvalid)}
            />
            {nameInvalid && (
              <p id="name-error" className="text-sm text-[#dc2626]">
                {errors.name}
              </p>
            )}
          </div>

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
              autoComplete="email"
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
              onBlur={() => {
                setTouched((t) => ({ ...t, email: true }));
                setErrors((e) => ({ ...e, email: validateEmail(email) }));
              }}
              disabled={submitting}
              aria-invalid={emailInvalid ? "true" : "false"}
              aria-describedby={emailInvalid ? "email-error" : undefined}
              ref={emailRef}
              className={inputClasses(emailInvalid)}
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
              autoComplete="new-password"
              placeholder="At least 8 chars, 1 letter, 1 digit"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setErrors((prev) => ({
                    ...prev,
                    password: validatePassword(e.target.value),
                  }));
                }
                if (touched.confirm_password) {
                  setErrors((prev) => ({
                    ...prev,
                    confirm_password: validateConfirm(
                      e.target.value,
                      confirmPassword
                    ),
                  }));
                }
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, password: true }));
                setErrors((e) => ({
                  ...e,
                  password: validatePassword(password),
                }));
              }}
              disabled={submitting}
              aria-invalid={passwordInvalid ? "true" : "false"}
              aria-describedby={
                passwordInvalid ? "password-error" : undefined
              }
              ref={passwordRef}
              className={inputClasses(passwordInvalid)}
            />
            {passwordInvalid && (
              <p id="password-error" className="text-sm text-[#dc2626]">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm_password"
              className="text-sm font-medium text-[#374151]"
            >
              Confirm password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (touched.confirm_password) {
                  setErrors((prev) => ({
                    ...prev,
                    confirm_password: validateConfirm(password, e.target.value),
                  }));
                }
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, confirm_password: true }));
                setErrors((e) => ({
                  ...e,
                  confirm_password: validateConfirm(password, confirmPassword),
                }));
              }}
              disabled={submitting}
              aria-invalid={confirmInvalid ? "true" : "false"}
              aria-describedby={
                confirmInvalid ? "confirm-password-error" : undefined
              }
              ref={confirmRef}
              className={inputClasses(confirmInvalid)}
            />
            {confirmInvalid && (
              <p
                id="confirm-password-error"
                className="text-sm text-[#dc2626]"
              >
                {errors.confirm_password}
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
            <span>{submitting ? "Creating account…" : "Create account"}</span>
          </button>
        </form>
      </div>

      <p className="text-sm text-[#374151]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#2563eb] hover:text-[#1d4ed8]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
