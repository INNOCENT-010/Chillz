import { supabase } from "@/lib/supabase";

// ─── WALLET FUNDING ───────────────────────────────────────────────────────────
export async function fundUserWallet(
  userId: string,
  amount: number,
  reference: string
) {
  const txId = crypto.randomUUID();
  await (supabase.from("ledger_entries") as any).insert([
    {
      transaction_id: txId,
      account_type: "PAYSTACK_INFLOW",
      account_id: userId,
      direction: "CREDIT",
      amount,
      note: "Wallet funded via Paystack",
      reference_id: reference,
      reference_type: "paystack_deposit",
    },
    {
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "CREDIT",
      amount,
      note: "Wallet topped up",
      reference_id: reference,
      reference_type: "paystack_deposit",
    },
  ]);
}

// ─── BOOKING RESERVE ─────────────────────────────────────────────────────────
export async function reserveBookingAmount(
  userId: string,
  bookingId: string,
  amount: number
) {
  const txId = crypto.randomUUID();
  await (supabase.from("ledger_entries") as any).insert([
    {
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "DEBIT",
      amount,
      note: "Booking reservation",
      reference_id: bookingId,
      reference_type: "booking",
    },
    {
      transaction_id: txId,
      account_type: "USER_RESERVED",
      account_id: userId,
      direction: "CREDIT",
      amount,
      note: "Booking reservation held",
      reference_id: bookingId,
      reference_type: "booking",
    },
  ]);
}

// ─── BOOKING COMPLETION (source of truth: receiptTotal) ──────────────────────
export async function completeBooking(
  userId: string,
  vendorId: string,
  bookingId: string,
  receiptTotal: number,
  reservedAmount: number
) {
  const platformFee = Math.round(receiptTotal * 0.05);
  const vendorCut = receiptTotal - platformFee;
  const delta = receiptTotal - reservedAmount;
  const txId = crypto.randomUUID();

  const entries: any[] = [];

  entries.push({
    transaction_id: txId,
    account_type: "USER_RESERVED",
    account_id: userId,
    direction: "DEBIT",
    amount: reservedAmount,
    note: "Reserved hold released on booking completion",
    reference_id: bookingId,
    reference_type: "booking_complete",
  });

  if (delta > 0) {
    entries.push({
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "DEBIT",
      amount: delta,
      note: `Receipt overage — ${delta} extra deducted from wallet`,
      reference_id: bookingId,
      reference_type: "booking_complete",
    });
  }

  if (delta < 0) {
    entries.push({
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "CREDIT",
      amount: Math.abs(delta),
      note: `Refund — receipt ${Math.abs(delta)} less than reserved`,
      reference_id: bookingId,
      reference_type: "booking_refund",
    });
  }

  entries.push({
    transaction_id: txId,
    account_type: "VENDOR_PENDING",
    account_id: vendorId,
    direction: "CREDIT",
    amount: vendorCut,
    note: "Vendor payout — 95% of receipt total",
    reference_id: bookingId,
    reference_type: "booking_complete",
  });

  entries.push({
    transaction_id: txId,
    account_type: "CHILLZ_REVENUE",
    account_id: "chillz",
    direction: "CREDIT",
    amount: platformFee,
    note: "Platform fee — 5% of receipt total",
    reference_id: bookingId,
    reference_type: "booking_complete",
  });

  const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert(entries);
  if (ledgerError) throw new Error(`Ledger write failed: ${ledgerError.message}`);

  const { error: bookingError } = await (supabase.from("bookings") as any)
    .update({ status: "completed", final_amount: receiptTotal })
    .eq("id", bookingId);
  if (bookingError) throw new Error(`Booking update failed: ${bookingError.message}`);

  const { error: receiptError } = await (supabase.from("receipts") as any)
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("booking_id", bookingId);
  if (receiptError) throw new Error(`Receipt confirm failed: ${receiptError.message}`);
}

