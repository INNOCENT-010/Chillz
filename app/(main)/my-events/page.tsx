/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Heart, Calendar, MapPin, Ticket, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isTomorrow, isPast } from "date-fns";

export default function MyEventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: savedEvents, isLoading } = useQuery({
    queryKey: ["saved-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("saved_events") as any)
        .select("id, event_id, created_at, events(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await (supabase.from("saved_events") as any)
        .delete()
        .eq("user_id", user!.id)
        .eq("event_id", eventId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-events", user?.id] });
    },
  });

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isPast(d)) return { label: "Past", color: "#9E9E9E", bg: "#F2EEF9" };
    if (isToday(d)) return { label: "Today", color: "#EF4444", bg: "#FEF2F2" };
    if (isTomorrow(d)) return { label: "Tomorrow", color: "#D97706", bg: "#FFF8E1" };
    return { label: format(d, "dd MMM"), color: "#059669", bg: "#E0F7EA" };
  };

  if (!user) {
    return (
      <MainLayout>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, padding: "0 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={28} style={{ color: "#5B0EA6" }} />
          </div>
          <p style={{ fontWeight: 800, fontSize: 17, color: "#0A0A0A", margin: 0, textAlign: "center" }}>Sign in to see your saved events</p>
          <button onClick={() => router.push("/login")}
            style={{ padding: "13px 32px", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </MainLayout>
    );
  }

  const upcoming = (savedEvents || []).filter((s: any) => s.events && !isPast(new Date(s.events.start_date)));
  const past = (savedEvents || []).filter((s: any) => s.events && isPast(new Date(s.events.start_date)));

  return (
    <MainLayout>
      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", position: "sticky", top: 0, zIndex: 40, borderBottom: "1px solid #F2EEF9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 14px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", marginLeft: -6, display: "flex" }}>
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>My Events</h1>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Events you've saved</p>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={16} style={{ color: "#5B0EA6", fill: "#5B0EA6" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", paddingBottom: 100 }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 110, borderRadius: 20, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : (savedEvents || []).length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Heart size={36} style={{ color: "#5B0EA6" }} />
            </motion.div>
            <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              No saved events yet
            </p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 24px", lineHeight: 1.5 }}>
              Tap the heart icon on any event to save it here
            </p>
            <button onClick={() => router.push("/events")}
              style={{ padding: "13px 32px", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
              Browse Events
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#00C853" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Upcoming · {upcoming.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcoming.map((saved: any, i: number) => {
                    const event = saved.events;
                    if (!event) return null;
                    const dateLabel = getDateLabel(event.start_date);
                    const lowestPrice = event.ticket_types?.length > 0
                      ? Math.min(...event.ticket_types.map((t: any) => t.price || 0))
                      : event.ticket_price || 0;

                    return (
                      <motion.div key={saved.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(91,14,166,0.07)", border: "1.5px solid #F2EEF9", display: "flex" }}>
                          {/* Image */}
                          <div onClick={() => router.push(`/events/${event.id}`)}
                            style={{ width: 100, flexShrink: 0, backgroundColor: "#EDE0F7", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                            {event.images?.[0]
                              ? <img src={event.images[0]} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", minHeight: 100, background: "linear-gradient(135deg, #3D0066, #5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Calendar size={28} style={{ color: "rgba(255,255,255,0.4)" }} />
                                </div>}
                            {/* Date badge */}
                            <div style={{ position: "absolute", top: 8, left: 8, backgroundColor: dateLabel.bg, borderRadius: 8, padding: "3px 7px" }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: dateLabel.color }}>{dateLabel.label}</span>
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, padding: "12px 12px 12px 14px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                              <p onClick={() => router.push(`/events/${event.id}`)}
                                style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: 0, cursor: "pointer", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>
                                {event.title}
                              </p>
                              {/* Unsave button */}
                              <button onClick={() => unsaveMutation.mutate(event.id)}
                                style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Heart size={13} style={{ color: "#FF4B6E", fill: "#FF4B6E" }} />
                              </button>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                              <Calendar size={10} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>
                                {format(new Date(event.start_date), "dd MMM · HH:mm")}
                              </span>
                            </div>

                            {event.address && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.address}</span>
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "3px 8px" }}>
                                <Ticket size={10} style={{ color: "#5B0EA6" }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6" }}>
                                  {lowestPrice === 0 ? "Free" : `From ${formatCurrency(lowestPrice)}`}
                                </span>
                              </div>
                              <button onClick={() => router.push(`/events/${event.id}`)}
                                style={{ padding: "5px 14px", borderRadius: 999, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#9E9E9E" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Past · {past.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.7 }}>
                  {past.map((saved: any, i: number) => {
                    const event = saved.events;
                    if (!event) return null;
                    return (
                      <motion.div key={saved.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 14px", border: "1px solid #F2EEF9", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#F2EEF9", overflow: "hidden", flexShrink: 0 }}>
                            {event.images?.[0]
                              ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Calendar size={18} style={{ color: "#C4BAD8" }} /></div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: 13, color: "#6B6B6B", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.title}</p>
                            <p style={{ fontSize: 11, color: "#C4BAD8", margin: 0 }}>{format(new Date(event.start_date), "dd MMM yyyy")}</p>
                          </div>
                          <button onClick={() => unsaveMutation.mutate(event.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                            <X size={14} style={{ color: "#C4BAD8" }} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}