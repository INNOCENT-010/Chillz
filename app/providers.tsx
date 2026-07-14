"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            gcTime: 1000 * 60 * 10,
            retry: 1,
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchIntervalInBackground: false,
          },
        },
      })
  );

  const { setUser } = useAuthStore();
  const initialised = useRef(false);

  async function syncUser(userId: string) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setUser(data as any);
    }
  }

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // 1. Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await syncUser(session.user.id);
      } else {
        setUser(null);
      }
    });

    // 2. Auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          queryClient.clear();
          return;
        }
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          if (session?.user) {
            await syncUser(session.user.id);
            // Refetch queries with fresh token
            queryClient.invalidateQueries();
          }
        }
      }
    );

    // 3. Track when tab was hidden
    let hiddenAt: number | null = null;
    let needsRefreshOnNav = false;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        needsRefreshOnNav = false;
        return;
      }

      if (document.visibilityState === "visible" && hiddenAt !== null) {
        const awayMs = Date.now() - hiddenAt;
        hiddenAt = null;

        if (awayMs >= 30_000) {
          // Away for 30+ seconds — flag that next navigation should hard reload
          needsRefreshOnNav = true;
          // Also invalidate current page queries immediately
          queryClient.invalidateQueries();
        }
      }
    };

    // Intercept clicks on links and buttons — if flagged, hard reload destination
    const handleClick = (e: MouseEvent) => {
      if (!needsRefreshOnNav) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      // Same-origin navigation — hard reload instead of client navigation
      e.preventDefault();
      e.stopPropagation();
      needsRefreshOnNav = false;
      window.location.href = anchor.href;
    };

    // Also intercept back/forward button
    const handlePopState = () => {
      if (needsRefreshOnNav) {
        needsRefreshOnNav = false;
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setUser, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}