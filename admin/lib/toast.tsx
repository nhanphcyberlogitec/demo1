"use client";

// Lightweight toast system used by Create / Update / Delete success paths
// (TECH_SPEC §3.3, §3.4, §3.5). One live region, polite, auto-dismiss after
// 3.5s. No external dependencies.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "info" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  showToast: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((cur) => [...cur, { id, kind, message }]);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((c) => c.filter((t) => t.id !== id))}
      />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), 3500);
    return () => window.clearTimeout(handle);
  }, [toast.id, onDismiss]);

  const styles =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : toast.kind === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div
      className={`pointer-events-auto min-w-[220px] max-w-[360px] rounded-lg border px-4 py-3 text-sm font-medium shadow-md ${styles}`}
    >
      {toast.message}
    </div>
  );
}
