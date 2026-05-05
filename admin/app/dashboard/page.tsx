"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type StoredUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthState =
  | { status: "checking" }
  | { status: "redirecting" }
  | { status: "ready"; user: StoredUser | null };

const CHECKING: AuthState = { status: "checking" };

let cachedSnapshot: AuthState = CHECKING;
let cachedKey = "";

function computeAuthState(): AuthState {
  if (typeof window === "undefined") return CHECKING;
  let token: string | null = null;
  let raw: string | null = null;
  try {
    token = window.localStorage.getItem("token");
    raw = window.localStorage.getItem("user");
  } catch {
    return { status: "redirecting" };
  }
  if (!token) return { status: "redirecting" };
  if (!raw) return { status: "ready", user: null };
  try {
    const user = JSON.parse(raw) as StoredUser;
    return { status: "ready", user };
  } catch {
    try {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    } catch {
      /* ignore */
    }
    return { status: "redirecting" };
  }
}

function getSnapshot(): AuthState {
  if (typeof window === "undefined") return CHECKING;
  const key = `${window.localStorage.getItem("token") ?? ""}|${
    window.localStorage.getItem("user") ?? ""
  }`;
  if (key === cachedKey) return cachedSnapshot;
  cachedKey = key;
  cachedSnapshot = computeAuthState();
  return cachedSnapshot;
}

function subscribe(notify: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

export default function DashboardPage() {
  const router = useRouter();
  const auth = useSyncExternalStore(subscribe, getSnapshot, () => CHECKING);

  useEffect(() => {
    if (auth.status === "redirecting") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  function handleSignOut() {
    try {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    } catch {
      /* ignore */
    }
    // Bust the snapshot cache so any rerender sees the cleared state.
    cachedKey = "";
    cachedSnapshot = CHECKING;
    router.replace("/login");
  }

  if (auth.status !== "ready") {
    return null;
  }

  const user = auth.user;
  const displayName = user?.name?.trim() || user?.email || "Admin";

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-8">
          <span className="text-[18px] font-semibold text-[#0f172a]">
            Admin Panel
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-3.5 text-[13px] font-medium text-[#0f172a] hover:bg-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-8 py-16">
        <div className="mx-auto w-full max-w-[720px] rounded-xl border border-[#e2e8f0] bg-white px-8 py-8">
          <h1 className="text-[20px] font-semibold text-[#0f172a]">
            Welcome, {displayName}
          </h1>
          <p className="mt-2 text-[14px] text-[#64748b]">
            You&apos;re signed in. Use the header&apos;s &quot;Sign out&quot;
            button to end your session.
          </p>
        </div>
      </main>
    </div>
  );
}
