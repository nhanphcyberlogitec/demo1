"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { name?: string; email?: string };

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

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch {
    return iso;
  }
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [authReady, setAuthReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");
    if (!token || !raw) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(raw) as { id: string };
      setCurrentUserId(u.id);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady || !id) return;
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      const { status, body } = await apiFetch<User>(`/api/accounts/${id}`);
      if (!active) return;
      if (status === 200 && body.success && body.data) {
        const u = body.data as User;
        setUser(u);
        setName(u.name);
        setEmail(u.email);
      } else if (status === 404) {
        setNotFound(true);
      } else if (status !== 401) {
        setLoadError(body.message || "Failed to load account.");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authReady, id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const dirty = useMemo(() => {
    if (!user) return false;
    return name.trim() !== user.name || email.trim() !== user.email;
  }, [user, name, email]);

  const handleCancel = () => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setErrors({});
    setFormError(null);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    setErrors({ name: nameErr, email: emailErr });
    if (nameErr || emailErr) return;

    const patch: Record<string, string> = {};
    if (name.trim() !== user.name) patch.name = name.trim();
    if (email.trim() !== user.email) patch.email = email.trim();
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    const { status, body } = await apiFetch<User>(`/api/accounts/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setSaving(false);

    if (status === 200 && body.success && body.data) {
      const updated = body.data as User;
      setUser(updated);
      setName(updated.name);
      setEmail(updated.email);
      setErrors({});
      setToast(body.message || "Changes saved");
      return;
    }

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
        });
        return;
      }
      setFormError(body.message || "Validation failed");
      return;
    }

    if (status === 404) {
      setNotFound(true);
      return;
    }

    if (status !== 401) {
      setFormError(body.message || "Failed to save changes.");
    }
  };

  const doToggleStatus = async () => {
    if (!user) return;
    setTogglingStatus(true);
    const { status, body } = await apiFetch<User>(
      `/api/accounts/${user.id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      }
    );
    setTogglingStatus(false);
    setConfirmOpen(false);

    if (status === 200 && body.success && body.data) {
      const updated = body.data as User;
      setUser(updated);
      setToast(body.message || "Status updated");
      return;
    }

    if (status === 403) {
      setFormError(body.message || "You cannot deactivate your own account.");
      return;
    }

    if (status === 404) {
      setNotFound(true);
      return;
    }

    if (status !== 401) {
      setFormError(body.message || "Failed to update status.");
    }
  };

  if (!authReady || loading) {
    return <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />;
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col bg-[#f9fafb]">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-8 text-center">
            <h2 className="text-xl font-bold text-[#111827]">Account not found</h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              This account may have been removed.
            </p>
            <Link
              href="/accounts"
              className="mt-4 inline-flex rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8]"
            >
              Back to accounts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="flex flex-1 flex-col bg-[#f9fafb]">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-xl border border-[#fecaca] bg-[#fef2f2] p-6 text-[#b91c1c]">
            <p className="text-sm">{loadError || "Failed to load account."}</p>
          </div>
        </main>
      </div>
    );
  }

  const isSelf = user.id === currentUserId;
  const willDeactivate = user.is_active;
  const disableDeactivate = isSelf && user.is_active;
  const nameInvalid = !!errors.name;
  const emailInvalid = !!errors.email;

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
        <div className="w-full max-w-3xl">
          <Link
            href="/accounts"
            className="mb-4 inline-flex items-center text-sm text-[#6b7280] hover:text-[#111827]"
          >
            ← Back to accounts
          </Link>

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-2 text-sm text-[#166534]"
            >
              {toast}
            </div>
          )}

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#111827]">{user.name}</h2>
                {user.is_active ? (
                  <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-medium text-[#166534]">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#6b7280]">
                    Inactive
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={disableDeactivate || togglingStatus}
                onClick={() => setConfirmOpen(true)}
                title={
                  disableDeactivate
                    ? "You cannot deactivate your own account."
                    : undefined
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  user.is_active
                    ? "border border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]"
                    : "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                }`}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>

            <dl className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#6b7280]">ID</dt>
                <dd className="mt-1 break-all font-mono text-[#374151]">{user.id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#6b7280]">Created</dt>
                <dd className="mt-1 text-[#374151]">{formatTimestamp(user.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#6b7280]">Updated</dt>
                <dd className="mt-1 text-[#374151]">{formatTimestamp(user.updated_at)}</dd>
              </div>
            </dl>

            <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
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
                  disabled={saving}
                  aria-invalid={nameInvalid ? "true" : "false"}
                  aria-describedby={nameInvalid ? "name-error" : undefined}
                  className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] ${
                    nameInvalid
                      ? "border-[#dc2626] focus:border-[#dc2626]"
                      : "border-[#d1d5db] focus:border-[#2563eb]"
                  }`}
                />
                {nameInvalid && (
                  <p id="name-error" className="text-sm text-[#dc2626]">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#374151]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((p) => ({ ...p, email: validateEmail(e.target.value) }));
                    }
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
                  disabled={saving}
                  aria-invalid={emailInvalid ? "true" : "false"}
                  aria-describedby={emailInvalid ? "email-error" : undefined}
                  className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[#2563eb]/40 disabled:bg-[#f3f4f6] ${
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={!dirty || saving}
                  className="rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6">
            <h3 id="confirm-title" className="text-lg font-bold text-[#111827]">
              {willDeactivate ? "Deactivate account?" : "Activate account?"}
            </h3>
            <p className="mt-2 text-sm text-[#6b7280]">
              User <span className="font-medium text-[#111827]">{user.name}</span> (
              {user.email}){" "}
              {willDeactivate
                ? "will no longer be able to sign in."
                : "will be able to sign in again."}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={togglingStatus}
                className="rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doToggleStatus}
                disabled={togglingStatus}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 ${
                  willDeactivate
                    ? "bg-[#dc2626] hover:bg-[#b91c1c]"
                    : "bg-[#2563eb] hover:bg-[#1d4ed8]"
                }`}
              >
                {togglingStatus
                  ? "…"
                  : willDeactivate
                  ? "Confirm deactivation"
                  : "Confirm activation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
