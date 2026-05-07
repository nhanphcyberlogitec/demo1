"use client";

// /dashboard — landing page rendered inside the shared AdminShell layout
// (TECH_SPEC §3.1). Auth is handled by app/dashboard/layout.tsx.

import { useEffect, useState } from "react";
import { listUsers, type UserDTO } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSetPageTitle } from "@/lib/page-title";

type Card = {
  label: string;
  value: number | null; // null = loading; -1 = error
};

export default function DashboardPage() {
  useSetPageTitle("Dashboard");
  const { user, guard } = useAuth();

  const [total, setTotal] = useState<Card>({ label: "Total users", value: null });
  const [admins, setAdmins] = useState<Card>({ label: "Administrators", value: null });
  const [thisWeek, setThisWeek] = useState<Card>({
    label: "Created this week",
    value: null,
  });

  useEffect(() => {
    let cancelled = false;
    // 1) Cheap "total users" count via pagination metadata.
    guard(listUsers({ page: 1, limit: 1 }))
      .then((res) => {
        if (cancelled) return;
        setTotal({ label: "Total users", value: res.pagination.total });
      })
      .catch(() => {
        if (cancelled) return;
        setTotal({ label: "Total users", value: -1 });
      });

    // 2) Administrators / Created this week — derived from a single
    //    page (limit=100) since BACKEND_API.md does not expose a dedicated
    //    aggregate endpoint and PROTOTYPE §6 keeps that out of scope.
    //    Adequate for early-stage admin panels (well below 100 users); if
    //    the system outgrows this, swap in a backend aggregate.
    guard(listUsers({ page: 1, limit: 100 }))
      .then((res) => {
        if (cancelled) return;
        const adminCount = res.items.filter(
          (u: UserDTO) => u.role === "admin"
        ).length;
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekCount = res.items.filter((u: UserDTO) => {
          const created = new Date(u.created_at).getTime();
          return Number.isFinite(created) && created >= sevenDaysAgo;
        }).length;
        setAdmins({ label: "Administrators", value: adminCount });
        setThisWeek({ label: "Created this week", value: weekCount });
      })
      .catch(() => {
        if (cancelled) return;
        setAdmins({ label: "Administrators", value: -1 });
        setThisWeek({ label: "Created this week", value: -1 });
      });

    return () => {
      cancelled = true;
    };
  }, [guard]);

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <header>
        <h2
          id="dashboard-heading"
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Welcome, {user.email}.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard card={total} hint="Across all roles" />
        <SummaryCard card={admins} hint='Users with role "admin"' />
        <SummaryCard card={thisWeek} hint="In the last 7 days" />
      </div>
    </section>
  );
}

function SummaryCard({
  card,
  hint,
}: {
  card: Card;
  hint: string;
}) {
  const display =
    card.value === null
      ? "—"
      : card.value === -1
      ? "—"
      : new Intl.NumberFormat().format(card.value);

  return (
    <article
      aria-label={card.label}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-slate-500">{card.label}</p>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight text-slate-900"
        aria-live="polite"
      >
        {display}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {card.value === -1 ? "Couldn't load — try refreshing." : hint}
      </p>
    </article>
  );
}
