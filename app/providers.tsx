"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            retry: 1,
          },
        },
      })
  );

  const { setUser } = useAuthStore();

  useEffect(() => {
    // Get session on first load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Try to get user record from our users table
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (data) {
          setUser(data as any);
        } else {
          // User exists in auth but not in users table yet — create it
          const newUser = {
            id: session.user.id,
            full_name:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            email: session.user.email!,
            phone: session.user.phone || null,
            avatar_url: session.user.user_metadata?.avatar_url || null,
          };
          await supabase.from("users").upsert(newUser as any);
          setUser(newUser as any);
        }
      } else {
        setUser(null);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (data) {
          setUser(data as any);
        } else {
          const newUser = {
            id: session.user.id,
            full_name:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            email: session.user.email!,
            phone: session.user.phone || null,
            avatar_url: session.user.user_metadata?.avatar_url || null,
          };
          await supabase.from("users").upsert(newUser as any);
          setUser(newUser as any);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}