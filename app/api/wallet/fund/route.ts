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
    return NextResponse.json({ success: true, amount });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("WALLET FUND ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
