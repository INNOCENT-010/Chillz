/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { TicketPurchaseSheet } from "@/components/events/ticket-purchase-sheet";
import {
  ArrowLeft, Calendar, MapPin, Ticket, Building2,
  Phone, MessageCircle, Mail, Globe, Camera, Video, Music2, Play,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function getVideoType(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}

export default function OrganizerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [ticketSheetEvent, setTicketSheetEvent] = useState<any>(null);

  const { data: organizer, isLoading } = useQuery({
    queryKey: ["organizer-detail", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type, description, avatar_url, phone, whatsapp, contact_email, website, instagram, videos")
        .eq("id", id)
        .eq("vendor_type", "event_organizer")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ["organizer-events", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("events") as any)
        .select("id, title, description, start_date, address, custom_venue_address, ticket_price, ticket_types, images, capacity, tickets_sold, vendor_id")
        .eq("vendor_id", id)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </MainLayout>
  );

  if (!organizer) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ fontSize: 14, color: "#6B6B6B" }}>Organizer not found</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  const now = Date.now();
  const upcoming = (events || []).filter((e) => new Date(e.start_date).getTime() >= now);
  const past = (events || []).filter((e) => new Date(e.start_date).getTime() < now);

  const contactLinks = [
    organizer.whatsapp && {
      icon: MessageCircle, label: organizer.whatsapp,
      href: `https://wa.me/${organizer.whatsapp.replace(/[^0-9]/g, "")}`,
      bg: "#E0F7EA", border: "#A7F3D0", color: "#059669",
    },
    organizer.phone && {
      icon: Phone, label: organizer.phone,
      href: `tel:${organizer.phone}`,
      bg: "#EDE0F7", border: "#DDD6FE", color: "#5B0EA6",
    },
    organizer.contact_email && {
      icon: Mail, label: organizer.contact_email,
      href: `mailto:${organizer.contact_email}`,
      bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB",
    },
    organizer.instagram && {
      icon: Camera, label: `@${organizer.instagram.replace(/^@/, "")}`,
      href: `https://instagram.com/${organizer.instagram.replace(/^@/, "")}`,
      bg: "#FDF2F8", border: "#F9A8D4", color: "#C13584",
    },
    organizer.website && {
      icon: Globe, label: organizer.website.replace(/^https?:\/\//, ""),
      href: organizer.website.startsWith("http") ? organizer.website : `https://${organizer.website}`,
      bg: "#F7F5FA", border: "#E4DCF0", color: "#6B6B6B",
    },
  ].filter(Boolean) as { icon: any; label: string; href: string; bg: string; border: string; color: string }[];

  return (
    <MainLayout>
      <div style={{ padding: "16px", borderBottom: "1px solid #F2EEF9", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A" }}>Organizer</span>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {organizer.avatar_url
              ? <img src={organizer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {organizer.business_name?.[0]?.toUpperCase() || "O"}
                </span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {organizer.business_name}
            </p>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>
              Event Organizer
            </span>
          </div>
        </div>

        {organizer.description && (
          <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: "0 0 16px" }}>{organizer.description}</p>
        )}

        {/* Contact links */}
        {contactLinks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {contactLinks.map((c, i) => {
              const Icon = c.icon;
              return (
                <a key={i} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "11px 14px" }}>
                  <Icon size={16} style={{ color: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.color, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {c.label}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Videos */}
        {organizer.videos?.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Videos
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {organizer.videos.map((url: string, i: number) => {
                const type = getVideoType(url);
                const ytId = type === "youtube" ? getYouTubeId(url) : null;
                const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
                const VideoIcon = type === "youtube" ? Video : type === "instagram" ? Camera : Music2;
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, border: "1.5px solid #E4DCF0", overflow: "hidden" }}>
                      {thumb ? (
                        <div style={{ position: "relative", height: 140 }}>
                          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Play size={16} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 2 }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 10 }}>
                          <VideoIcon size={18} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#6B6B6B", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{url}</span>
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}

        <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />

        {/* Upcoming events */}
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Upcoming Events
        </h3>
        {upcoming.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9E9E9E", marginBottom: 20 }}>No upcoming events yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {upcoming.map((event) => {
              const isSoldOut = event.capacity && (event.tickets_sold || 0) >= event.capacity;
              const lowestPrice = event.ticket_types?.length
                ? Math.min(...event.ticket_types.map((t: any) => t.price ?? 0))
                : (event.ticket_price ?? 0);
              return (
                <div key={event.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "12px 14px", border: "1px solid #EDE0F7", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                    {event.images?.[0]
                      ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Calendar size={18} style={{ color: "#5B0EA6" }} />
                        </div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {event.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                      {format(new Date(event.start_date), "dd MMM · HH:mm")}
                    </p>
                    {(event.address || event.custom_venue_address) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                        <MapPin size={10} style={{ color: "#9E9E9E" }} />
                        <span style={{ fontSize: 10, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {event.address || event.custom_venue_address}
                        </span>
                      </div>
                    )}
                  </div>
                  {isSoldOut ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>
                      Sold Out
                    </span>
                  ) : (
                    <button
                      onClick={() => setTicketSheetEvent(event)}
                      style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      <Ticket size={12} />
                      {lowestPrice === 0 ? "Free" : formatCurrency(lowestPrice)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Past events */}
        {past.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Past Events
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
              {past.map((event) => (
                <div key={event.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "10px 14px", opacity: 0.65, display: "flex", alignItems: "center", gap: 10 }}>
                  <Building2 size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 1px" }}>{event.title}</p>
                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>{format(new Date(event.start_date), "dd MMM yyyy")}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {ticketSheetEvent && (
        <TicketPurchaseSheet
          event={ticketSheetEvent}
          isOpen={!!ticketSheetEvent}
          onClose={() => setTicketSheetEvent(null)}
          navigateOnSuccess={false}
          onSuccess={() => {
            setTicketSheetEvent(null);
            qc.invalidateQueries({ queryKey: ["organizer-events", id] });
          }}
        />
      )}
    </MainLayout>
  );
}