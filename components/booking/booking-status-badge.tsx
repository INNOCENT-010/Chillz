import { formatCurrency } from "@/lib/utils";

export const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  confirmed:    { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed"    },
  checked_in:   { bg: "#E0F7EA", color: "#00C853", label: "Checked In"   },
  completed:    { bg: "#E0F7EA", color: "#00C853", label: "Completed"    },
  receipt_sent: { bg: "#FFF8E1", color: "#F59E0B", label: "Receipt Sent" },
  disputed:     { bg: "#FEF3C7", color: "#D97706", label: "Disputed"     },
  cancelled:    { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled"    },
  pending:      { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending"      },
};

export function BookingStatusBadge({ status, reservedAmount, finalAmount, receiptSubtotal }: {
  status: string;
  reservedAmount: number;
  finalAmount?: number;
  receiptSubtotal?: number;
}) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;

  // Source of truth priority: receipt.subtotal > final_amount > reserved_amount
  const displayAmount = status === "completed"
    ? (receiptSubtotal ?? finalAmount ?? reservedAmount)
    : reservedAmount;

  const showReservedNote = status === "completed" && displayAmount !== reservedAmount;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: s.bg, borderRadius: 999, padding: "6px 14px" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</span>
      </div>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          {formatCurrency(displayAmount)}
        </span>
        {showReservedNote && (
          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "2px 0 0", textAlign: "right" }}>
            reserved {formatCurrency(reservedAmount)}
          </p>
        )}
      </div>
    </div>
  );
}