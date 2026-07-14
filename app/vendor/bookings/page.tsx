/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { BillSheet } from "@/components/vendor/bill-sheet";
import {
  ArrowLeft, Search, X, Calendar, Users, Building2,
  Mail, Phone, CreditCard, CheckCircle, AlertCircle,
  ClipboardList, Ban, Eye, Star, Receipt, Car, UserCheck,
  Clock, Home, UtensilsCrossed, ShoppingBag, Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isBefore, startOfDay, parseISO } from "date-fns";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:    { label: "Confirmed",    color: "#059669", bg: "#DCFCE7" },
  pending:      { label: "Pending",      color: "#D97706", bg: "#FEF3C7" },
  checked_in:   { label: "Checked In",  color: "#2563EB", bg: "#DBEAFE" },
  receipt_sent: { label: "Receipt Sent", color: "#7C3AED", bg: "#EDE0F7" },
  completed:    { label: "Completed",    color: "#6B7280", bg: "#F3F4F6" },
  cancelled:    { label: "Cancelled",    color: "#EF4444", bg: "#FEE2E2" },
  disputed:     { label: "Disputed",     color: "#D97706", bg: "#FEF3C7" },
};

function getBookingActions(booking: any): "pre_checkin" | "ready_checkin" | "checked_in" | "billed" | "done" {
  if (booking.status === "completed" || booking.status === "cancelled") return "done";
  if (booking.status === "receipt_sent" || booking.status === "disputed") return "billed";
  if (booking.status === "checked_in") return "checked_in";
  const today   = startOfDay(new Date());
  const checkin = booking.checkin_date ? startOfDay(parseISO(booking.checkin_date)) : null;
  if (!checkin || isBefore(today, checkin)) return "pre_checkin";
  return "ready_checkin";
}

function getVendorMeta(vendorType: string) {
  switch (vendorType) {
    case "car_rental":  return { unitLabel: "Vehicle",  nightLabel: "day",   Icon: Car };
    case "apartment":   return { unitLabel: "Unit",     nightLabel: "night", Icon: Home };
    case "hotel":       return { unitLabel: "Room",     nightLabel: "night", Icon: Building2 };
    case "venue":       return { unitLabel: "Table",    nightLabel: "visit", Icon: UtensilsCrossed };
    default:            return { unitLabel: "Package",  nightLabel: "night", Icon: Building2 };
  }
}

function parseNotesField(notes: string | null): { guestCount: string | null; occasion: string | null; actualNotes: string | null } {
  if (!notes) return { guestCount: null, occasion: null, actualNotes: null };
  let remaining = notes;
  let guestCount: string | null = null;
  let occasion: string | null = null;

  const guestMatch = remaining.match(/Guests?:\s*(\d+)/i);
  if (guestMatch) { guestCount = guestMatch[1]; remaining = remaining.replace(guestMatch[0], "").trim(); }

  const occasionMatch = remaining.match(/Occasion:\s*([^·\n]+)/i);
  if (occasionMatch) { occasion = occasionMatch[1].trim(); remaining = remaining.replace(occasionMatch[0], "").trim(); }

  remaining = remaining.replace(/^[·\s]+|[·\s]+$/g, "").trim();
  return { guestCount, occasion, actualNotes: remaining || null };
}

