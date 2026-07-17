/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, MapPin, Calendar, CheckCircle,
  AlertTriangle, Ticket, Navigation, ChevronRight,
  ChevronLeft, X, Star, MessageCircle, Phone,
  Globe, Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  active:     { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed",  dot: "#5B0EA6" },
  confirmed:  { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed",  dot: "#5B0EA6" },
  checked_in: { bg: "#FEF2F2", color: "#EF4444", label: "Used 🎟",    dot: "#EF4444" },
  completed:  { bg: "#E0F7EA", color: "#00C853", label: "Completed",  dot: "#00C853" },
  cancelled:  { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled",  dot: "#EF4444" },
  disputed:   { bg: "#FEF3C7", color: "#D97706", label: "Disputed",   dot: "#D97706" },
  pending:    { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending",    dot: "#9E9E9E" },
};

const TICKET_CLASSIFICATION_STYLES: Record<string, { color: string; bg: string; gradient: string }> = {
  regular:    { color: "#6B6B6B", bg: "#F2EEF9", gradient: "linear-gradient(135deg,#6B6B6B,#9E9E9E)" },
  vip:        { color: "#5B0EA6", bg: "#EDE0F7", gradient: "linear-gradient(135deg,#5B0EA6,#7B2FBE)" },
  vvip:       { color: "#E07B00", bg: "#FFF3E0", gradient: "linear-gradient(135deg,#E07B00,#F59E0B)" },
  early_bird: { color: "#00C853", bg: "#E0F7EA", gradient: "linear-gradient(135deg,#00C853,#059669)" },
  table:      { color: "#2563EB", bg: "#EFF6FF", gradient: "linear-gradient(135deg,#2563EB,#3B82F6)" },
  student:    { color: "#7B2FBE", bg: "#F3E8FF", gradient: "linear-gradient(135deg,#7B2FBE,#9333EA)" },
};

function openDirections(lat: number, lng: number, name: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const encodedName = encodeURIComponent(name);
  if (isIOS) window.open(`maps://?daddr=${lat},${lng}&q=${encodedName}`, "_blank");
  else if (isAndroid) window.open(`geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`, "_blank");
  else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

function QRDisplay({ value }: { value: string }) {
  const size  = 200;
  const cells = 21;
  const cellSize = size / cells;
  const grid: boolean[][] = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) & 0xffffffff;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0x100000000; };
  for (let r = 0; r < cells; r++) {
    grid[r] = [];
    for (let c = 0; c < cells; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8);
      if (inFinder) {
        const lr = r % 8; const lc = c % 8;
        const rr = r >= cells - 8 ? r - (cells - 8) : r;
        const rc = c >= cells - 8 ? c - (cells - 8) : c;
        const border   = lr === 0 || lr === 6 || lc === 0 || lc === 6 || rr === 0 || rr === 6 || rc === 0 || rc === 6;
        const innerDot = (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) || (rr >= 2 && rr <= 4 && rc >= 2 && rc <= 4);
        grid[r][c] = border || innerDot;
      } else { grid[r][c] = rand() > 0.5; }
    }
  }
  return (
    <div style={{ padding: 16, backgroundColor: "#FFFFFF", borderRadius: 20, display: "inline-block", boxShadow: "0 4px 24px rgba(91,14,166,0.15)" }}>
      <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        {grid.map((row, r) => row.map((filled, c) => filled
          ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#0A0A0A" />
          : null))}
      </svg>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [activeImage,      setActiveImage]      = useState(0);
  const [lightboxOpen,     setLightboxOpen]      = useState(false);
  const [showDispute,      setShowDispute]       = useState(false);
  const [disputeReason,    setDisputeReason]     = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data: ticketData, error } = await (supabase.from("tickets") as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error || !ticketData) return null;
      if (ticketData.event_id) {
        const { data: eventData } = await supabase
          .from("events")
          .select(`
            title, address, images, start_date, end_date, lat, lng,
            total_capacity, ticket_types, vendor_id, dress_code,
            vendors!events_vendor_id_fkey(business_name, avatar_url, description, instagram, phone, whatsapp, website, contact_email),
            organizer:vendors!events_organizer_vendor_id_fkey(business_name, avatar_url, description, instagram, phone, whatsapp, website, contact_email)
          `)
          .eq("id", ticketData.event_id)
          .single();
        return { ...ticketData, events: eventData || null } as any;
      }
      return { ...ticketData, events: null } as any;
    },
    staleTime: 0,
    refetchInterval: 15000,
  });

  // ── 30-day auto-complete ──────────────────────────────────────────────
  const autoCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!ticket) return;
      const amount    = ticket.amount_paid;
      const vendorCut = Math.round(amount * 0.95);
      const chillzCut = amount - vendorCut;
      const txId      = crypto.randomUUID();
      await (supabase.from("ledger_entries") as any).insert([
        { transaction_id: txId, account_type: "USER_RESERVED",  account_id: ticket.user_id,   direction: "DEBIT",  amount,      note: "Ticket auto-completed — 30 days after event", reference_id: id, reference_type: "ticket_auto_complete" },
        ...(ticket.vendor_id ? [{ transaction_id: txId, account_type: "VENDOR_PENDING", account_id: ticket.vendor_id, direction: "CREDIT", amount: vendorCut, note: "95% ticket payout — auto-released", reference_id: id, reference_type: "ticket_auto_complete" }] : []),
        { transaction_id: txId, account_type: "CHILLZ_REVENUE", account_id: "chillz",        direction: "CREDIT", amount: chillzCut, note: "5% platform fee — auto-released", reference_id: id, reference_type: "ticket_auto_complete" },
      ]);
      await (supabase.from("tickets") as any).update({ status: "completed" }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  useEffect(() => {
    if (!ticket || !ticket.events?.end_date) return;
    if (!["active", "confirmed", "checked_in"].includes(ticket.status)) return;
    const thirtyDaysAfter = new Date(new Date(ticket.events.end_date).getTime() + 30 * 24 * 60 * 60 * 1000);
    if (new Date() > thirtyDaysAfter) autoCompleteMutation.mutate();
  }, [ticket?.id, ticket?.status]);

  // ── Dispute mutation ──────────────────────────────────────────────────
  const disputeMutation = useMutation({
    mutationFn: async () => {
      if (!disputeReason.trim()) throw new Error("Please describe the issue");
      await (supabase.from("tickets") as any).update({ status: "disputed" }).eq("id", id);
      if (ticket?.vendor_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: ticket.vendor_id,
          title:   "Ticket Disputed",
          body:    `A guest raised a dispute for ticket #${id.slice(0, 8).toUpperCase()}. Reason: ${disputeReason.trim().slice(0, 100)}`,
          type:    "ticket",
          reference_id: id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setShowDispute(false);
      setDisputeReason("");
    },
    onError: (e: any) => console.error("Dispute failed:", e.message),
  });

  const event   = ticket?.events;
  const images  = event?.images || [];
  const status  = ticket ? (STATUS_STYLE[ticket.status] || STATUS_STYLE.pending) : null;

  const ticketTypeDetails = event?.ticket_types?.find((t: any) => t.name === ticket?.ticket_type_name);
  const clsKey = ticket?.ticket_type_classification || ticketTypeDetails?.classification || "regular";
  const cls    = TICKET_CLASSIFICATION_STYLES[clsKey] || TICKET_CLASSIFICATION_STYLES.regular;

  const isActive    = ["active", "confirmed"].includes(ticket?.status || "");
  const isCheckedIn = ticket?.status === "checked_in";
  const isCompleted = ticket?.status === "completed";
  const isCancelled = ticket?.status === "cancelled";
  const isDisputed  = ticket?.status === "disputed";

  const host = event?.organizer || event?.vendors;

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: event?.title, text: `My ticket to ${event?.title}`, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!ticket) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <Ticket size={40} style={{ color: "#E4DCF0" }} />
        <p style={{ color: "#6B6B6B", fontSize: 14, fontWeight: 600 }}>Ticket not found.</p>
        <button onClick={() => router.back()}
          style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", backgroundColor: "#F7F5FA", paddingBottom: 60 }}>

        {/* ── Hero ── */}
        <div style={{ position: "relative", height: 300, backgroundColor: "#3D0066", overflow: "hidden" }}>
          {images.length > 0 ? (
            <img
              src={images[activeImage]}
              alt={event?.title}
              onClick={() => setLightboxOpen(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#3D0066,#5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ticket size={72} style={{ color: "rgba(255,255,255,0.15)" }} />
            </div>
          )}

          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 35%, rgba(10,0,30,0.85) 100%)", pointerEvents: "none" }} />

          {/* Top nav */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
            <button onClick={() => router.back()}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <button onClick={handleShare}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} style={{ color: "#FFFFFF" }} />
            </button>
          </div>

          {/* Image dots */}
          {images.length > 1 && (
            <>
              <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                {images.map((_: any, i: number) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    style={{ width: i === activeImage ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
              {activeImage > 0 && (
                <button onClick={() => setActiveImage(i => i - 1)}
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}
              {activeImage < images.length - 1 && (
                <button onClick={() => setActiveImage(i => i + 1)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}
            </>
          )}

          {/* Event title overlay */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 16px" }}>
            {host?.business_name && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "0 0 4px", fontWeight: 600 }}>
                by {host.business_name}
              </p>
            )}
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", margin: "0 0 6px", fontFamily: "var(--font-display,Syne,sans-serif)", textShadow: "0 2px 8px rgba(0,0,0,0.4)", lineHeight: 1.2 }}>
              {event?.title || "Event Ticket"}
            </h1>
            {event?.address && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} style={{ color: "rgba(255,255,255,0.7)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── White card content ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", marginTop: -16, padding: "20px 16px 0", position: "relative", zIndex: 1 }}>

          {/* Status + amount row */}
          {status && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: status.bg, borderRadius: 999, padding: "7px 16px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: status.dot, boxShadow: `0 0 6px ${status.dot}` }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: status.color }}>{status.label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: ACCENT, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                {formatCurrency(ticket.amount_paid)}
              </span>
            </div>
          )}

          {/* Ticket type badge */}
          {ticket.ticket_type_name && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 14, padding: "10px 16px", background: cls.gradient, boxShadow: `0 4px 16px ${cls.color}40` }}>
                <Ticket size={16} style={{ color: "#FFFFFF" }} />
                <div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {clsKey.replace(/_/g, " ")}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF", margin: 0 }}>{ticket.ticket_type_name}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Checked in SUCCESS state ── */}
          {isCheckedIn && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ background: "linear-gradient(135deg,#00C853,#065F46)", borderRadius: 20, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                <CheckCircle size={30} style={{ color: "#FFFFFF" }} />
              </motion.div>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: "0 0 4px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>You're In! 🎉</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0 }}>Enjoy the event. Your ticket has been scanned.</p>
            </motion.div>
          )}

          {/* ── Completed state ── */}
          {isCompleted && (
            <div style={{ backgroundColor: "#E0F7EA", border: "1.5px solid #A7F3D0", borderRadius: 16, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10 }}>
              <CheckCircle size={18} style={{ color: "#00C853", flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 3px" }}>Event Attended</p>
                <p style={{ fontSize: 12, color: "#047857", margin: 0 }}>Thanks for coming. Hope you had an amazing time!</p>
              </div>
            </div>
          )}

          {/* Rate experience — completed or checked_in */}
          {(isCompleted || isCheckedIn) && (
            <Link href={`/review/${id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: ACCENT_BG, borderRadius: 14, padding: "13px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Star size={16} style={{ color: ACCENT, fill: ACCENT }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Rate your experience</span>
              </div>
              <ChevronRight size={16} style={{ color: ACCENT }} />
            </Link>
          )}

          {/* ── Cancelled state ── */}
          {isCancelled && (
            <div style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 16, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10 }}>
              <X size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#EF4444", margin: "0 0 3px" }}>Ticket Cancelled</p>
                <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0 }}>{formatCurrency(ticket.amount_paid)} has been refunded to your wallet.</p>
              </div>
            </div>
          )}

          {/* ── Disputed state ── */}
          {isDisputed && (
            <div style={{ backgroundColor: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={16} style={{ color: "#D97706" }} />
                <p style={{ fontWeight: 700, fontSize: 13, color: "#D97706", margin: 0 }}>Dispute Open</p>
              </div>
              <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>Chillz support is reviewing your dispute. Resolution within 8 hours.</p>
            </div>
          )}

          {/* ── Event info cards ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>

            {event?.start_date && (
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Calendar size={19} style={{ color: ACCENT }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Date & Time</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{format(new Date(event.start_date), "EEEE, dd MMMM yyyy")}</p>
                  <p style={{ fontSize: 12, color: "#6B6B6B", margin: "2px 0 0" }}>
                    {format(new Date(event.start_date), "HH:mm")}
                    {event.end_date && ` – ${format(new Date(event.end_date), "HH:mm")}`}
                  </p>
                </div>
              </div>
            )}

            {event?.address && (
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={19} style={{ color: ACCENT }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Location</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.address}</p>
                </div>
                {event.lat && event.lng && (
                  <button onClick={() => openDirections(event.lat, event.lng, event.title)}
                    style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    <Navigation size={11} />Go
                  </button>
                )}
              </div>
            )}

            {event?.dress_code && (
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "13px 14px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Dress C</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{event.dress_code}</p>
              </div>
            )}

            {/* Ticket details card */}
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px" }}>
              {[
                { label: "Ticket ID",  value: ticket.ticket_code || `#${id.slice(0, 8).toUpperCase()}`, mono: true },
                { label: "Purchased",  value: format(new Date(ticket.created_at), "dd MMM yyyy · HH:mm") },
                ...(ticket.qty > 1 || ticket.ticket_qty > 1 ? [{ label: "Quantity", value: `${ticket.qty || ticket.ticket_qty}×` }] : []),
                { label: "Amount Paid", value: formatCurrency(ticket.amount_paid) },
              ].map(({ label, value, mono }: any) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #EEEBF5" }}>
                  <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", textAlign: "right", fontFamily: mono ? "monospace" : "inherit", letterSpacing: mono ? "0.05em" : "normal" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── QR Code — active and confirmed only ── */}
          {(isActive) && ticket.qr_code_hash && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px 2px" }}>Entry QR Code</p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, background: "linear-gradient(135deg,#F9F5FF,#EDE0F7)", borderRadius: 24, padding: "28px 16px", border: "1.5px solid #D8C8F0" }}>
                <QRDisplay value={ticket.ticket_code || ticket.qr_code_hash || id} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px" }}>Show this at the entrance</p>
                <div style={{ backgroundColor: "#0A0A0A", borderRadius: 16, padding: "20px 24px", marginBottom: 12 }}>
                  <p style={{ fontSize: ticket.ticket_code ? 24 : 38, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "monospace", letterSpacing: "0.08em", textAlign: "center" }}>
                    {ticket.ticket_code || ticket.qr_code_hash?.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E" }}>Staff will scan this code to grant entry</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Checked in QR (greyed) ── */}
          {isCheckedIn && ticket.qr_code_hash && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", borderRadius: 20, padding: "20px 16px", opacity: 0.5 }}>
                <QRDisplay value={ticket.ticket_code || ticket.qr_code_hash || id} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E0F7EA", borderRadius: 999, padding: "5px 14px" }}>
                  <CheckCircle size={13} style={{ color: "#00C853" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#00C853" }}>Already Scanned</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Ready for entry banner ── */}
          {isActive && (
            <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, borderRadius: 16, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ticket size={20} style={{ color: "#FFFFFF" }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF", margin: "0 0 2px" }}>Ready for Entry</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: 0 }}>Present your QR code at the entrance</p>
              </div>
            </div>
          )}

          {/* ── Host card ── */}
          {host && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, border: "1px solid #F0EBF8", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ background: "linear-gradient(135deg,#3B0764,#5B0EA6)", padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                  {event?.organizer ? "Event Organizer" : "Hosted at"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {host.avatar_url
                      ? <img src={host.avatar_url} alt={host.business_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF" }}>{host.business_name?.[0] || "?"}</span>}
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{host.business_name}</p>
                </div>
              </div>
              {host.description && (
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EEF9" }}>
                  <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>{host.description}</p>
                </div>
              )}
              {(host.whatsapp || host.phone || host.instagram || host.website || host.contact_email) && (
                <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {host.whatsapp && (
                    <a href={`https://wa.me/${host.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 10, padding: "7px 12px" }}>
                      <MessageCircle size={12} style={{ color: "#059669" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span>
                    </a>
                  )}
                  {host.phone && (
                    <a href={`tel:${host.phone}`}
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: ACCENT_BG, border: "1px solid #C4BAD8", borderRadius: 10, padding: "7px 12px" }}>
                      <Phone size={12} style={{ color: ACCENT }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Call</span>
                    </a>
                  )}
                  {host.instagram && (
                    <a href={`https://instagram.com/${host.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#FFF0E6,#FCE4EC)", border: "1px solid #FBBF24", borderRadius: 10, padding: "7px 12px" }}>
                      <span style={{ fontSize: 12 }}>📸</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>Instagram</span>
                    </a>
                  )}
                  {host.website && (
                    <a href={host.website.startsWith("http") ? host.website : `https://${host.website}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 10, padding: "7px 12px" }}>
                      <Globe size={12} style={{ color: "#6B6B6B" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Website</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Dispute button ── */}
          {!isCancelled && !isDisputed && !isCompleted && (
            <button onClick={() => setShowDispute(true)}
              style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
              <AlertTriangle size={14} />Report an Issue
            </button>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* ── Dispute Sheet ── */}
      <AnimatePresence>
        {showDispute && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowDispute(false); setDisputeReason(""); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "20px 20px 48px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <AlertTriangle size={26} style={{ color: "#D97706" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px" }}>Report an Issue</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                  Describe what happened. Chillz support will review and respond within 8 hours.
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  What happened? <span style={{ color: "#EF4444" }}>*</span>
                </p>
                <textarea
                  placeholder="e.g. Entry was denied despite valid ticket, wrong ticket type issued..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  rows={3}
                  style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }}
                />
              </div>
              {disputeMutation.isError && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{(disputeMutation.error as Error).message}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowDispute(false); setDisputeReason(""); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => disputeMutation.mutate()}
                  disabled={disputeMutation.isPending || !disputeReason.trim()}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: disputeMutation.isPending || !disputeReason.trim() ? "#9E9E9E" : "#D97706", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: disputeMutation.isPending || !disputeReason.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {disputeMutation.isPending ? "Submitting..." : <><AlertTriangle size={14} />Submit Report</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && images.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={() => setLightboxOpen(false)}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            {images.length > 1 && (
              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{activeImage + 1} / {images.length}</span>
              </div>
            )}
            {activeImage > 0 && (
              <button onClick={e => { e.stopPropagation(); setActiveImage(i => i - 1); }}
                style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            {activeImage < images.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setActiveImage(i => i + 1); }}
                style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            <motion.img
              key={images[activeImage]}
              src={images[activeImage]}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }}
            />
            {images.length > 1 && (
              <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {images.map((_: any, i: number) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setActiveImage(i); }}
                    style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}