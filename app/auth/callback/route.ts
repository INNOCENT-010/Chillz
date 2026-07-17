import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type");
  const next       = searchParams.get("next") ?? "/";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name, options) => {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  // ── Email confirmation / OTP flow (signup, recovery, email change) ──
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/home`);
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  // ── OAuth / magic link code exchange flow ──
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Recovery flow — send straight to reset password page
  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const accountType = data.user.user_metadata?.account_type;
  const redirectTo  = accountType === "vendor"
    ? "/vendor"
    : next === "/" ? "/home" : next;

  const response = NextResponse.redirect(`${origin}${redirectTo}`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}