/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Wallet, QrCode, Star, TrendingUp, AlertTriangle,
  ChevronRight, Receipt, Clock, CheckCircle,
  Calendar, Ticket, Plus,
} from "lucide-react";

interface Props {
  vendor: any;
  ledger: { pending: number; available: number } | undefined;
  checkedInBookings: any[];
  receiptSentBookings: any[];
  recentBookings: any[];
  recentTickets: any[];
  disputeCount: number;
  quickActions: { href: string; icon: any; label: string; color: string; bg: string }[];
  onSetTab: (t: string) => void;
  onBillGuest: (booking: any) => void;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  completed:    { bg: "#E0F7EA", color: "#00C853" },
  confirmed:    { bg: "#EDE0F7", color: "#5B0EA6" },
  receipt_sent: { bg: "#FFF8E1", color: "#F59E0B" },
  checked_in:   { bg: "#E0F7EA", color: "#00C853" },
  disputed:     { bg: "#FEF3C7", color: "#D97706" },
};

// ── Event Organizer Overview ──────────────────────────────────────────────
function EventOrganizerOverview({ vendor, ledger, disputeCount, quickActions, onSetTab }: {
  vendor: any;
  ledger: { pending: number; available: number } | undefined;
  disputeCount: number;
  quickActions: { href: string; icon: any; label: string; color: string; bg: string }[];
  onSetTab: (t: string) => void;
}) {
  const router = useRouter();

  const { data: events = [] } = useQuery({
    queryKey: ["organizer-events", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("events") as any)
        .select("id, title, start_date, is_active, tickets_sold, capacity, ticket_price, images")
        .eq("vendor_id", vendor.id)
        .order("start_date", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: recentTickets = [] } = useQuery({
    queryKey: ["organizer-recent-tickets", vendor?.id],
    queryFn: async () => {
      const { data: tix } = await (supabase.from("tickets") as any)
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!tix?.length) return [];
      const userIds = [...new Set(tix.map((t: any) => t.user_id))];
      const eventIds = [...new Set(tix.map((t: any) => t.event_id).filter(Boolean))];
      const { data: users } = await supabase.from("users").select("id, full_name, avatar_url").in("id", userIds as string[]);
      const { data: evts } = await supabase.from("events").select("id, title").in("id", eventIds as string[]);
      const usersMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
      const eventsMap = Object.fromEntries((evts || []).map((e: any) => [e.id, e]));
      return tix.map((t: any) => ({ ...t, users: usersMap[t.user_id] || null, events: eventsMap[t.event_id] || null }));
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const now = new Date();
  const upcomingEvents = events.filter((e: any) => new Date(e.start_date) >= now && e.is_active);
  const totalTicketsSold = events.reduce((acc: number, e: any) => acc + (e.tickets_sold || 0), 0);

  return (
    <motion.div key="overview-organizer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Earnings */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 16px rgba(91,14,166,0.07)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Earnings</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Available</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#00C853", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {formatCurrency(ledger?.available || 0)}
            </p>
          </div>
          <div style={{ width: 1, backgroundColor: "#F2EEF9" }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Pending</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#F59E0B", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {formatCurrency(ledger?.pending || 0)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSetTab("withdraw")} disabled={(ledger?.available || 0) === 0}
            style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: (ledger?.available || 0) > 0 ? "#5B0EA6" : "#F2EEF9", color: (ledger?.available || 0) > 0 ? "#FFFFFF" : "#9E9E9E", fontSize: 13, fontWeight: 700, cursor: (ledger?.available || 0) > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Wallet size={15} />{(ledger?.available || 0) > 0 ? `Withdraw ${formatCurrency(ledger?.available || 0)}` : "No funds yet"}
          </button>
          <button onClick={() => router.push("/vendor/earnings")}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #EDE0F7", backgroundColor: "#F7F5FA", color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <TrendingUp size={14} />History
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Total Events", value: String(events.length), color: "#5B0EA6", bg: "#EDE0F7", icon: Calendar },
          { label: "Tickets Sold", value: String(totalTicketsSold), color: "#059669", bg: "#E0F7EA", icon: Ticket },
          { label: "Upcoming", value: String(upcomingEvents.length), color: "#D97706", bg: "#FFF8E1", icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px 10px", textAlign: "center", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
              <Icon size={15} style={{ color }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 900, color, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Dispute alert */}
      {disputeCount > 0 && (
        <button onClick={() => onSetTab("disputes")}
          style={{ width: "100%", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 16, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: "#D97706" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>{disputeCount} Active Dispute{disputeCount > 1 ? "s" : ""}</p>
            <p style={{ fontSize: 11, color: "#D97706", margin: 0 }}>Tap to view and respond</p>
          </div>
          <ChevronRight size={16} style={{ color: "#D97706" }} />
        </button>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${quickActions.length}, 1fr)`, gap: 8 }}>
        {quickActions.map(({ href, icon: Icon, label, color, bg }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={17} style={{ color }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#0A0A0A", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Create event CTA */}
      <Link href="/vendor/events/add" style={{ textDecoration: "none" }}>
        <div style={{ background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Plus size={20} style={{ color: "#FFFFFF" }} />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: "0 0 1px" }}>Create New Event</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Tag any venue, set ticket prices</p>
          </div>
          <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.7)", marginLeft: "auto" }} />
        </div>
      </Link>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: 0 }}>Upcoming Events</h3>
            <button onClick={() => onSetTab("events")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
              See all <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.slice(0, 3).map((event: any) => (
              <Link key={event.id} href={`/vendor/events/${event.id}`} style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", display: "flex", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #F2EEF9" }}>
                  <div style={{ width: 68, flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                    {event.images?.[0]
                      ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 72 }} />
                      : <div style={{ width: "100%", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Calendar size={20} style={{ color: "#7B2FBE" }} />
                        </div>}
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {event.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: "0 0 4px" }}>
                      {format(new Date(event.start_date), "dd MMM · HH:mm")}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#E0F7EA", padding: "2px 7px", borderRadius: 999 }}>
                        {event.tickets_sold || 0} sold
                      </span>
                      {event.capacity && <span style={{ fontSize: 10, color: "#9E9E9E" }}>of {event.capacity}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "0 10px 0 0" }}>
                    <ChevronRight size={14} style={{ color: "#9E9E9E" }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent ticket sales */}
      {recentTickets.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: 0 }}>Recent Ticket Sales</h3>
            <button onClick={() => onSetTab("tickets")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
              See all <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentTickets.map((ticket: any) => (
              <div key={ticket.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.04)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {ticket.users?.avatar_url
                    ? <img src={ticket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>{ticket.users?.full_name?.[0]}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {ticket.users?.full_name || "Guest"}
                  </p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {ticket.events?.title || "Event"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6", margin: "0 0 2px" }}>
                    {ticket.amount_paid > 0 ? formatCurrency(ticket.amount_paid) : "Free"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                    {format(new Date(ticket.created_at), "dd MMM, HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && recentTickets.length === 0 && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 2px 8px rgba(91,14,166,0.05)" }}>
          <Calendar size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
          <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No events yet</p>
          <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px", lineHeight: 1.5 }}>Create your first event to start selling tickets.</p>
          <Link href="/vendor/events/add" style={{ textDecoration: "none" }}>
            <button style={{ padding: "10px 24px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} />Create Event
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ── Venue Vendor Overview ─────────────────────────────────────────────────
export function OverviewTab({ vendor, ledger, checkedInBookings, receiptSentBookings, recentBookings, recentTickets, disputeCount, quickActions, onSetTab, onBillGuest }: Props) {
  const router = useRouter();

  if (vendor?.vendor_type === "event_organizer") {
    return (
      <EventOrganizerOverview
        vendor={vendor}
        ledger={ledger}
        disputeCount={disputeCount}
        quickActions={quickActions}
        onSetTab={onSetTab}
      />
    );
  }

  const totalCheckedIn = checkedInBookings.length;
  const totalReceiptSent = receiptSentBookings.length;

  return (
    <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Earnings */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 16px rgba(91,14,166,0.07)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Earnings</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Available</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#00C853", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(ledger?.available || 0)}</p>
          </div>
          <div style={{ width: 1, backgroundColor: "#F2EEF9" }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Pending</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#F59E0B", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(ledger?.pending || 0)}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSetTab("withdraw")} disabled={(ledger?.available || 0) === 0}
            style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: (ledger?.available || 0) > 0 ? "#5B0EA6" : "#F2EEF9", color: (ledger?.available || 0) > 0 ? "#FFFFFF" : "#9E9E9E", fontSize: 13, fontWeight: 700, cursor: (ledger?.available || 0) > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Wallet size={15} />{(ledger?.available || 0) > 0 ? `Withdraw ${formatCurrency(ledger?.available || 0)}` : "No funds yet"}
          </button>
          <button onClick={() => router.push("/vendor/earnings")}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #EDE0F7", backgroundColor: "#F7F5FA", color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <TrendingUp size={14} />History
          </button>
        </div>
      </div>

      {/* Dispute alert */}
      {disputeCount > 0 && (
        <button onClick={() => onSetTab("disputes")}
          style={{ width: "100%", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 16, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: "#D97706" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>{disputeCount} Active Dispute{disputeCount > 1 ? "s" : ""}</p>
            <p style={{ fontSize: 11, color: "#D97706", margin: 0 }}>Tap to view and respond</p>
          </div>
          <ChevronRight size={16} style={{ color: "#D97706" }} />
        </button>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${quickActions.length}, 1fr)`, gap: 8 }}>
        {quickActions.map(({ href, icon: Icon, label, color, bg }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={17} style={{ color }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#0A0A0A", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Bookings link */}
      <Link href="/vendor/bookings" style={{ textDecoration: "none" }}>
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #F2EEF9" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px" }}>All Bookings</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>View full booking history with filters</p>
          </div>
          <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
        </div>
      </Link>

      {/* Active guests */}
      {totalCheckedIn > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 2px" }}>Active Guests</h3>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Tap to bill</p>
            </div>
            <div style={{ backgroundColor: "#00C853", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>
              {totalCheckedIn} in venue
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checkedInBookings.map((booking: any) => {
              const initials = booking.users?.full_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const checkedInTime = booking.checked_in_at ? format(new Date(booking.checked_in_at), "HH:mm") : null;
              return (
                <motion.button key={booking.id} onClick={() => onBillGuest(booking)} whileTap={{ scale: 0.98 }}
                  style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(91,14,166,0.07)", border: "1.5px solid #EDE0F7", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                    {booking.users?.avatar_url
                      ? <img src={booking.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 16, fontWeight: 800, color: "#5B0EA6" }}>{initials}</span>}
                    <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", backgroundColor: "#00C853", border: "2px solid #FFFFFF" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {booking.users?.full_name}
                    </p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "1px 7px", borderRadius: 999, fontFamily: "monospace" }}>
                        {booking.qr_code_hash?.slice(0, 8).toUpperCase()}
                      </span>
                      {checkedInTime && <span style={{ fontSize: 10, color: "#9E9E9E" }}>In {checkedInTime}</span>}
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#6B6B6B" }}>₦{(booking.reserved_amount / 1000).toFixed(0)}k reserved</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: "#5B0EA6", borderRadius: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <Receipt size={12} style={{ color: "#FFFFFF" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>Bill</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Awaiting confirmation */}
      {totalReceiptSent > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 2px" }}>Awaiting Confirmation</h3>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Receipts sent, waiting for guest</p>
            </div>
            <div style={{ backgroundColor: "#F59E0B", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>
              {totalReceiptSent} pending
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {receiptSentBookings.map((booking: any) => {
              const receiptAmt = booking.receipts?.[0]?.total || booking.reserved_amount;
              return (
                <div key={booking.id} style={{ backgroundColor: "#FFFBEB", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #FDE68A" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {booking.users?.avatar_url
                      ? <img src={booking.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 15, fontWeight: 800, color: "#D97706" }}>{booking.users?.full_name?.charAt(0)}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{booking.users?.full_name}</p>
                    <p style={{ fontSize: 11, color: "#D97706", fontWeight: 600, margin: 0 }}>Receipt sent · {formatCurrency(receiptAmt)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <Clock size={12} style={{ color: "#F59E0B" }} />
                    <span style={{ fontSize: 10, color: "#D97706", fontWeight: 600 }}>Waiting</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity — bookings */}
      {recentBookings.length > 0 && (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 10px" }}>Recent Activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentBookings.map((booking: any) => {
              const s = STATUS_COLORS[booking.status] || { bg: "#F2EEF9", color: "#9E9E9E" };
              const receipt = booking.receipts?.[0];
              const subtotal = receipt?.subtotal ?? booking.final_amount ?? booking.reserved_amount;
              const platformFee = receipt?.platform_fee ?? Math.round(subtotal * 0.05);
              const displayAmount = booking.status === "completed" ? subtotal - platformFee : booking.reserved_amount;
              return (
                <div key={booking.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, boxShadow: "0 1px 6px rgba(91,14,166,0.04)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{booking.users?.full_name}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{format(new Date(booking.created_at), "dd MMM, HH:mm")}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6" }}>{formatCurrency(displayAmount)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: "2px 8px", borderRadius: 999 }}>
                      {booking.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent ticket sales — venue vendors who host events */}
      {recentTickets.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: 0 }}>Recent Ticket Sales</h3>
            <button onClick={() => onSetTab("tickets")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
              See all <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentTickets.map((ticket: any) => (
              <div key={ticket.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.04)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {ticket.users?.avatar_url
                    ? <img src={ticket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>{ticket.users?.full_name?.[0]}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {ticket.users?.full_name || "Guest"}
                  </p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {ticket.events?.title || "Event"} · 🎟️
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6", margin: "0 0 2px" }}>
                    {ticket.amount_paid > 0 ? formatCurrency(ticket.amount_paid) : "Free"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                    {format(new Date(ticket.created_at), "dd MMM, HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalCheckedIn === 0 && totalReceiptSent === 0 && recentBookings.length === 0 && recentTickets.length === 0 && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 2px 8px rgba(91,14,166,0.05)" }}>
          <CheckCircle size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
          <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No active guests</p>
          <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px", lineHeight: 1.5 }}>Scan a guest's QR code to check them in.</p>
          <Link href="/vendor/scan" style={{ textDecoration: "none" }}>
            <button style={{ padding: "10px 24px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <QrCode size={15} />Scan QR
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}