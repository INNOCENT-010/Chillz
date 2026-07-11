/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, TrendingUp, CheckCircle, Wallet, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function VendorEarningsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"bookings" | "tickets">("bookings");

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id, vendor_type").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  // Default event_organizer to tickets tab
  useEffect(() => {
    if (vendor?.vendor_type === "event_organizer") setActiveTab("tickets");
  }, [vendor?.vendor_type]);

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["vendor-earnings-bookings", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select("id, created_at, reserved_amount, final_amount, users(full_name), receipts(subtotal, total, platform_fee, confirmed_at)")
        .eq("vendor_id", vendor!.id).eq("status", "completed")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id && vendor?.vendor_type !== "event_organizer",
    staleTime: 0,
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["vendor-earnings-tickets", vendor?.id],
    queryFn: async () => {
      const { data: ticketsData } = await (supabase.from("tickets") as any)
        .select("id, created_at, amount_paid, user_id, event_id, ticket_type_name, qty, status")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      if (!ticketsData?.length) return [];

      const userIds  = [...new Set(ticketsData.map((t: any) => t.user_id))];
      const eventIds = [...new Set(ticketsData.map((t: any) => t.event_id).filter(Boolean))];
      const { data: users }      = await supabase.from("users").select("id, full_name").in("id", userIds as string[]);
      const { data: eventsData } = await supabase.from("events").select("id, title").in("id", eventIds as string[]);
      const usersMap  = Object.fromEntries((users      || []).map((u: any) => [u.id, u]));
      const eventsMap = Object.fromEntries((eventsData || []).map((e: any) => [e.id, e]));

      return ticketsData.map((t: any) => ({
        ...t,
        users:  usersMap[t.user_id]   || null,
        events: eventsMap[t.event_id] || null,
      })) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
  });

  const isOrganizer = vendor?.vendor_type === "event_organizer";

  const bookingTotalReceived = (bookings || []).reduce((acc: number, b: any) => {
    const receipt  = b.receipts?.[0];
    const subtotal = receipt?.subtotal ?? b.final_amount ?? b.reserved_amount;
    const fee      = receipt?.platform_fee ?? Math.round(subtotal * 0.05);
    return acc + (subtotal - fee);
  }, 0);
  const bookingTotalFees = (bookings || []).reduce((acc: number, b: any) => {
    const receipt  = b.receipts?.[0];
    const subtotal = receipt?.subtotal ?? b.final_amount ?? b.reserved_amount;
    return acc + (receipt?.platform_fee ?? Math.round(subtotal * 0.05));
  }, 0);
  const bookingGuestPaid = (bookings || []).reduce((acc: number, b: any) => {
    const receipt = b.receipts?.[0];
    return acc + (receipt?.subtotal ?? b.final_amount ?? b.reserved_amount);
  }, 0);

  const ticketGross = (tickets || []).reduce((acc: number, t: any) => acc + (t.amount_paid || 0), 0);
  const ticketFees  = Math.round(ticketGross * 0.05);
  const ticketNet   = ticketGross - ticketFees;

  if (!vendor || (bookingsLoading && ticketsLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const currentTotal      = activeTab === "bookings" ? bookingTotalReceived : ticketNet;
  const currentGuestPaid  = activeTab === "bookings" ? bookingGuestPaid     : ticketGross;
  const currentFees       = activeTab === "bookings" ? bookingTotalFees      : ticketFees;
  const currentCount      = activeTab === "bookings" ? (bookings || []).length : (tickets || []).length;

  const visibleTabs = [
    { id: "bookings", label: "Bookings", icon: CheckCircle },
    { id: "tickets",  label: "Tickets",  icon: Ticket },
  ].filter(tab => !(tab.id === "bookings" && isOrganizer));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 0" }}>
        <button onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Dashboard</span>
        </button>

        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Earnings</h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: "0 0 20px" }}>
          {isOrganizer ? "Ticket sales revenue" : activeTab === "bookings" ? "Confirmed receipts only" : "Ticket sales revenue"}
        </p>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: "16px", gridColumn: "1 / -1" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Received</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(currentTotal)}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>from {formatCurrency(currentGuestPaid)} gross</p>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            {activeTab === "bookings"
              ? <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} />
              : <Ticket size={16} style={{ color: "#7B2FBE", flexShrink: 0 }} />}
            <div>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {activeTab === "bookings" ? "Completed" : "Tickets Sold"}
              </p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0 }}>{currentCount}</p>
            </div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingUp size={16} style={{ color: "#FBBF24", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fees Paid</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0 }}>{formatCurrency(currentFees)}</p>
            </div>
          </div>
        </div>

        {/* Tabs — hidden for event_organizer if only tickets */}
        {!isOrganizer && (
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                style={{ flex: 1, padding: "10px 0 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === id ? "2.5px solid #FFFFFF" : "2.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon size={14} style={{ color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.4)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.4)" }}>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Organizer: single Tickets label bar */}
        {isOrganizer && (
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ flex: 1, padding: "10px 0 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderBottom: "2.5px solid #FFFFFF" }}>
              <Ticket size={14} style={{ color: "#FFFFFF" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Tickets</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && !isOrganizer && (
          (bookings || []).length === 0 ? (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "48px 20px", textAlign: "center" }}>
              <Wallet size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No booking earnings yet</p>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, lineHeight: 1.5 }}>Completed bookings with confirmed receipts appear here.</p>
            </div>
          ) : (
            (bookings || []).map((booking: any, i: number) => {
              const receipt     = booking.receipts?.[0];
              const subtotal    = receipt?.subtotal ?? booking.final_amount ?? booking.reserved_amount;
              const platformFee = receipt?.platform_fee ?? Math.round(subtotal * 0.05);
              const youReceived = subtotal - platformFee;
              const confirmedAt = receipt?.confirmed_at || booking.created_at;
              const isBackfilled = !receipt?.subtotal && !booking.final_amount;
              return (
                <motion.div key={booking.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                  <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F7F5FA" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{booking.users?.full_name || "Guest"}</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{format(new Date(confirmedAt), "dd MMM yyyy · HH:mm")}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isBackfilled && <span style={{ fontSize: 9, fontWeight: 700, color: "#D97706", backgroundColor: "#FFF8E1", padding: "2px 7px", borderRadius: 999 }}>estimated</span>}
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#E0F7EA", padding: "3px 10px", borderRadius: 999 }}>Completed</span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E" }}>Guest paid</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>{formatCurrency(subtotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E" }}>Chillz fee (5%)</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#EF4444" }}>− {formatCurrency(platformFee)}</span>
                    </div>
                    <div style={{ borderTop: "1px dashed #E4DCF0", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>You received</span>
                      <span style={{ fontSize: 17, fontWeight: 900, color: "#059669", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(youReceived)}</span>
                    </div>
                    <p style={{ fontSize: 10, color: "#C4BAD8", margin: "2px 0 0", fontFamily: "monospace" }}>#{booking.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </motion.div>
              );
            })
          )
        )}

        {/* ── TICKETS TAB ── */}
        {(activeTab === "tickets" || isOrganizer) && (
          (tickets || []).length === 0 ? (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "48px 20px", textAlign: "center" }}>
              <Ticket size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No ticket sales yet</p>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, lineHeight: 1.5 }}>Ticket purchases from your events appear here.</p>
            </div>
          ) : (
            (tickets || []).map((ticket: any, i: number) => {
              const fee = Math.round((ticket.amount_paid || 0) * 0.05);
              const net = (ticket.amount_paid || 0) - fee;
              return (
                <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                  <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F7F5FA" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{ticket.users?.full_name || "Guest"}</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                        {ticket.events?.title || "Event"} · {format(new Date(ticket.created_at), "dd MMM yyyy · HH:mm")}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {ticket.ticket_type_name && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 7px", borderRadius: 999 }}>
                          {ticket.ticket_type_name}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700,
                        color: ticket.status === "checked_in" ? "#EF4444" : ticket.status === "completed" ? "#059669" : "#5B0EA6",
                        backgroundColor: ticket.status === "checked_in" ? "#FEF2F2" : ticket.status === "completed" ? "#E0F7EA" : "#EDE0F7",
                        padding: "3px 10px", borderRadius: 999 }}>
                        {ticket.status === "checked_in" ? "Used" : ticket.status === "active" ? "Active" : ticket.status === "completed" ? "Completed" : ticket.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {ticket.amount_paid > 0 ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9E9E9E" }}>Ticket price</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>{formatCurrency(ticket.amount_paid)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9E9E9E" }}>Chillz fee (5%)</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#EF4444" }}>− {formatCurrency(fee)}</span>
                        </div>
                        <div style={{ borderTop: "1px dashed #E4DCF0", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>You receive</span>
                          <span style={{ fontSize: 17, fontWeight: 900, color: "#059669", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(net)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#9E9E9E" }}>Free ticket</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>₦0</span>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: "#C4BAD8", margin: "2px 0 0", fontFamily: "monospace" }}>#{ticket.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </motion.div>
              );
            })
          )
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}