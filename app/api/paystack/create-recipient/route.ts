export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizedMatch(registered: string, bankName: string): boolean {
  const normalize = (s: string) =>
    s.toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .sort()
      .join(" ");
  return normalize(registered) === normalize(bankName);
}

export async function POST(req: NextRequest) {
  try {
    const {
      bank_name, account_number, account_name,
      bank_code, entity_type, entity_id,
    } = await req.json();

    // ── Fetch registered name to compare ─────────────────────────────────
    const table = entity_type === "vendor" ? "vendors" : "users";
    const nameField = entity_type === "vendor" ? "account_holder_name" : "full_name";

    const { data: profile } = await supabaseAdmin
      .from(table)
      .select(`${nameField}`)
      .eq("id", entity_id)
      .single();

    const registeredName = (profile as any)?.[nameField];

    if (registeredName) {
      const isMatch = normalizedMatch(registeredName, account_name);
      if (!isMatch) {
        return NextResponse.json(
          {
            error: `Account name "${account_name}" does not match your registered name "${registeredName}". Make sure you entered your name exactly as it appears on your bank account during registration.`,
            code: "NAME_MISMATCH_AT_LINK",
          },
          { status: 403 }
        );
      }
    }

    // ── Create Paystack recipient ─────────────────────────────────────────
    const res = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: account_name,
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json(
        { error: data.message || "Failed to create recipient" },
        { status: 400 }
      );
    }

    const recipient_code = data.data.recipient_code;

    // ── Save to table ─────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({
        bank_name,
        bank_account_number: account_number,
        bank_account_name: account_name,
        paystack_recipient_code: recipient_code,
        bank_linked_at: new Date().toISOString(),
      })
      .eq("id", entity_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, recipient_code });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Create recipient error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
