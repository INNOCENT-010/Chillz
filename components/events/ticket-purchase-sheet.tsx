/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Ticket, Wallet, CreditCard, CheckCircle,
  AlertCircle, Plus, Minus, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface TicketType {
  id?: string;
  name: string;
  price: number;
  slots?: number;
  capacity?: number;
  available?: number;
  sold?: number;
  description?: string;
  classification?: string;
}

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  ticket_price?: number;
  ticket_types?: TicketType[];
  capacity?: number;
  tickets_sold?: number;
  vendor_id: string;
  images?: string[];
  address?: string;
  custom_venue_address?: string;
  venues?: { name: string; address: string };
}

interface Props {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketId: string) => void;
  navigateOnSuccess?: boolean; // if true, router.push to /tickets/[id]
}

const CLASSIFICATION_STYLES: Record<string, { color: string; bg: string }> = {
  regular:    { color: "#6B6B6B", bg: "#F2EEF9" },
  vip:        { color: "#5B0EA6", bg: "#EDE0F7" },
  vvip:       { color: "#E07B00", bg: "#FFF3E0" },
  early_bird: { color: "#00C853", bg: "#E0F7EA" },
  table:      { color: "#2563EB", bg: "#EFF6FF" },
  student:    { color: "#7B2FBE", bg: "#F3E8FF" },
};

function generateTicketHash(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase() +
    Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function TicketPurchaseSheet({ event, isOpen, onClose, onSuccess, navigateOnSuccess = false }: Props) {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const hasTicketTypes = (event.ticket_types?.length || 0) > 0;
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(
    hasTicketTypes ? event.ticket_types![0] : null
  );
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");
  const [bookingError, setBookingError] = useState("");
  const [succeeded, setSucceeded] = useState(false);

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.from("ledger_entries").select("direction, amount")
        .eq("account_id", user.id).eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce(
        (acc: number, row: any) => row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0
      );
    },
    enabled: !!user?.id && isOpen,
    staleTime: 1000 * 15,
  });

  const ticketPrice = selectedTicket?.price ?? event.ticket_price ?? 0;
  const isFree = ticketPrice === 0;
  const totalCost = ticketPrice * qty;
  const isSoldOut = event.capacity && (event.tickets_sold || 0) >= event.capacity;
  const insufficientBalance = !isFree && paymentMethod === "wallet" && (walletBalance || 0) < totalCost;

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to purchase tickets");
      if (!isFree && totalCost > (walletBalance || 0) && paymentMethod === "wallet")
        throw new Error("Insufficient wallet balance");

      const txId = crypto.randomUUID();

      // Deduct wallet if paid
      if (!isFree && paymentMethod === "wallet") {
        const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert([
          {
            transaction_id: txId,
            account_type: "USER_WALLET",
            account_id: user.id,
            direction: "DEBIT",
            amount: totalCost,
            note: `Ticket: ${event.title}`,
            reference_id: event.id,
            reference_type: "ticket_purchase",
          },
          {
            transaction_id: txId,
            account_type: "VENDOR_PENDING",
            account_id: event.vendor_id,
            direction: "CREDIT",
            amount: Math.round(totalCost * 0.95),
            note: `Ticket sale: ${event.title}`,
            reference_id: event.id,
            reference_type: "ticket_sale",
          },
        ]);
        if (ledgerError) throw ledgerError;
      }

      // Insert tickets
      // In purchaseMutation.mutationFn, replace ticketInserts:
