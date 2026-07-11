/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function BookingCompletedReceipt({ bookingId, reservedAmount }: {
  bookingId: string;
  reservedAmount: number;
}) {
  const { data: receipt } = useQuery({
    queryKey: ["confirmed-receipt", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("receipts")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Source of truth: receipts.subtotal is what the vendor charged
  // reservedAmount is what was held — difference was taken from wallet
  const actualPaid = receipt?.subtotal ?? reservedAmount;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Completed banner */}
      <div style={{ backgroundColor: "#E0F7EA", border: "1.5px solid #A7F3D0", borderRadius: 16, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10 }}>
        <CheckCircle size={18} style={{ color: "#00C853", flexShrink: 0 }} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 3px" }}>Booking Completed</p>
          <p style={{ fontSize: 12, color: "#047857", margin: 0 }}>
            {formatCurrency(actualPaid)} paid. Thank you for using Chillz!
          </p>
        </div>
      </div>

      {receipt && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 10px rgba(91,14,166,0.07)" }}>
          <div style={{ backgroundColor: "#5B0EA6", padding: "12px 16px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Confirmed Receipt
            </p>
          </div>
          <div style={{ padding: "14px 16px" }}>

            {/* Line items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
              {(receipt.line_items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < receipt.line_items.length - 1 ? "1px solid #F7F5FA" : "none" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{item.name}</span>
                    {item.qty > 1 && <span style={{ fontSize: 11, color: "#9E9E9E" }}> × {item.qty}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                    {formatCurrency(item.amount * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ borderTop: "1px dashed #E4DCF0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Subtotal</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>
                  {formatCurrency(receipt.subtotal)}
                </span>
              </div>

              {/* How it was paid breakdown */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>From reservation</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>
                  {formatCurrency(reservedAmount)}
                </span>
              </div>

              {actualPaid > reservedAmount && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>From wallet</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>
                    {formatCurrency(actualPaid - reservedAmount)}
                  </span>
                </div>
              )}

              {actualPaid < reservedAmount && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#00C853" }}>Wallet refund</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#00C853" }}>
                    + {formatCurrency(reservedAmount - actualPaid)}
                  </span>
                </div>
              )}

              {/* Total paid — source of truth from receipt */}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #F7F5FA" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A" }}>Total Paid</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(actualPaid)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}