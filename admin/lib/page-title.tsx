"use client";

// Tiny context so child pages can set the topbar title slot rendered by the
// shared dashboard layout (TECH_SPEC §2.2).

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  title: string;
  setTitle: (next: string) => void;
};

const PageTitleContext = createContext<Ctx | null>(null);

export function PageTitleProvider({
  children,
  defaultTitle = "Dashboard",
}: {
  children: ReactNode;
  defaultTitle?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const value = useMemo<Ctx>(() => ({ title, setTitle }), [title]);
  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(): Ctx {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error("usePageTitle must be used inside PageTitleProvider");
  return ctx;
}

export function useSetPageTitle(title: string) {
  const { setTitle } = usePageTitle();
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
}
