"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userJson = localStorage.getItem("user");

    if (!token || !userJson) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(userJson));
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <svg
          className="h-8 w-8 animate-spin text-[#2563EB]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
      <div className="w-full max-w-[400px] rounded-lg bg-white p-8 shadow-sm mx-4">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
          <p className="text-base text-[#374151]">
            Welcome, {user.name}!
          </p>
          <button
            onClick={handleLogout}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#2563EB] text-base font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
