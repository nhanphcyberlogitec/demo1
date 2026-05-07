"use client";

// Shared layout for /dashboard/* (TECH_SPEC §2). Wraps every dashboard page
// in: AuthProvider (auth guard + 401 interceptor), PageTitleProvider
// (so pages can set the topbar title), ToastProvider (success/info toasts),
// and the AdminShell (sidebar + topbar + content area).

import type { ReactNode } from "react";
import { AdminShell } from "./_components/AdminShell";
import { AuthProvider } from "@/lib/auth";
import { PageTitleProvider } from "@/lib/page-title";
import { ToastProvider } from "@/lib/toast";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <PageTitleProvider>
        <ToastProvider>
          <AdminShell>{children}</AdminShell>
        </ToastProvider>
      </PageTitleProvider>
    </AuthProvider>
  );
}
