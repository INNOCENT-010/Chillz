/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  MessageCircle, Building2, Wallet, QrCode, Calendar,
  Star, HelpCircle, Send, X, ArrowLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

const FAQ = [
  { icon: Wallet, question: "How does the wallet work?", answer: "Your Chillz wallet holds funds you add via Paystack. When you book a venue, the amount is reserved (not spent). It's only deducted when the vendor sends your receipt and you confirm it. Any unused amount is returned to your wallet." },
  { icon: Calendar, question: "How do I book a venue?", answer: "Go to any venue page and tap 'Book This Spot'. Enter the amount you want to reserve, choose a date and time, then confirm. The amount is held in escrow until your visit is complete." },
  { icon: QrCode, question: "What is the QR code for?", answer: "Your booking has a unique QR code. When you arrive at the venue, show it to the staff. They scan it to check you in. After your visit, they build your bill and send a receipt for you to confirm." },
  { icon: CheckCircle, question: "How do I confirm my receipt?", answer: "When the vendor sends your receipt, you get a notification. Open your booking, review the itemised bill, and tap 'Confirm & Pay'. The reserved amount is transferred to the vendor." },
  { icon: Star, question: "When can I leave a review?", answer: "After your booking is marked as completed (receipt confirmed), you'll be prompted to leave a review automatically." },
  { icon: Building2, question: "How do I become a vendor?", answer: "Tap 'I'm a Vendor' on the registration page. Fill in your business details, find your venue on Google Maps, and submit your KYC documents. The Chillz team reviews within 24 hours." },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmed:    { label: "Confirmed",  color: "#5B0EA6", bg: "#EDE0F7", dot: "#5B0EA6" },
  checked_in:   { label: "Checked In",color: "#059669", bg: "#DCFCE7", dot: "#059669" },
  receipt_sent: { label: "Awaiting",  color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  completed:    { label: "Completed", color: "#059669", bg: "#DCFCE7", dot: "#059669" },
  cancelled:    { label: "Cancelled", color: "#EF4444", bg: "#FEE2E2", dot: "#EF4444" },
  disputed:     { label: "Disputed",  color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  pending:      { label: "Pending",   color: "#9E9E9E", bg: "#F2EEF9", dot: "#9E9E9E" },
};

function SupportIllustration() {
  return (
    <svg width="170" height="140" viewBox="0 0 170 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Subtle glow circles behind everything */}
      <circle cx="80" cy="70" r="62" fill="rgba(255,255,255,0.06)" />
      <circle cx="80" cy="70" r="46" fill="rgba(255,255,255,0.06)" />

      {/* ── HEADSET ── */}
      {/* Headband arc */}
      <path d="M38 72 C38 38 122 38 122 72"
        stroke="rgba(255,255,255,0.70)" strokeWidth="7"
        strokeLinecap="round" fill="none" />

      {/* Left ear cup — pill shape */}
      <rect x="26" y="68" width="18" height="30" rx="9"
        fill="rgba(255,255,255,0.55)" />
      {/* Left ear cup inner */}
      <rect x="30" y="73" width="10" height="20" rx="5"
        fill="rgba(180,130,240,0.5)" />

      {/* Right ear cup — pill shape */}
      <rect x="116" y="68" width="18" height="30" rx="9"
        fill="rgba(255,255,255,0.55)" />
      {/* Right ear cup inner */}
      <rect x="120" y="73" width="10" height="20" rx="5"
        fill="rgba(180,130,240,0.5)" />

      {/* Mic arm — curves down from right ear */}
      <path d="M125 93 C133 97 136 110 126 116"
        stroke="rgba(255,255,255,0.60)" strokeWidth="4.5"
        strokeLinecap="round" fill="none" />
      {/* Mic head */}
      <ellipse cx="124" cy="118" rx="6" ry="5"
        fill="rgba(255,255,255,0.70)" />
      {/* Mic dot */}
      <circle cx="124" cy="118" r="2.5"
        fill="rgba(160,100,230,0.8)" />

      {/* ── CHAT BUBBLE (overlapping right side of headset) ── */}
      <rect x="88" y="44" width="72" height="52" rx="18"
        fill="rgba(255,255,255,0.22)" />
      {/* Bubble tail — bottom left of bubble */}
      <path d="M100 96 L90 112 L116 96 Z"
        fill="rgba(255,255,255,0.22)" />
      {/* Three dots */}
      <circle cx="108" cy="70" r="5" fill="rgba(255,255,255,0.80)" />
      <circle cx="124" cy="70" r="5" fill="rgba(255,255,255,0.80)" />
      <circle cx="140" cy="70" r="5" fill="rgba(255,255,255,0.80)" />

      {/* Decorative small dots scattered */}
      <circle cx="20" cy="32" r="4" fill="rgba(255,255,255,0.18)" />
      <circle cx="155" cy="28" r="5" fill="rgba(255,255,255,0.13)" />
      <circle cx="162" cy="110" r="4" fill="rgba(255,255,255,0.10)" />
      <circle cx="14" cy="108" r="3" fill="rgba(255,255,255,0.12)" />
      <circle cx="148" cy="130" r="3" fill="rgba(255,255,255,0.10)" />
    </svg>
  );
}

export default function SupportPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reportType, setReportType] = useState<"vendor" | "chillz" | null>(null);
  const [reportMessage, setReportMessage] = useState("");
  const [reportSubject, setReportSubject] = useState("");
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [userAttachments, setUserAttachments] = useState<string[]>([]);
  const [userUploading, setUserUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);

  const [activeDisputeBookingId, setActiveDisputeBookingId] = useState<string | null>(null);
  const [disputeMessage, setDisputeMessage] = useState("");
  const disputeMessagesEndRef = useRef<HTMLDivElement>(null);

  const { data: recentBookings } = useQuery({
    queryKey: ["support-recent", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: bookingsData } = await (supabase.from("bookings") as any)
        .select("*, venues(name, images)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      const bookings = (bookingsData || []) as any[];

      // Enrich event bookings separately
      const eventIds = bookings.filter((b: any) => b.event_id).map((b: any) => b.event_id);
      let eventsMap: Record<string, any> = {};
      if (eventIds.length > 0) {
        const { data: eventsData } = await (supabase.from("events") as any)
          .select("id, title, images, vendor_id")
          .in("id", eventIds);
        eventsMap = Object.fromEntries((eventsData || []).map((e: any) => [e.id, e]));
      }
      console.log("EVENTS MAP:", eventsMap);
      console.log("BOOKINGS:", bookings.map((b: any) => ({ id: b.id, event_id: b.event_id, venue: b.venues?.name })));
      return bookings.map((b: any) => ({
        ...b,
        events: b.event_id ? eventsMap[b.event_id] || null : null,
      }));
      
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const { data: disputedBookings } = useQuery({
    queryKey: ["disputed-bookings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: bookingsData } = await (supabase.from("bookings") as any)
        .select("*, venues(name, images)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      const bookings = (bookingsData || []) as any[];
      const eventIds = [...new Set(bookings.filter((b: any) => b.event_id).map((b: any) => b.event_id))];
      let eventsMap: Record<string, any> = {};
      if (eventIds.length > 0) {
        const { data: eventsData } = await (supabase.from("events") as any)
          .select("id, title, images, vendor_id")
          .in("id", eventIds);
        const vendorIds = [...new Set((eventsData || []).map((e: any) => e.vendor_id).filter(Boolean))];
        let vendorsMap: Record<string, any> = {};
        if (vendorIds.length > 0) {
          const { data: vendorsData } = await (supabase.from("vendors") as any)
            .select("id, business_name")
            .in("id", vendorIds);
          vendorsMap = Object.fromEntries((vendorsData || []).map((v: any) => [v.id, v]));
        }
        eventsMap = Object.fromEntries((eventsData || []).map((e: any) => [e.id, { ...e, vendors: vendorsMap[e.vendor_id] || null }]));
      }
      return bookings.map((b: any) => ({ ...b, events: b.event_id ? eventsMap[b.event_id] || null : null }));
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const { data: myTickets } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("support_tickets") as any)
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["ticket-messages", activeTicketId],
    queryFn: async () => {
      if (!activeTicketId) return [];
      const { data, error } = await (supabase.from("support_messages") as any)
        .select("*")
        .eq("ticket_id", activeTicketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!activeTicketId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: disputeMessages, refetch: refetchDisputeMessages } = useQuery({
    queryKey: ["dispute-messages", activeDisputeBookingId],
    queryFn: async () => {
      if (!activeDisputeBookingId) return [];
      const { data } = await (supabase.from("dispute_messages") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("booking_id", activeDisputeBookingId)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!activeDisputeBookingId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!activeTicketId) return;
    const ch = supabase.channel(`user-support-${activeTicketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeTicketId}` },
        () => { refetchMessages(); qc.invalidateQueries({ queryKey: ["my-tickets"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeDisputeBookingId) return;
    const ch = supabase.channel(`dispute-user-${activeDisputeBookingId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dispute_messages", filter: `booking_id=eq.${activeDisputeBookingId}` },
        () => refetchDisputeMessages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeDisputeBookingId]);

  useEffect(() => {
    if (!activeTicketId) return;
    (supabase.from("support_tickets") as any).update({ user_read: true }).eq("id", activeTicketId)
      .then(() => qc.invalidateQueries({ queryKey: ["my-tickets"] }));
  }, [activeTicketId]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  useEffect(() => {
    setTimeout(() => disputeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [disputeMessages]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!reportSubject.trim()) throw new Error("Please enter a subject");
      if (!reportMessage.trim()) throw new Error("Please describe the issue");
      if (!reportType) throw new Error("Please select who to report to");
      const { data: ticket, error: dbError } = await (supabase.from("support_tickets") as any)
        .insert({
          user_id: user?.id || null,
          booking_id: selectedBooking?.id || null,
          vendor_id: reportType === "vendor" ? selectedBooking?.vendor_id || null : null,
          type: reportType, subject: reportSubject.trim(), message: reportMessage.trim(),
          status: "open", last_message_at: new Date().toISOString(), admin_read: false, user_read: true,
        }).select().single();
      if (dbError) throw dbError;
      await (supabase.from("support_messages") as any).insert({
        ticket_id: ticket.id, sender_role: "user", sender_id: user?.id || null,
        message: `${reportSubject.trim()}\n\n${reportMessage.trim()}`, attachments: [],
      });
      await fetch("/api/support/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType, subject: reportSubject.trim(), message: reportMessage.trim(), bookingId: selectedBooking?.id, venueName: selectedBooking?.venues?.name, userEmail: user?.email, vendorId: selectedBooking?.vendor_id }),
      }).catch(() => {});
      return ticket;
    },
    onSuccess: (ticket) => {
      setSubmitSuccess(true);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      setTimeout(() => {
        setShowReportSheet(false); setSubmitSuccess(false);
        setReportMessage(""); setReportSubject(""); setReportType(null); setSelectedBooking(null);
        setActiveTicketId(ticket.id);
      }, 1500);
    },
    onError: (e: any) => setSubmitError(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if ((!reply.trim() && userAttachments.length === 0) || !activeTicketId) return;
      await (supabase.from("support_messages") as any).insert({
        ticket_id: activeTicketId, sender_role: "user", sender_id: user?.id || null,
        message: reply.trim() || "(attachment)", attachments: userAttachments.length > 0 ? userAttachments : [],
      });
      await (supabase.from("support_tickets") as any)
        .update({ last_message_at: new Date().toISOString(), admin_read: false, user_read: true })
        .eq("id", activeTicketId);
    },
    onSuccess: () => { setReply(""); setUserAttachments([]); refetchMessages(); qc.invalidateQueries({ queryKey: ["my-tickets"] }); },
  });

  const sendDisputeMessage = useMutation({
    mutationFn: async () => {
      if (!disputeMessage.trim() || !activeDisputeBookingId || !user?.id) return;
      await (supabase.from("dispute_messages") as any).insert({
        booking_id: activeDisputeBookingId, sender_id: user.id, sender_role: "user",
        message: disputeMessage.trim(), attachments: [],
      });
    },
    onSuccess: () => { setDisputeMessage(""); refetchDisputeMessages(); },
  });

  const handleUserFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUserUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `support/${activeTicketId}/${Date.now()}-user.${ext}`;
        const { error } = await supabase.storage.from("support-attachments").upload(path, file, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from("support-attachments").getPublicUrl(path);
          uploaded.push(urlData.publicUrl);
        }
      }
      setUserAttachments((prev) => [...prev, ...uploaded]);
    } catch {}
    finally { setUserUploading(false); if (userFileInputRef.current) userFileInputRef.current.value = ""; }
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const activeTicket = (myTickets || []).find((t: any) => t.id === activeTicketId);
  const unreadCount = (myTickets || []).filter((t: any) => !t.user_read).length;
  const displayedBookings = (recentBookings || []).slice(0, 8);

  return (
    <MainLayout>
      <div style={{ backgroundColor: "#EEEAF6", minHeight: "100vh", paddingBottom: 100 }}>

        {/* ── HERO HEADER ── */}
        <div style={{
          background: "linear-gradient(135deg, #3A0080 0%, #5710B2 45%, #6D22CC 100%)",
          padding: "52px 24px 36px",
          position: "relative",
          overflow: "hidden",
          minHeight: 180,
        }}>
          {/* Dotted pattern overlay - top right */}
          <div style={{
            position: "absolute", top: 0, right: 0, width: "55%", height: "100%",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{
                color: "#FFFFFF", fontSize: 38, fontWeight: 900, margin: "0 0 12px",
                fontFamily: "var(--font-display, Syne, sans-serif)", lineHeight: 1.05, letterSpacing: "-0.5px",
              }}>
                Support
              </h1>
              <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 210 }}>
                We're here to help. Tap a recent activity to report an issue.
              </p>
            </div>
            <div style={{ flexShrink: 0, marginRight: -12, marginTop: -8 }}>
              <SupportIllustration />
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── MY TICKETS ── */}
          {user && myTickets && myTickets.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6680", margin: 0, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  My Tickets
                </p>
                {unreadCount > 0 && (
                  <span style={{ backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myTickets.map((ticket: any) => {
                  const hasUnread = !ticket.user_read;
                  return (
                    <button key={ticket.id}
                      onClick={() => { setActiveTicketId(ticket.id); setReply(""); setUserAttachments([]); }}
                      style={{
                        width: "100%", backgroundColor: "#FFFFFF", borderRadius: 18,
                        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                        border: "none", cursor: "pointer", textAlign: "left",
                        boxShadow: hasUnread ? "0 2px 16px rgba(91,14,166,0.14)" : "0 1px 8px rgba(91,14,166,0.07)",
                      }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        backgroundColor: hasUnread ? "#EDE0F7" : "#F4F2FA",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, position: "relative",
                      }}>
                        <MessageCircle size={18} style={{ color: hasUnread ? "#5B0EA6" : "#9E9E9E" }} />
                        {hasUnread && <div style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", backgroundColor: "#EF4444", border: "2px solid #FFFFFF" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: hasUnread ? 800 : 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {ticket.subject}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                          {format(new Date(ticket.last_message_at || ticket.created_at), "dd MMM · HH:mm")}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: ticket.status === "resolved" ? "#059669" : "#D97706",
                          backgroundColor: ticket.status === "resolved" ? "#DCFCE7" : "#FEF3C7",
                          padding: "3px 10px", borderRadius: 999,
                        }}>
                          {ticket.status}
                        </span>
                        <ChevronRight size={14} style={{ color: "#C4BAD8" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ACTIVE DISPUTES ── */}
          {user && disputedBookings && disputedBookings.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6680", margin: 0, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  Active Disputes
                </p>
                <span style={{ backgroundColor: "#FEF3C7", color: "#D97706", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
                  {disputedBookings.length} open
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {disputedBookings.map((booking: any) => (
                  <button key={booking.id} onClick={() => setActiveDisputeBookingId(booking.id)}
                    style={{ width: "100%", backgroundColor: "#FFFBEB", borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, border: "1.5px solid #FDE68A", cursor: "pointer", textAlign: "left", boxShadow: "0 1px 8px rgba(217,119,6,0.10)" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                      {booking.venues?.images?.[0]
                        ? <img src={booking.venues.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={20} style={{ color: "#C4BAD8" }} /></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#92400E", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {booking.venues?.name || booking.events?.title || "Booking"} — Disputed
                      </p>
                      <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>Tap to open dispute thread</p>
                    </div>
                    <AlertTriangle size={18} style={{ color: "#D97706", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── RECENT ACTIVITY ── */}
          {user && (
            <div>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingLeft: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Clock icon — circle with hands */}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8.5" stroke="#7C6F9E" strokeWidth="1.6" />
                    <path d="M10 6V10.5L13 12.5" stroke="#7C6F9E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7C6F9E", textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    Recent Activity
                  </span>
                </div>
                <button onClick={() => router.push("/bookings")}
                  style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>View all</span>
                  <ChevronRight size={15} style={{ color: "#5B0EA6" }} />
                </button>
              </div>

              {displayedBookings.length === 0 ? (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 8px rgba(91,14,166,0.07)" }}>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No recent activity.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {displayedBookings.map((booking: any) => {
                    const st = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                    return (
                      <button
                        key={booking.id}
                        onClick={() => { setSelectedBooking(booking); setShowReportSheet(true); setSubmitError(""); }}
                        style={{
                          width: "100%", backgroundColor: "#FFFFFF",
                          borderRadius: 18, padding: "14px 16px",
                          display: "flex", alignItems: "center", gap: 14,
                          border: "none", cursor: "pointer", textAlign: "left",
                          boxShadow: "0 2px 12px rgba(91,14,166,0.08)",
                        }}>
                        {/* Venue / Event image */}
                        <div style={{ width: 58, height: 58, borderRadius: 14, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                          {(booking.venues?.images?.[0] || booking.events?.images?.[0])
                            ? <img src={booking.venues?.images?.[0] || booking.events?.images?.[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {booking.events ? <Calendar size={22} style={{ color: "#C4BAD8" }} /> : <Building2 size={22} style={{ color: "#C4BAD8" }} />}
                              </div>}
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: "#0D0D0D", margin: "0 0 5px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {booking.venues?.name || booking.events?.title || booking.events?.vendors?.business_name || "Unknown Venue"}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6" }}>
                              {formatCurrency(booking.reserved_amount)}
                            </span>
                            <span style={{ fontSize: 12, color: "#A09EB0", margin: "0 4px" }}>·</span>
                            <span style={{ fontSize: 12, color: "#A09EB0" }}>
                              {format(new Date(booking.created_at), "dd MMM yyyy")}
                            </span>
                          </div>
                        </div>

                        {/* Status + chevron */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: st.bg, borderRadius: 999, padding: "5px 12px" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: st.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>
                              {st.label}
                            </span>
                          </div>
                          <ChevronRight size={16} style={{ color: "#7B5EA6" }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CONTACT CHILLZ SUPPORT ── */}
          <button
            onClick={() => { setSelectedBooking(null); setShowReportSheet(true); setSubmitError(""); }}
            style={{
              width: "100%", backgroundColor: "#FFFFFF", borderRadius: 18,
              padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
              border: "none", cursor: "pointer",
              boxShadow: "0 2px 12px rgba(91,14,166,0.08)",
            }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: "#EDE0F7",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <MessageCircle size={22} style={{ color: "#5B0EA6" }} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#0D0D0D", margin: "0 0 3px" }}>Contact Chillz Support</p>
              <p style={{ fontSize: 12, color: "#A09EB0", margin: 0 }}>General enquiry not tied to a booking</p>
            </div>
            <ChevronRight size={18} style={{ color: "#7B5EA6" }} />
          </button>

          {/* ── FAQ ── */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6680", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.09em" }}>
              How It Works
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FAQ.map(({ icon: Icon, question, answer }, i) => (
                <div key={i} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: "100%", padding: "14px 16px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={17} style={{ color: "#5B0EA6" }} />
                    </div>
                    <p style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0, lineHeight: 1.4 }}>{question}</p>
                    {openFaq === i ? <ChevronUp size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                        <div style={{ padding: "0 16px 16px 66px" }}>
                          <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>{answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── DISPUTE THREAD SHEET ── */}
      <AnimatePresence>
        {activeDisputeBookingId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setActiveDisputeBookingId(null); setDisputeMessage(""); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", height: "88vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 20px 12px", flexShrink: 0, borderBottom: "1px solid #F2EEF9" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 14px" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => { setActiveDisputeBookingId(null); setDisputeMessage(""); }}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#FEF3C7", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ArrowLeft size={14} style={{ color: "#D97706" }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>Dispute Thread</p>
                    <p style={{ fontSize: 11, color: "#D97706", margin: 0, fontWeight: 600 }}>3-way chat · You · Vendor · Chillz Support</p>
                  </div>
                  <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "3px 10px", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706" }}>DISPUTED</span>
                  </div>
                </div>
              </div>
              <div style={{ backgroundColor: "#FFF8E1", borderBottom: "1px solid #FDE68A", padding: "10px 16px", flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>Chillz support is reviewing your dispute. Post updates here. Resolution within 8 hours.</p>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, backgroundColor: "#F7F5FA" }}>
                {!disputeMessages || disputeMessages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <AlertTriangle size={28} style={{ color: "#FDE68A", marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No messages yet. Send an update below.</p>
                  </div>
                ) : (
                  disputeMessages.map((msg: any) => {
                    const isUser = msg.sender_role === "user";
                    const isAdmin = msg.sender_role === "admin";
                    const senderLabel = isAdmin ? "Chillz Support" : msg.sender_role === "vendor" ? "Venue" : "You";
                    const bubbleBg = isUser ? "#5B0EA6" : isAdmin ? "#0A0A0A" : "#FFFFFF";
                    const textColor = isUser || isAdmin ? "#FFFFFF" : "#0A0A0A";
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "78%" }}>
                          {!isUser && <p style={{ fontSize: 10, fontWeight: 700, color: isAdmin ? "#0A0A0A" : "#D97706", margin: "0 0 3px 4px" }}>{senderLabel}</p>}
                          <div style={{ backgroundColor: bubbleBg, borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", boxShadow: isUser ? "0 2px 10px rgba(91,14,166,0.25)" : "0 1px 6px rgba(0,0,0,0.06)", border: !isUser && !isAdmin ? "1px solid #F2EEF9" : "none" }}>
                            <p style={{ fontSize: 13, color: textColor, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.message}</p>
                          </div>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0", textAlign: isUser ? "right" : "left" }}>
                            {format(new Date(msg.created_at), "HH:mm · dd MMM")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={disputeMessagesEndRef} />
              </div>
              <div style={{ padding: "10px 16px 36px", borderTop: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea value={disputeMessage} onChange={(e) => setDisputeMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (disputeMessage.trim()) sendDisputeMessage.mutate(); } }}
                    placeholder="Send update to support and venue..." rows={2}
                    style={{ flex: 1, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }} />
                  <button onClick={() => { if (disputeMessage.trim()) sendDisputeMessage.mutate(); }}
                    disabled={!disputeMessage.trim() || sendDisputeMessage.isPending}
                    style={{ width: 42, height: 42, borderRadius: 12, border: "none", backgroundColor: disputeMessage.trim() ? "#D97706" : "#E4DCF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: disputeMessage.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>
                    {sendDisputeMessage.isPending
                      ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                      : <Send size={16} style={{ color: disputeMessage.trim() ? "#FFFFFF" : "#9E9E9E" }} />}
                  </button>
                </div>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>Enter to send · Shift+Enter for new line</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SUPPORT THREAD SHEET ── */}
      <AnimatePresence>
        {activeTicketId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setActiveTicketId(null); setUserAttachments([]); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", height: "88vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 20px 12px", flexShrink: 0, borderBottom: "1px solid #F2EEF9" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 14px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <button onClick={() => { setActiveTicketId(null); setUserAttachments([]); }}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ArrowLeft size={14} style={{ color: "#5B0EA6" }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {activeTicket?.subject || "Support Thread"}
                    </p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: activeTicket?.status === "resolved" ? "#059669" : "#D97706", backgroundColor: activeTicket?.status === "resolved" ? "#DCFCE7" : "#FEF3C7", padding: "1px 7px", borderRadius: 999 }}>
                        {activeTicket?.status}
                      </span>
                      <span style={{ fontSize: 10, color: "#9E9E9E" }}>
                        {activeTicket && format(new Date(activeTicket.created_at), "dd MMM yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, backgroundColor: "#F7F5FA" }}>
                {!messages || messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <MessageCircle size={28} style={{ color: "#E4DCF0", marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Loading messages...</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isUser = msg.sender_role === "user";
                    const isVendor = msg.sender_role === "vendor";
                    const isAdmin = msg.sender_role === "admin";
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "78%" }}>
                          {!isUser && (
                            <p style={{ fontSize: 10, color: isAdmin ? "#5B0EA6" : isVendor ? "#D97706" : "#9E9E9E", margin: "0 0 3px 4px", fontWeight: 700 }}>
                              {isAdmin ? "Chillz Support" : isVendor ? "Venue" : "Support"}
                            </p>
                          )}
                          <div style={{ backgroundColor: isUser ? "#5B0EA6" : "#FFFFFF", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", boxShadow: isUser ? "0 2px 10px rgba(91,14,166,0.25)" : "0 1px 6px rgba(0,0,0,0.06)", border: isUser ? "none" : "1px solid #F2EEF9" }}>
                            {msg.message && msg.message !== "(attachment)" && (
                              <p style={{ fontSize: 13, color: isUser ? "#FFFFFF" : "#0A0A0A", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.message}</p>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: msg.message && msg.message !== "(attachment)" ? 8 : 0 }}>
                                {msg.attachments.map((url: string, i: number) => (
                                  isImageUrl(url) ? (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: 10, overflow: "hidden", maxWidth: 200 }}>
                                      <img src={url} alt="attachment" style={{ width: "100%", display: "block", borderRadius: 10 }} />
                                    </a>
                                  ) : (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: isUser ? "rgba(255,255,255,0.15)" : "#F7F5FA", borderRadius: 10, padding: "8px 12px", textDecoration: "none" }}>
                                      <span style={{ fontSize: 12, color: isUser ? "#FFFFFF" : "#5B0EA6", fontWeight: 600 }}>📎 {url.split("/").pop()}</span>
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0", textAlign: isUser ? "right" : "left" }}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              {activeTicket?.status === "open" ? (
                <div style={{ padding: "10px 16px 36px", borderTop: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>
                  {userAttachments.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      {userAttachments.map((url, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          {isImageUrl(url)
                            ? <img src={url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1.5px solid #E4DCF0" }} />
                            : <div style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 20 }}>📎</span></div>}
                          <button onClick={() => setUserAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                            style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#EF4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                            <X size={9} style={{ color: "#FFFFFF" }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input type="file" ref={userFileInputRef} onChange={handleUserFileUpload} multiple accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <button onClick={() => userFileInputRef.current?.click()} disabled={userUploading}
                      style={{ width: 38, height: 38, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      {userUploading
                        ? <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                        : <span style={{ fontSize: 16 }}>📎</span>}
                    </button>
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (reply.trim() || userAttachments.length > 0) replyMutation.mutate(); } }}
                      placeholder="Reply to support..." rows={2}
                      style={{ flex: 1, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }} />
                    <button onClick={() => { if (reply.trim() || userAttachments.length > 0) replyMutation.mutate(); }}
                      disabled={(!reply.trim() && userAttachments.length === 0) || replyMutation.isPending}
                      style={{ width: 42, height: 42, borderRadius: 12, border: "none", backgroundColor: (reply.trim() || userAttachments.length > 0) ? "#5B0EA6" : "#E4DCF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: (reply.trim() || userAttachments.length > 0) ? "pointer" : "not-allowed", flexShrink: 0 }}>
                      {replyMutation.isPending
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                        : <Send size={16} style={{ color: (reply.trim() || userAttachments.length > 0) ? "#FFFFFF" : "#9E9E9E" }} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>Enter to send · Shift+Enter for new line</p>
                </div>
              ) : (
                <div style={{ padding: "16px", borderTop: "1px solid #F2EEF9", textAlign: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>This ticket is resolved.</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SUBMIT TICKET SHEET ── */}
      <AnimatePresence>
        {showReportSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowReportSheet(false); setSubmitSuccess(false); setSubmitError(""); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {selectedBooking ? "Report an Issue" : "Contact Support"}
                    </h3>
                    {selectedBooking && (
                      <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                        Re: {selectedBooking.venues?.name || selectedBooking.events?.title || "Booking"} · {formatCurrency(selectedBooking.reserved_amount)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => { setShowReportSheet(false); setSubmitSuccess(false); }}
                    style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={14} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>
                {submitSuccess ? (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <CheckCircle size={32} style={{ color: "#00C853" }} />
                    </div>
                    <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>Ticket submitted!</p>
                    <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Opening your conversation...</p>
                  </motion.div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Report To</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        {(selectedBooking ? [
                          {
                            value: "vendor" as const,
                            label: selectedBooking.venues?.name || selectedBooking.events?.vendors?.business_name || selectedBooking.events?.title || "The Business",
                            icon: Building2,
                            desc: selectedBooking.events ? "Issue with this event or organizer" : "Issue with service at the venue",
                            color: "#E07B00",
                            bg: "#FFF3E0",
                          },
                          {
                            value: "chillz" as const,
                            label: "Chillz Support",
                            icon: HelpCircle,
                            desc: "App, payment, or platform issue",
                            color: "#5B0EA6",
                            bg: "#EDE0F7",
                          },
                        ] : [
                          {
                            value: "chillz" as const,
                            label: "Chillz Support",
                            icon: HelpCircle,
                            desc: "General enquiry or feedback",
                            color: "#5B0EA6",
                            bg: "#EDE0F7",
                          },
                        ]).map(({ value, label, icon: Icon, desc, color, bg }) => (
                          <button key={value} onClick={() => setReportType(value)}
                            style={{ flex: 1, padding: "14px 10px", borderRadius: 16, border: "2px solid", borderColor: reportType === value ? color : "#E4DCF0", backgroundColor: reportType === value ? bg : "#FFFFFF", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: reportType === value ? "rgba(255,255,255,0.6)" : "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                              <Icon size={20} style={{ color: reportType === value ? color : "#9E9E9E" }} />
                            </div>
                            <p style={{ fontWeight: 800, fontSize: 12, color: reportType === value ? color : "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{label}</p>
                            <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, lineHeight: 1.4 }}>{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Subject</p>
                      <input type="text" placeholder="e.g. Wrong amount charged" value={reportSubject}
                        onChange={(e) => setReportSubject(e.target.value)}
                        style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Message</p>
                      <textarea placeholder="Describe the issue in detail..." value={reportMessage}
                        onChange={(e) => setReportMessage(e.target.value)} rows={5}
                        style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
                    </div>
                    {submitError && (
                      <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                        <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                        <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{submitError}</p>
                      </div>
                    )}
                    <button onClick={() => { setSubmitError(""); submitMutation.mutate(); }} disabled={submitMutation.isPending}
                      style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: submitMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: submitMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                      {submitMutation.isPending
                        ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Submitting...</>
                        : <><Send size={16} />Submit Report</>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}