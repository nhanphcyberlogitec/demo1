"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const token = window.localStorage.getItem("token");
      router.replace(token ? "/dashboard" : "/login");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
