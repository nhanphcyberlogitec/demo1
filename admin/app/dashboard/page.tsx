"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  name: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("token");
    const rawUser = window.localStorage.getItem("user");

    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as User;
      setUser(parsed);
      setReady(true);
    } catch {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
      router.replace("/login");
    }
  }, [router]);

  const handleLogout = () => {
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    router.replace("/login");
  };

  if (!ready || !user) {
    return null;
  }

  return (
    <main className="min-h-screen w-full bg-[#f9fafb] px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827]">
                Welcome, {user.name ?? user.email}
              </h1>
              <p className="mt-2 text-sm text-[#6b7280]">
                You are signed in as {user.email}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-sm transition hover:bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] focus:ring-offset-2"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
