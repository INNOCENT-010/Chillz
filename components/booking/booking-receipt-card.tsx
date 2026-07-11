/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

export function BookingReceiptCard({ receipt, heroName, surplus, isOverspend, isUnderspend, rejectCount, onConfirm, onReject }: {
  receipt: any;
  heroName: string;
  surplus: number;
  isOverspend: boolean;
  isUnderspend: boolean;
  rejectCount: number;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
      <div style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ backgroundColor: "#F59E0B", padding: "12px 16px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Receipt from {heroName}
          </p>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {(receipt.line_items || []).map((item: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{item.name}</span>
                  {item.qty > 1 && <span style={{ fontSize: 11, color: "#9E9E9E" }}> × {item.qty}</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(item.amount * item.qty)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px dashed #FDE68A", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {formatCurrency(receipt.total)}
              </span>
            </div>
          </div>

          {isOverspend && (
            <div style={{ marginTop: 10, backgroundColor: "#FEF2F2", borderRadius: 10, padding: "8px 12px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#EF4444", margin: 0 }}>
                Receipt is {formatCurrency(surplus)} more than your reserved amount. Extra will be deducted from your wallet.
              </p>
            </div>
          )}
          {isUnderspend && (
            <div style={{ marginTop: 10, backgroundColor: "#E0F7EA", borderRadius: 10, padding: "8px 12px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#00C853", margin: 0 }}>
                Receipt is {formatCurrency(Math.abs(surplus))} less than reserved — {formatCurrency(Math.abs(surplus))} will be refunded to your wallet.
              </p>
            </div>
          )}

          {rejectCount > 0 && (
            <div style={{ marginTop: 10, backgroundColor: "#FEF2F2", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{rejectCount}/3 rejections — dispute opens at 3</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={onReject}
              style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <XCircle size={15} />Reject
            </button>
            <button onClick={onConfirm}
              style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
              <CheckCircle size={15} />Confirm & Pay
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}