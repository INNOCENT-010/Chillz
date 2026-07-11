import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fc(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { bookingId, userId, reservedAmount, reason } = await req.json();

    if (!bookingId || !userId || !reservedAmount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();

    if (!booking || booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Booking cannot be rejected at this stage" },
        { status: 400 }
      );
    }

    const txId = crypto.randomUUID();

    await supabaseAdmin.from("ledger_entries" as any).insert([
      {
        transaction_id: txId,
        account_type: "USER_RESERVED",
        account_id: userId,
        direction: "DEBIT",
        amount: reservedAmount,
        note: "Vendor rejected booking — refund",
        reference_id: bookingId,
        reference_type: "vendor_rejection",
      },
      {
        transaction_id: txId,
        account_type: "USER_WALLET",
        account_id: userId,
        direction: "CREDIT",
        amount: reservedAmount,
        note: "Refund: vendor rejected your booking",
        reference_id: bookingId,
        reference_type: "vendor_rejection",
      },
    ]);

    await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        notes: `Rejected by venue: ${reason || "Unavailable"}`,
      } as any)
      .eq("id", bookingId);

    await supabaseAdmin.from("notifications" as any).insert({
      user_id: userId,
      title: "Booking rejected by venue",
      body: `Your booking was declined.${reason ? ` Reason: ${reason}.` : ""} ${fc(reservedAmount)} refunded to your wallet.`,
      type: "booking",
      reference_id: bookingId,
      is_read: false,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}