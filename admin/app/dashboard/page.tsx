"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; full_name: string | null };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        setUser(JSON.parse(raw) as User);
      } catch {
        setUser(null);
      }
    }
    setAuthChecked(true);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  }

  if (!authChecked) return null;

  const greeting = user?.full_name || user?.email || "Admin";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Panel</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-4 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100"
          >
            Log out
          </button>
        </header>
        <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)]">
          <p className="text-gray-900">Welcome, {greeting}.</p>
        </section>
      </div>
    </main>
  );
}
