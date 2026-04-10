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
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) return null;

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