export default function VendorBookingsPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [activeTab,    setActiveTab]    = useState("All");
  const [search,       setSearch]       = useState("");
  const [showSearch,   setShowSearch]   = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [showDetail,   setShowDetail]   = useState(false);
  const [showReject,   setShowReject]   = useState(false);
  const [showBill,     setShowBill]     = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showIdImage,  setShowIdImage]  = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, vendor_type, business_name")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const vendorMeta        = getVendorMeta(vendor?.vendor_type || "");
  const isCarRentalVendor = vendor?.vendor_type === "car_rental";
  const isApartmentVendor = vendor?.vendor_type === "apartment";
  const isVenueVendor     = vendor?.vendor_type === "venue";

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["vendor-bookings", vendor?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bookings") as any)
        .select(`
          id, status, reserved_amount, booking_date, checkin_date, checkout_date,
          num_nights, num_rooms, guest_count, package_name, package_price,
          special_occasion, notes, nin_number, id_document_url, qr_code_hash,
          created_at, listing_id, user_id, with_driver, pickup_time,
          pickup_location, dropoff_location, same_return_location,
          vehicle_report_images, vehicle_report_status,
          vehicle_report_rejections, vehicle_report_vendor_sends,
          order_items,
          users(id, full_name, email, phone, avatar_url),
          venues(id, name)
        `)
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      if (error) { console.error("bookings error:", error); return []; }
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 30,
  });

  const isLoading = !vendor?.id || bookingsLoading;

  const totalEarned = bookings
    .filter((b: any) => ["confirmed","checked_in","receipt_sent","completed"].includes(b.status))
    .reduce((a: number, b: any) => a + (b.reserved_amount || 0), 0);

  const TABS = [
    { key: "All",          label: "All",        count: bookings.length },
    { key: "confirmed",    label: "Confirmed",  count: bookings.filter((b: any) => b.status === "confirmed").length },
    { key: "checked_in",   label: "Checked In", count: bookings.filter((b: any) => b.status === "checked_in").length },
    { key: "receipt_sent", label: "Billed",     count: bookings.filter((b: any) => b.status === "receipt_sent").length },
    { key: "completed",    label: "Completed",  count: bookings.filter((b: any) => b.status === "completed").length },
    { key: "cancelled",    label: "Cancelled",  count: bookings.filter((b: any) => b.status === "cancelled").length },
  ];

  const filtered = bookings.filter((b: any) => {
    if (activeTab !== "All" && b.status !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !b.users?.full_name?.toLowerCase().includes(q) &&
        !(b.package_name || "").toLowerCase().includes(q) &&
        !(b.qr_code_hash || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await (supabase.from("bookings") as any)
        .update({ status: "checked_in" }).eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-bookings"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error: statusError } = await (supabase.from("bookings") as any)
        .update({
          status: "cancelled",
          notes: rejectReason.trim()
            ? `Rejected by vendor: ${rejectReason.trim()}`
            : "Rejected by vendor",
        })
        .eq("id", bookingId);
      if (statusError) throw new Error(`Booking status update failed: ${statusError.message}`);

      const booking = bookings.find((b: any) => b.id === bookingId);
      const userId  = booking?.users?.id || booking?.user_id;
      const amount  = booking?.reserved_amount || 0;

      if (amount && userId) {
        const txId = crypto.randomUUID();
        const { error: ledgerError } = await (supabase.from("ledger_entries") as any).insert([
          {
            transaction_id: txId,
            account_id:     userId,
            account_type:   "USER_WALLET",
            direction:      "CREDIT",
            amount,
            note:           "Booking rejected by vendor — full refund",
            reference_id:   bookingId,
            reference_type: "booking_rejected",
          },
          {
            transaction_id: txId,
            account_id:     userId,
            account_type:   "USER_RESERVED",
            direction:      "DEBIT",
            amount,
            note:           "Escrow released — booking rejected",
            reference_id:   bookingId,
            reference_type: "booking_rejected",
          },
        ]);
        if (ledgerError) throw new Error("Ledger release failed. Please retry.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bookings"] });
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setShowReject(false);
      setShowDetail(false);
      setSelectedBook(null);
      setRejectReason("");
    },
    onError: (e: any) => console.error("Reject failed:", e.message || e),
  });

  const completeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await (supabase.from("bookings") as any)
        .update({ status: "completed" }).eq("id", bookingId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bookings"] });
      setSelectedBook((p: any) => p ? { ...p, status: "completed" } : null);
    },
  });

  const uploadReportMutation = useMutation({
    mutationFn: async ({ bookingId, files }: { bookingId: string; files: FileList }) => {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext  = file.name.split(".").pop();
        const path = `vehicle-reports/${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("chillz-images").upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("chillz-images").getPublicUrl(path);
        uploaded.push(urlData.publicUrl);
      }
      const currentSends = selectedBook?.vehicle_report_vendor_sends || 0;
      const { error: updateError } = await (supabase.from("bookings") as any).update({
        vehicle_report_images:       uploaded,
        vehicle_report_status:       "pending_review",
        vehicle_report_vendor_sends: currentSends + 1,
      }).eq("id", bookingId);
      if (updateError) throw updateError;

      const userId = selectedBook?.users?.id || selectedBook?.user_id;
      if (userId) {
        await (supabase.from("notifications") as any).insert({
          user_id: userId,
          type:    "vehicle_report_uploaded",
          title:   "Vehicle photos uploaded 📸",
          body:    "Vehicle condition photos have been uploaded. Please review and confirm.",
          data:    { booking_id: bookingId },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bookings"] });
      setShowDetail(false);
    },
    onError: (e: any) => console.error("Upload failed:", e.message || e),
  });

  const sb            = selectedBook;
  const sbStatus      = sb ? STATUS_CONFIG[sb.status] || STATUS_CONFIG.confirmed : null;
  const sbActions     = sb ? getBookingActions(sb) : null;
  const sbIsCarRental = !!(sb?.pickup_location);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} style={{ color: "#FFFFFF" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>Bookings</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                {bookings.length} total · {formatCurrency(totalEarned)} earned
              </p>
            </div>
          </div>
          <button onClick={() => setShowSearch(!showSearch)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
            <Search size={20} style={{ color: "#FFFFFF" }} />
          </button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                <Search size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
                <input autoFocus type="text" placeholder="Search guest, unit, ref..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#FFFFFF", fontFamily: "inherit" }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <X size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? "#FFFFFF" : "rgba(255,255,255,0.55)", borderBottom: `2.5px solid ${activeTab === tab.key ? "#FFFFFF" : "transparent"}`, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)", color: "#FFFFFF", padding: "1px 6px", borderRadius: 999 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 160, borderRadius: 16, backgroundColor: "#FFFFFF", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>No bookings yet</p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
              {search ? "Try a different search" : "Bookings will appear here"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((booking: any) => {
              const guest      = booking.users || {};
              const status     = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
              const actions    = getBookingActions(booking);
              const ref        = (booking.qr_code_hash || booking.id || "").slice(0, 8).toUpperCase();
              const isCarBook  = !!booking.pickup_location;
              const reportSent = !!(booking.vehicle_report_images?.length > 0 && booking.vehicle_report_status === "pending_review");
              const { unitLabel, nightLabel, Icon: UnitIcon } = vendorMeta;

              const orderItems: any[]  = booking.order_items || [];
              const guestCount         = booking.guest_count || null;
              const specialOccasion    = booking.special_occasion && booking.special_occasion !== "None"
                ? booking.special_occasion : null;
              const parsed             = parseNotesField(booking.notes);
              const displayGuestCount  = guestCount || parsed.guestCount;
              const displayOccasion    = specialOccasion || parsed.occasion;
              const displayNotes       = !isVenueVendor ? booking.notes : parsed.actualNotes;
              const isPackageBooking   = !!booking.package_name && isVenueVendor;

              return (
                <motion.div key={booking.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.07)", border: "1px solid #F0EBF8" }}>

                  <div style={{ padding: "14px 14px 10px" }}>
                    {/* Guest header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          {guest.avatar_url
                            ? <img src={guest.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{guest.full_name?.[0] || "?"}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {guest.full_name || "Guest"}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: status.color, backgroundColor: status.bg, padding: "2px 8px", borderRadius: 999 }}>{status.label}</span>
                            <span style={{ fontSize: 10, color: "#9E9E9E" }}>#{ref}</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 900, color: ACCENT, margin: 0, flexShrink: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                        {formatCurrency(booking.reserved_amount || 0)}
                      </p>
                    </div>

                    {/* Booking details block */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "10px 12px", backgroundColor: "#F7F5FA", borderRadius: 12, marginBottom: 8 }}>

                      {/* Package — venue vendors */}
                      {isPackageBooking && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Package size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Package · </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{booking.package_name}</span>
                          </div>
                        </div>
                      )}

                      {/* Unit / Room / Vehicle name — hotel, apartment, car rental */}
                      {booking.package_name && !isVenueVendor && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <UnitIcon size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em" }}>{unitLabel} · </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{booking.package_name}</span>
                          </div>
                        </div>
                      )}

                      {isCarBook && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11 }}>{booking.with_driver ? "🧑‍✈️" : "🔑"}</span>
                          <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                            {booking.with_driver ? "With Driver" : "Self Drive"}
                            {booking.pickup_time ? ` · Pickup at ${booking.pickup_time}` : ""}
                          </span>
                        </div>
                      )}

                      {!isVenueVendor && (booking.checkin_date || booking.checkout_date) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Calendar size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                            {booking.checkin_date ? format(parseISO(booking.checkin_date), "dd MMM yyyy") : ""}
                            {booking.checkout_date ? ` → ${format(parseISO(booking.checkout_date), "dd MMM yyyy")}` : ""}
                            {booking.num_nights ? ` · ${booking.num_nights} ${nightLabel}${booking.num_nights !== 1 ? "s" : ""}` : ""}
                          </span>
                        </div>
                      )}

                      {(displayGuestCount || booking.guest_count) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Users size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                            {displayGuestCount || booking.guest_count} {isCarBook ? "passenger" : "guest"}{Number(displayGuestCount || booking.guest_count) !== 1 ? "s" : ""}
                            {!isCarBook && booking.num_rooms > 1 ? ` · ${booking.num_rooms} rooms` : ""}
                          </span>
                        </div>
                      )}

                      {/* Venue: order items summary — non-package only, qty fixed */}
                      {isVenueVendor && !isPackageBooking && orderItems.length > 0 && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <ShoppingBag size={12} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order · </span>
                            <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                              {orderItems.slice(0, 3).map((item: any) => {
                                const q = item.qty || item.quantity || 1;
                                return `${item.name}${q > 1 ? ` ×${q}` : ""}`;
                              }).join(", ")}
                              {orderItems.length > 3 ? ` +${orderItems.length - 3} more` : ""}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Guest info block — hotel/apartment */}
                    {!isCarBook && !isVenueVendor && (guest.email || guest.phone || booking.nin_number || booking.id_document_url) && (
                      <div style={{ padding: "8px 12px", backgroundColor: "#F7F5FA", borderRadius: 10, marginBottom: 8 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>Guest Info</p>
                        {guest.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                            <Mail size={11} style={{ color: "#9E9E9E" }} />
                            <span style={{ fontSize: 12, color: "#6B6B6B" }}>{guest.email}</span>
                          </div>
                        )}
                        {guest.phone && (
                          <div
                            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${guest.phone.replace(/[^0-9]/g, "")}`, "_blank"); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 8, padding: "4px 10px", cursor: "pointer", marginBottom: 3 }}>
                            <span style={{ fontSize: 12 }}>💬</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{guest.phone}</span>
                          </div>
                        )}
                        {booking.nin_number && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <CreditCard size={11} style={{ color: "#059669" }} />
                            <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>NIN: {booking.nin_number}</span>
                          </div>
                        )}
                        {booking.id_document_url && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <CreditCard size={11} style={{ color: "#059669" }} />
                            <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>ID document uploaded ✓</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Venue guest info block */}
                    {isVenueVendor && (guest.email || guest.phone) && (
                      <div style={{ padding: "8px 12px", backgroundColor: "#F7F5FA", borderRadius: 10, marginBottom: 8 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>Guest Info</p>
                        {guest.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: guest.phone ? 4 : 0 }}>
                            <Mail size={11} style={{ color: "#9E9E9E" }} />
                            <span style={{ fontSize: 12, color: "#6B6B6B" }}>{guest.email}</span>
                          </div>
                        )}
                        {guest.phone && (
                          <div
                            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${guest.phone.replace(/[^0-9]/g, "")}`, "_blank"); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 8, padding: "4px 10px", cursor: "pointer", marginTop: 2 }}>
                            <span style={{ fontSize: 12 }}>💬</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{guest.phone}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Special occasion — venue */}
                    {isVenueVendor && displayOccasion && (
                      <div style={{ padding: "6px 12px", backgroundColor: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13 }}>🎉</span>
                        <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                          {displayOccasion}{displayGuestCount ? ` · ${displayGuestCount} guests` : ""}
                        </span>
                      </div>
                    )}

                    {/* Actual user notes */}
                    {displayNotes && !displayNotes.startsWith("Rejected") && !displayNotes.startsWith("Cancelled") && (
                      <div style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A", marginBottom: 8 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Guest Notes</p>
                        <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>{displayNotes}</p>
                      </div>
                    )}

                    {/* Vehicle report banner */}
                    {isCarBook && reportSent && (
                      <div style={{ padding: "8px 12px", backgroundColor: "#CCFBF1", borderRadius: 10, border: "1px solid #99F6E4", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11 }}>📸</span>
                        <span style={{ fontSize: 11, color: "#0F766E", fontWeight: 600 }}>Vehicle report sent — awaiting guest approval</span>
                      </div>
                    )}
                  </div>

                  {/* ── Card action buttons ── */}
                  {booking.status !== "cancelled" && (
                    <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>

                      <button onClick={() => { setSelectedBook(booking); setShowDetail(true); }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Eye size={13} />View
                      </button>

                      {isCarBook && (actions === "pre_checkin" || actions === "ready_checkin") && !reportSent && (
                        <>
                          <input type="file" multiple accept="image/*" style={{ display: "none" }}
                            id={`report-upload-${booking.id}`}
                            onChange={e => {
                              if (e.target.files?.length) {
                                setSelectedBook(booking);
                                uploadReportMutation.mutate({ bookingId: booking.id, files: e.target.files! });
                              }
                            }}
                          />
                          <label htmlFor={`report-upload-${booking.id}`}
                            style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0F766E,#0D9488)", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            📸 Upload Vehicle Report
                          </label>
                        </>
                      )}

                      {isCarBook && reportSent && (
                        <div style={{ flex: 2, padding: "10px 0", borderRadius: 12, backgroundColor: "#CCFBF1", border: "1px solid #99F6E4", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <span style={{ fontSize: 11 }}>📸</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0F766E" }}>Awaiting Guest Approval</span>
                        </div>
                      )}

                      {/* Reject — all vendor types during pre_checkin */}
                      {actions === "pre_checkin" && (
                        <button onClick={() => { setSelectedBook(booking); setShowReject(true); }}
                          style={{ flex: isCarBook ? 1 : 2, padding: "10px 0", borderRadius: 12, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <Ban size={13} />Reject
                        </button>
                      )}

                      {!isCarBook && actions === "ready_checkin" && (
                        <button onClick={() => checkInMutation.mutate(booking.id)} disabled={checkInMutation.isPending}
                          style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: "#059669", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: checkInMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <CheckCircle size={13} />
                          {checkInMutation.isPending ? "Checking in..." : "Check In Guest"}
                        </button>
                      )}

                      {actions === "checked_in" && (
                        <button onClick={() => { setSelectedBook(booking); setShowBill(true); }}
                          style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg,#3B0764,${ACCENT})`, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <ClipboardList size={13} />Bill Guest
                        </button>
                      )}

                      {actions === "billed" && (
                        <div style={{ flex: 2, padding: "10px 0", borderRadius: 12, backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <Receipt size={13} style={{ color: "#F59E0B" }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B" }}>Awaiting Confirm</span>
                        </div>
                      )}

                      {actions === "done" && (
                        <div style={{ flex: 2, padding: "10px 0", borderRadius: 12, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <CheckCircle size={13} style={{ color: "#6B7280" }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Completed</span>
                        </div>
                      )}
                    </div>
                  )}

                  {booking.status === "cancelled" && (
                    <div style={{ padding: "0 14px 14px" }}>
                      <div style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertCircle size={12} style={{ color: "#EF4444" }} />
                        <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>
                          {booking.notes?.startsWith("Rejected") ? "Rejected — guest refunded" : "Cancelled — guest refunded"}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Sheet ── */}
      <AnimatePresence>
        {showDetail && selectedBook && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDetail(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>Booking Details</h3>
                  <button onClick={() => setShowDetail(false)}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>

                  {/* Status + amount */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 16px" }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Status</p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: sbStatus?.color, backgroundColor: sbStatus?.bg, padding: "3px 10px", borderRadius: 999 }}>{sbStatus?.label}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Amount</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: ACCENT, margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(sb?.reserved_amount || 0)}</p>
                    </div>
                  </div>

                  {/* Guest */}
                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Guest</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {sb?.users?.avatar_url
                          ? <img src={sb.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{sb?.users?.full_name?.[0] || "?"}</span>}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 2px" }}>{sb?.users?.full_name || "Guest"}</p>
                        {sb?.users?.email && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "0 0 4px" }}>{sb.users.email}</p>}
                        {sb?.users?.phone && (
                          <div
                            onClick={() => window.open(`https://wa.me/${sb.users.phone.replace(/[^0-9]/g, "")}`, "_blank")}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                            <span style={{ fontSize: 13 }}>💬</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{sb.users.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booking info */}
                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Booking Info</p>
                    {(() => {
                      const sbParsed     = parseNotesField(sb?.notes);
                      const sbGuestCount = sb?.guest_count || sbParsed.guestCount;
                      const sbOccasion   = (sb?.special_occasion && sb.special_occasion !== "None") ? sb.special_occasion : sbParsed.occasion;
                      return [
                        sb?.package_name && !isVenueVendor
                          ? { Icon: vendorMeta.Icon, label: vendorMeta.unitLabel, value: sb.package_name }
                          : null,
                        sb?.package_name && isVenueVendor
                          ? { Icon: Package, label: "Package", value: sb.package_name }
                          : null,
                        sbIsCarRental
                          ? { Icon: UserCheck, label: "Driver", value: sb.with_driver ? "🧑‍✈️ With Driver" : "🔑 Self Drive" }
                          : null,
                        sbIsCarRental && sb?.pickup_time
                          ? { Icon: Clock, label: "Pickup Time", value: sb.pickup_time }
                          : null,
                        !isVenueVendor && sb?.checkin_date
                          ? { Icon: Calendar, label: sbIsCarRental ? "Pickup Date" : "Check-in", value: format(parseISO(sb.checkin_date), "EEEE, dd MMM yyyy") }
                          : null,
                        !isVenueVendor && sb?.checkout_date
                          ? { Icon: Calendar, label: sbIsCarRental ? "Return Date" : "Check-out", value: format(parseISO(sb.checkout_date), "EEEE, dd MMM yyyy") }
                          : null,
                        !isVenueVendor && sb?.num_nights
                          ? { Icon: Calendar, label: "Duration", value: `${sb.num_nights} ${vendorMeta.nightLabel}${sb.num_nights !== 1 ? "s" : ""}${!sbIsCarRental && sb?.num_rooms > 1 ? ` · ${sb.num_rooms} rooms` : ""}` }
                          : null,
                        sbGuestCount
                          ? { Icon: Users, label: sbIsCarRental ? "Passengers" : "Guests", value: `${sbGuestCount} ${sbIsCarRental ? "passenger" : "guest"}${Number(sbGuestCount) !== 1 ? "s" : ""}` }
                          : null,
                        sbOccasion
                          ? { Icon: Star, label: "Occasion", value: `🎉 ${sbOccasion}` }
                          : null,
                        isVenueVendor && sb?.booking_date
                          ? { Icon: Calendar, label: "Visit Date", value: format(new Date(sb.booking_date), "EEEE, dd MMM yyyy · HH:mm") }
                          : null,
                      ].filter(Boolean).map(({ Icon, label, value }: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={13} style={{ color: ACCENT }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                            <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{value}</p>
                          </div>
                        </div>
                      ));
                    })()}

                    {sbIsCarRental && sb?.pickup_location && (
                      <div style={{ marginTop: 8, padding: "10px 12px", backgroundColor: "#FFFFFF", borderRadius: 10, border: "1px solid #E4DCF0" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 4px" }}>Pickup Location</p>
                        <p style={{ fontSize: 12, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{sb.pickup_location}</p>
                        {sb.dropoff_location && !sb.same_return_location && (
                          <>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "8px 0 4px" }}>Dropoff Location</p>
                            <p style={{ fontSize: 12, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{sb.dropoff_location}</p>
                          </>
                        )}
                        {sb.same_return_location && (
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0", fontStyle: "italic" }}>↩ Returns to pickup location</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Package detail — vendor sees name + price + prep list */}
                  {isVenueVendor && sb?.package_name && (
                    <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ padding: "14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Package Booked</p>
                          <p style={{ fontSize: 15, fontWeight: 800, color: "#5B0EA6", margin: 0 }}>{sb.package_name}</p>
                          {sb.guest_count && (
                            <p style={{ fontSize: 12, color: "#7B2FBE", margin: "3px 0 0" }}>{sb.guest_count} guests</p>
                          )}
                        </div>
                        <p style={{ fontSize: 22, fontWeight: 900, color: "#5B0EA6", margin: 0, flexShrink: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                          {formatCurrency(sb.reserved_amount)}
                        </p>
                      </div>
                      {/* Prep list — items vendor needs to prepare */}
                      {sb?.order_items?.length > 0 && (
                        <div style={{ borderTop: "1px solid rgba(91,14,166,0.15)", padding: "10px 14px" }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: "#7B2FBE", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Preparation List</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {sb.order_items.map((item: any, i: number) => {
                              const qty = item.qty || item.quantity || 1;
                              return (
                                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#7B2FBE", flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#3D0066" }}>{item.name}</span>
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6" }}>×{qty}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order items — venue non-package bookings, qty fixed */}
                  {isVenueVendor && !sb?.package_name && sb?.order_items?.length > 0 && (
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Order Items</p>
                      {sb.order_items.map((item: any, i: number) => {
                        const qty = item.qty || item.quantity || 1;
                        const lineTotal = item.subtotal || (item.price || 0) * qty;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < sb.order_items.length - 1 ? "1px solid #E4DCF0" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <UtensilsCrossed size={11} style={{ color: ACCENT }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{item.name}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 12, color: "#9E9E9E" }}>×{qty} </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(lineTotal)}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1.5px solid #E4DCF0" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Order Total</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>
                          {formatCurrency(sb.order_items.reduce((a: number, i: any) => a + (i.subtotal || (i.price || 0) * (i.qty || i.quantity || 1)), 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* NIN / ID — hotel/apartment */}
                  {!sbIsCarRental && !isVenueVendor && (sb?.nin_number || sb?.id_document_url) && (
                    <div style={{ backgroundColor: "#F0FDF4", borderRadius: 14, padding: "14px", border: "1px solid #BBF7D0" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>🔒 Identity Verified</p>
                      {sb?.nin_number && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sb?.id_document_url ? 8 : 0 }}>
                          <CreditCard size={14} style={{ color: "#059669" }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#059669", fontFamily: "monospace", letterSpacing: 1 }}>
                            NIN: {sb.nin_number}
                          </span>
                          <CheckCircle size={14} style={{ color: "#059669" }} />
                        </div>
                      )}
                      {sb?.id_document_url && (
                        <div>
                          <p style={{ fontSize: 11, color: "#059669", margin: "0 0 6px", fontWeight: 600 }}>ID Document</p>
                          <button onClick={() => setShowIdImage(true)}
                            style={{ width: "100%", border: "none", borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, position: "relative", display: "block" }}>
                            <img src={sb.id_document_url} alt="ID" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                            <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 999 }}>Tap to view</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actual notes */}
                  {(() => {
                    const sbParsed  = parseNotesField(sb?.notes);
                    const realNotes = isVenueVendor ? sbParsed.actualNotes : sb?.notes;
                    if (!realNotes || realNotes.startsWith("Rejected") || realNotes.startsWith("Cancelled")) return null;
                    return (
                      <div style={{ backgroundColor: "#FFFBEB", borderRadius: 14, padding: "12px 14px", border: "1px solid #FDE68A" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Guest Notes</p>
                        <p style={{ fontSize: 13, color: "#92400E", margin: 0, lineHeight: 1.5 }}>{realNotes}</p>
                      </div>
                    );
                  })()}

                  {/* Reference */}
                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 600 }}>Reference</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", fontFamily: "monospace" }}>
                      #{(sb?.qr_code_hash || sb?.id || "").slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  {/* ── Detail sheet actions ── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                    {sbIsCarRental && (sbActions === "pre_checkin" || sbActions === "ready_checkin") && !(sb?.vehicle_report_images?.length > 0 && sb?.vehicle_report_status === "pending_review") && (
                      <>
                        <input type="file" multiple accept="image/*" style={{ display: "none" }}
                          id="detail-report-upload"
                          onChange={e => {
                            if (e.target.files?.length) {
                              uploadReportMutation.mutate({ bookingId: sb.id, files: e.target.files! });
                            }
                          }}
                        />
                        <label htmlFor="detail-report-upload"
                          style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#0F766E,#0D9488)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(13,148,136,0.3)", textAlign: "center" as const }}>
                          📸 Upload Vehicle Report
                          {sb?.vehicle_report_vendor_sends > 0 ? ` (Re-upload #${sb.vehicle_report_vendor_sends + 1})` : ""}
                        </label>
                        {uploadReportMutation.isPending && (
                          <p style={{ fontSize: 11, color: "#0D9488", textAlign: "center", margin: 0 }}>Uploading photos...</p>
                        )}
                      </>
                    )}

                    {sbIsCarRental && sb?.vehicle_report_images?.length > 0 && sb?.vehicle_report_status === "pending_review" && (
                      <div style={{ backgroundColor: "#CCFBF1", borderRadius: 14, padding: "14px", textAlign: "center", border: "1px solid #99F6E4" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0F766E", margin: "0 0 3px" }}>📸 Vehicle Report Sent</p>
                        <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>Waiting for guest to review and approve</p>
                      </div>
                    )}

                    {sbActions === "pre_checkin" && (
                      <>
                        {!sbIsCarRental && !isVenueVendor && (
                          <div style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                            <AlertCircle size={14} style={{ color: "#2563EB", flexShrink: 0 }} />
                            <p style={{ fontSize: 12, color: "#1D4ED8", margin: 0 }}>
                              Check-in date: <strong>{sb?.checkin_date ? format(parseISO(sb.checkin_date), "dd MMM yyyy") : "—"}</strong>
                            </p>
                          </div>
                        )}
                        <button onClick={() => { setShowDetail(false); setShowReject(true); }}
                          style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Ban size={14} />Reject This Booking
                        </button>
                      </>
                    )}

                    {!sbIsCarRental && sbActions === "ready_checkin" && (
                      <button onClick={() => { checkInMutation.mutate(sb.id); setShowDetail(false); }} disabled={checkInMutation.isPending}
                        style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", backgroundColor: "#059669", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <CheckCircle size={16} />
                        {checkInMutation.isPending ? "Checking in..." : "Check In Guest"}
                      </button>
                    )}

                    {sbActions === "checked_in" && (
                      <button onClick={() => { setShowDetail(false); setShowBill(true); }}
                        style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg,#3B0764,${ACCENT})`, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                        <ClipboardList size={16} />Bill This Guest
                      </button>
                    )}

                    {sbActions === "billed" && (
                      <div style={{ backgroundColor: "#FFF8E1", borderRadius: 14, padding: "14px", textAlign: "center", border: "1px solid #FDE68A" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B", margin: "0 0 3px" }}>Receipt Sent</p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Waiting for guest to confirm payment</p>
                      </div>
                    )}

                    {sbActions === "done" && sb?.status === "receipt_sent" && (
                      <button onClick={() => completeMutation.mutate(sb.id)} disabled={completeMutation.isPending}
                        style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", backgroundColor: "#059669", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <CheckCircle size={16} />Mark as Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Reject Sheet ── */}
      <AnimatePresence>
        {showReject && selectedBook && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowReject(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 60 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "20px 20px 40px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Ban size={24} style={{ color: "#EF4444" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px" }}>Reject Booking?</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>
                  {selectedBook.users?.full_name || "The guest"} will be fully refunded{" "}
                  <strong>{formatCurrency(selectedBook.reserved_amount || 0)}</strong> to their wallet.
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Reason <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                </p>
                <textarea placeholder="e.g. Fully booked, venue unavailable..."
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                  style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowReject(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Keep Booking
                </button>
                <button onClick={() => rejectMutation.mutate(selectedBook.id)} disabled={rejectMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: rejectMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: rejectMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {rejectMutation.isPending ? "Rejecting..." : <><Ban size={14} />Yes, Reject</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bill Sheet ── */}
      <AnimatePresence>
        {showBill && selectedBook && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowBill(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 60 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
              <BillSheet
                booking={selectedBook}
                vendorType={vendor?.vendor_type || ""}
                vendorId={vendor?.id || ""}
                onClose={() => setShowBill(false)}
                onSent={() => {
                  setShowBill(false);
                  setSelectedBook(null);
                  qc.invalidateQueries({ queryKey: ["vendor-bookings", vendor?.id] });
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ID Fullscreen ── */}
      <AnimatePresence>
        {showIdImage && selectedBook?.id_document_url && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowIdImage(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={() => setShowIdImage(false)}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <img src={selectedBook.id_document_url} alt="ID"
              style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 12 }} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
}