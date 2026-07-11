/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { Ticket, Calendar, MapPin, Lock, Bookmark, ChevronRight } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

type StatusStyle = { bg: string; color: string; label: string; dot: string };

const STATUS_STYLE: Record<string, StatusStyle> = {
  active:       { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed",  dot: "#5B0EA6" },
  confirmed:    { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed",  dot: "#5B0EA6" },
  checked_in:   { bg: "#E0F7EA", color: "#00C853", label: "Checked In", dot: "#00C853" },
  completed:    { bg: "#E0F7EA", color: "#00C853", label: "Completed",  dot: "#00C853" },
  cancelled:    { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled",  dot: "#EF4444" },
  pending:      { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending",    dot: "#9E9E9E" },
};

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

export default function TicketsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", user?.id],
    queryFn: async () => {
  if (!user?.id) return [];

  // Step 1: fetch tickets
  const { data: ticketsData, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !ticketsData?.length) return [];

  // Step 2: fetch events separately
  const eventIds = [...new Set(ticketsData.map((t: any) => t.event_id).filter(Boolean))];
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, title, address, images, start_date, end_date")
    .in("id", eventIds);

  const eventsMap = Object.fromEntries((eventsData || []).map((e: any) => [e.id, e]));

  return ticketsData.map((t: any) => ({
    ...t,
    events: eventsMap[t.event_id] || null,
  })) as any[];
},
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    refetchInterval: 15000,
  });

  const header = (
    <div style={{ backgroundColor: "#FFFFFF", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ padding: "20px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Activity</h1>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: "2px 0 0", fontWeight: 500 }}>Track all your bookings and tickets</p>
          </div>
          {tickets && tickets.length > 0 && (
            <div style={{ backgroundColor: "#EDE0F7", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
              <Ticket size={13} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 700 }}>{tickets.length} tickets</span>
            </div>
          )}
        </div>
      </div>
      <ActivityTabs />
    </div>
  );

  if (!user) {
    return (
      <MainLayout>
        {header}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, padding: "0 24px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={30} style={{ color: "#5B0EA6" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Your tickets live here</h2>
          <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0, lineHeight: 1.5 }}>Sign in to view your event tickets.</p>
          <button onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
            style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {header}
      <div style={{ padding: "14px 16px 100px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 110, borderRadius: 20, backgroundColor: "#F2EEF9", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tickets.map((ticket: any, i: number) => {
              const title = ticket.events?.title || "Event Ticket";
              const address = ticket.events?.address;
              const image = ticket.events?.images?.[0];
              const organiser = ticket.events?.vendors?.business_name;
              const status = STATUS_STYLE[ticket.status] || STATUS_STYLE.pending;
              const classification = ticket.ticket_type_classification;

              return (
                <motion.div key={ticket.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", border: "1px solid #F0EBF8", position: "relative" }}>

                      {/* Bookmark */}
                      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 28, height: 28, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bookmark size={13} style={{ color: "#5B0EA6" }} fill="#5B0EA6" />
                      </div>

                      {/* Thumbnail */}
                      <div style={{ width: 100, flexShrink: 0, backgroundColor: "#EDE0F7", position: "relative", overflow: "hidden", minHeight: 110 }}>
                        {image ? (
                          <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #3D0066, #5B0EA6)" }}>
                            <Ticket size={28} style={{ color: "rgba(255,255,255,0.5)" }} />
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(10,0,30,0.72))", padding: "18px 6px 6px", display: "flex", justifyContent: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.92)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {classification ? classification.replace(/_/g, " ") : "EVENT"}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, padding: "13px 36px 13px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                        {/* Top */}
                        <div>
                          <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px", lineHeight: 1.25, fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {title}
                          </p>
                          {address && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                              <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} strokeWidth={1.8} />
                              <span style={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{address}</span>
                            </div>
                          )}
                          {ticket.events?.start_date && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#F2EEF9", borderRadius: 6, padding: "3px 7px" }}>
                              <Calendar size={9} style={{ color: "#5B0EA6", flexShrink: 0 }} strokeWidth={2} />
                              <span style={{ fontSize: 10, color: "#5B0EA6", fontWeight: 700 }}>
                                {format(new Date(ticket.events.start_date), "dd MMM • HH:mm")}
                              </span>
                            </div>
                          )}
                          {ticket.ticket_type_name && (
                            <div style={{ marginTop: 5 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#7B2FBE", backgroundColor: "#EDE0F7", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                {ticket.ticket_type_name}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bottom */}
                        <div style={{ marginTop: 10 }}>
                          <p style={{ fontSize: 9, color: "#9E9E9E", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px" }}>AMOUNT PAID</p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                              {formatCurrency(ticket.amount_paid)}
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
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 14, textAlign: "center" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ticket size={32} style={{ color: "#5B0EA6" }} />
            </motion.div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>No tickets yet</p>
            <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5, maxWidth: 240 }}>
              Book an event and your ticket will appear here.
            </p>
            <Link href="/discover" style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", textDecoration: "none", borderRadius: 14, padding: "11px 28px", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              Browse Events
            </Link>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </MainLayout>
  );
}