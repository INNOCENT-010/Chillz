import { NextRequest, NextResponse } from "next/server";
import { fundUserWallet } from "@/lib/ledger";

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
      return NextResponse.redirect(
        new URL("/wallet?status=failed", req.url)
      );
    }

    const amount = data.data.amount / 100;
    const user_id = data.data.metadata?.user_id;

    if (user_id) {
      await fundUserWallet(user_id, amount, reference);
    }

    return NextResponse.redirect(
      new URL("/wallet?status=success", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/wallet?status=failed", req.url)
    );
  }
}