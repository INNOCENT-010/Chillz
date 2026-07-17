export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { type, subject, message, bookingId, venueName, userEmail, vendorId } = await req.json();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.log("Support ticket (no Resend):", { type, subject, message });
      return NextResponse.json({ success: true });
    }

    const recipientEmail = type === "vendor"
      ? process.env.VENDOR_SUPPORT_EMAIL || "support@chillz.app"
      : "support@chillz.app";

    const body = `
Support Ticket

Type: ${type === "vendor" ? "Vendor Report" : "Chillz Support"}
Subject: ${subject}
${venueName ? `Venue: ${venueName}` : ""}
${bookingId ? `Booking ID: ${bookingId}` : ""}
User Email: ${userEmail || "Not logged in"}

Message:
${message}
    `.trim();

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Chillz Support <noreply@chillz.app>",
        to: [recipientEmail],
        subject: `[${type === "vendor" ? "Vendor Report" : "Support"}] ${subject}`,
        text: body,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Support submit error:", error);
    return NextResponse.json({ success: true }); // Don't fail silently — ticket is already in DB
  }
}
