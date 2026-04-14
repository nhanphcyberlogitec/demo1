"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_LETTER = /[A-Za-z]/;
const PASSWORD_DIGIT = /[0-9]/;

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
};

function validateName(v: string): string | undefined {
  if (!v.trim()) return "Name is required.";
  if (v.trim().length > 100) return "Name is too long.";
  return undefined;
}
function validateEmail(v: string): string | undefined {
  if (!v.trim()) return "Email is required.";
  if (!EMAIL_PATTERN.test(v.trim())) return "Enter a valid email address.";
  if (v.trim().length > 255) return "Email is too long.";
  return undefined;
}
function validatePassword(v: string): string | undefined {
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (v.length > 128) return "Password is too long.";
  if (!PASSWORD_LETTER.test(v) || !PASSWORD_DIGIT.test(v))
    return "Password must include at least one letter and one digit.";
  return undefined;
}

export default function NewAccountPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isActive, setIsActive] = useState<"active" | "inactive">("active");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

  if (!authReady) {
    return <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />;
  }

  const validateConfirm = (): string | undefined => {
    if (!confirm) return "Please confirm the password.";
    if (confirm !== password) return "Passwords do not match.";
    return undefined;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const next: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirm(),
    };
    setErrors(next);
    if (next.name || next.email || next.password || next.confirm) return;

    setSubmitting(true);
    const { status, body } = await apiFetch<{ id: string }>(`/api/accounts`, {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        is_active: isActive === "active",
      }),
    });

    if (status === 201 && body.success) {
      sessionStorage.setItem("accounts:flash", body.message || "Account created");
      router.replace("/accounts");
      return;
    }

    setSubmitting(false);

    if (status === 409) {
      setErrors((prev) => ({
        ...prev,
        email: body.message || "An account with this email already exists.",
      }));
      return;
    }

    if (status === 422) {
      const data = body.data as { errors?: Record<string, string> } | null;
      if (data?.errors) {
        setErrors({
          name: data.errors.name,
          email: data.errors.email,
          password: data.errors.password,
        });
        return;
      }
      setFormError(body.message || "Validation failed.");
      return;
    }

    if (status !== 401) {
      setFormError(body.message || "Failed to create account.");
    }
  };

  const fieldClass = (invalid: boolean) =>
    `h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] ${
      invalid
        ? "border-[#dc2626] focus:border-[#dc2626]"
        : "border-[#d1d5db] focus:border-[#2563eb]"
    }`;

  return (
    <div className="flex flex-1 flex-col bg-[#f9fafb]">
      <header className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-[#111827]">Admin Panel</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-[#6b7280] hover:text-[#111827]">
              Dashboard
            </Link>
            <Link href="/accounts" className="font-medium text-[#2563eb]">
              Accounts
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <Link
            href="/accounts"
            className="mb-4 inline-flex items-center text-sm text-[#6b7280] hover:text-[#111827]"
          >
            ← Back to accounts
          </Link>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-6">
            <h2 className="mb-6 text-2xl font-bold text-[#111827]">New account</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]"
                >
                  {formError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-[#374151]">
                  Name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((p) => ({ ...p, name: validateName(e.target.value) }));
                    }
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, name: validateName(name) }))}
                  disabled={submitting}
                  className={fieldClass(!!errors.name)}
                />
                {errors.name && <p className="text-sm text-[#dc2626]">{errors.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#374151]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((p) => ({ ...p, email: validateEmail(e.target.value) }));
                    }
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
                  disabled={submitting}
                  className={fieldClass(!!errors.email)}
                />
                {errors.email && <p className="text-sm text-[#dc2626]">{errors.email}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-[#374151]">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((p) => ({
                        ...p,
                        password: validatePassword(e.target.value),
                      }));
                    }
                  }}
                  onBlur={() =>
                    setErrors((p) => ({ ...p, password: validatePassword(password) }))
                  }
                  disabled={submitting}
                  className={fieldClass(!!errors.password)}
                />
                {errors.password ? (
                  <p className="text-sm text-[#dc2626]">{errors.password}</p>
                ) : (
                  <p className="text-xs text-[#6b7280]">
                    At least 8 characters, with a letter and a digit.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-[#374151]">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (errors.confirm) {
                      setErrors((p) => ({
                        ...p,
                        confirm:
                          !e.target.value
                            ? "Please confirm the password."
                            : e.target.value !== password
                            ? "Passwords do not match."
                            : undefined,
                      }));
                    }
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, confirm: validateConfirm() }))}
                  disabled={submitting}
                  className={fieldClass(!!errors.confirm)}
                />
                {errors.confirm && (
                  <p className="text-sm text-[#dc2626]">{errors.confirm}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="status" className="text-sm font-medium text-[#374151]">
                  Status
                </label>
                <select
                  id="status"
                  value={isActive}
                  onChange={(e) => setIsActive(e.target.value as "active" | "inactive")}
                  disabled={submitting}
                  className="h-11 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href="/accounts"
                  className="rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
