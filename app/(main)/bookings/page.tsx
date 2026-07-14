/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Link from "next/link";
import { CalendarCheck, MapPin, ChevronRight, Clock, Bookmark } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

type StatusStyle = { bg: string; color: string; label: string; dot: string };

const STATUS_STYLE: Record<string, StatusStyle> = {
  confirmed:    { bg: "#E8F5E9", color: "#2E7D32", label: "Confirmed",    dot: "#2E7D32" },
  checked_in:   { bg: "#E0F7EA", color: "#00C853", label: "Checked In",   dot: "#00C853" },
  completed:    { bg: "#E0F7EA", color: "#00C853", label: "Completed",    dot: "#00C853" },
  receipt_sent: { bg: "#FFF8E1", color: "#F59E0B", label: "Receipt Sent", dot: "#F59E0B" },
  disputed:     { bg: "#FEF3C7", color: "#D97706", label: "Disputed",     dot: "#D97706" },
  cancelled:    { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled",    dot: "#EF4444" },
  pending:      { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending",      dot: "#9E9E9E" },
};

const ACTIVE_STATUSES = ["checked_in", "confirmed", "receipt_sent", "disputed", "pending"];

function ActivityTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", padding: "0 16px", borderBottom: "1px solid #F0EBF8" }}>
      {[
        { label: "Bookings", href: "/bookings", icon: "🏛️" },
        { label: "Tickets",  href: "/tickets",  icon: "🎟️" },
      ].map(({ label, href, icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            style={{ textDecoration: "none", padding: "12px 20px", fontSize: 14, fontWeight: active ? 800 : 500, color: active ? "#5B0EA6" : "#9E9E9E", borderBottom: active ? "2.5px solid #5B0EA6" : "2.5px solid transparent", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15 }}>{icon}</span>{label}
          </Link>
        );
      })}
    </div>
  );
}

