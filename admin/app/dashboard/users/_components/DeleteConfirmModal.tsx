"use client";

// Delete confirmation modal (TECH_SPEC §3.5).

import { useState } from "react";
import { Modal } from "../../_components/Modal";
import { ApiError, deleteUser, type UserDTO } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function DeleteConfirmModal({
  open,
  user,
  onClose,
  onDeleted,
  onAlreadyGone,
}: {
  open: boolean;
  user: UserDTO | null;
  onClose: () => void;
  onDeleted: (user: UserDTO) => void;
  onAlreadyGone: (user: UserDTO) => void;
}) {
  const { guard } = useAuth();
  // Parent remounts via `key` when a new target is chosen, so the modal
  // resets cleanly without a useEffect-driven state sync.
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function handleDelete() {
    if (!user || submitting) return;
    setSubmitting(true);
    setBanner(null);
    try {
      await guard(deleteUser(user.id));
      onDeleted(user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return;
        if (err.status === 404) {
          // Already deleted by someone else (TECH_SPEC §3.5).
          onAlreadyGone(user);
          return;
        }
        if (err.status === 400) {
          // self-delete or last-admin (BACKEND_API §6.2 / §6.3).
          setBanner(err.serverMessage || "Couldn't delete user.");
        } else {
          setBanner("Couldn't delete user. Please try again.");
        }
      } else {
        setBanner("Couldn't delete user. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete user?" size="sm">
      <div className="space-y-4">
        {banner && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {banner}
          </div>
        )}
        <p className="text-sm text-slate-600">
          This will remove{" "}
          <span className="font-semibold text-slate-900">{user?.email}</span>{" "}
          from the system. They will no longer be able to sign in. This action
          can&apos;t be undone.
        </p>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            aria-busy={submitting ? "true" : undefined}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400 disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
