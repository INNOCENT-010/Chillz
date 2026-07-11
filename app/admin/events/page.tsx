/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Calendar, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export default function AdminEventsPage() {
  const router = useRouter();

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
  const now = new Date().toISOString();

  // Auto-expire past events
  await (supabase.from("events") as any)
    .update({ is_active: false })
    .lt("start_date", now)
    .eq("is_active", true);

  const { data } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: false });
  return (data || []) as any[];
},
    staleTime: 1000 * 30,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F5FA",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E4DCF0",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              marginLeft: -6,
              display: "flex",
            }}
          >
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#0A0A0A",
                margin: 0,
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              Events
            </h1>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
              {events?.length || 0} total
            </p>
          </div>
        </div>
        <Link
          href="/admin/events/add"
          style={{
            backgroundColor: "#5B0EA6",
            color: "#FFFFFF",
            textDecoration: "none",
            borderRadius: 12,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={15} />
          Add
        </Link>
      </div>

      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 90,
                  borderRadius: 16,
                  backgroundColor: "#F2EEF9",
                }}
              />
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((event: any, i: number) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/admin/events/${event.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      overflow: "hidden",
                      boxShadow: "0 1px 8px rgba(91,14,166,0.06)",
                      display: "flex",
                      opacity: event.is_active ? 1 : 0.6,
                    }}
                  >
                    {/* Image */}
                    <div
                      style={{
                        width: 80,
                        flexShrink: 0,
                        backgroundColor: "#EDE0F7",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {event.images?.[0] ? (
                        <img
                          src={event.images[0]}
                          alt={event.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            minHeight: 90,
                            background:
                              "linear-gradient(135deg, #EDE0F7, #F2EEF9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Calendar size={24} style={{ color: "#7B2FBE" }} />
                        </div>
                      )}
                      {/* Hidden overlay */}
                      {!event.is_active && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#FFFFFF",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Hidden
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: "11px 12px 11px 14px", minWidth: 0 }}>
                      {/* Title + status */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          marginBottom: 5,
                          gap: 8,
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#0A0A0A",
                            margin: 0,
                            flex: 1,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: 1.35,
                          }}
                        >
                          {event.title}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              backgroundColor: event.is_active
                                ? "#00C853"
                                : "#9E9E9E",
                            }}
                          />
                          {(() => {
  const isPast = new Date(event.start_date) < new Date();
  const label = isPast ? "Expired" : event.is_active ? "Live" : "Hidden";
  const color = isPast ? "#EF4444" : event.is_active ? "#00C853" : "#9E9E9E";
  const bg = isPast ? "#FEF2F2" : event.is_active ? "#E0F7EA" : "#F2EEF9";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, backgroundColor: bg, padding: "2px 7px", borderRadius: 999 }}>
      {label}
    </span>
  );
})()}
                        </div>
                      </div>

                      {/* Date */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 3,
                        }}
                      >
                        <Calendar
                          size={10}
                          style={{ color: "#5B0EA6", flexShrink: 0 }}
                          strokeWidth={2}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#5B0EA6",
                            fontWeight: 600,
                          }}
                        >
                          {format(
                            new Date(event.start_date),
                            "dd MMM yyyy · HH:mm"
                          )}
                        </span>
                      </div>

                      {/* Address */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 6,
                        }}
                      >
                        <MapPin
                          size={10}
                          style={{ color: "#9E9E9E", flexShrink: 0 }}
                          strokeWidth={1.8}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9E9E9E",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {event.address}
                        </span>
                      </div>

                      {/* Badges */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#5B0EA6",
                            backgroundColor: "#EDE0F7",
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {event.ticket_price === 0
                            ? "Free"
                            : formatCurrency(event.ticket_price)}
                        </span>
                        {event.is_featured && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#00C853",
                              backgroundColor: "#E0F7EA",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            Featured
                          </span>
                        )}
                        {event.is_outdoor && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#7B2FBE",
                              backgroundColor: "#F3E8FF",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            Outdoor
                          </span>
                        )}
                        {event.event_tags?.slice(0, 1).map((tag: string) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#6B6B6B",
                              backgroundColor: "#F2EEF9",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 80,
              gap: 14,
              textAlign: "center",
            }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={32} style={{ color: "#5B0EA6" }} />
            </motion.div>
            <p
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: "#0A0A0A",
                margin: 0,
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              No events yet
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#6B6B6B",
                margin: 0,
                lineHeight: 1.5,
                maxWidth: 220,
              }}
            >
              Add your first event and it will appear on the home screen.
            </p>
            <Link
              href="/admin/events/add"
              style={{
                backgroundColor: "#5B0EA6",
                color: "#FFFFFF",
                textDecoration: "none",
                borderRadius: 14,
                padding: "11px 28px",
                fontSize: 13,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              Add First Event
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}