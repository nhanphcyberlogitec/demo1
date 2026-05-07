"use client";

// Generic accessible modal (TECH_SPEC §9.2):
// - role="dialog", aria-modal="true", aria-labelledby pointing at the title
// - Focus trap while open; Esc closes
// - Restores focus to the trigger on close
// - Backdrop click closes
//
// Intentionally minimal — just enough to satisfy the spec without pulling in
// a UI library.

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management + Esc handler.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR
    );
    if (focusables && focusables.length > 0) {
      // Defer to next frame so input refs / autofocus props settle.
      requestAnimationFrame(() => focusables[0]?.focus());
    } else {
      dialog?.focus();
    }

    function handleKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        onClose();
        return;
      }
      if (ev.key === "Tab" && dialog) {
        const list = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (list.length === 0) {
          ev.preventDefault();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (ev.shiftKey && active === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && active === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKey, true);

    // Lock body scroll while modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = size === "sm" ? "max-w-md" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8"
      aria-hidden={false}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        className={`relative w-full ${widthClass} rounded-xl border border-slate-200 bg-white shadow-xl outline-none`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2
            id={titleId}
            className="text-lg font-bold text-slate-900 tracking-tight"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