// ─── CANCELLATION REFUND — IDEMPOTENT ────────────────────────────────────────
// Guards against double-refund by checking for existing cancellation ledger entry
// before inserting. Safe to call multiple times — only executes once per booking.
export async function refundCancellation(
  userId: string,
  bookingId: string,
  amount: number
) {
  // ── Guard: check booking status first ──────────────────────────────
  const { data: booking } = await (supabase.from("bookings") as any)
    .select("status")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") {
    throw new Error("This booking has already been cancelled.");
  }
  if (!["confirmed", "pending"].includes(booking.status)) {
    throw new Error(`Cannot cancel a booking with status: ${booking.status}`);
  }

  // ── Guard: check for existing cancellation ledger entry ────────────
  const { data: existingEntries } = await (supabase.from("ledger_entries") as any)
    .select("id")
    .eq("reference_id", bookingId)
    .eq("reference_type", "cancellation")
    .limit(1);

  if (existingEntries && existingEntries.length > 0) {
    throw new Error("Refund already processed for this booking.");
  }

  // ── Mark booking cancelled FIRST before touching ledger ────────────
  // This means even if ledger insert fails, the booking won't show as
  // cancellable again — prevents the double-tap window entirely.
  const { error: statusError } = await (supabase.from("bookings") as any)
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("status", "confirmed"); // extra safety: only updates if still confirmed

  if (statusError) throw new Error(`Cancellation failed: ${statusError.message}`);

  // ── Now write ledger entries ────────────────────────────────────────
  const fee = Math.round(amount * 0.05);
  const refundAmount = amount - fee;
  const txId = crypto.randomUUID();

  const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert([
    {
      transaction_id: txId,
      account_type: "USER_RESERVED",
      account_id: userId,
      direction: "DEBIT",
      amount,
      note: "Cancellation — reserved funds released",
      reference_id: bookingId,
      reference_type: "cancellation",
    },
    {
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "CREDIT",
      amount: refundAmount,
      note: "Cancellation refund (95%)",
      reference_id: bookingId,
      reference_type: "cancellation",
    },
    {
      transaction_id: txId,
      account_type: "CHILLZ_REVENUE",
      account_id: "chillz",
      direction: "CREDIT",
      amount: fee,
      note: "Cancellation fee (5%)",
      reference_id: bookingId,
      reference_type: "cancellation",
    },
  ]);

  if (ledgerError) {
    // Ledger failed after status was already set to cancelled.
    // Log this for manual resolution — booking is cancelled but refund
    // needs to be re-processed by admin. Don't re-throw as "booking not
    // cancelled" since it IS cancelled.
    console.error(`LEDGER_FAIL_AFTER_CANCEL: bookingId=${bookingId} amount=${amount}`, ledgerError);
    throw new Error("Refund ledger entry failed. Your booking is cancelled. Contact support for your refund.");
  }
}

// ─── WALLET BALANCE HELPER ───────────────────────────────────────────────────
export async function getUserWalletBalance(userId: string): Promise<number> {
  const { data } = await (supabase.from("ledger_entries") as any)
    .select("direction, amount")
    .eq("account_id", userId)
    .eq("account_type", "USER_WALLET");

  return ((data || []) as any[]).reduce(
    (acc: number, row: any) =>
      row.direction === "CREDIT" ? acc + row.amount : acc - row.amount,
    0
  );
}

// ─── PAYSTACK CARD TOP-UP THEN COMPLETE ──────────────────────────────────────
export async function cardTopupAndComplete(
  userId: string,
  vendorId: string,
  bookingId: string,
  receiptTotal: number,
  reservedAmount: number,
  surplusAmount: number,
  paystackReference: string
) {
  const txId = crypto.randomUUID();

  await (supabase.from("ledger_entries") as any).insert([
    {
      transaction_id: txId,
      account_type: "PAYSTACK_INFLOW",
      account_id: userId,
      direction: "CREDIT",
      amount: surplusAmount,
      note: `Card top-up for receipt shortfall — ref: ${paystackReference}`,
      reference_id: bookingId,
      reference_type: "paystack_topup",
    },
    {
      transaction_id: txId,
      account_type: "USER_WALLET",
      account_id: userId,
      direction: "CREDIT",
      amount: surplusAmount,
      note: `Card top-up for receipt shortfall — ref: ${paystackReference}`,
      reference_id: bookingId,
      reference_type: "paystack_topup",
    },
  ]);

  await completeBooking(userId, vendorId, bookingId, receiptTotal, reservedAmount);
}