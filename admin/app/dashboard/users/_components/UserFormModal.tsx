"use client";

// Create / Edit user modal (TECH_SPEC §3.3, §3.4). The two flows share most
// of their UI so they live in a single component, switched by `mode`.

import { useState, type FormEvent } from "react";
import { Modal } from "../../_components/Modal";
import {
  ApiError,
  createUser,
  updateUser,
  type UserDTO,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Mode = "create" | "edit";

type FormErrors = Partial<{
  email: string;
  name: string;
  role: string;
  password: string;
  confirm: string;
}>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const NAME_MAX = 100;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function clientValidate(input: {
  mode: Mode;
  email: string;
  name: string;
  role: "admin" | "user";
  passwordOpen: boolean;
  password: string;
  confirm: string;
}): FormErrors {
  const errs: FormErrors = {};
  const email = input.email.trim();
  if (!email) errs.email = "Email is required";
  else if (email.length > EMAIL_MAX) errs.email = "Email is too long";
  else if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address";

  const name = input.name.trim();
  if (!name) errs.name = "Name is required";
  else if (name.length > NAME_MAX) errs.name = "Name is too long";

  if (input.role !== "admin" && input.role !== "user") {
    errs.role = "Invalid role";
  }

  // Password handling differs by mode (TECH_SPEC §6.4):
  // - create: required.
  // - edit: only required when the "Reset password" section is open.
  const requirePassword = input.mode === "create" || input.passwordOpen;
  if (requirePassword) {
    if (!input.password) errs.password = "Password is required";
    else if (input.password.length < PASSWORD_MIN)
      errs.password = "Password must be at least 8 characters";
    else if (input.password.length > PASSWORD_MAX)
      errs.password = "Password is too long";

    if (!input.confirm) errs.confirm = "Please confirm the password";
    else if (input.password !== input.confirm)
      errs.confirm = "Passwords do not match";
  }

  return errs;
}

export function UserFormModal({
  open,
  mode,
  initialUser,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initialUser?: UserDTO | null;
  onClose: () => void;
  onSaved: (user: UserDTO) => void;
}) {
  const { user: signedInUser, guard } = useAuth();

  // The parent remounts this component (via a `key` tied to the open state /
  // selected row) so we can derive the initial form state from props in the
  // useState initialiser instead of synchronising via useEffect.
  const [email, setEmail] = useState(() =>
    mode === "edit" && initialUser ? initialUser.email : ""
  );
  const [name, setName] = useState(() =>
    mode === "edit" && initialUser ? initialUser.name : ""
  );
  const [role, setRole] = useState<"admin" | "user">(() =>
    mode === "edit" && initialUser ? initialUser.role : "user"
  );
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSelf =
    mode === "edit" && initialUser && initialUser.id === signedInUser.id;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const clientErrs = clientValidate({
      mode,
      email,
      name,
      role,
      passwordOpen,
      password,
      confirm,
    });
    if (Object.keys(clientErrs).length > 0) {
      setErrors(clientErrs);
      setBanner(null);
      return;
    }
    setErrors({});
    setBanner(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        const created = await guard(
          createUser({
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role,
            password,
          })
        );
        onSaved(created);
      } else if (initialUser) {
        // Build a minimal patch — only changed fields plus the optional
        // password reset.
        const patch: Record<string, string> = {};
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();
        if (trimmedEmail !== initialUser.email) patch.email = trimmedEmail;
        if (trimmedName !== initialUser.name) patch.name = trimmedName;
        if (role !== initialUser.role) patch.role = role;
        if (passwordOpen && password) patch.password = password;

        if (Object.keys(patch).length === 0) {
          // Nothing changed and Reset password wasn't opened — close.
          onClose();
          return;
        }

        const updated = await guard(updateUser(initialUser.id, patch));
        onSaved(updated);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 is already handled by `guard` — caller will be redirected.
        if (err.status === 401) return;
        if (err.status === 422 || err.status === 409) {
          // Map server field errors onto the form (BACKEND_API §1.4).
          const next: FormErrors = {};
          for (const k of Object.keys(err.fieldErrors)) {
            const v = err.fieldErrors[k];
            if (k === "email") next.email = v;
            else if (k === "name") next.name = v;
            else if (k === "role") next.role = v;
            else if (k === "password") next.password = v;
          }
          setErrors(next);
          // Last-admin demote returns role error + a top-level message —
          // surface it as a banner too (TECH_SPEC §3.4 / AC-14).
          if (next.role === "Cannot remove the last administrator") {
            setBanner(err.serverMessage || next.role);
          } else if (Object.keys(next).length === 0 && err.serverMessage) {
            // No field-specific error mapped → fall back to a banner.
            setBanner(err.serverMessage);
          } else {
            setBanner(null);
          }
        } else {
          // 5xx, network, or anything else.
          setBanner("Something went wrong. Please try again.");
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "New user" : "Edit user";
  const submitLabel = submitting
    ? mode === "create"
      ? "Creating…"
      : "Saving…"
    : mode === "create"
    ? "Create user"
    : "Save changes";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {banner && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {banner}
          </div>
        )}

        <Field id="user-email" label="Email" error={errors.email}>
          <input
            id="user-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            disabled={submitting}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "user-email-error" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="user@example.com"
            className={inputClasses(!!errors.email)}
          />
        </Field>

        <Field id="user-name" label="Name" error={errors.name}>
          <input
            id="user-name"
            type="text"
            autoComplete="name"
            disabled={submitting}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "user-name-error" : undefined}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            className={inputClasses(!!errors.name)}
          />
        </Field>

        <Field id="user-role" label="Role" error={errors.role}>
          <select
            id="user-role"
            disabled={submitting || !!isSelf}
            aria-invalid={errors.role ? "true" : undefined}
            aria-describedby={
              errors.role
                ? "user-role-error"
                : isSelf
                ? "user-role-help"
                : undefined
            }
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "admin" | "user");
              if (errors.role) setErrors((p) => ({ ...p, role: undefined }));
            }}
            className={inputClasses(!!errors.role)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {isSelf && !errors.role && (
            <p
              id="user-role-help"
              className="mt-1.5 text-xs text-slate-500"
            >
              You can&apos;t change your own role.
            </p>
          )}
        </Field>

        {mode === "create" ? (
          <>
            <Field
              id="user-password"
              label="Password"
              error={errors.password}
            >
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                disabled={submitting}
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby={
                  errors.password ? "user-password-error" : undefined
                }
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                className={inputClasses(!!errors.password)}
              />
            </Field>
            <Field
              id="user-confirm"
              label="Confirm password"
              error={errors.confirm}
            >
              <input
                id="user-confirm"
                type="password"
                autoComplete="new-password"
                disabled={submitting}
                aria-invalid={errors.confirm ? "true" : undefined}
                aria-describedby={
                  errors.confirm ? "user-confirm-error" : undefined
                }
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (errors.confirm)
                    setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                className={inputClasses(!!errors.confirm)}
              />
            </Field>
          </>
        ) : (
          <ResetPasswordSection
            open={passwordOpen}
            onToggle={(next) => {
              setPasswordOpen(next);
              if (!next) {
                setPassword("");
                setConfirm("");
                setErrors((p) => ({
                  ...p,
                  password: undefined,
                  confirm: undefined,
                }));
              }
            }}
            password={password}
            confirm={confirm}
            errors={errors}
            disabled={submitting}
            onPasswordChange={(v) => {
              setPassword(v);
              if (errors.password)
                setErrors((p) => ({ ...p, password: undefined }));
            }}
            onConfirmChange={(v) => {
              setConfirm(v);
              if (errors.confirm)
                setErrors((p) => ({ ...p, confirm: undefined }));
            }}
          />
        )}

        <div className="mt-2 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting ? "true" : undefined}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordSection({
  open,
  onToggle,
  password,
  confirm,
  errors,
  disabled,
  onPasswordChange,
  onConfirmChange,
}: {
  open: boolean;
  onToggle: (next: boolean) => void;
  password: string;
  confirm: string;
  errors: FormErrors;
  disabled: boolean;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="reset-password-region"
        onClick={() => onToggle(!open)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <span>Reset password</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={[
            "h-4 w-4 text-slate-500 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          id="reset-password-region"
          className="space-y-3 border-t border-slate-200 px-3 py-3"
        >
          <Field
            id="user-new-password"
            label="New password"
            error={errors.password}
          >
            <input
              id="user-new-password"
              type="password"
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={
                errors.password ? "user-new-password-error" : undefined
              }
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className={inputClasses(!!errors.password)}
            />
          </Field>
          <Field
            id="user-new-confirm"
            label="Confirm new password"
            error={errors.confirm}
          >
            <input
              id="user-new-confirm"
              type="password"
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={errors.confirm ? "true" : undefined}
              aria-describedby={
                errors.confirm ? "user-new-confirm-error" : undefined
              }
              value={confirm}
              onChange={(e) => onConfirmChange(e.target.value)}
              className={inputClasses(!!errors.confirm)}
            />
          </Field>
        </div>
      )}
    </div>
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
          className="mt-1.5 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function inputClasses(hasError: boolean): string {
  const base =
    "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const ring = hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
    : "border-slate-300 focus:border-slate-900 focus:ring-slate-900/20";
  return `${base} ${ring}`;
}
