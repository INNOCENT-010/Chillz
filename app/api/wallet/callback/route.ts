import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.redirect(new URL("/wallet?status=failed", req.url));
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    const data = await res.json();

    if (data.data?.status !== "success") {
      return NextResponse.redirect(new URL("/wallet?status=failed", req.url));
    }

    // Redirect immediately — let the client-side call /api/wallet/fund to credit
    // This avoids Vercel serverless timeout on the redirect chain
    const amount = data.data.amount / 100;
    const user_id = data.data.metadata?.user_id;

    return NextResponse.redirect(
      new URL(`/wallet?status=success&ref=${reference}&amount=${amount}&uid=${user_id}`, req.url)
    );
  } catch {
    return NextResponse.redirect(new URL("/wallet?status=failed", req.url));
  }
}