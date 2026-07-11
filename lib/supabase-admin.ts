import { createClient } from "@supabase/supabase-js";

// This file must ONLY be imported in server-side code (API routes, server actions)
// Never import this in client components or pages
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // In browser context this will be undefined — safe to warn but not throw
  if (typeof window === "undefined") {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in server environment");
  }
}

export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;