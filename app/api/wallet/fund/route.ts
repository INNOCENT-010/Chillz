export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { reference, user_id } = await req.json();

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    const verifyData = await verifyRes.json();

    if (verifyData.data?.status !== "success") {
      return NextResponse.json({ error: "Transaction not successful" }, { status: 400 });
    }

    const amount = verifyData.data.amount / 100;

    console.log("WALLET FUND ATTEMPT:", { user_id, amount, reference });

    const txId = crypto.randomUUID();
    const { error } = await (supabaseAdmin.from("ledger_entries") as any).insert([
      {
        transaction_id: txId,
        account_type: "PAYSTACK_INFLOW",
        account_id: user_id,
        direction: "CREDIT",
        amount,
        note: "Wallet funded via Paystack",
        reference_id: reference,
        reference_type: "paystack_deposit",
      },
      {
        transaction_id: txId,
        account_type: "USER_WALLET",
        account_id: user_id,
        direction: "CREDIT",
        amount,
        note: "Wallet topped up",
        reference_id: reference,
        reference_type: "paystack_deposit",
      },
    ]);

    if (error) {
      console.error("LEDGER INSERT ERROR:", error.message);
      throw new Error(`Wallet fund failed: ${error.message}`);
    }

    console.log("WALLET FUND SUCCESS:", { user_id, amount });

    // Send wallet funded email
    try {
      const { data: userData } = await (supabaseAdmin.from("users") as any)
        .select("full_name, email")
        .eq("id", user_id)
        .single();

      if (userData?.email) {
        const firstName = userData.full_name?.split(" ")[0] || "there";
        const formattedAmount = `₦${Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

        const emailRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            to: userData.email,
            subject: `💳 Wallet Funded — ${formattedAmount} added to Chillz`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F5FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">

    <div style="background:linear-gradient(135deg,#3D0066,#5B0EA6);border-radius:20px;padding:32px 24px;text-align:center;margin-bottom:16px;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:28px;">✅</div>
      <h1 style="color:#FFFFFF;font-size:22px;font-weight:900;margin:0 0 6px;font-family:sans-serif;">Checkout Complete</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Your Chillz wallet has been funded</p>
    </div>

    <div style="background:#FFFFFF;border-radius:16px;padding:24px;text-align:center;margin-bottom:16px;box-shadow:0 2px 12px rgba(91,14,166,0.08);">
      <p style="font-size:12px;font-weight:700;color:#9E9E9E;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Amount Added</p>
      <p style="font-size:38px;font-weight:900;color:#5B0EA6;margin:0 0 6px;font-family:sans-serif;">${formattedAmount}</p>
      <p style="font-size:12px;color:#9E9E9E;margin:0;">Ref: ${reference}</p>
    </div>

    <div style="background:#FFFFFF;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(91,14,166,0.08);">
      <p style="font-size:15px;color:#0A0A0A;margin:0 0 12px;font-weight:600;">Hey ${firstName} 👋</p>
      <p style="font-size:14px;color:#6B6B6B;line-height:1.8;margin:0 0 12px;">
        <strong style="color:#5B0EA6;">${formattedAmount}</strong> has landed in your Chillz wallet and is ready to use right now.
      </p>
      <p style="font-size:14px;color:#6B6B6B;line-height:1.8;margin:0;">
        Book a table, grab event tickets, reserve a stay, or hire a ride — your city has something waiting for you tonight.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://mychillz.app/home"
        style="display:inline-block;background:linear-gradient(135deg,#5B0EA6,#7B2FBE);color:#FFFFFF;text-decoration:none;padding:15px 36px;border-radius:14px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
        Start Exploring 🎉
      </a>
    </div>

    <p style="text-align:center;font-size:12px;color:#9E9E9E;margin:0;line-height:1.8;">
      Thank you for using Chillz.<br/>
      <a href="https://mychillz.app" style="color:#5B0EA6;text-decoration:none;">mychillz.app</a>
    </p>

  </div>
</body>
</html>`,
          }),
        });
        const emailData = await emailRes.json();
        console.log("WALLET EMAIL RESULT:", emailRes.status, emailData);
      }
    } catch (emailErr) {
      console.error("Wallet funded email failed:", emailErr);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true, amount });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("WALLET FUND ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
