import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, booking_id, amount } = await req.json();
    if (!user_id || !booking_id || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const txId = crypto.randomUUID();
    const { error } = await (supabaseAdmin.from("ledger_entries") as any).insert([
      {
        transaction_id: txId,
        account_type: "USER_WALLET",
        account_id: user_id,
        direction: "DEBIT",
        amount,
        note: "Booking reservation",
        reference_id: booking_id,
        reference_type: "booking",
      },
      {
        transaction_id: txId,
        account_type: "USER_RESERVED",
        account_id: user_id,
        direction: "CREDIT",
        amount,
        note: "Booking reservation held",
        reference_id: booking_id,
        reference_type: "booking",
      },
    ]);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Reserve error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}