export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, otp } = await req.json();
    if (!user_id || !otp) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const otpHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");

    const { data: record } = await supabaseAdmin
      .from("withdrawal_otps")
      .select("*")
      .eq("user_id", user_id)
      .eq("otp_hash", otpHash)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired OTP. Request a new one." },
        { status: 400 }
      );
    }

    // Mark as used
    await supabaseAdmin
      .from("withdrawal_otps")
      .update({ used: true })
      .eq("id", record.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
