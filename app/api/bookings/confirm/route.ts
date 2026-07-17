export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { completeBooking } from "@/lib/ledger";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { booking_id, user_id } = await req.json();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server config error" }, { status: 500 });
    const { data: rawBooking } = await supabaseAdmin
      .from("bookings")
      .select("*, receipts(*)")
      .eq("id", booking_id)
      .single();

    const booking = rawBooking as any;
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.status !== "receipt_sent") {
      return NextResponse.json({ error: "Receipt not sent yet" }, { status: 400 });
    }

    const receipt = booking.receipts?.[0];
    const amount = receipt?.total || booking.reserved_amount;

    await completeBooking(user_id, booking.vendor_id, booking_id, amount, booking.reserved_amount);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

