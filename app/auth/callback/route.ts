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
      if (type === "signup") {
        const redirectNext = next && next !== "/" ? next : "/home";
        return NextResponse.redirect(`${origin}/login?confirmed=true&next=${encodeURIComponent(redirectNext)}`);
      }
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

  // Login notification email — fire and forget
  try {
    const userEmail = data.user.email;
    const fullName  = data.user.user_metadata?.full_name || "";
    const firstName = fullName.split(" ")[0] || "there";

    // Get city from Chillz location cache (sent via header or fallback)
    const loginTime = new Date().toLocaleString("en-NG", {
      dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos",
    });

    // Get approximate city from IP via free API
    let city = "your current location";
    try {
      const ipRes  = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
      const ipData = await ipRes.json();
      if (ipData.city && ipData.region) {
        city = `${ipData.city}, ${ipData.region}`;
      } else if (ipData.city) {
        city = ipData.city;
      }
    } catch { /* silent */ }

    if (userEmail) {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          to: userEmail,
          subject: "🔐 New login to your Chillz account",
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F5FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
  <div style="background:linear-gradient(135deg,#3D0066,#5B0EA6);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:16px;">
    <div style="font-size:40px;margin-bottom:10px;">🔐</div>
    <h1 style="color:#FFFFFF;font-size:20px;font-weight:900;margin:0 0 4px;">New Login Detected</h1>
    <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Someone signed in to your Chillz account</p>
  </div>
  <div style="background:#FFFFFF;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(91,14,166,0.08);">
    <p style="font-size:15px;color:#0A0A0A;margin:0 0 16px;">Hey ${firstName} 👋</p>
    <p style="font-size:14px;color:#6B6B6B;line-height:1.7;margin:0 0 16px;">
      We noticed a new sign-in to your Chillz account. Here are the details:
    </p>
    <div style="background:#F7F5FA;border-radius:12px;padding:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:12px;color:#9E9E9E;padding:6px 0;border-bottom:1px solid #EDE0F7;">📍 Location</td>
          <td style="font-size:13px;font-weight:700;color:#0A0A0A;text-align:right;padding:6px 0;border-bottom:1px solid #EDE0F7;">${city}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#9E9E9E;padding:6px 0;border-bottom:1px solid #EDE0F7;">🕐 Time</td>
          <td style="font-size:13px;font-weight:700;color:#0A0A0A;text-align:right;padding:6px 0;border-bottom:1px solid #EDE0F7;">${loginTime} WAT</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#9E9E9E;padding:6px 0;">📧 Account</td>
          <td style="font-size:13px;font-weight:700;color:#0A0A0A;text-align:right;padding:6px 0;">${userEmail}</td>
        </tr>
      </table>
    </div>
  </div>
  <div style="background:#FEF3C7;border-radius:16px;padding:16px 20px;margin-bottom:16px;border:1px solid #FDE68A;">
    <p style="font-size:13px;color:#92400E;margin:0;line-height:1.6;">
      ⚠️ <strong>Not you?</strong> Change your password immediately and contact us at <a href="mailto:support@mychillz.app" style="color:#D97706;">support@mychillz.app</a>
    </p>
  </div>
  <p style="text-align:center;font-size:12px;color:#9E9E9E;margin:0;">Chillz Security Team<br/><a href="https://mychillz.app" style="color:#5B0EA6;">mychillz.app</a></p>
</div></body></html>`,
        }),
      });
    }
  } catch { /* never block the redirect */ }

  const response = NextResponse.redirect(`${origin}${redirectTo}`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}