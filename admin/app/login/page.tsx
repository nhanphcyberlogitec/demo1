"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      router.push("/dashboard");
    } catch {
      setError("Unable to connect to server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-lg bg-white p-8 shadow-sm mx-4"
      >
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold text-[#111827]">Login</h1>

          <div className="flex w-full flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-base text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-base text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && (
            <p className="w-full text-sm text-[#DC2626]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#2563EB] text-base font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>
    </div>
  );
}
