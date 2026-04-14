"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ListResponse = {
  items: User[];
  page: number;
  page_size: number;
  total: number;
};

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export default function AccountsListPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    const flash = sessionStorage.getItem("accounts:flash");
    if (flash) {
      setToast(flash);
      sessionStorage.removeItem("accounts:flash");
    }
    setAuthReady(true);
  }, [router]);

  // debounce search input (300ms) and reset pagination on change
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const fetchCounter = useRef(0);

  const loadAccounts = useCallback(async () => {
    if (!authReady) return;
    const reqId = ++fetchCounter.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("status", status);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    const { status: http, body } = await apiFetch<ListResponse>(
      `/api/accounts?${params.toString()}`
    );
    if (reqId !== fetchCounter.current) return;
    if (http === 200 && body.success && body.data) {
      const d = body.data as ListResponse;
      setItems(d.items);
      setTotal(d.total);
    } else if (http !== 401) {
      setError(body.message || "Failed to load accounts.");
      setItems([]);
      setTotal(0);
    }
    setLoading(false);
  }, [authReady, debouncedSearch, status, page]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleToggleStatus = async (user: User) => {
    if (togglingId) return;
    if (!user.is_active || user.id !== currentUserId) {
      // Fine to proceed for activate-anyone or deactivate-not-self.
    }
    setTogglingId(user.id);
    const { status: http, body } = await apiFetch<User>(
      `/api/accounts/${user.id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      }
    );
    setTogglingId(null);
    if (http === 200 && body.success && body.data) {
      const updated = body.data as User;
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setToast(body.message || "Status updated");
    } else if (http !== 401) {
      setToast(body.message || "Failed to update status.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  if (!authReady) {
    return <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasRows = items.length > 0;

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
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
        >
          Logout
        </button>
      </header>

      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-2 text-sm text-[#166534]"
            >
              {toast}
            </div>
          )}

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#111827]">Accounts</h2>
            <Link
              href="/accounts/new"
              className="inline-flex h-10 items-center rounded-lg bg-[#2563eb] px-4 text-sm font-bold text-white transition hover:bg-[#1d4ed8]"
            >
              + New account
            </Link>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] px-4 py-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search accounts"
                className="h-11 min-w-[260px] flex-1 rounded-lg border border-[#d1d5db] bg-white px-3.5 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/40"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                aria-label="Filter by status"
                className="h-11 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/40"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {error && (
              <div className="flex items-center justify-between border-b border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => loadAccounts()}
                  className="rounded-md border border-[#fecaca] bg-white px-3 py-1 text-sm font-medium text-[#b91c1c] hover:bg-[#fef2f2]"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f9fafb] text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`s-${i}`} className="border-t border-[#e5e7eb]">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 w-full max-w-[160px] animate-pulse rounded bg-[#f3f4f6]" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!loading && !hasRows && !error && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#6b7280]">
                        No accounts match your filters.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    items.map((u) => {
                      const isSelf = u.id === currentUserId;
                      const disableDeactivate = isSelf && u.is_active;
                      return (
                        <tr key={u.id} className="border-t border-[#e5e7eb] hover:bg-[#f9fafb]">
                          <td className="px-4 py-3 font-medium text-[#111827]">{u.name}</td>
                          <td className="px-4 py-3 text-[#374151]">{u.email}</td>
                          <td className="px-4 py-3">
                            {u.is_active ? (
                              <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-medium text-[#166534]">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#6b7280]">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#6b7280]">{formatDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/accounts/${u.id}`}
                                className="text-sm font-medium text-[#2563eb] hover:underline"
                              >
                                View
                              </Link>
                              <button
                                type="button"
                                disabled={togglingId === u.id || disableDeactivate}
                                onClick={() => handleToggleStatus(u)}
                                title={
                                  disableDeactivate
                                    ? "You cannot deactivate your own account."
                                    : undefined
                                }
                                className="rounded-md border border-[#d1d5db] bg-white px-3 py-1 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {togglingId === u.id
                                  ? "…"
                                  : u.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-4 py-3 text-sm text-[#6b7280]">
              <span>
                {total === 0
                  ? "0 results"
                  : `Page ${page} of ${totalPages} · ${total} total`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-[#d1d5db] bg-white px-3 py-1 font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-[#d1d5db] bg-white px-3 py-1 font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
