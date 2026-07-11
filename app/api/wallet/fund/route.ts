import { NextRequest, NextResponse } from "next/server";
import { fundUserWallet } from "@/lib/ledger";

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
    await fundUserWallet(user_id, amount, reference);

    return NextResponse.json({ success: true, amount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}