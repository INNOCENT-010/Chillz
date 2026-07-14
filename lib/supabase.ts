import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

// Singleton — prevents multiple instances across hot reloads and navigation
const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

declare global {
  // eslint-disable-next-line no-var
  var _supabaseClient: ReturnType<typeof createClient> | undefined;
}

export const supabase =
  globalThis._supabaseClient ?? (globalThis._supabaseClient = createClient());