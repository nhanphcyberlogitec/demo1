"use client";

// AuthContext — reads the cached session from localStorage, protects
// /dashboard/* routes, and centralises the 401 → re-login flow
// (TECH_SPEC §3.6, §4.11).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "./api";

export type SessionUser = {
  id: string;
  email: string;
};

export type AuthContextValue = {
  user: SessionUser;
  logout: () => void;
  /** Wrap any apiFetch call in this to auto-handle 401 → /login. */
  guard: <T>(p: Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

type State =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: SessionUser };

function readSession(): SessionUser | null {
  let token: string | null = null;
  let rawUser: string | null = null;
  try {
    token = localStorage.getItem("token");
    rawUser = localStorage.getItem("user");
  } catch {
    return null;
  }
  if (!token || !rawUser) return null;
  // Mirror the malformed-JWT defense from app/dashboard/page.tsx.
  if (token.split(".").length !== 3) return null;
  try {
    const parsed = JSON.parse(rawUser) as Partial<SessionUser>;
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "checking" });
  // Once we've redirected to /login we don't want subsequent 401s to fire
  // additional router.replace calls that race the navigation.
  const redirectingRef = useRef(false);

  useEffect(() => {
    const session = readSession();
    // Defer state updates out of the effect body (matches the pattern used
    // in app/login/page.tsx) so React 19's react-hooks/set-state-in-effect
    // rule stays happy; rAF still resolves on the next frame.
    const handle = requestAnimationFrame(() => {
      if (!session) {
        clearSession();
        redirectingRef.current = true;
        router.replace("/login");
        setState({ status: "unauthenticated" });
      } else {
        setState({ status: "authenticated", user: session });
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [router]);

  const logout = useCallback(() => {
    clearSession();
    if (!redirectingRef.current) {
      redirectingRef.current = true;
      router.replace("/login");
    }
  }, [router]);

  const guard = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      try {
        return await promise;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Token expired or invalid — force re-login (TECH_SPEC §4.11).
          logout();
        }
        throw err;
      }
    },
    [logout]
  );

  if (state.status !== "authenticated") {
    // Don't flash protected content (TECH_SPEC §3.6).
    return <div aria-busy="true" className="min-h-dvh bg-slate-50" />;
  }

  // React 19 / Next 16 compiles components automatically — the inline object
  // literal here is safe to construct on every render because consumers go
  // through the `useAuth()` hook and only read individual fields.
  return (
    <AuthContext.Provider value={{ user: state.user, logout, guard }}>
      {children}
    </AuthContext.Provider>
  );
}
