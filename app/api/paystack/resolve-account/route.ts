import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account_number = searchParams.get("account_number");
  const bank_code = searchParams.get("bank_code");

  if (!account_number || !bank_code) {
    return NextResponse.json({ error: "Missing account_number or bank_code" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || "Could not resolve account" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      account_name: data.data.account_name,
      account_number: data.data.account_number,
    });
  } catch (error: any) {
    console.error("Resolve account error:", error.message);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}