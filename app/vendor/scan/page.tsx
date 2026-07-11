/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, AlertTriangle,
  Search, X, Receipt, User, ChevronRight,
  UtensilsCrossed, FileText, StickyNote, Ticket,
  ShoppingBag, Users, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { BillSheet } from "@/components/vendor/bill-sheet";

interface LineItem { name: string; qty: number; amount: number; }

const NOTE_TEMPLATES = [
  { label: "👫 Couple", text: "Couple." },
  { label: "🎂 Birthday", text: "Birthday celebration." },
  { label: "💍 Anniversary", text: "Anniversary dinner." },
  { label: "👔 Man wearing...", text: "The man is wearing " },
  { label: "👗 Woman wearing...", text: "The woman is wearing " },
  { label: "👕 Guest wearing...", text: "Guest is wearing " },
  { label: "🎉 Group", text: "Group of " },
  { label: "🥂 VIP", text: "VIP guest. Table reserved." },
  { label: "🌹 Date night", text: "Date night." },
  { label: "💼 Corporate", text: "Corporate booking." },
  { label: "🍰 Cake request", text: "Cake requested on arrival." },
  { label: "🪑 Seating pref", text: "Seating preference: " },
  { label: "🚗 Valet", text: "Valet requested." },
  { label: "🥗 Dietary", text: "Dietary restriction: " },
  { label: "📸 Photography", text: "Photography package requested." },
  { label: "🎁 Surprise", text: "Surprise planned. Do not mention." },
];

function cleanNotes(notes: string | null): string | null {
  if (!notes) return null;
  let s = notes;
  s = s.replace(/Guests?:\s*\d+\s*[·\-]?\s*/gi, "");
  s = s.replace(/Occasion:\s*[^·\n]+/gi, "");
  s = s.replace(/^[·\s]+|[·\s]+$/g, "").trim();
  return s || null;
}

