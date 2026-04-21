"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SessionUser = {
  id: string;
  email: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let token: string | null = null;
    let rawUser: string | null = null;
    try {
      token = localStorage.getItem("token");
      rawUser = localStorage.getItem("user");
    } catch {
      token = null;
      rawUser = null;
    }

    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }

    // Basic malformed-JWT defense: a JWT must have 3 dot-separated parts.
    if (token.split(".").length !== 3) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {
        // ignore
      }
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as SessionUser;
      if (!parsed || typeof parsed.email !== "string") {
        throw new Error("Malformed user object");
      }
      setUser(parsed);
      setChecking(false);
    } catch {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {
        // ignore
      }
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      // ignore
    }
    router.replace("/login");
  }

  if (checking || !user) {
    // Don't flash protected content (TECH_SPEC §3.6).
    return <div aria-busy="true" className="min-h-dvh bg-slate-50" />;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Admin Panel
          </h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section
          aria-labelledby="welcome-heading"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2
            id="welcome-heading"
            className="text-xl font-bold text-slate-900 tracking-tight"
          >
            Welcome, {user.email}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            You&apos;re signed in. Use the header&apos;s &ldquo;Log out&rdquo;
            button to end your session.
          </p>
        </section>
      </main>
    </div>
  );
}
