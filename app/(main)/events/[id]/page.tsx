/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash, generateTicketCode } from "@/lib/utils";
import {
  ArrowLeft, Calendar, MapPin, Ticket, Heart,
  Share2, Navigation, Users, CheckCircle,
  X, AlertTriangle, Plus, Minus, Wallet, CreditCard,
  ChevronRight, Phone, MessageCircle, Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useState, useEffect } from "react";

const EVENT_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  "Rave / Party":          { color: "#EF4444", bg: "#FEF2F2" },
  "Concert":               { color: "#5B0EA6", bg: "#EDE0F7" },
  "Comedy Show":           { color: "#F59E0B", bg: "#FFF8E1" },
  "Seminar / Conference":  { color: "#2563EB", bg: "#EFF6FF" },
  "Networking":            { color: "#059669", bg: "#E0F7EA" },
  "Pop-up / Market":       { color: "#DB2777", bg: "#FDF2F8" },
  "Festival":              { color: "#7B2FBE", bg: "#F3E8FF" },
  "Sports Viewing":        { color: "#0D9488", bg: "#CCFBF1" },
  "Other":                 { color: "#6B6B6B", bg: "#F2EEF9" },
};

function openDirections(lat: number, lng: number, name: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const encodedName = encodeURIComponent(name);
  if (isIOS) window.open(`maps://?daddr=${lat},${lng}&q=${encodedName}`, "_blank");
  else if (isAndroid) window.open(`geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`, "_blank");
  else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

const TICKET_CLASSIFICATION_STYLES: Record<string, { color: string; bg: string }> = {
  regular:    { color: "#6B6B6B", bg: "#F2EEF9" },
  vip:        { color: "#5B0EA6", bg: "#EDE0F7" },
  vvip:       { color: "#E07B00", bg: "#FFF3E0" },
  early_bird: { color: "#00C853", bg: "#E0F7EA" },
  table:      { color: "#2563EB", bg: "#EFF6FF" },
  student:    { color: "#7B2FBE", bg: "#F3E8FF" },
};

function usePaystack() {
  useEffect(() => {
    if (document.getElementById("paystack-script")) return;
    const script = document.createElement("script");
    script.id = "paystack-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  usePaystack();

  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showTicketSheet, setShowTicketSheet] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");
  const [bookingError, setBookingError] = useState("");

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, vendors!events_vendor_id_fkey(business_name, id, avatar_url, description, instagram, phone, whatsapp, website, contact_email), organizer:vendors!events_organizer_vendor_id_fkey(business_name, id, avatar_url, description, instagram, phone, whatsapp, website, contact_email)")
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  const { data: savedRecord } = useQuery({
    queryKey: ["saved-event", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("saved_events") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle();
      return data as { id: string } | null;
    },
    enabled: !!user?.id,
  });

  const liked = !!savedRecord;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) { router.push(`/login?redirect=/events/${id}`); return; }
      if (liked) {
        await (supabase.from("saved_events") as any)
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", id);
      } else {
        await (supabase.from("saved_events") as any)
          .insert({ user_id: user.id, event_id: id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-event", id, user?.id] });
      qc.invalidateQueries({ queryKey: ["saved-events", user?.id] });
    },
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount")
        .eq("account_id", user.id)
        .eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce((acc: number, row: any) =>
        row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });
  const { data: currentUserVendor } = useQuery({
    queryKey: ["is-vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("vendors") as any).select("id, kyc_status")
        .eq("user_id", user.id).maybeSingle();
      return data as { id: string; kyc_status: string } | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isApprovedVendor = currentUserVendor?.kyc_status === "approved";
  
  useEffect(() => {
    if (showTicketSheet && event?.ticket_types?.length > 0 && !selectedTicket) {
      setSelectedTicket(event.ticket_types[0]);
    }
  }, [showTicketSheet, event, selectedTicket]);

  const totalAmount = selectedTicket
    ? (selectedTicket.price || 0) * quantity
    : (event?.ticket_price || 0) * quantity;

  const walletMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to purchase tickets");
      if (!event) throw new Error("Event not found");
      if (totalAmount > (walletBalance || 0)) throw new Error("Insufficient wallet balance");
      const qrHash = generateQRHash();
      const txId = crypto.randomUUID();
      const { data: booking, error: bookingErr } = await (supabase.from("bookings") as any)
        .insert({
          user_id: user.id,
          event_id: event.id,
          vendor_id: event.vendor_id || event.vendors?.id || null,
          status: "confirmed",
          reserved_amount: totalAmount,
          qr_code_hash: qrHash,
          ticket_type_id: selectedTicket?.id || null,
          ticket_type_name: selectedTicket?.name || "General Admission",
          quantity,
          booking_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (bookingErr) throw bookingErr;
      const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert([
        { transaction_id: txId, account_type: "USER_WALLET", account_id: user.id, direction: "DEBIT", amount: totalAmount, note: `Ticket purchase — ${event.title}`, reference_id: booking.id, reference_type: "ticket_purchase" },
        { transaction_id: txId, account_type: "USER_RESERVED", account_id: user.id, direction: "CREDIT", amount: totalAmount, note: `Ticket reserved — ${event.title}`, reference_id: booking.id, reference_type: "ticket_purchase" },
      ]);
      if (ledgerError) throw ledgerError;
      if (selectedTicket && event.ticket_types) {
        const updatedTypes = event.ticket_types.map((t: any) =>
          t.id === selectedTicket.id && t.available !== undefined
            ? { ...t, available: Math.max(0, t.available - quantity), sold: (t.sold || 0) + quantity }
            : t
        );
        await (supabase.from("events") as any).update({ ticket_types: updatedTypes }).eq("id", event.id);
      }
      // Insert one ticket record per seat
      const pricePerSeat = Math.round(totalAmount / quantity);
      const ticketInserts = Array.from({ length: quantity }, () => ({
        event_id:                   event.id,
        user_id:                    user.id,
        vendor_id:                  event.organizer_vendor_id || event.vendor_id || event.vendors?.id || null,
        amount_paid:                pricePerSeat,
        qr_code_hash:               generateQRHash(),
        ticket_code:                generateTicketCode(),
        status:                     "active",
        ticket_type_name:           selectedTicket?.name || "General Admission",
        ticket_type_classification: selectedTicket?.classification || "regular",
        qty:                        1,
        ticket_qty:                 1,
      }));
      const { data: tickets, error: ticketErr } = await (supabase.from("tickets") as any)
        .insert(ticketInserts)
        .select();
      if (ticketErr) throw ticketErr;
      const ticket = tickets[0];
      // Increment tickets_sold
      const { data: evData } = await (supabase.from("events") as any)
        .select("tickets_sold").eq("id", event.id).single();
      await (supabase.from("events") as any)
        .update({ tickets_sold: (evData?.tickets_sold || 0) + quantity })
        .eq("id", event.id);
      await (supabase.from("notifications") as any).insert({
        user_id: user?.id ?? null,
        title: quantity > 1 ? `${quantity} Tickets confirmed!` : "Ticket confirmed!",
        body: quantity > 1
          ? `Your ${quantity} ${selectedTicket?.name || "General Admission"} tickets for ${event.title} are confirmed. Each ticket has its own unique code.`
          : `Your ${selectedTicket?.name || "General Admission"} ticket for ${event.title} is confirmed.`,
        type: "booking",
        reference_id: ticket.id,
        is_read: false,
      });
      return ticket;
    },
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setShowTicketSheet(false);
      router.push(`/tickets/${ticket.id}`);
    },
    onError: (e: any) => setBookingError(e.message),
  });
  
  const handlePaystack = () => {
    if (!user?.email) { setBookingError("Please sign in to purchase tickets"); return; }
    if (!(window as any).PaystackPop) { setBookingError("Payment system loading, please try again"); return; }
    const handler = (window as any).PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: totalAmount * 100,
      currency: "NGN",
      ref: `CHILLZ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      metadata: { event_id: id, event_title: event?.title, ticket_type: selectedTicket?.name || "General Admission", quantity, user_id: user?.id ?? null },
      callback: async (response: any) => {
        try {
          const qrHash = generateQRHash();
          const { data: booking, error: bookingErr } = await (supabase.from("bookings") as any)
            .insert({
              user_id: user?.id ?? null, event_id: event.id,
              vendor_id: event.vendor_id || event.vendors?.id || null,
              status: "confirmed", reserved_amount: totalAmount, qr_code_hash: qrHash,
              ticket_type_id: selectedTicket?.id || null,
              ticket_type_name: selectedTicket?.name || "General Admission",
              quantity, booking_date: new Date().toISOString(),
              notes: `Paystack ref: ${response.reference}`,
            })
            .select().single();
          if (bookingErr) throw bookingErr;
          if (selectedTicket && event.ticket_types) {
            const updatedTypes = event.ticket_types.map((t: any) =>
              t.id === selectedTicket.id && t.available !== undefined
                ? { ...t, available: Math.max(0, t.available - quantity), sold: (t.sold || 0) + quantity }
                : t
            );
            await (supabase.from("events") as any).update({ ticket_types: updatedTypes }).eq("id", event.id);
          }
          const ticketCode = generateTicketCode();
          const { data: ticket, error: ticketErr } = await (supabase.from("tickets") as any)
            .insert({
              event_id:                   event.id,
              user_id:                    user?.id ?? null,
              vendor_id:                  event.organizer_vendor_id || event.vendor_id || event.vendors?.id || null,
              amount_paid:                totalAmount,
              qr_code_hash:               qrHash,
              ticket_code:                ticketCode,
              status:                     "active",
              ticket_type_name:           selectedTicket?.name || "General Admission",
              ticket_type_classification: selectedTicket?.classification || "regular",
              qty:                        quantity,
              ticket_qty:                 quantity,
            })
            .select()
            .single();
          if (ticketErr) throw ticketErr;

          await (supabase.from("notifications") as any).insert({
            user_id: user.id, title: "Ticket confirmed!",
            body: `Your ${selectedTicket?.name || "General Admission"} ticket for ${event.title} is confirmed.`,
            type: "booking", reference_id: ticket.id, is_read: false,
          });
          qc.invalidateQueries({ queryKey: ["tickets"] });
          setShowTicketSheet(false);
          router.push(`/tickets/${ticket.id}`);
        } catch (err: any) { setBookingError(err.message || "Booking creation failed after payment"); }
      },
      onClose: () => {},
    });
    handler.openIframe();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
          <p style={{ color: "#6B6B6B", fontSize: 14 }}>Event not found.</p>
          <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
        </div>
      </MainLayout>
    );
  }

  const hasTicketTypes = event.ticket_types && event.ticket_types.length > 0;
  const lowestPrice = hasTicketTypes
    ? Math.min(...event.ticket_types.map((t: any) => t.price || 0))
    : event.ticket_price || 0;

  const typeStyle = EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS["Other"];
  const isOrganizerEvent = !!event.organizer_vendor_id;
  const hostName = isOrganizerEvent ? event.organizer?.business_name : event.vendors?.business_name;
  const images = event.images || [];

  return (
    <MainLayout>
      {/* Hero */}
      <div style={{ position: "relative", height: 300, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
        {images.length > 0
          ? <img
              src={images[activeImage]}
              alt={event.title}
              onClick={() => setLightboxOpen(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Calendar size={60} style={{ color: "rgba(255,255,255,0.3)" }} /></div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(61,0,102,0.7) 100%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
          <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              onClick={() => saveMutation.mutate()}
              whileTap={{ scale: 0.85 }}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: liked ? "rgba(255,75,110,0.25)" : "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: liked ? "1px solid rgba(255,75,110,0.4)" : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={liked ? "liked" : "unliked"}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Heart size={18} style={{ color: liked ? "#FF4B6E" : "#FFFFFF", fill: liked ? "#FF4B6E" : "none" }} />
                </motion.div>
              </AnimatePresence>
            </motion.button>
            <button style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} style={{ color: "#FFFFFF" }} />
            </button>
          </div>
        </div>

        {images.length > 1 && (
          <button onClick={() => setLightboxOpen(true)}
            style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "5px 12px", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>View all {images.length} photos</span>
          </button>
        )}

        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setActiveImage(i)}
                style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        )}

        {event.is_featured && (
          <div style={{ position: "absolute", bottom: 16, left: 16 }}>
            <span style={{ backgroundColor: "#00C853", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>Featured</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", marginTop: -16, padding: "20px 16px 0", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {event.event_type && (
            <span style={{ fontSize: 10, fontWeight: 800, color: typeStyle.color, backgroundColor: typeStyle.bg, padding: "4px 10px", borderRadius: 999 }}>
              {event.event_type}
            </span>
          )}
          {isOrganizerEvent && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", display: "flex", alignItems: "center", gap: 3 }}>
              <CheckCircle size={11} style={{ color: "#5B0EA6" }} /> Verified Organizer
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{event.title}</h1>
        {hostName && (
          <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px" }}>
            {isOrganizerEvent ? "Hosted by" : "Held at"} <span style={{ color: "#5B0EA6", fontWeight: 600 }}>{hostName}</span>
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Calendar size={18} style={{ color: "#5B0EA6" }} />
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

          {event.address && (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MapPin size={18} style={{ color: "#5B0EA6" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Location</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.address}</p>
              </div>
              {event.lat && event.lng && (
                <button onClick={() => openDirections(event.lat, event.lng, event.title)}
                  style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  <Navigation size={11} />Go
                </button>
              )}
            </div>
          )}

          {(event.total_capacity > 0 || event.capacity > 0) && (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Users size={18} style={{ color: "#5B0EA6" }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Capacity</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                  {(event.total_capacity || event.capacity).toLocaleString()} attendees
                  {event.tickets_sold > 0 && <span style={{ fontWeight: 500, color: "#6B6B6B" }}> · {event.tickets_sold} sold</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {(event.event_tags?.length > 0 || event.music_vibe?.length > 0 || event.is_outdoor) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
            {event.event_tags?.map((tag: string) => (
              <span key={tag} style={{ backgroundColor: "#F2EEF9", color: "#5B0EA6", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: "1px solid #E4DCF0" }}>{tag}</span>
            ))}
            {event.music_vibe?.map((vibe: string) => (
              <span key={vibe} style={{ backgroundColor: "#FDF2F8", color: "#DB2777", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999 }}>🎵 {vibe}</span>
            ))}
            {event.is_outdoor && (
              <span style={{ backgroundColor: "#E0F7EA", color: "#059669", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 999 }}>Outdoor</span>
            )}
          </div>
        )}

        {event.description && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, marginBottom: 20 }}>{event.description}</p>
          </>
        )}

        {/* DJ Lineup */}
        {event.dj_lineup?.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 10px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Lineup</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {event.dj_lineup.map((dj: string) => (
                <span key={dj} style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#0A0A0A", border: "1px solid #E4DCF0" }}>🎧 {dj}</span>
              ))}
            </div>
          </>
        )}

        {/* Dress code / age restriction */}
        {(event.dress_code || event.age_restriction) && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 10px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Good to Know</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {event.dress_code && (
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Dress Code</p>
                  <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{event.dress_code}</p>
                </div>
              )}
              {event.age_restriction && (
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Age Restriction</p>
                  <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{event.age_restriction}</p>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />

        {/* Tickets section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Ticket size={16} style={{ color: "#5B0EA6" }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Tickets</h3>
          </div>

          {hasTicketTypes ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {event.ticket_types.map((ticket: any, idx: number) => {
                const cls = TICKET_CLASSIFICATION_STYLES[ticket.classification] || TICKET_CLASSIFICATION_STYLES.regular;
                const soldOut = ticket.available !== undefined && ticket.available <= 0;
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", border: `1.5px solid ${soldOut ? "#E4DCF0" : "#EDE0F7"}`, opacity: soldOut ? 0.6 : 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                            <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: 0 }}>{ticket.name}</p>
                            {ticket.classification && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: cls.color, backgroundColor: cls.bg, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {ticket.classification.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          {ticket.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "0 0 6px", lineHeight: 1.4 }}>{ticket.description}</p>}
                          <span style={{ fontSize: 11, fontWeight: 700, color: soldOut ? "#EF4444" : "#00C853", backgroundColor: soldOut ? "#FEF2F2" : "#E0F7EA", padding: "2px 8px", borderRadius: 999 }}>
                            {soldOut ? "Sold out" : ticket.available !== undefined ? `${ticket.available} left` : "Available"}
                          </span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {ticket.price === 0 ? "Free" : formatCurrency(ticket.price)}
                          </p>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "2px 0 0" }}>per person</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : event.ticket_price !== null && event.ticket_price !== undefined ? (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", border: "1.5px solid #EDE0F7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ticket size={18} style={{ color: "#5B0EA6" }} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>General Admission</p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Standard entry ticket</p>
                </div>
              </div>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {event.ticket_price === 0 ? "Free" : formatCurrency(event.ticket_price)}
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "16px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No ticket information available</p>
            </div>
          )}
        </div>

        {/* ── Host / Organizer card ── */}
        {(() => {
          const host = isOrganizerEvent ? event.organizer : event.vendors;
          if (!host) return null;
          const venueId = event.venue_id;
          const CardWrapper = ({ children }: { children: React.ReactNode }) =>
            !isOrganizerEvent && venueId
              ? <a href={`/venue/${venueId}`} style={{ textDecoration: "none", display: "block" }}>{children}</a>
              : <>{children}</>;
          return (
            <CardWrapper>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, border: "1px solid #F0EBF8", overflow: "hidden", marginBottom: 100, cursor: !isOrganizerEvent && venueId ? "pointer" : "default" }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg, #3B0764, #5B0EA6)", padding: "16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                  {isOrganizerEvent ? "Event Organizer" : "Hosted at"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {host.avatar_url
                      ? <img src={host.avatar_url} alt={host.business_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF" }}>{host.business_name?.[0] || "?"}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {host.business_name}
                    </p>
                    {isOrganizerEvent && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle size={9} style={{ color: "#FFFFFF" }} /> Verified Organizer
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {host.description && (
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F2EEF9" }}>
                  <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.7 }}>{host.description}</p>
                </div>
              )}

              {/* Contact links */}
              {(host.whatsapp || host.phone || host.instagram || host.website || host.contact_email) && (
                <div style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {host.whatsapp && (
                    <a href={`https://wa.me/${host.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "8px 13px" }}>
                      <MessageCircle size={13} style={{ color: "#059669" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span>
                    </a>
                  )}
                  {host.phone && (
                    <a href={`tel:${host.phone}`}
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#EDE0F7", border: "1px solid #C4BAD8", borderRadius: 12, padding: "8px 13px" }}>
                      <Phone size={13} style={{ color: "#5B0EA6" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>Call</span>
                    </a>
                  )}
                  {host.instagram && (
                    <a href={`https://instagram.com/${host.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #FFF0E6, #FCE4EC)", border: "1px solid #FBBF24", borderRadius: 12, padding: "8px 13px" }}>
                      <span style={{ fontSize: 13 }}>📸</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>Instagram</span>
                    </a>
                  )}
                  {host.website && (
                    <a href={host.website.startsWith("http") ? host.website : `https://${host.website}`} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 12, padding: "8px 13px" }}>
                      <Globe size={13} style={{ color: "#6B6B6B" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Website</span>
                    </a>
                  )}
                  {host.contact_email && (
                    <a href={`mailto:${host.contact_email}`}
                      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "8px 13px" }}>
                      <span style={{ fontSize: 13 }}>✉️</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Email</span>
                    </a>
                  )}
                </div>
              )}
            </div>
            </CardWrapper>
          );
        })()}

      </div>

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 2px" }}>{hasTicketTypes ? "Starting from" : "Ticket price"}</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {lowestPrice === 0 ? "Free" : formatCurrency(lowestPrice)}
            </p>
          </div>
          {isApprovedVendor ? (
            <div style={{ padding: "10px 20px", borderRadius: 16, backgroundColor: "#F2EEF9", border: "1.5px solid #E4DCF0", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E" }}>Vendor accounts cannot buy tickets</span>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!user) { router.push(`/login?redirect=/events/${id}`); return; }
                setSelectedTicket(hasTicketTypes ? event.ticket_types[0] : null);
                setQuantity(1);
                setBookingError("");
                setShowTicketSheet(true);
              }}
              style={{ padding: "14px 28px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(91,14,166,0.35)" }}>
              Get Tickets
            </button>
          )}
        </div>
      </div>

      {/* Ticket sheet — unchanged from working version */}
      <AnimatePresence>
        {showTicketSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTicketSheet(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", maxWidth: 480, margin: "0 auto", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Get Tickets</h3>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>{event.title}</p>
                </div>
                <button onClick={() => setShowTicketSheet(false)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} style={{ color: "#6B6B6B" }} />
                </button>
              </div>

              {hasTicketTypes && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Ticket Type</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {event.ticket_types.map((ticket: any, idx: number) => {
                      const cls = TICKET_CLASSIFICATION_STYLES[ticket.classification] || TICKET_CLASSIFICATION_STYLES.regular;
                      const soldOut = ticket.available !== undefined && ticket.available <= 0;
                      const isSelected = selectedTicket?.id === ticket.id;
                      return (
                        <button key={idx} onClick={() => { if (!soldOut) { setSelectedTicket(ticket); setQuantity(1); } }} disabled={soldOut}
                          style={{ width: "100%", padding: "14px", borderRadius: 16, border: `2px solid ${isSelected ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isSelected ? "#F9F5FF" : "#FFFFFF", cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.5 : 1, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A" }}>{ticket.name}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: cls.color, backgroundColor: cls.bg, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase" }}>
                                {ticket.classification?.replace(/_/g, " ")}
                              </span>
                            </div>
                            {ticket.description && <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>{ticket.description}</p>}
                            <span style={{ fontSize: 10, fontWeight: 600, color: soldOut ? "#EF4444" : "#9E9E9E" }}>
                              {soldOut ? "Sold out" : ticket.available !== undefined ? `${ticket.available} remaining` : "Available"}
                            </span>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ fontSize: 16, fontWeight: 900, color: isSelected ? "#5B0EA6" : "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                              {ticket.price === 0 ? "Free" : formatCurrency(ticket.price)}
                            </p>
                            {isSelected && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}><CheckCircle size={14} style={{ color: "#5B0EA6" }} /></div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quantity</p>
                <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 16px" }}>
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Minus size={16} style={{ color: "#5B0EA6" }} />
                  </button>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 900, color: "#0A0A0A", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{quantity}</span>
                  <button onClick={() => { const max = selectedTicket?.available ?? 10; setQuantity(Math.min(max, quantity + 1)); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Plus size={16} style={{ color: "#5B0EA6" }} />
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Order Summary</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#6B6B6B" }}>{selectedTicket?.name || "General Admission"} × {quantity}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{totalAmount === 0 ? "Free" : formatCurrency(totalAmount)}</span>
                </div>
                <div style={{ borderTop: "1px solid #E4DCF0", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{totalAmount === 0 ? "Free" : formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {totalAmount > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Payment Method</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { key: "wallet" as const, icon: <Wallet size={20} />, label: "Wallet", sub: formatCurrency(walletBalance || 0), warn: (walletBalance || 0) < totalAmount },
                      { key: "card" as const, icon: <CreditCard size={20} />, label: "Card", sub: "Paystack", warn: false },
                    ].map(({ key, icon, label, sub, warn }) => (
                      <button key={key} onClick={() => setPaymentMethod(key)}
                        style={{ flex: 1, padding: "12px 10px", borderRadius: 14, border: `2px solid ${paymentMethod === key ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: paymentMethod === key ? "#F9F5FF" : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <span style={{ color: paymentMethod === key ? "#5B0EA6" : "#9E9E9E" }}>{icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: paymentMethod === key ? "#5B0EA6" : "#6B6B6B" }}>{label}</span>
                        <span style={{ fontSize: 10, color: paymentMethod === key ? "#7B2FBE" : "#9E9E9E", fontWeight: 600 }}>{sub}</span>
                        {warn && <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 600 }}>Insufficient</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === "wallet" && totalAmount > 0 && (walletBalance || 0) < totalAmount && (
                <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>You need {formatCurrency(totalAmount - (walletBalance || 0))} more</p>
                  </div>
                  <button onClick={() => { setShowTicketSheet(false); router.push("/wallet"); }}
                    style={{ backgroundColor: "#F59E0B", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Fund Wallet
                  </button>
                </div>
              )}

              <AnimatePresence>
                {bookingError && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{bookingError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => { setBookingError(""); totalAmount === 0 || paymentMethod === "wallet" ? walletMutation.mutate() : handlePaystack(); }}
                disabled={walletMutation.isPending || (paymentMethod === "wallet" && totalAmount > 0 && (walletBalance || 0) < totalAmount)}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: walletMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: walletMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(91,14,166,0.35)", opacity: (paymentMethod === "wallet" && totalAmount > 0 && (walletBalance || 0) < totalAmount) ? 0.5 : 1 }}>
                {walletMutation.isPending
                  ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                  : totalAmount === 0 ? <><Ticket size={18} />Get Free Ticket</>
                  : paymentMethod === "wallet" ? <><Wallet size={18} />Pay {formatCurrency(totalAmount)} from Wallet</>
                  : <><CreditCard size={18} />Pay {formatCurrency(totalAmount)} with Card</>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox — tap to swipe between images ── */}
      <AnimatePresence>
        {lightboxOpen && images.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>

            <button onClick={() => setLightboxOpen(false)}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>

            {images.length > 1 && (
              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px", zIndex: 102 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{activeImage + 1} / {images.length}</span>
              </div>
            )}

            {activeImage > 0 && (
              <button onClick={e => { e.stopPropagation(); setActiveImage(i => i - 1); }}
                style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF", transform: "rotate(180deg)" }} />
              </button>
            )}

            {activeImage < images.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setActiveImage(i => i + 1); }}
                style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
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
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.x < -80 && activeImage < images.length - 1) setActiveImage(i => i + 1);
                else if (info.offset.x > 80 && activeImage > 0) setActiveImage(i => i - 1);
              }}
              style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12, cursor: "grab" }}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}