export default function VendorScanPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [inputCode, setInputCode] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [checkedInBooking, setCheckedInBooking] = useState<any>(null);
  const [checkedInTicket, setCheckedInTicket] = useState<any>(null);
  const [lookupError, setLookupError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "bill">("info");
  const [checkinNotes, setCheckinNotes] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraError, setCameraError] = useState("");

  const [receiptItems, setReceiptItems] = useState<LineItem[]>([]);
  const [sendError, setSendError] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [foundBooking, setFoundBooking] = useState<any>(null);
  const [foundTicket, setFoundTicket] = useState<any>(null);

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, venue_id, vendor_type, business_name")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const isCarRentalBooking = (booking: any) =>
    booking?.vendors?.vendor_type === "car_rental" ||
    vendor?.vendor_type === "car_rental" ||
    !!booking?.pickup_location;

  const isVenueVendor = vendor?.vendor_type === "venue";

  const lookupBooking = useCallback(async (code: string) => {
    if (!code || !vendor?.id) return;
    setIsSearching(true);
    setLookupError("");
    setFoundBooking(null);
    setFoundTicket(null);

    try {
      const trimmed = code.trim();

      let ticket: any = null;
      const ticketSelect = "*, users(full_name, avatar_url, email), events(title, id, address)"

      // 1. Search by ticket_code via RPC — bypasses PostgREST schema cache
      const { data: codeResults, error: rpcErr } = await (supabase as any)
        .rpc("find_ticket_by_code", { p_code: trimmed.toUpperCase() });
      console.log("RPC RESULT:", { codeResults, rpcErr });
      if (codeResults?.length) {
        const t = codeResults[0];
        // Fetch users and events separately
        const { data: ticketUser } = await (supabase.from("users") as any)
          .select("full_name, avatar_url, email")
          .eq("id", t.user_id)
          .maybeSingle();
        const { data: ticketEvent } = await (supabase.from("events") as any)
          .select("title, id, address")
          .eq("id", t.event_id)
          .maybeSingle();
        ticket = { ...t, users: ticketUser, events: ticketEvent };
      }

      // 2. Fallback: exact match on qr_code_hash for legacy tickets
      const { data: byHash, error: hashErr } = await (supabase.from("tickets") as any)
        .select(ticketSelect)
        .eq("qr_code_hash", trimmed)
        .maybeSingle();
      console.log("HASH SEARCH:", { byHash, hashErr });
      if (byHash) ticket = byHash;

      if (ticket) {
        if (ticket.vendor_id !== vendor.id) { setLookupError("This ticket is not for your event."); return; }
        if (ticket.status === "checked_in") { setLookupError("This ticket has already been scanned."); return; }
        if (ticket.status === "cancelled")  { setLookupError("This ticket has been cancelled."); return; }
        setFoundTicket(ticket);
        return;
      }

      const SELECT = "*, order_items, guest_count, special_occasion, package_name, package_price, num_nights, num_rooms, users(full_name, avatar_url, email), venues(name, id), events(title, id), vendors(vendor_type)";

      let booking: any = null;
      const { data: exact } = await supabase.from("bookings").select(SELECT).eq("qr_code_hash", trimmed).maybeSingle();
      if (exact) booking = exact;

      if (!booking) {
        const { data: rows } = await supabase.from("bookings").select(SELECT).ilike("qr_code_hash", `${trimmed}%`).limit(1);
        if (rows?.length) booking = rows[0];
      }

      if (!booking) {
        const { data: rows } = await supabase.from("bookings").select(SELECT).ilike("id", `${trimmed}%`).limit(1);
        if (rows?.length) booking = rows[0];
      }

      if (!booking) { setLookupError("No booking or ticket found. Check the code and try again."); return; }

      const vendorOwnsBooking =
        booking.vendor_id === vendor.id ||
        booking.venue_id === vendor.venue_id ||
        (booking.venues?.id && booking.venues.id === vendor.venue_id) ||
        (booking.vendor_id === null && booking.venue_id === null);

      if (!vendorOwnsBooking) { setLookupError("This booking is not for your venue."); return; }
      if (booking.status === "cancelled") { setLookupError("This booking has been cancelled."); return; }
      if (booking.status === "completed") { setLookupError("This booking is already completed."); return; }

      setFoundBooking(booking);
    } catch (e: any) {
      setLookupError(e.message || "Failed to look up code");
    } finally {
      setIsSearching(false);
    }
  }, [vendor]);

  useEffect(() => {
    if (searchCode && vendor?.id) lookupBooking(searchCode);
  }, [searchCode, vendor?.id, lookupBooking]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            stopCamera();
            const code = barcodes[0].rawValue;
            setInputCode(code);
            setSearchCode(code);
          }
        } catch { /* continue */ }
      }
    }, 500);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startScanning();
    } catch (e: any) {
      setCameraError(e.name === "NotAllowedError"
        ? "Camera permission denied. Use manual entry below."
        : "Camera unavailable on this device. Use manual entry below.");
    }
  }, [startScanning]);

  useEffect(() => {
    if (mode === "camera") startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  const checkInTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await (supabase as any)
        .rpc("check_in_ticket", { p_ticket_id: ticketId });
      if (error) throw error;

      // ── Pay vendor immediately on check-in ────────────────────────
      const amount    = Number(foundTicket?.amount_paid) || 0;
      const vendorId  = foundTicket?.vendor_id || null;
      const userId    = foundTicket?.user_id   || null;
      if (amount > 0 && vendorId && userId) {
        const vendorCut = Math.round(amount * 0.95);
        const chillzCut = amount - vendorCut;
        const txId      = crypto.randomUUID();
        const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert([
          {
            transaction_id: txId,
            account_type:   "USER_RESERVED",
            account_id:     userId,
            direction:      "DEBIT",
            amount,
            note:           `Ticket checked in — ${foundTicket.events?.title || "Event"}`,
            reference_id:   ticketId,
            reference_type: "ticket_checkin",
          },
          {
            transaction_id: txId,
            account_type:   "VENDOR_PENDING",
            account_id:     vendorId,
            direction:      "CREDIT",
            amount:         vendorCut,
            note:           `95% ticket payout — ${foundTicket.events?.title || "Event"}`,
            reference_id:   ticketId,
            reference_type: "ticket_checkin",
          },
          {
            transaction_id: txId,
            account_type:   "CHILLZ_REVENUE",
            account_id:     "chillz",
            direction:      "CREDIT",
            amount:         chillzCut,
            note:           `5% platform fee — ${foundTicket.events?.title || "Event"}`,
            reference_id:   ticketId,
            reference_type: "ticket_checkin",
          },
        ]);
        if (ledgerError) console.error("Ledger insert failed:", ledgerError.message);
      }

      if (userId) {
        await (supabase.from("notifications") as any).insert({
          user_id: userId,
          title:   "Ticket scanned ✅",
          body:    `You've been checked in to ${foundTicket.events?.title}. Enjoy the event!`,
          type:    "ticket",
          reference_id: ticketId,
        });
      }
    },
    onSuccess: async () => {
      // Increment tickets_sold on the event
      if (foundTicket?.event_id) {
        const qty = foundTicket.qty || foundTicket.ticket_qty || 1;
        const { data: ev } = await (supabase.from("events") as any)
          .select("tickets_sold").eq("id", foundTicket.event_id).single();
        if (ev) {
          await (supabase.from("events") as any)
            .update({ tickets_sold: (ev.tickets_sold || 0) + qty })
            .eq("id", foundTicket.event_id);
        }
      }
      setCheckedInTicket({ ...foundTicket, status: "checked_in" });
      setFoundTicket(null);
      setSearchCode(""); setInputCode(""); setLookupError("");
      qc.invalidateQueries({ queryKey: ["organizer-recent-tickets"] });
      qc.invalidateQueries({ queryKey: ["vendor-tickets-events"] });
      qc.invalidateQueries({ queryKey: ["vendor-balance"] });
    },
    onError: (e: any) => setLookupError(e.message),
  });

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await (supabase.from("bookings") as any)
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
          checkin_notes: checkinNotes.trim() || null,
        })
        .eq("id", bookingId);
      if (error) throw error;
      await (supabase.from("running_tabs") as any).upsert({
        booking_id: bookingId, vendor_id: vendor?.id, items: [], subtotal: 0,
      }, { onConflict: "booking_id" });
      if (foundBooking?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: foundBooking.user_id,
          title: "You've been checked in! 🎉",
          body: `Welcome to ${foundBooking.venues?.name || foundBooking.events?.title}. Enjoy your time!`,
          type: "booking",
          reference_id: bookingId,
        });
      }
    },
    onSuccess: () => {
      setCheckedInBooking({
        ...foundBooking,
        status: "checked_in",
        checkin_notes: checkinNotes.trim() || null,
      });
      setFoundBooking(null);
      setSearchCode(""); setInputCode(""); setLookupError("");
      setCheckinNotes(""); setShowNotesPanel(false); setActiveTab("info");
      qc.invalidateQueries({ queryKey: ["vendor-pending-bookings"] });
    },
    onError: (e: any) => setLookupError(e.message),
  });

  const alreadyProcessed = foundBooking &&
    ["checked_in", "receipt_sent", "completed"].includes(foundBooking.status);
  const showResults = (foundBooking || foundTicket || lookupError) && !isSearching;

  const resetScan = () => {
    setFoundBooking(null); setFoundTicket(null);
    setSearchCode(""); setInputCode(""); setLookupError("");
    setCheckinNotes(""); setShowNotesPanel(false);
    if (mode === "camera") setTimeout(startCamera, 300);
  };

  const applyTemplate = (text: string) => {
    setCheckinNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      if (trimmed.endsWith(".") || trimmed.endsWith(",")) return `${trimmed} ${text}`;
      return `${trimmed}. ${text}`;
    });
  };

  if (checkedInTicket) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #5B0EA6 0%, #3D0066 100%)", padding: "44px 20px 28px" }}>
          <button
            onClick={() => { setCheckedInTicket(null); resetScan(); if (mode === "camera") setTimeout(startCamera, 300); }}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Scan Another</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle size={28} style={{ color: "#00C853" }} />
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ticket Valid ✓</p>
              <p style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {checkedInTicket.users?.full_name || "Guest"}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 10px rgba(91,14,166,0.07)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Ticket Details</p>
            {[
              { label: "Guest",       value: checkedInTicket.users?.full_name || "—" },
              { label: "Email",       value: checkedInTicket.users?.email || "—" },
              { label: "Event",       value: checkedInTicket.events?.title || "—" },
              { label: "Ticket Type", value: checkedInTicket.ticket_type_name || "General Admission" },
              { label: "Amount Paid", value: checkedInTicket.amount_paid > 0 ? formatCurrency(checkedInTicket.amount_paid) : "Free" },
              { label: "Ticket Code", value: checkedInTicket.ticket_code || checkedInTicket.qr_code_hash?.slice(0, 8).toUpperCase(), mono: true },
              { label: "Checked In",  value: format(new Date(), "dd MMM yyyy · HH:mm") },
            ].map((row: any) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #F7F5FA" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", textAlign: "right", fontFamily: row.mono ? "monospace" : "inherit", letterSpacing: row.mono ? "0.06em" : "normal" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: "#E0F7EA", border: "1.5px solid #A7F3D0", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 10 }}>
            <CheckCircle size={18} style={{ color: "#00C853", flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>Entry Granted</p>
              <p style={{ fontSize: 12, color: "#047857", margin: 0 }}>Ticket is valid and guest has been checked in.</p>
            </div>
          </div>
          <button
            onClick={() => { setCheckedInTicket(null); resetScan(); if (mode === "camera") setTimeout(startCamera, 300); }}
            style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
            Scan Next Ticket
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", maxWidth: 480, margin: "0 auto", position: "relative" }}>

      {!checkedInBooking && (
        <>
          {mode === "camera" && (
            <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "44px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button onClick={() => router.back()}
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
                  </button>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 16, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Scan QR Code</p>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: 0 }}>Bookings & event tickets</p>
                  </div>
                  <button onClick={() => { stopCamera(); setMode("manual"); }}
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Search size={18} style={{ color: "#FFFFFF" }} />
                  </button>
                </div>

                {cameraError ? (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 16, padding: "16px 20px", textAlign: "center" }}>
                    <AlertTriangle size={28} style={{ color: "#FFFFFF", marginBottom: 8 }} />
                    <p style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>{cameraError}</p>
                    <button onClick={() => { stopCamera(); setMode("manual"); }}
                      style={{ backgroundColor: "#FFFFFF", color: "#EF4444", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Enter Code Manually
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", width: 240, height: 240 }}>
                    {[
                      { top: 0, left: 0, borderTop: "3px solid #5B0EA6", borderLeft: "3px solid #5B0EA6" } as any,
                      { top: 0, right: 0, borderTop: "3px solid #5B0EA6", borderRight: "3px solid #5B0EA6" } as any,
                      { bottom: 0, left: 0, borderBottom: "3px solid #5B0EA6", borderLeft: "3px solid #5B0EA6" } as any,
                      { bottom: 0, right: 0, borderBottom: "3px solid #5B0EA6", borderRight: "3px solid #5B0EA6" } as any,
                    ].map((s, i) => <div key={i} style={{ position: "absolute", width: 28, height: 28, borderRadius: 4, ...s }} />)}
                    <motion.div animate={{ y: [0, 220, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      style={{ position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "#5B0EA6", boxShadow: "0 0 8px #5B0EA6" }} />
                  </div>
                )}

                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 44px", backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "0 0 10px", textAlign: "center" }}>Or enter booking / ticket code</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 14px" }}>
                      <Search size={14} style={{ color: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
                      <input type="text" placeholder="e.g. DFD057C0" value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && inputCode.trim()) setSearchCode(inputCode.trim()); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#FFFFFF", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }} />
                      {inputCode && (
                        <button onClick={() => setInputCode("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          <X size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                        </button>
                      )}
                    </div>
                    <button onClick={() => { if (inputCode.trim()) setSearchCode(inputCode.trim()); }}
                      disabled={!inputCode.trim() || isSearching}
                      style={{ padding: "11px 16px", borderRadius: 12, border: "none", backgroundColor: inputCode.trim() ? "#5B0EA6" : "rgba(255,255,255,0.1)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: inputCode.trim() ? "pointer" : "not-allowed" }}>
                      {isSearching
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                        : "Find"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA" }}>
              <div style={{ background: "linear-gradient(135deg, #3D0066 0%, #5B0EA6 100%)", padding: "44px 20px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <button onClick={() => { setMode("camera"); resetScan(); }}
                    style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
                    <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Camera</span>
                  </button>
                </div>
                <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Enter Code</h1>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>Type the booking or ticket code</p>
              </div>
              <div style={{ padding: "20px 16px" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                    <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                    <input type="text" placeholder="e.g. DFD057C0" value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter" && inputCode.trim()) setSearchCode(inputCode.trim()); }}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }} />
                    {inputCode && (
                      <button onClick={() => { setInputCode(""); resetScan(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <X size={13} style={{ color: "#9E9E9E" }} />
                      </button>
                    )}
                  </div>
                  <button onClick={() => { if (inputCode.trim()) setSearchCode(inputCode.trim()); }}
                    disabled={!inputCode.trim() || isSearching}
                    style={{ padding: "12px 16px", borderRadius: 14, border: "none", backgroundColor: !inputCode.trim() ? "#F2EEF9" : "#5B0EA6", color: !inputCode.trim() ? "#9E9E9E" : "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: !inputCode.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 60 }}>
                    {isSearching
                      ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(91,14,166,0.2)", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                      : "Find"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {showResults && (
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: mode === "camera" ? "fixed" : "relative", bottom: mode === "camera" ? 0 : undefined, left: 0, right: 0, backgroundColor: "#FFFFFF", borderRadius: mode === "camera" ? "24px 24px 0 0" : 16, padding: "20px 16px 44px", maxWidth: 480, margin: "0 auto", zIndex: 60, boxShadow: "0 -8px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />

                {lookupError && !foundBooking && !foundTicket && (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                      <AlertTriangle size={26} style={{ color: "#EF4444" }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 6px" }}>Not Found</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 18px", lineHeight: 1.5, padding: "0 10px" }}>{lookupError}</p>
                    <button onClick={resetScan} style={{ padding: "10px 28px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Try Again</button>
                  </div>
                )}

                {foundTicket && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ backgroundColor: "#EDE0F7", borderRadius: 10, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Ticket size={12} style={{ color: "#5B0EA6" }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>Event Ticket</span>
                      </div>
                      {foundTicket.ticket_type_name && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7B2FBE", backgroundColor: "#F3E8FF", padding: "4px 10px", borderRadius: 999 }}>
                          {foundTicket.ticket_type_name}
                        </span>
                      )}
                    </div>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {foundTicket.users?.avatar_url
                          ? <img src={foundTicket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 22, fontWeight: 800, color: "#5B0EA6" }}>{foundTicket.users?.full_name?.charAt(0)}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                          {foundTicket.users?.full_name || "Guest"}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 3px" }}>{foundTicket.users?.email}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>
                            {foundTicket.amount_paid > 0 ? formatCurrency(foundTicket.amount_paid) : "Free"}
                          </span>
                          <span style={{ fontSize: 10, color: "#9E9E9E" }}>paid</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px" }}>
                      <p style={{ fontSize: 11, color: "#7B2FBE", fontWeight: 600, margin: "0 0 2px" }}>{foundTicket.events?.title || "Event"}</p>
                      <p style={{ fontSize: 13, fontWeight: 900, color: "#5B0EA6", fontFamily: "monospace", margin: 0, letterSpacing: "0.08em" }}>
                        {foundTicket.qr_code_hash?.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <button onClick={() => checkInTicketMutation.mutate(foundTicket.id)} disabled={checkInTicketMutation.isPending}
                      style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: checkInTicketMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: checkInTicketMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                      {checkInTicketMutation.isPending
                        ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Scanning...</>
                        : <><CheckCircle size={18} />Grant Entry</>}
                    </button>
                  </div>
                )}

                {foundBooking && alreadyProcessed && (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#FFF8E1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                      <AlertTriangle size={26} style={{ color: "#F59E0B" }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 4px" }}>
                      Already {foundBooking.status.replace(/_/g, " ")}
                    </p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 18px" }}>
                      {foundBooking.users?.full_name} · {formatCurrency(foundBooking.reserved_amount)}
                    </p>
                    <button onClick={resetScan} style={{ padding: "10px 28px", borderRadius: 12, border: "none", backgroundColor: "#F2EEF9", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Scan Another</button>
                  </div>
                )}

                {foundBooking && !alreadyProcessed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Booking Found</p>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {foundBooking.users?.avatar_url
                          ? <img src={foundBooking.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 22, fontWeight: 800, color: "#5B0EA6" }}>{foundBooking.users?.full_name?.charAt(0)}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                          {foundBooking.users?.full_name}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 3px" }}>{foundBooking.users?.email}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>{formatCurrency(foundBooking.reserved_amount)}</span>
                          <span style={{ fontSize: 10, color: "#9E9E9E" }}>reserved</span>
                          {foundBooking.booking_date && (
                            <span style={{ fontSize: 10, color: "#9E9E9E" }}>· {format(new Date(foundBooking.booking_date), "dd MMM · HH:mm")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#7B2FBE", fontWeight: 600 }}>Booking Code</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#5B0EA6", fontFamily: "monospace", letterSpacing: "0.08em" }}>
                        {foundBooking.qr_code_hash?.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    {/* Package pill — clean, no item breakdown */}
                    {foundBooking.package_name && (
                      <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }}>Package</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6", margin: 0 }}>{foundBooking.package_name}</p>
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                          {formatCurrency(foundBooking.reserved_amount)}
                        </p>
                      </div>
                    )}

                    {/* Order items — non-package bookings only */}
                    {!foundBooking.package_name && foundBooking.order_items?.length > 0 && (
                      <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Pre-ordered</p>
                        {foundBooking.order_items.map((item: any, i: number) => {
                          const qty = item.qty || item.quantity || 1;
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 600 }}>{item.name}</span>
                              <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 700 }}>×{qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(foundBooking.guest_count || (foundBooking.special_occasion && foundBooking.special_occasion !== "None")) && (
                      <div style={{ backgroundColor: "#FFF8E1", borderRadius: 12, padding: "8px 14px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#D97706", margin: "0 0 4px" }}>
                          {foundBooking.special_occasion && foundBooking.special_occasion !== "None" ? `🎉 ${foundBooking.special_occasion}` : "Guest Info"}
                        </p>
                        {foundBooking.guest_count && (
                          <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                            {foundBooking.guest_count} guest{Number(foundBooking.guest_count) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {cleanNotes(foundBooking.notes) && (
                      <div style={{ backgroundColor: "#FFF8E1", borderRadius: 12, padding: "8px 14px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#D97706", margin: "0 0 2px" }}>Guest Notes</p>
                        <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>{cleanNotes(foundBooking.notes)}</p>
                      </div>
                    )}

                    {isCarRentalBooking(foundBooking) ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ backgroundColor: "#CCFBF1", border: "1.5px solid #99F6E4", borderRadius: 14, padding: "14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>🚗</span>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 13, color: "#0F766E", margin: "0 0 4px" }}>Vehicle Report Required</p>
                            <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                              Car rental check-in requires a vehicle condition report. Upload photos from your Bookings page.
                            </p>
                          </div>
                        </div>
                        <button onClick={() => { resetScan(); router.push("/vendor/bookings"); }}
                          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#0F766E,#0D9488)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(13,148,136,0.3)" }}>
                          📸 Go to Bookings to Upload Report
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, border: "1.5px solid #E4DCF0", overflow: "hidden" }}>
                          <button onClick={() => setShowNotesPanel(!showNotesPanel)}
                            style={{ width: "100%", padding: "12px 14px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFF8E1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <StickyNote size={16} style={{ color: "#D97706" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Add Check-in Notes</p>
                              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                                {checkinNotes.trim()
                                  ? checkinNotes.trim().slice(0, 40) + (checkinNotes.length > 40 ? "..." : "")
                                  : "Appearance, occasion, seating..."}
                              </p>
                            </div>
                            {checkinNotes.trim() && (
                              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#00C853", flexShrink: 0 }} />
                            )}
                          </button>
                          <AnimatePresence>
                            {showNotesPanel && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                                <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #F2EEF9" }}>
                                  <div>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "10px 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Templates</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {NOTE_TEMPLATES.map((t) => (
                                        <button key={t.label} onClick={() => applyTemplate(t.text)}
                                          style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #E4DCF0", backgroundColor: "#F7F5FA", color: "#0A0A0A", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                                          {t.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <textarea value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)}
                                    placeholder="e.g. Couple. The man is wearing a red shirt..." rows={3}
                                    style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                                  {checkinNotes.trim() && (
                                    <button onClick={() => setCheckinNotes("")}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#EF4444", padding: 0, fontWeight: 600, textAlign: "left" }}>
                                      Clear notes
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {lookupError && (
                          <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                            <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{lookupError}</p>
                          </div>
                        )}

                        <button onClick={() => checkInMutation.mutate(foundBooking.id)} disabled={checkInMutation.isPending}
                          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: checkInMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #00C853, #00A846)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: checkInMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,200,83,0.3)" }}>
                          {checkInMutation.isPending
                            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Checking In...</>
                            : <><CheckCircle size={18} />Check In Guest</>}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── CHECKED IN BOOKING VIEW ── */}
      {checkedInBooking && (
        <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA" }}>
          <div style={{ background: "linear-gradient(135deg, #00C853 0%, #065F46 100%)", padding: "44px 20px 0" }}>
            <button
              onClick={() => { setCheckedInBooking(null); setReceiptItems([]); resetScan(); if (mode === "camera") setTimeout(startCamera, 300); }}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
              <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
              <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Scan Another</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {checkedInBooking.users?.avatar_url
                  ? <img src={checkedInBooking.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>{checkedInBooking.users?.full_name?.charAt(0)}</span>}
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Checked In</p>
                <p style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{checkedInBooking.users?.full_name}</p>
              </div>
            </div>
            <div style={{ marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 10px" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                {checkedInBooking.qr_code_hash?.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {[{ id: "info", label: "Guest Info", icon: User }, { id: "bill", label: "Bill Customer", icon: Receipt }]
              .filter(tab => !(tab.id === "bill" && vendor?.vendor_type === "event_organizer"))
              .map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id as any)}
                  style={{ flex: 1, padding: "10px 8px 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === id ? "2.5px solid #FFFFFF" : "2.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon size={14} style={{ color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.4)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.4)" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px" }}>
            {activeTab === "info" && (
              <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Booking details card */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 10px rgba(91,14,166,0.07)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Booking Details</p>
                  {[
                    { label: "Guest",   value: checkedInBooking.users?.full_name },
                    { label: "Email",   value: checkedInBooking.users?.email },
                    { label: "Venue",   value: checkedInBooking.venues?.name || checkedInBooking.events?.title },
                    checkedInBooking.package_name && { label: "Package", value: checkedInBooking.package_name },
                    checkedInBooking.guest_count && {
                      label: "Guests",
                      value: `${checkedInBooking.guest_count} guest${Number(checkedInBooking.guest_count) !== 1 ? "s" : ""}`,
                    },
                    checkedInBooking.special_occasion && checkedInBooking.special_occasion !== "None" && {
                      label: "Occasion",
                      value: `🎉 ${checkedInBooking.special_occasion}`,
                    },
                    { label: "Reserved", value: formatCurrency(checkedInBooking.reserved_amount) },
                    { label: "Code",     value: checkedInBooking.qr_code_hash?.slice(0, 8).toUpperCase(), mono: true },
                    checkedInBooking.booking_date && {
                      label: "Date",
                      value: format(new Date(checkedInBooking.booking_date), "dd MMM yyyy · HH:mm"),
                    },
                    cleanNotes(checkedInBooking.notes) && {
                      label: "Guest Notes",
                      value: cleanNotes(checkedInBooking.notes),
                    },
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #F7F5FA" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", textAlign: "right", fontFamily: row.mono ? "monospace" : "inherit", letterSpacing: row.mono ? "0.06em" : "normal" }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Package — show name + price only, no item breakdown */}
                {checkedInBooking.package_name && (
                  <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 3px" }}>Package Booked</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: "#5B0EA6", margin: 0 }}>{checkedInBooking.package_name}</p>
                    </div>
                    <p style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                      {formatCurrency(checkedInBooking.reserved_amount)}
                    </p>
                  </div>
                )}

                {/* Pre-ordered items — non-package bookings only, qty fixed */}
                {isVenueVendor && !checkedInBooking.package_name && checkedInBooking.order_items?.length > 0 && (
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Pre-ordered Items</p>
                    {checkedInBooking.order_items.map((item: any, i: number) => {
                      const qty = item.qty || item.quantity || 1;
                      const lineTotal = item.subtotal || (item.price || 0) * qty;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < checkedInBooking.order_items.length - 1 ? "1px solid #F2EEF9" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <UtensilsCrossed size={11} style={{ color: "#5B0EA6" }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{item.name}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 12, color: "#9E9E9E" }}>×{qty} </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1.5px solid #E4DCF0" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Order Total</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#5B0EA6" }}>
                        {formatCurrency(checkedInBooking.order_items.reduce((a: number, i: any) => a + (i.subtotal || (i.price || 0) * (i.qty || i.quantity || 1)), 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Staff notes */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StickyNote size={15} style={{ color: "#D97706" }} />
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Staff Notes</p>
                    </div>
                    <button onClick={() => setShowNotesPanel(!showNotesPanel)}
                      style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", backgroundColor: "#EDE0F7", borderRadius: 8 }}>
                      {showNotesPanel ? "Done" : "Edit"}
                    </button>
                  </div>
                  {(checkedInBooking.checkin_notes || checkinNotes.trim()) && !showNotesPanel && (
                    <div style={{ padding: "0 14px 12px" }}>
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, lineHeight: 1.6 }}>
                        {checkinNotes.trim() || checkedInBooking.checkin_notes}
                      </p>
                    </div>
                  )}
                  <AnimatePresence>
                    {showNotesPanel && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #F2EEF9" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {NOTE_TEMPLATES.map((t) => (
                              <button key={t.label} onClick={() => applyTemplate(t.text)}
                                style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #E4DCF0", backgroundColor: "#F7F5FA", color: "#0A0A0A", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={checkinNotes || checkedInBooking.checkin_notes || ""}
                            onChange={(e) => setCheckinNotes(e.target.value)} rows={3}
                            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                          <button onClick={async () => {
                            await (supabase.from("bookings") as any)
                              .update({ checkin_notes: checkinNotes.trim() })
                              .eq("id", checkedInBooking.id);
                            setCheckedInBooking((prev: any) => ({ ...prev, checkin_notes: checkinNotes.trim() }));
                            setShowNotesPanel(false);
                          }} style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            Save Notes
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {vendor?.vendor_type !== "event_organizer" && <button onClick={() => router.push(`/vendor/tab/${checkedInBooking.id}`)}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "1.5px solid #EDE0F7", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={18} style={{ color: "#5B0EA6" }} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px" }}>Open Running Tab</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Add items as guest orders — send receipt when done</p>
                  </div>
                  <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                </button>
                }

                {vendor?.vendor_type !== "event_organizer" && (
                  <button onClick={() => setActiveTab("bill")}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                    <Receipt size={17} />Quick Bill (Send Now)
                  </button>
                )}
              </motion.div>
            )}

            {activeTab === "bill" && (
              <motion.div key="bill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <BillSheet
                  booking={checkedInBooking}
                  vendorType={vendor?.vendor_type || ""}
                  vendorId={vendor?.id || ""}
                  onClose={() => setActiveTab("info")}
                  onSent={() => {
                    setCheckedInBooking(null);
                    setReceiptItems([]);
                    setSearchCode("");
                    setInputCode("");
                    setSendError("");
                    qc.invalidateQueries({ queryKey: ["vendor-pending-bookings"] });
                    qc.invalidateQueries({ queryKey: ["vendor-checked-in"] });
                    qc.invalidateQueries({ queryKey: ["vendor-earnings"] });
                    qc.invalidateQueries({ queryKey: ["vendor-balance"] });
                    if (mode === "camera") setTimeout(startCamera, 300);
                  }}
                />
              </motion.div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}