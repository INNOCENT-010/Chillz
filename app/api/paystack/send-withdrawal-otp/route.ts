export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateOTP } from "@/lib/security";
import * as crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendEmail(to: string, otp: string) {
  // Uses Resend — swap for any email provider
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chillz <security@chillz.app>",
      to,
      subject: "Your Chillz Withdrawal OTP",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #5B0EA6;">Withdrawal Verification</h2>
          <p>Your one-time password to confirm your withdrawal is:</p>
          <div style="background: #EDE0F7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #5B0EA6;">${otp}</span>
          </div>
          <p style="color: #6B6B6B; font-size: 13px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color: #6B6B6B; font-size: 13px;">If you didn't request this, please contact support immediately.</p>
        </div>
      `,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, email } = await req.json();
    if (!user_id || !email) {
      return NextResponse.json({ error: "Missing user_id or email" }, { status: 400 });
    }

    // Rate limit: max 3 OTPs per 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("withdrawal_otps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("created_at", tenMinsAgo);

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait 10 minutes." },
        { status: 429 }
      );
    }

    // Generate OTP + hash it
    const otp = generateOTP();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate old OTPs for this user
    await supabaseAdmin
      .from("withdrawal_otps")
      .update({ used: true })
      .eq("user_id", user_id)
      .eq("used", false);

    // Store new OTP
    await supabaseAdmin.from("withdrawal_otps").insert({
      user_id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      used: false,
    });

    // Send email
    await sendEmail(email, otp);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