function ActiveBookingCard({ booking, i }: { booking: any; i: number }) {
  const title = booking.venues?.name || "Venue Booking";
  const address = booking.venues?.address;
  const image = booking.venues?.images?.[0];
  const category = booking.venues?.category;
  const status = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;
  const displayAmount = booking.status === "completed"
    ? (booking.receipts?.[0]?.subtotal ?? booking.final_amount ?? booking.reserved_amount)
    : booking.reserved_amount;

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <Link href={`/bookings/${booking.id}`} style={{ textDecoration: "none" }}>
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", border: "1px solid #F0EBF8", position: "relative" }}>
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 28, height: 28, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bookmark size={13} style={{ color: "#5B0EA6" }} fill="#5B0EA6" />
          </div>
          <div style={{ width: 100, flexShrink: 0, backgroundColor: "#EDE0F7", position: "relative", overflow: "hidden", minHeight: 110 }}>
            {image ? (
              <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)" }}>
                <CalendarCheck size={28} style={{ color: "#7B2FBE" }} />
              </div>
            )}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(10,0,30,0.72))", padding: "18px 6px 6px", display: "flex", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.92)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {category?.replace(/-/g, " ") || "VENUE"}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, padding: "13px 36px 13px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 5px", lineHeight: 1.25, fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {title}
              </p>
              {address && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} strokeWidth={1.8} />
                  <span style={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{address}</span>
                </div>
              )}
              {booking.booking_date && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#F2EEF9", borderRadius: 6, padding: "3px 7px" }}>
                  <Clock size={9} style={{ color: "#5B0EA6", flexShrink: 0 }} strokeWidth={2} />
                  <span style={{ fontSize: 10, color: "#5B0EA6", fontWeight: 700 }}>
                    {format(new Date(booking.booking_date), "dd MMM • HH:mm")}
                  </span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 9, color: "#9E9E9E", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px" }}>AMOUNT PAID</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(displayAmount)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: status.bg, borderRadius: 999, padding: "4px 9px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: status.dot }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: status.color }}>{status.label}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: "#CCBBDD" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PastBookingRow({ booking, i }: { booking: any; i: number }) {
  const title = booking.venues?.name || "Venue Booking";
  const image = booking.venues?.images?.[0];
  const status = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;
  const displayAmount = booking.final_amount ?? booking.reserved_amount;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
      <Link href={`/bookings/${booking.id}`} style={{ textDecoration: "none" }}>
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #F0EBF8", opacity: 0.75 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#EDE0F7", overflow: "hidden", flexShrink: 0 }}>
            {image
              ? <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><CalendarCheck size={16} style={{ color: "#7B2FBE" }} /></div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
              {booking.booking_date ? format(new Date(booking.booking_date), "dd MMM yyyy") : ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#6B6B6B" }}>{formatCurrency(displayAmount)}</span>
            <div style={{ backgroundColor: status.bg, borderRadius: 999, padding: "3px 8px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: status.color }}>{status.label}</span>
            </div>
            <ChevronRight size={13} style={{ color: "#CCBBDD" }} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function BookingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "past">("active");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("bookings")
        .select("*, venues(name, address, images, category), receipts(subtotal, status)")
        .eq("user_id", user.id)
        .not("venue_id", "is", null)
        .is("event_id", null)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    refetchInterval: 10000,
  });

  const active = (bookings || []).filter((b: any) => ACTIVE_STATUSES.includes(b.status));
  const past   = (bookings || []).filter((b: any) => !ACTIVE_STATUSES.includes(b.status));

  const header = (
    <div style={{ backgroundColor: "#FFFFFF", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ padding: "20px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Activity</h1>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: "2px 0 0", fontWeight: 500 }}>Track all your bookings and tickets</p>
          </div>
          {bookings && bookings.length > 0 && (
            <div style={{ backgroundColor: "#EDE0F7", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
              <CalendarCheck size={13} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 700 }}>{bookings.length} bookings</span>
            </div>
          )}
        </div>
      </div>
      <ActivityTabs />
    </div>
  );

  if (!user) return (
    <MainLayout>
      {header}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarCheck size={32} style={{ color: "#5B0EA6" }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Sign in to view bookings</h2>
        <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Your venue bookings will appear here.</p>
        <button onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
          style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Sign In
        </button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      {header}
      {/* Inner tabs */}
      <div style={{ display: "flex", padding: "12px 16px 0", gap: 8 }}>
        {[
          { key: "active", label: "Active", count: active.length, dot: "#00C853" },
          { key: "past",   label: "Past",   count: past.length,   dot: "#9E9E9E" },
        ].map(({ key, label, count, dot }) => (
          <button key={key} onClick={() => setTab(key as any)}
            style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: tab === key ? "#5B0EA6" : "#FFFFFF", color: tab === key ? "#FFFFFF" : "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: tab === key ? "0 2px 10px rgba(91,14,166,0.25)" : "none" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: tab === key ? "#FFFFFF" : dot }} />
            {label}
            {count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: tab === key ? "rgba(255,255,255,0.25)" : "#F2EEF9", color: tab === key ? "#FFFFFF" : "#9E9E9E", padding: "1px 6px", borderRadius: 999 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 16px 100px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 110, borderRadius: 20, backgroundColor: "#F2EEF9", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : tab === "active" ? (
          active.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {active.map((b: any, i: number) => <ActiveBookingCard key={b.id} booking={b} i={i} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12, textAlign: "center" }}>
              <CalendarCheck size={36} style={{ color: "#E4DCF0" }} />
              <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: 0 }}>No active bookings</p>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Your confirmed and ongoing bookings show here.</p>
              <button onClick={() => setTab("past")} style={{ fontSize: 13, color: "#5B0EA6", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                View past bookings →
              </button>
            </div>
          )
        ) : (
          past.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {past.map((b: any, i: number) => <PastBookingRow key={b.id} booking={b} i={i} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12, textAlign: "center" }}>
              <CalendarCheck size={36} style={{ color: "#E4DCF0" }} />
              <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: 0 }}>No past bookings</p>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Completed and cancelled bookings will appear here.</p>
            </div>
          )
        )}
        {!isLoading && !bookings?.length && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 14, textAlign: "center" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CalendarCheck size={32} style={{ color: "#5B0EA6" }} />
            </motion.div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>No bookings yet</p>
            <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5, maxWidth: 240 }}>Book a venue and it will appear here.</p>
            <Link href="/home" style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", textDecoration: "none", borderRadius: 14, padding: "11px 28px", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              Explore Chillz
            </Link>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </MainLayout>
  );
}