const ticketInserts = Array.from({ length: qty }).map(() => ({
  event_id: event.id,
  user_id: user.id,
  vendor_id: event.vendor_id,
  amount_paid: ticketPrice,
  qr_code_hash: generateTicketHash(),
  status: "active",
  ticket_type_name: selectedTicket?.name || null,
  ticket_type_classification: selectedTicket?.classification || null,
  qty: qty,
}));
      const { data: tickets, error: ticketError } = await (supabase.from("tickets") as any)
        .insert(ticketInserts)
        .select();
      if (ticketError) throw ticketError;

      // Update tickets_sold
      await (supabase.from("events") as any).update({
        tickets_sold: (event.tickets_sold || 0) + qty,
      }).eq("id", event.id);

      // Update ticket type availability
      if (selectedTicket && event.ticket_types) {
        const updatedTypes = event.ticket_types.map((t: TicketType) =>
          (t.id === selectedTicket.id || t.name === selectedTicket.name) && t.available !== undefined
            ? { ...t, available: Math.max(0, t.available - qty), sold: (t.sold || 0) + qty }
            : t
        );
        await (supabase.from("events") as any).update({ ticket_types: updatedTypes }).eq("id", event.id);
      }

      // Notify vendor
      await (supabase.from("notifications") as any).insert({
        user_id: event.vendor_id,
        title: `${qty} ticket${qty > 1 ? "s" : ""} sold 🎟️`,
        body: `${formatCurrency(totalCost)} from ${event.title}`,
        type: "ticket",
        reference_id: event.id,
        is_read: false,
      });

      return tickets?.[0];
    },
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      qc.invalidateQueries({ queryKey: ["user-ticket", event.id] });
      qc.invalidateQueries({ queryKey: ["event", event.id] });
      setSucceeded(true);

      setTimeout(() => {
        setSucceeded(false);
        onClose();
        if (navigateOnSuccess && ticket?.id) {
          router.push(`/tickets/${ticket.id}`);
        } else if (onSuccess && ticket?.id) {
          onSuccess(ticket.id);
        }
      }, 1800);
    },
    onError: (e: any) => setBookingError(e.message),
  });

  const handlePaystack = () => {
    if (!user?.email) { setBookingError("Please sign in"); return; }
    if (!(window as any).PaystackPop) { setBookingError("Payment loading, please try again"); return; }
    const handler = (window as any).PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: totalCost * 100,
      currency: "NGN",
      ref: `CHILLZ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      callback: async () => {
        // After Paystack payment, create tickets without wallet debit
        const ticketInserts = Array.from({ length: qty }).map(() => ({
          event_id: event.id,
          user_id: user.id,
          vendor_id: event.vendor_id,
          amount_paid: ticketPrice,
          qr_code_hash: generateTicketHash(),
          status: "active",
        }));
        const { data: tickets } = await (supabase.from("tickets") as any).insert(ticketInserts).select();
        await (supabase.from("events") as any).update({ tickets_sold: (event.tickets_sold || 0) + qty,
      }).eq("id", event.id);
        qc.invalidateQueries({ queryKey: ["wallet-quick"] });
        setSucceeded(true);
        setTimeout(() => {
          setSucceeded(false);
          onClose();
          if (navigateOnSuccess && tickets?.[0]?.id) router.push(`/tickets/${tickets[0].id}`);
          else if (onSuccess && tickets?.[0]?.id) onSuccess(tickets[0].id);
        }, 1800);
      },
      onClose: () => {},
    });
    handler.openIframe();
  };

  const handleConfirm = () => {
    setBookingError("");
    if (!user) { router.push("/login"); return; }
    if (isFree || paymentMethod === "wallet") {
      purchaseMutation.mutate();
    } else {
      handlePaystack();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 80 }} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 81, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

            {/* Success overlay */}
            <AnimatePresence>
              {succeeded && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: "absolute", inset: 0, borderRadius: "24px 24px 0 0", backgroundColor: "#FFFFFF", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle size={40} style={{ color: "#00C853" }} />
                  </motion.div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    Ticket Confirmed!
                  </p>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                    {isFree ? "You're on the list" : `${formatCurrency(totalCost)} paid`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {event.title}
                  </h3>
                  <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                    {format(new Date(event.start_date), "EEE dd MMM · HH:mm")}
                  </p>
                </div>
                <button onClick={onClose}
                  style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <X size={16} style={{ color: "#6B6B6B" }} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>

                {/* Sold out */}
                {isSoldOut ? (
                  <div style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "16px", textAlign: "center" }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#EF4444", margin: 0 }}>Sold Out</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: "4px 0 0" }}>No tickets remaining for this event.</p>
                  </div>
                ) : (
                  <>
                    {/* Ticket type selector */}
                    {hasTicketTypes && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                          Select Ticket
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {event.ticket_types!.map((ticket, idx) => {
                            const cls = CLASSIFICATION_STYLES[ticket.classification || "regular"] || CLASSIFICATION_STYLES.regular;
                            const soldOut = ticket.available !== undefined && ticket.available <= 0;
                            const isSelected = selectedTicket?.name === ticket.name;
                            return (
                              <button key={idx}
                                onClick={() => { if (!soldOut) { setSelectedTicket(ticket); setQty(1); } }}
                                disabled={soldOut}
                                style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `2px solid ${isSelected ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isSelected ? "#F9F5FF" : "#FFFFFF", cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.5 : 1, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A" }}>{ticket.name}</span>
                                    {ticket.classification && (
                                      <span style={{ fontSize: 9, fontWeight: 700, color: cls.color, backgroundColor: cls.bg, padding: "1px 6px", borderRadius: 999, textTransform: "uppercase" }}>
                                        {ticket.classification.replace(/_/g, " ")}
                                      </span>
                                    )}
                                  </div>
                                  {ticket.description && (
                                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{ticket.description}</p>
                                  )}
                                  <p style={{ fontSize: 10, fontWeight: 600, color: soldOut ? "#EF4444" : "#9E9E9E", margin: "2px 0 0" }}>
                                    {soldOut ? "Sold out" : ticket.available !== undefined ? `${ticket.available} left` : "Available"}
                                  </p>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <p style={{ fontSize: 15, fontWeight: 900, color: isSelected ? "#5B0EA6" : "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                                    {ticket.price === 0 ? "Free" : formatCurrency(ticket.price)}
                                  </p>
                                  {isSelected && <CheckCircle size={14} style={{ color: "#5B0EA6", marginTop: 4 }} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Qty picker — only for paid events */}
                    {!isFree && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                          Quantity
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 16px" }}>
                          <button onClick={() => setQty(Math.max(1, qty - 1))}
                            style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Minus size={16} style={{ color: "#5B0EA6" }} />
                          </button>
                          <span style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 900, color: "#0A0A0A", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {qty}
                          </span>
                          <button onClick={() => {
                            const max = selectedTicket?.available ?? 10;
                            setQty(Math.min(max, qty + 1));
                          }}
                            style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Plus size={16} style={{ color: "#5B0EA6" }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Order summary */}
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: isFree ? 0 : 6 }}>
                        <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                          {selectedTicket?.name || "General Admission"} {!isFree && `× ${qty}`}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                          {isFree ? "Free" : formatCurrency(totalCost)}
                        </span>
                      </div>
                      {!isFree && (
                        <div style={{ borderTop: "1px solid #E4DCF0", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {formatCurrency(totalCost)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Payment method — paid only */}
                    {!isFree && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                          Pay With
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                          {[
                            { key: "wallet" as const, icon: Wallet, label: "Wallet", sub: formatCurrency(walletBalance || 0), warn: (walletBalance || 0) < totalCost },
                            { key: "card" as const, icon: CreditCard, label: "Card", sub: "Paystack", warn: false },
                          ].map(({ key, icon: Icon, label, sub, warn }) => (
                            <button key={key} onClick={() => setPaymentMethod(key)}
                              style={{ flex: 1, padding: "11px 8px", borderRadius: 14, border: `2px solid ${paymentMethod === key ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: paymentMethod === key ? "#F9F5FF" : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                              <Icon size={18} style={{ color: paymentMethod === key ? "#5B0EA6" : "#9E9E9E" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: paymentMethod === key ? "#5B0EA6" : "#6B6B6B" }}>{label}</span>
                              <span style={{ fontSize: 10, color: warn ? "#EF4444" : "#9E9E9E", fontWeight: 600 }}>{sub}</span>
                              {warn && key === "wallet" && (
                                <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 700 }}>Insufficient</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Insufficient balance warning */}
                    {insufficientBalance && (
                      <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                            Need {formatCurrency(totalCost - (walletBalance || 0))} more
                          </p>
                        </div>
                        <button
                          onClick={() => { onClose(); router.push("/wallet"); }}
                          style={{ backgroundColor: "#F59E0B", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          Fund Wallet
                        </button>
                      </div>
                    )}

                    {/* Error */}
                    {bookingError && (
                      <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                        <p style={{ color: "#EF4444", fontSize: 12, margin: 0 }}>{bookingError}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Confirm button */}
            {!isSoldOut && (
              <div style={{ padding: "12px 20px 44px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                <button
                  onClick={handleConfirm}
                  disabled={purchaseMutation.isPending || (insufficientBalance && paymentMethod === "wallet")}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: purchaseMutation.isPending || (insufficientBalance && paymentMethod === "wallet") ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: purchaseMutation.isPending || (insufficientBalance && paymentMethod === "wallet") ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(91,14,166,0.35)" }}>
                  {purchaseMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                    : isFree
                      ? <><Ticket size={17} />Claim Free Ticket</>
                      : paymentMethod === "wallet"
                        ? <><Wallet size={17} />Pay {formatCurrency(totalCost)}</>
                        : <><CreditCard size={17} />Pay {formatCurrency(totalCost)} with Card</>}
                </button>
              </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}