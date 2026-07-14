"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export function RouterRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const hiddenAt = useRef<number | null>(null);
  const lastPath = useRef<string>(pathname);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    // Every time the path changes (navigation happened)
    // check if we were away — if so, refresh the new page
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      if (hiddenAt.current !== null) {
        const awayMs = Date.now() - hiddenAt.current;
        if (awayMs >= 15_000) {
          // Was away 15+ seconds before navigating — force fresh data
          router.refresh();
        }
        hiddenAt.current = null;
      }
    }
  }, [pathname, router]);

  return null;
}