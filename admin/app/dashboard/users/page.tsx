"use client";

// /dashboard/users — users list with search, pagination, and inline modals
// for create / edit / delete (TECH_SPEC §3.2 – §3.5). Auth is handled by
// app/dashboard/layout.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, listUsers, type UserDTO } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSetPageTitle } from "@/lib/page-title";
import { useToast } from "@/lib/toast";
import { formatShortDate } from "@/lib/format";
import { UserFormModal } from "./_components/UserFormModal";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export default function UsersPage() {
  useSetPageTitle("Users");
  const { user: signedInUser, guard } = useAuth();
  const { showToast } = useToast();

  // Search input is controlled separately from `q` so we can debounce.
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);

  const [items, setItems] = useState<UserDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDTO | null>(null);

  // Debounce the search input → q. Reset to page 1 whenever the search term
  // actually changes (TECH_SPEC §3.2).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQ((prev) => {
        if (prev !== searchInput) {
          setPage(1);
        }
        return searchInput;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Cancel in-flight requests when params change so a slow earlier response
  // can't overwrite a later one.
  const lastRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++lastRequestId.current;
    const controller = new AbortController();
    // Defer the "loading" state update out of the synchronous effect body
    // (mirrors the rAF pattern used in app/login/page.tsx). The fetch is
    // kicked off immediately so the UI catches up on the next frame.
    const loadingHandle = requestAnimationFrame(() => {
      if (lastRequestId.current === requestId) {
        setLoadState({ kind: "loading" });
      }
    });

    guard(listUsers({ q, page, limit }, controller.signal))
      .then((res) => {
        if (lastRequestId.current !== requestId) return;
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.total_pages);
        setLoadState({ kind: "idle" });
      })
      .catch((err) => {
        if (lastRequestId.current !== requestId) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 401) {
          // 401 already handled by guard(); just stop here.
          return;
        }
        setLoadState({
          kind: "error",
          message: "Couldn't load users. Try again.",
        });
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      });

    return () => {
      cancelAnimationFrame(loadingHandle);
      controller.abort();
    };
  }, [q, page, limit, guard, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleCreated = useCallback(() => {
    setCreateOpen(false);
    showToast("success", "User created.");
    // Reset to page 1 so the newly-created user (sorted DESC by created_at)
    // is visible.
    if (page !== 1) setPage(1);
    else refresh();
  }, [page, refresh, showToast]);

  const handleUpdated = useCallback(
    (updated: UserDTO) => {
      setEditTarget(null);
      showToast("success", "User updated.");
      // Patch the row in place to avoid a flash, then refetch to keep total
      // counts and ordering correct.
      setItems((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      refresh();
    },
    [refresh, showToast]
  );

  const handleDeleted = useCallback(() => {
    setDeleteTarget(null);
    showToast("success", "User deleted.");
    refresh();
  }, [refresh, showToast]);

  const handleAlreadyGone = useCallback(() => {
    setDeleteTarget(null);
    showToast("info", "User already removed.");
    refresh();
  }, [refresh, showToast]);

  const tablePlaceholder = useMemo(() => {
    if (loadState.kind === "loading") return "Loading users…";
    if (loadState.kind === "error") return null;
    if (items.length === 0) {
      return q ? "No users match your search." : "No users yet.";
    }
    return null;
  }, [loadState, items.length, q]);

  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  return (
    <section aria-labelledby="users-heading" className="space-y-5">
      <header>
        <h2
          id="users-heading"
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          Users
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage admins and other users of the panel.
        </p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-sm">
          <span className="sr-only">Search</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l3 3" />
            </svg>
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or name"
            aria-label="Search users by email or name"
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <span aria-hidden="true">+</span>
          <span>New user</span>
        </button>
      </div>

      {/* Error banner */}
      {loadState.kind === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{loadState.message}</span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => {
                const isSelf = u.id === signedInUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditTarget(u)}
                        className="text-left font-medium text-slate-900 hover:underline"
                      >
                        {u.email}
                      </button>
                      {isSelf && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {u.name && u.name.trim() ? u.name : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RolePill role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatShortDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          label={`Edit user ${u.email}`}
                          onClick={() => setEditTarget(u)}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M13 4l3 3-9 9H4v-3z" />
                          </svg>
                        </IconButton>
                        <IconButton
                          label={`Delete user ${u.email}`}
                          onClick={() => setDeleteTarget(u)}
                          disabled={isSelf}
                          tooltip={
                            isSelf
                              ? "You can't delete the account you're signed in with."
                              : undefined
                          }
                          variant="danger"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" />
                          </svg>
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tablePlaceholder && (
          <div
            aria-busy={loadState.kind === "loading"}
            className="border-t border-slate-100 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500"
          >
            {tablePlaceholder}
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label htmlFor="page-size" className="text-sm">
            Rows per page
          </label>
          <select
            id="page-size"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="hidden text-slate-400 sm:inline">·</span>
          <span className="text-slate-500">
            {total === 0
              ? "0 users"
              : `Showing ${showingFrom}–${showingTo} of ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loadState.kind === "loading"}
            aria-disabled={page <= 1 || loadState.kind === "loading"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600" aria-live="polite">
            Page {totalPages === 0 ? 0 : page} of {totalPages}
            {total > 0 && (
              <>
                {" "}
                <span className="text-slate-400">·</span> {total} total
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p))
            }
            disabled={
              loadState.kind === "loading" || page >= totalPages || totalPages === 0
            }
            aria-disabled={
              loadState.kind === "loading" || page >= totalPages || totalPages === 0
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modals — keyed so each opening is a fresh component instance and
          form state initialises cleanly from props (no useEffect sync). */}
      <UserFormModal
        key={`create-${createOpen ? "open" : "closed"}`}
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={handleCreated}
      />
      <UserFormModal
        key={`edit-${editTarget?.id ?? "none"}`}
        open={!!editTarget}
        mode="edit"
        initialUser={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleUpdated}
      />
      <DeleteConfirmModal
        key={`delete-${deleteTarget?.id ?? "none"}`}
        open={!!deleteTarget}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
        onAlreadyGone={handleAlreadyGone}
      />
    </section>
  );
}

function RolePill({ role }: { role: "admin" | "user" }) {
  const isAdmin = role === "admin";
  const styles = isAdmin
    ? "bg-slate-900 text-white"
    : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}
    >
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  tooltip,
  variant = "default",
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: "default" | "danger";
}) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";
  const tone =
    variant === "danger"
      ? "text-red-600 hover:border-red-200 hover:bg-red-50"
      : "text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip || label}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone}`}
    >
      {children}
    </button>
  );
}
