import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nameSimilarity, isWithin24Hours } from "@/lib/security";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_DAILY_USER = 500_000;
const MAX_DAILY_VENDOR = 5_000_000;
const NAME_SIMILARITY_THRESHOLD = 0.55;

export async function POST(req: NextRequest) {
  try {
    const {
      recipient_code, amount, reason,
      entity_type, entity_id, account_type,
      otp_verified,
    } = await req.json();

    if (!recipient_code) {
      return NextResponse.json(
        { error: "No bank account linked. Please add your bank account first." },
        { status: 400 }
      );
    }

    // ── Fetch entity profile ──────────────────────────────────────────────
    const table = entity_type === "vendor" ? "vendors" : "users";

    const { data: profile } = await supabaseAdmin
      .from(table)
      .select("bank_account_name, bank_linked_at, full_name, business_name")
      .eq("id", entity_id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // ── Security Layer 1: 24-hour hold ────────────────────────────────────
    if (profile.bank_linked_at && isWithin24Hours(profile.bank_linked_at)) {
      const linkedAt = new Date(profile.bank_linked_at);
      const availableAt = new Date(linkedAt.getTime() + 24 * 60 * 60 * 1000);
      const hoursLeft = Math.ceil((availableAt.getTime() - Date.now()) / (1000 * 60 * 60));
      return NextResponse.json(
        {
          error: `For your security, withdrawals to newly linked accounts are available after 24 hours. Available in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}.`,
          code: "COOLING_PERIOD",
          available_at: availableAt.toISOString(),
        },
        { status: 403 }
      );
    }

    // ── Security Layer 2: Fuzzy name match ────────────────────────────────
    const registeredName = entity_type === "vendor"
      ? profile.business_name
      : profile.full_name;
    const bankAccountName = profile.bank_account_name;

    if (registeredName && bankAccountName) {
      const similarity = nameSimilarity(registeredName, bankAccountName);
      if (similarity < NAME_SIMILARITY_THRESHOLD) {
        return NextResponse.json(
          {
            error: "The bank account name doesn't match your registered name. Please contact support if this is your account.",
            code: "NAME_MISMATCH",
            similarity: (similarity * 100).toFixed(0),
          },
          { status: 403 }
        );
      }
    }

    // ── Security Layer 3: Daily withdrawal limit ──────────────────────────
    const maxDaily = entity_type === "vendor" ? MAX_DAILY_VENDOR : MAX_DAILY_USER;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabaseAdmin
      .from("ledger_entries")
      .select("amount")
      .eq("account_id", entity_id)
      .eq("account_type", account_type)
      .eq("direction", "DEBIT")
      .eq("reference_type", "withdrawal")
      .gte("created_at", startOfDay.toISOString());

    const withdrawnToday = ((todayWithdrawals || []) as any[])
      .reduce((sum: number, row: any) => sum + row.amount, 0);

    if (withdrawnToday + amount > maxDaily) {
      const remaining = Math.max(0, maxDaily - withdrawnToday);
      return NextResponse.json(
        {
          error: `Daily withdrawal limit reached. You can withdraw up to ₦${remaining.toLocaleString()} more today.`,
          code: "DAILY_LIMIT",
          remaining,
        },
        { status: 403 }
      );
    }

    // ── Check ledger balance ──────────────────────────────────────────────
    const { data: ledger } = await supabaseAdmin
      .from("ledger_entries")
      .select("direction, amount")
      .eq("account_id", entity_id)
      .eq("account_type", account_type);

    const balance = ((ledger || []) as any[]).reduce((acc: number, row: any) =>
      row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);

    if (amount > balance) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // ── Initiate Paystack transfer ────────────────────────────────────────
    const ref = `CHILLZ-WD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const res = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100,
        recipient: recipient_code,
        reason: reason || "Chillz withdrawal",
        reference: ref,
      }),
    });

    const transferData = await res.json();
    console.log("Paystack transfer response:", JSON.stringify(transferData, null, 2));

    if (!transferData.status) {
      return NextResponse.json(
        { error: transferData.message || "Transfer failed. Please try again." },
        { status: 400 }
      );
    }

    const txStatus = transferData.data.status;

    // ── Debit ledger ──────────────────────────────────────────────────────
    const txId = crypto.randomUUID();

    await supabaseAdmin.from("ledger_entries").insert({
      transaction_id: txId,
      account_type,
      account_id: entity_id,
      direction: "DEBIT",
      amount,
      note: reason || "Withdrawal",
      reference_id: ref,
      reference_type: "withdrawal",
    });

    // ── Notify ────────────────────────────────────────────────────────────
    if (entity_type === "user") {
      await supabaseAdmin.from("notifications").insert({
        user_id: entity_id,
        title: txStatus === "success" ? "Transfer successful" : "Transfer initiated",
        body: txStatus === "success"
          ? `₦${amount.toLocaleString()} has been sent to your bank account.`
          : `Your withdrawal of ₦${amount.toLocaleString()} is being processed.`,
        type: "booking",
        is_read: false,
      });
    }

    return NextResponse.json({ success: true, status: txStatus, reference: ref });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Transfer route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}