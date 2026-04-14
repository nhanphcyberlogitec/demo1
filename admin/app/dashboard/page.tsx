"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");
    if (!token || !raw) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(raw) as User);
      setReady(true);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/login");
    }
  }, [router]);

  if (!ready || !user) {
    return <div className="flex flex-1 items-center justify-center bg-[#f9fafb]" />;
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  return (
    <div className="flex flex-1 flex-col bg-[#f9fafb]">
      <header className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-[#111827]">Admin Panel</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
        >
          Logout
        </button>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-[#111827]">Dashboard</h2>
          <p className="mt-2 text-sm text-[#6b7280]">
            Welcome, <span className="font-medium text-[#111827]">{user.email}</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
