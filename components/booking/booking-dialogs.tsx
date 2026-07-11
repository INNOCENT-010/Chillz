/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cardTopupAndComplete } from "@/lib/ledger";
import { useQueryClient } from "@tanstack/react-query";

export function ConfirmDialog({ show, onClose, onConfirm, isPending, isError, errMsg,
  heroName, receiptTotal, reservedAmount, surplus, isOverspend, isUnderspend,
  booking, receipt, bookingId,
}: {
  show: boolean; onClose: () => void; onConfirm: () => void; isPending: boolean;
  isError: boolean; errMsg: string; heroName: string; receiptTotal: number;
  reservedAmount: number; surplus: number; isOverspend: boolean; isUnderspend: boolean;
  booking: any; receipt: any; bookingId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const isInsufficientFunds = errMsg.startsWith("INSUFFICIENT:");
  const parts = isInsufficientFunds ? errMsg.split(":") : [];
  const surplusNeeded = isInsufficientFunds ? Number(parts[1]) : 0;
  const currentBalance = isInsufficientFunds ? Number(parts[2]) : 0;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: isOverspend ? "#FFF8E1" : "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <CheckCircle size={28} style={{ color: isOverspend ? "#F59E0B" : "#00C853" }} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {isOverspend ? "Additional Payment Required" : "Confirm Receipt"}
              </h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                {isOverspend ? `The receipt is ${formatCurrency(surplus)} more than your reserved amount.` : `This will complete your booking at ${heroName}.`}
              </p>
            </div>

            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #F2EEF9", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Reserved</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(reservedAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #F2EEF9", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Receipt total</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(receiptTotal)}</span>
              </div>
              {isOverspend && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #F2EEF9", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#EF4444" }}>Extra from wallet</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>+ {formatCurrency(surplus)}</span>
                </div>
              )}
              {isUnderspend && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #F2EEF9", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#00C853" }}>Wallet refund</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#00C853" }}>+ {formatCurrency(Math.abs(surplus))}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A" }}>You pay</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(receiptTotal)}</span>
              </div>
            </div>

            {isOverspend && !isInsufficientFunds && (
              <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: "#92400E", margin: "0 0 8px" }}>
                  {formatCurrency(surplus)} will be deducted from your wallet on confirmation.
                </p>
                <button onClick={() => { onClose(); router.push("/wallet"); }}
                  style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "1.5px solid #FDE68A", backgroundColor: "#FFFFFF", color: "#D97706", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Fund Wallet First
                </button>
              </div>
            )}

            {isInsufficientFunds && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                <p style={{ color: "#EF4444", fontSize: 12, fontWeight: 700, margin: "0 0 2px" }}>Insufficient wallet balance</p>
                <p style={{ color: "#EF4444", fontSize: 11, margin: "0 0 10px" }}>
                  You need {formatCurrency(surplusNeeded)} but only have {formatCurrency(currentBalance)}.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { onClose(); router.push("/wallet"); }}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Fund Wallet
                  </button>
                  <button
                    onClick={() => {
                      if (!(window as any).PaystackPop) return;
                      (window as any).PaystackPop.setup({
                        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
                        email: booking.users?.email || "",
                        amount: surplusNeeded * 100,
                        currency: "NGN",
                        ref: `CHILLZ-TOPUP-${Date.now()}`,
                        callback: async (response: any) => {
                          await cardTopupAndComplete(
                            booking.user_id, booking.vendor_id, bookingId,
                            receipt!.total, booking.reserved_amount,
                            surplusNeeded, response.reference
                          );
                          qc.invalidateQueries({ queryKey: ["booking", bookingId] });
                          qc.invalidateQueries({ queryKey: ["bookings"] });
                          onClose();
                        },
                        onClose: () => {},
                      }).openIframe();
                    }}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1.5px solid #FECACA", backgroundColor: "#FFFFFF", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Pay with Card
                  </button>
                </div>
              </div>
            )}

            {isError && !isInsufficientFunds && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{errMsg}</p>
              </div>
            )}

            <button onClick={onConfirm} disabled={isPending}
              style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {isPending
                ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                : <><CheckCircle size={18} />{isOverspend ? `Pay ${formatCurrency(receiptTotal)}` : "Confirm & Release Payment"}</>}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function RejectDialog({ show, onClose, onReject, isPending, rejectCount }: {
  show: boolean; onClose: () => void; onReject: () => void;
  isPending: boolean; rejectCount: number;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <XCircle size={28} style={{ color: "#EF4444" }} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 6px" }}>Reject Receipt</h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                The vendor will be notified and can send a corrected receipt.
                {rejectCount >= 2 && " This is your final rejection before dispute."}
              </p>
            </div>
            {rejectCount >= 2 && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>After this rejection, Chillz support will automatically intervene.</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={onReject} disabled={isPending}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {isPending
                  ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                  : <><XCircle size={14} />Reject</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CancelDialog({ show, onClose, onCancel, isPending, isError, errMsg, reservedAmount }: {
  show: boolean; onClose: () => void; onCancel: () => void;
  isPending: boolean; isError: boolean; errMsg: string; reservedAmount: number;
}) {
  const { formatCurrency } = require("@/lib/utils");
  const cancellationFee = Math.round(reservedAmount * 0.05);
  const refundAmount = reservedAmount - cancellationFee;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <X size={28} style={{ color: "#EF4444" }} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Cancel Booking?</h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>A 5% cancellation fee applies.</p>
            </div>
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>Reserved amount</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(reservedAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#EF4444" }}>Cancellation fee (5%)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>− {formatCurrency(cancellationFee)}</span>
              </div>
              <div style={{ borderTop: "1px dashed #E4DCF0", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Refund to wallet</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#00C853", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(refundAmount)}</span>
              </div>
            </div>
            <AnimatePresence>
              {isError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{errMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Keep Booking
              </button>
              <button onClick={onCancel} disabled={isPending}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {isPending
                  ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                  : <><X size={14} />Yes, Cancel</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}