/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ArrowLeft, CheckCircle, X, AlertCircle,
  Building2, Clock, Receipt, MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

export default function BookingReceiptPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["booking-receipt", id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select(`
          id, status, reserved_amount, final_amount, package_name,
          package_price, num_nights, num_rooms,
          checkin_date, checkout_date, guest_count,
          booking_date, notes, special_occasion, qr_code_hash,
          user_id, vendor_id,
          users(full_name, email),
          venues(id, name, address),
          vendors(vendor_type)
        `)
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 15,
    refetchInterval: 10000,
  });

  const { data: receipt, isLoading: receiptLoading } = useQuery({
    queryKey: ["booking-receipt-data", id],
    queryFn: async () => {
      const { data } = await (supabase.from("receipts") as any)
        .select("*").eq("booking_id", id).maybeSingle();
      return data as any;
    },
    staleTime: 1000 * 10,
    refetchInterval: 8000,
  });

  // ── Reserved balance (what user actually has locked for this booking) ──
  const { data: reservedBalance } = useQuery({
    queryKey: ["booking-reserved-balance", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("ledger_entries") as any)
        .select("direction,amount")
        .eq("account_id", user.id)
        .eq("account_type", "USER_RESERVED")
        .eq("reference_id", id);
      const entries = (data || []) as any[];
      if (!entries.length) return null; // null = fall back to reserved_amount
      return entries.reduce(
        (acc: number, r: any) => r.direction === "CREDIT" ? acc + r.amount : acc - r.amount, 0
      );
    },
    enabled: !!user?.id && !!id,
    staleTime: 1000 * 15,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.from("ledger_entries")
        .select("direction,amount")
        .eq("account_id", user.id)
        .eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce(
        (acc: number, r: any) => r.direction === "CREDIT" ? acc + r.amount : acc - r.amount, 0
      );
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });

  const isCarRental = booking?.vendors?.vendor_type === "car_rental" || !!booking?.pickup_location;

  // ── Confirm payment mutation ───────────────────────────────────────────
  // Correct flow:
  // 1. DEBIT USER_RESERVED (release escrow)
  // 2. If bill < reserved → CREDIT USER_WALLET the difference (refund)
  // 3. CREDIT VENDOR_PENDING (vendor earns, minus 5% platform fee)
  // 4. CREDIT CHILLZ_REVENUE (platform fee)
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !receipt) throw new Error("No receipt to confirm");
      if (!user?.id) throw new Error("You must be logged in to confirm payment");

      const userId      = user.id;
      const billAmount  = receipt.total || booking.reserved_amount;
      const reserved    = booking.reserved_amount;
      const platformFee = Math.round(billAmount * 0.05);
      const vendorPays  = billAmount - platformFee; // vendor gets 95%, user pays full bill

      // How much of the bill is covered by reserved escrow
      const effectiveReserved = Math.min(reservedBalance ?? reserved, billAmount);
      // Any remaining balance above reserved comes from wallet
      const walletDebit = Math.max(0, billAmount - effectiveReserved);
      // Refund if bill < reserved
      const refund = Math.max(0, (reservedBalance ?? reserved) - billAmount);

      if (billAmount > effectiveReserved + (walletBalance || 0)) {
        throw new Error("Insufficient balance to confirm this bill.");
      }

      const txId = crypto.randomUUID();

      const ledgerRows: any[] = [
        // Release reserved escrow
        {
          transaction_id: txId,
          account_id:     userId,
          account_type:   "USER_RESERVED",
          direction:      "DEBIT",
          amount:         effectiveReserved,
          note:           "Escrow released — payment confirmed by guest",
          reference_id:   id,
          reference_type: "booking_complete",
        },
        // Vendor receives their cut
        {
          transaction_id: txId,
          account_id:     booking.vendor_id,
          account_type:   "VENDOR_PENDING",
          direction:      "CREDIT",
          amount:         vendorPays,
          note:           `Guest payment received — ${booking.package_name || booking.venues?.name || "booking"}`,
          reference_id:   id,
          reference_type: "booking_complete",
        },
        // Platform fee
        {
          transaction_id: txId,
          account_id:     "chillz-platform",
          account_type:   "CHILLZ_REVENUE",
          direction:      "CREDIT",
          amount:         platformFee,
          note:           `Platform fee (5%) — booking ${id}`,
          reference_id:   id,
          reference_type: "booking_complete",
        },
      ];

      // Debit wallet for any amount above reserved
      if (walletDebit > 0) {
        ledgerRows.push({
          transaction_id: txId,
          account_id:     userId,
          account_type:   "USER_WALLET",
          direction:      "DEBIT",
          amount:         walletDebit,
          note:           `Wallet top-up for bill overage — ₦${walletDebit.toLocaleString()} above reserved`,
          reference_id:   id,
          reference_type: "booking_complete",
        });
      }

      // Refund wallet if bill < reserved
      if (refund > 0) {
        ledgerRows.push({
          transaction_id: txId,
          account_id:     userId,
          account_type:   "USER_WALLET",
          direction:      "CREDIT",
          amount:         refund,
          note:           `Refund — bill was less than reserved amount`,
          reference_id:   id,
          reference_type: "booking_refund",
        });
      }

      const { error: ledgerError } = await (supabase.from("ledger_entries") as any)
        .insert(ledgerRows);
      if (ledgerError) throw new Error(`Payment failed: ${ledgerError.message}`);

      await (supabase.from("bookings") as any)
        .update({ status: "completed", final_amount: billAmount })
        .eq("id", id);

      await (supabase.from("receipts") as any)
        .update({ status: "confirmed" })
        .eq("booking_id", id);

      await (supabase.from("notifications") as any).insert({
        user_id: booking.vendor_id,
        type:    "payment_confirmed",
        title:   "Payment Confirmed ✓",
        message: `${booking.users?.full_name || "Guest"} confirmed payment of ${formatCurrency(vendorPays)} (after 5% platform fee).${refund > 0 ? ` ${formatCurrency(refund)} was refunded to guest.` : ""}`,
        data:    { booking_id: id },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-receipt", id] });
      qc.invalidateQueries({ queryKey: ["booking-detail", id] });
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["vendor-balance"] });
      qc.invalidateQueries({ queryKey: ["vendor-earnings"] });
      qc.invalidateQueries({ queryKey: ["booking-reserved-balance", id] });

      // Send booking payment confirmation email
      if (user?.email && booking && receipt) {
        const billAmount = receipt.total || booking.reserved_amount;
        const firstName = user.full_name?.split(" ")[0] || "there";
        const venueName = booking.venues?.name || "the venue";
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to: user.email,
            subject: `✅ Payment Confirmed — ${venueName}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F5FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#3D0066,#5B0EA6);border-radius:20px;padding:32px 24px;text-align:center;margin-bottom:16px;">
      <span style="font-size:40px;">🎉</span>
      <h1 style="color:#FFFFFF;font-size:22px;font-weight:900;margin:12px 0 6px;">Payment Confirmed</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">${venueName}</p>
    </div>
    <div style="background:#FFFFFF;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(91,14,166,0.08);">
      <p style="font-size:15px;color:#0A0A0A;margin:0 0 12px;">Hey ${firstName} 👋</p>
      <p style="font-size:14px;color:#6B6B6B;line-height:1.7;margin:0 0 16px;">
        Your payment of <strong style="color:#5B0EA6;">₦${billAmount.toLocaleString()}</strong> to <strong>${venueName}</strong> has been confirmed and released.
      </p>
      <div style="background:#F7F5FA;border-radius:12px;padding:16px;border-left:4px solid #5B0EA6;">
        <p style="font-size:12px;font-weight:700;color:#9E9E9E;text-transform:uppercase;margin:0 0 4px;">Amount Paid</p>
        <p style="font-size:24px;font-weight:900;color:#5B0EA6;margin:0;">₦${billAmount.toLocaleString()}</p>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="https://mychillz.app/bookings" style="display:inline-block;background:linear-gradient(135deg,#5B0EA6,#7B2FBE);color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:14px;font-size:15px;font-weight:700;">
        View My Bookings
      </a>
    </div>
    <p style="text-align:center;font-size:12px;color:#9E9E9E;margin:0;">
      Thank you for using Chillz.<br/>
      <a href="https://mychillz.app" style="color:#5B0EA6;">mychillz.app</a>
    </p>
  </div>
</body>
</html>
            `,
          }),
        }).catch(() => {}); // fire and forget
      }

      router.push(`/review/${id}`);
    },
    onError: (e: any) => console.error("Confirm failed:", e.message || e),
  });

  // ── Dispute / reject receipt mutation ─────────────────────────────────
  // Tracks rejection count on receipt. After 3 rejections → auto-dispute.
  // Manual dispute always available.
  const disputeMutation = useMutation({
    mutationFn: async (isManual: boolean = false) => {
      if (!booking || !receipt) throw new Error("No receipt to dispute");

      const currentRejections = receipt.rejection_count || 0;
      const newRejections     = isManual ? currentRejections : currentRejections + 1;
      const autoDispute       = !isManual && newRejections >= 3;
      const forceDispute      = isManual || autoDispute;

      // Update rejection count on receipt
      await (supabase.from("receipts") as any)
        .update({
          rejection_count: newRejections,
          status: forceDispute ? "disputed" : "sent",
        })
        .eq("booking_id", id);

      if (forceDispute) {
        // Escalate to dispute
        await (supabase.from("bookings") as any)
          .update({ status: "disputed" })
          .eq("id", id);

        const reason = isManual
          ? "Guest manually raised a dispute on the receipt."
          : `Receipt automatically disputed after ${newRejections} rejections.`;

        await (supabase.from("dispute_messages") as any).insert({
          booking_id:  id,
          sender_id:   user?.id || null,
          sender_role: "user",
          message:     reason,
          attachments: [],
        });

        await (supabase.from("notifications") as any).insert({
          user_id: booking.vendor_id,
          type:    "booking_disputed",
          title:   "Receipt Disputed",
          body:    `${booking.users?.full_name || "Guest"} has disputed the receipt.${isManual ? "" : ` (After ${newRejections} rejections)`}`,
          data:    { booking_id: id },
        });
      } else {
        // Reset booking to checked_in so vendor can bill again
        await (supabase.from("bookings") as any)
          .update({ status: "checked_in" })
          .eq("id", id);

        // Reset receipt to draft so user sees running tab, not receipt banner
        await (supabase.from("receipts") as any)
          .update({ status: "draft" })
          .eq("booking_id", id);

        // Notify vendor to resend
        await (supabase.from("notifications") as any).insert({
          user_id: booking.vendor_id,
          type:    "receipt_rejected",
          title:   "Receipt Rejected — Please Resend",
          body:    `${booking.users?.full_name || "Guest"} rejected the receipt. Rejection ${newRejections} of 3. Edit and resend from your Bookings page.`,
          data:    { booking_id: id },
        });
      }

      return { forceDispute, newRejections };
    },
    onSuccess: ({ forceDispute }) => {
      qc.invalidateQueries({ queryKey: ["booking-receipt", id] });
      qc.invalidateQueries({ queryKey: ["booking-receipt-data", id] });
      qc.invalidateQueries({ queryKey: ["booking-detail", id] });
      if (forceDispute) {
        router.push(`/bookings/${id}/dispute`);
      }
    },
    onError: (e: any) => console.error("Dispute failed:", e.message || e),
  });

  const isLoading  = bookingLoading || receiptLoading;
  const isDraft    = !receipt || receipt.status === "draft";
  const isSent     = booking?.status === "receipt_sent";
  const isComplete = booking?.status === "completed";
  const isDisputed = booking?.status === "disputed";

  const rejectionCount  = receipt?.rejection_count || 0;
  const rejectionsLeft  = Math.max(0, 3 - rejectionCount);
  const onLastRejection = rejectionCount >= 2; // next rejection = auto-dispute

  // Synthesize line items
  const roomLineItem = booking?.package_name ? {
    id:       "room-charge",
    name:     booking.package_name,
    price:    booking.package_price
      ?? (booking.reserved_amount
        ? Math.round(booking.reserved_amount / ((booking.num_nights || 1) * (booking.num_rooms || 1)))
        : 0),
    quantity: (booking.num_nights || 1) * (booking.num_rooms || 1),
  } : null;

  const receiptItems: any[] = receipt?.items?.length
    ? receipt.items
    : (roomLineItem && roomLineItem.price > 0 ? [roomLineItem] : []);

  const subtotal   = receipt?.subtotal || booking?.reserved_amount || 0;
  const platform   = receipt?.platform_fee || 0;
  const total      = receipt?.total || subtotal;
  const reserved   = booking?.reserved_amount || 0;
  const refundAmt  = Math.max(0, reserved - total);

  // For the confirm button: check against reserved balance not wallet
  // The money is already locked in USER_RESERVED so no wallet deduction needed
  // If no USER_RESERVED entries exist (old bookings before trigger fix),
  // fall back to reserved_amount from the booking row itself
  const effectiveReserved = reservedBalance ?? reserved;
  const totalAvailable    = (effectiveReserved || 0) + (walletBalance || 0);
  const canConfirm        = isSent && total <= totalAvailable;
  const needsTopUp        = isSent && total > totalAvailable;

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!booking) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Booking not found.</p>
        <button onClick={() => router.back()}
          style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", backgroundColor: "#F7F5FA", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, padding: "16px 16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} style={{ color: "#FFFFFF" }} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              {isSent ? "Your Receipt" : isDraft ? "Running Tab" : isDisputed ? "Disputed Receipt" : "Receipt"}
            </h1>
          </div>

          <div style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: "14px" }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px" }}>
              {booking.venues?.name || "Your Booking"}
            </p>
            {booking.package_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <Building2 size={11} style={{ color: "rgba(255,255,255,0.7)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{booking.package_name}</span>
              </div>
            )}
            {booking.checkin_date && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={11} style={{ color: "rgba(255,255,255,0.7)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {format(parseISO(booking.checkin_date), "dd MMM")}
                  {booking.checkout_date ? ` → ${format(parseISO(booking.checkout_date), "dd MMM yyyy")}` : ""}
                  {booking.num_nights ? ` · ${booking.num_nights} ${isCarRental ? "day" : "night"}${booking.num_nights !== 1 ? "s" : ""}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "16px" }}>

          {/* Status banners */}
          {isDraft && !isComplete && !isDisputed && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#F59E0B", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>Tab in Progress</p>
                <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>The vendor is building your bill. This updates live.</p>
              </div>
            </motion.div>
          )}

          {isSent && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: ACCENT_BG, border: `1px solid ${ACCENT}33`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Receipt size={18} style={{ color: ACCENT, flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: ACCENT, margin: "0 0 2px" }}>Receipt Ready</p>
                <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>
                  Review your bill and confirm to release payment.
                  {rejectionCount > 0 && ` You have ${rejectionsLeft} rejection${rejectionsLeft !== 1 ? "s" : ""} left before auto-dispute.`}
                </p>
              </div>
            </motion.div>
          )}

          {isComplete && (
            <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle size={18} style={{ color: "#059669", flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#059669", margin: "0 0 2px" }}>Payment Confirmed — Thank you!</p>
                {refundAmt > 0 && (
                  <p style={{ fontSize: 11, color: "#059669", margin: 0 }}>
                    {formatCurrency(refundAmt)} was refunded to your wallet.
                  </p>
                )}
              </div>
            </div>
          )}

          {isDisputed && (
            <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <AlertCircle size={18} style={{ color: "#D97706", flexShrink: 0 }} />
                <p style={{ fontWeight: 700, fontSize: 13, color: "#D97706", margin: 0 }}>Dispute In Progress</p>
              </div>
              <p style={{ fontSize: 12, color: "#92400E", margin: "0 0 10px", lineHeight: 1.5 }}>
                Chillz support is reviewing. Resolution within 8 hours.
              </p>
              <button onClick={() => router.push(`/bookings/${id}/dispute`)}
                style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1.5px solid #FDE68A", backgroundColor: "#FFFFFF", color: "#D97706", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MessageCircle size={14} />Open Dispute Thread
              </button>
            </div>
          )}

          {/* Refund notice — when bill < reserved */}
          {isSent && refundAmt > 0 && (
            <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle size={14} style={{ color: "#059669", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#059669", margin: 0, fontWeight: 600 }}>
                {formatCurrency(refundAmt)} will be refunded to your wallet on confirmation (bill is less than your reservation).
              </p>
            </div>
          )}

          {/* Receipt items */}
          {receiptItems.length > 0 ? (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8", marginBottom: 16 }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #F2EEF9" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                  {isDraft ? "Current Tab" : "Bill Items"}
                </p>
              </div>
              {receiptItems.map((item: any, i: number) => {
                // Support both qty (order_items) and quantity (bill sheet items)
                const qty      = item.qty || item.quantity || 1;
                const price    = item.price || 0;
                const lineTotal = item.subtotal || price * qty;
                return (
                  <div key={item.id || i}
                    style={{ padding: "12px 16px", borderBottom: i < receiptItems.length - 1 ? "1px solid #F2EEF9" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                        {formatCurrency(price)} × {qty}
                      </p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>
                );
              })}

              <div style={{ backgroundColor: "#F7F5FA", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#6B6B6B" }}>Subtotal</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatCurrency(subtotal)}</span>
                </div>
                
                {refundAmt > 0 && isSent && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#059669" }}>Refund to wallet</span>
                    <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>+{formatCurrency(refundAmt)}</span>
                  </div>
                )}
                <div style={{ height: 1, backgroundColor: "#E4DCF0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: ACCENT, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {receipt?.notes && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid #F2EEF9", backgroundColor: "#FFFBEB" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#92400E", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Note from vendor</p>
                  <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>{receipt.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "32px 16px", textAlign: "center", marginBottom: 16, border: "1px solid #F0EBF8" }}>
              <Receipt size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: "#9E9E9E", margin: "0 0 4px" }}>
                {isDraft ? "No items added yet" : "No receipt data"}
              </p>
              <p style={{ fontSize: 12, color: "#C4BAD8", margin: 0 }}>
                {isDraft ? "The vendor will add items as you use services" : ""}
              </p>
            </div>
          )}

          {/* Reserved balance info */}
          {isSent && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: "1px solid #F0EBF8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>Reserved for this booking</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{formatCurrency(reserved)}</span>
              </div>
              {total > reserved && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#D97706" }}>Extra from wallet</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#D97706" }}>-{formatCurrency(total - reserved)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Wallet balance after</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6B6B6B" }}>{formatCurrency(Math.max(0, (walletBalance || 0) - Math.max(0, total - reserved)))}</span>
              </div>
            </div>
          )}

          {/* Top-up warning — only if bill somehow exceeds reserved AND wallet */}
          {needsTopUp && (
            <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                This bill exceeds your reserved and wallet balance. Please{" "}
                <button onClick={() => router.push("/wallet")}
                  style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
                  fund your wallet →
                </button>
              </p>
            </div>
          )}

          <AnimatePresence>
            {(confirmMutation.isError || disputeMutation.isError) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
                <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>
                  {((confirmMutation.error || disputeMutation.error) as Error)?.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {isSent && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Confirm button */}
              <button
                onClick={() => {
                  if (!user?.id) { router.push(`/login?redirect=/bookings/${id}/receipt`); return; }
                  confirmMutation.mutate();
                }}
                disabled={confirmMutation.isPending || !canConfirm || needsTopUp || !user?.id}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: confirmMutation.isPending || !canConfirm || needsTopUp ? "#9E9E9E" : `linear-gradient(135deg,#3B0764,${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: confirmMutation.isPending || !canConfirm || needsTopUp ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: canConfirm && !needsTopUp ? "0 4px 20px rgba(91,14,166,0.35)" : "none" }}>
                {confirmMutation.isPending
                  ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Confirming...</>
                  : <><CheckCircle size={18} />Confirm & Pay {formatCurrency(total)}</>}
              </button>

              {/* Reject / dispute button */}
              <button
                onClick={() => disputeMutation.mutate(false)}
                disabled={disputeMutation.isPending || confirmMutation.isPending}
                style={{ width: "100%", padding: "13px 0", borderRadius: 16, border: `1.5px solid ${onLastRejection ? "#FDE68A" : "#FECACA"}`, backgroundColor: onLastRejection ? "#FFFBEB" : "#FEF2F2", color: onLastRejection ? "#D97706" : "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {disputeMutation.isPending
                  ? "Processing..."
                  : onLastRejection
                  ? <><AlertCircle size={16} />Reject & Dispute (final rejection)</>
                  : <><X size={16} />Reject Bill{rejectionCount > 0 ? ` (${rejectionsLeft} left)` : ""}</>}
              </button>

              {/* Manual dispute — always available */}
              <button
                onClick={() => disputeMutation.mutate(true)}
                disabled={disputeMutation.isPending || confirmMutation.isPending}
                style={{ width: "100%", padding: "11px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MessageCircle size={14} />Report an Issue Instead
              </button>

              <p style={{ fontSize: 11, color: "#9E9E9E", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
                Confirming releases payment from your reserved balance.
                {rejectionsLeft > 0 && ` You can reject up to ${rejectionsLeft} more time${rejectionsLeft !== 1 ? "s" : ""} before auto-dispute.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </MainLayout>
  );
}