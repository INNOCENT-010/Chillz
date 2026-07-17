export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server config error" }, { status: 500 });
    const { data: rawBooking } = await supabaseAdmin
      .from("bookings")
      .select("reject_count, status")
      .eq("id", booking_id)
      .single();

    const booking = rawBooking as any;
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newRejectCount = (booking.reject_count || 0) + 1;

    if (newRejectCount >= 3) {
      await (supabaseAdmin.from("bookings") as any)
        .update({ status: "disputed", reject_count: newRejectCount })
        .eq("id", booking_id);
      return NextResponse.json({ status: "disputed", message: "Max rejections reached." });
    }

    await (supabaseAdmin.from("bookings") as any)
      .update({ status: "confirmed", reject_count: newRejectCount })
      .eq("id", booking_id);

    await (supabaseAdmin.from("receipts") as any)
      .update({ status: "rejected" })
      .eq("booking_id", booking_id);

    return NextResponse.json({ status: "rejected", remaining: 3 - newRejectCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

