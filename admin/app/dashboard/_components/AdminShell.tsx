"use client";

// Admin shell — sidebar + topbar that wraps every /dashboard/* page
// (TECH_SPEC §2.2). The shell itself does not call any API; it reads the
// cached `user` from localStorage via AuthContext for display.
//
// Topbar is rendered exactly once (mobile and desktop share it) so the
// existing E2E selector `getByRole("button", { name: "Log out" })` resolves
// to a single element and continues to work after this phase.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { usePageTitle } from "@/lib/page-title";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: (
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="7" r="3" />
        <path d="M2.5 17c.7-2.6 2.9-4.5 5.5-4.5s4.8 1.9 5.5 4.5" />
        <circle cx="14" cy="6" r="2.25" />
        <path d="M13.5 12.6c.4-.06.8-.1 1.2-.1 1.7 0 3.2.94 4 2.4" />
      </svg>
    ),
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const { user, logout } = useAuth();
  const { title: pageTitle } = usePageTitle();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="flex min-h-dvh">
        {/* Sidebar */}
        <aside
          id="admin-sidebar"
          aria-label="Primary"
          className={[
            "fixed inset-y-0 left-0 z-30 w-60 shrink-0 border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
        >
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
            <span className="text-base font-bold tracking-tight text-slate-900">
              Admin Panel
            </span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <nav className="px-3 py-4">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar — single instance shared by mobile and desktop. */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {/* Hamburger only on mobile */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Open navigation"
                aria-controls="admin-sidebar"
                aria-expanded={mobileNavOpen}
                className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 md:hidden"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h14M3 10h14M3 14h14" />
                </svg>
              </button>
              <h1 className="truncate text-base font-semibold text-slate-900">
                {pageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="hidden truncate text-sm text-slate-500 sm:inline"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Log out
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
