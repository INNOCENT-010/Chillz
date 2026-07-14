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

    // 2. Auth state changes
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
            queryClient.invalidateQueries();
          }
        }
      }
    );

    // 3. Hard navigate after any tab switch to bypass Next.js router cache
    let wasHidden = false;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!wasHidden) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = (anchor as HTMLAnchorElement).href;
      if (!href) return;
      try {
        const url = new URL(href);
        if (url.origin !== window.location.origin) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        wasHidden = false;
        window.location.href = href;
      } catch {}
    };

    const handlePopState = () => {
      if (wasHidden) {
        wasHidden = false;
        window.location.reload();
      }
    };

    // pagehide/pageshow are the reliable iOS Safari equivalents of visibilitychange
    const handlePageHide = () => { wasHidden = true; };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page restored from bfcache — force full reload immediately
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setUser, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}