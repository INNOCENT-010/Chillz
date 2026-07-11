/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ArrowLeft, MapPin, Calendar, Users, Clock,
  Phone, MessageCircle, Star, CheckCircle,
  XCircle, Receipt, Building2, X, AlertCircle,
  Navigation, QrCode, ChevronRight, Car, UserCheck,
  UtensilsCrossed, ShoppingBag, ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useState } from "react";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  confirmed:    { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed"    },
  checked_in:   { bg: "#E0F7EA", color: "#00C853", label: "Checked In"   },
  completed:    { bg: "#E0F7EA", color: "#00C853", label: "Completed"    },
  receipt_sent: { bg: "#FFF8E1", color: "#F59E0B", label: "Receipt Sent" },
  disputed:     { bg: "#FEF3C7", color: "#D97706", label: "Disputed"     },
  cancelled:    { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled"    },
  pending:      { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending"      },
};

// Strip "Guests: X · Occasion: Y ·" prefix from legacy notes strings
function cleanNotes(notes: string | null): string | null {
  if (!notes) return null;
  let s = notes;
  s = s.replace(/Guests?:\s*\d+\s*[·\-]?\s*/gi, "");
  s = s.replace(/Occasion:\s*[^·\n]+[·]?\s*/gi, "");
  s = s.replace(/^[·\s]+|[·\s]+$/g, "").trim();
  return s || null;
}

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [reportIdx,      setReportIdx]      = useState(0);
  const [lightboxImgs,   setLightboxImgs]   = useState<string[]>([]);
  const [lightboxIdx,    setLightboxIdx]    = useState(0);
  const [showDispute,    setShowDispute]    = useState(false);
  const [disputeReason,  setDisputeReason]  = useState("");

  const openLightbox  = (imgs: string[], idx: number) => { setLightboxImgs(imgs); setLightboxIdx(idx); };
  const closeLightbox = () => setLightboxImgs([]);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select(`
          id, status, reserved_amount, final_amount, package_name, package_price,
          checkin_date, checkout_date, num_nights, num_rooms, guest_count,
          booking_date, notes, special_occasion, qr_code_hash, user_id,
          vendor_id, listing_id, pickup_location, dropoff_location,
          pickup_time, with_driver, same_return_location,
          vehicle_report_images, vehicle_report_status, vehicle_report_rejections,
          order_items, nin_number, id_document_url,
          users(full_name, email, phone, avatar_url),
          venues(id, name, address, lat, lng, phone, whatsapp, images),
          vendors(id, business_name, vendor_type)
        `)
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 30,
    refetchInterval: 10000,
  });

  const { data: receipt } = useQuery({
    queryKey: ["booking-receipt-data", id],
    queryFn: async () => {
      const { data } = await (supabase.from("receipts") as any)
        .select("*").eq("booking_id", id).maybeSingle();
      return data as any;
    },
    staleTime: 1000 * 15,
    refetchInterval: 10000,
  });

  const { data: review } = useQuery({
    queryKey: ["booking-review", id],
    queryFn: async () => {
      const { data } = await (supabase.from("reviews") as any)
        .select("id, rating, comment").eq("booking_id", id).maybeSingle();
      return data as any;
    },
    enabled: booking?.status === "completed",
    staleTime: 1000 * 60,
  });

  // ── Vehicle report mutations ───────────────────────────────────────
  const approveReportMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("bookings") as any)
        .update({
          status:                "checked_in",
          vehicle_report_status: "approved",
          checked_in_at:         new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await (supabase.from("notifications") as any).insert({
        user_id: booking?.vendor_id,
        type:    "vehicle_report_approved",
        title:   "Vehicle report approved ✓",
        body:    `${booking?.users?.full_name || "Guest"} approved the vehicle condition report.`,
        data:    { booking_id: id },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-detail", id] }),
  });

  const rejectReportMutation = useMutation({
    mutationFn: async () => {
      const currentRejections = booking?.vehicle_report_rejections || 0;
      const newRejections = currentRejections + 1;
      if (newRejections >= 4) {
        await (supabase.from("bookings") as any)
          .update({ status: "disputed", vehicle_report_status: "rejected", vehicle_report_rejections: newRejections })
          .eq("id", id);
        await (supabase.from("dispute_messages") as any).insert({
          booking_id: id, sender_id: user!.id, sender_role: "user",
          message: `Vehicle report automatically disputed after ${newRejections} rejections.`,
          attachments: [],
        });
        await (supabase.from("notifications") as any).insert({
          user_id: booking?.vendor_id, type: "booking_disputed",
          title: "Booking Disputed — Vehicle Report",
          body: `${booking?.users?.full_name || "Guest"} rejected the vehicle report 4 times.`,
          data: { booking_id: id },
        });
      } else {
        await (supabase.from("bookings") as any)
          .update({ vehicle_report_status: "rejected", vehicle_report_rejections: newRejections })
          .eq("id", id);
        await (supabase.from("notifications") as any).insert({
          user_id: booking?.vendor_id, type: "vehicle_report_rejected",
          title: "Vehicle report rejected",
          body: `${booking?.users?.full_name || "Guest"} rejected the vehicle condition report. Attempt ${newRejections} of 4.`,
          data: { booking_id: id },
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-detail", id] }),
  });

  // ── Manual dispute mutation ────────────────────────────────────────
  const manualDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!disputeReason.trim()) throw new Error("Please describe the issue");
      await (supabase.from("bookings") as any)
        .update({ status: "disputed" }).eq("id", id);
      await (supabase.from("dispute_messages") as any).insert({
        booking_id:  id,
        sender_id:   user!.id,
        sender_role: "user",
        message:     disputeReason.trim(),
        attachments: [],
      });
      await (supabase.from("notifications") as any).insert({
        user_id: booking?.vendor_id,
        type:    "booking_disputed",
        title:   "Booking Disputed",
        body:    `${booking?.users?.full_name || "Guest"} has raised a dispute. Reason: ${disputeReason.trim().slice(0, 100)}`,
        data:    { booking_id: id },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-detail", id] });
      setShowDispute(false);
      setDisputeReason("");
    },
    onError: (e: any) => console.error("Dispute failed:", e.message),
  });

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!booking) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Booking not found.</p>
        <button onClick={() => router.back()}
          style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  const status      = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;
  const venue       = booking.venues || {};
  const vendor      = booking.vendors || {};
  const isCarRental = vendor.vendor_type === "car_rental" || !!booking.pickup_location;
  const isVenue     = ["venue","restaurant","bar-lounge","club","bar","lounge"].includes(vendor.vendor_type || "");
  const isCancelled = booking.status === "cancelled";
  const isCompleted = booking.status === "completed";
  const isReceipt   = booking.status === "receipt_sent";
  const isCheckedIn = booking.status === "checked_in";
  const isDisputed  = booking.status === "disputed";
  const hasReceipt  = !!receipt;
  const isDraft     = receipt && receipt.status === "draft";
  const ref         = (booking.qr_code_hash || booking.id || "").slice(0, 8).toUpperCase();

  const displayAmount = isCancelled
    ? booking.reserved_amount
    : isCompleted && booking.final_amount
    ? booking.final_amount
    : booking.reserved_amount;

  const hasStaySummary = !isCarRental && (booking.checkin_date || booking.checkout_date);
  const hasCarDetails  = booking.pickup_location || booking.dropoff_location;

  // order_items uses field names: id, name, price, qty, subtotal
  const orderItems: any[] = booking.order_items || [];

  // Vehicle report
  const reportImages: string[]   = booking.vehicle_report_images || [];
  const reportStatus             = booking.vehicle_report_status;
  const reportRejections         = booking.vehicle_report_rejections || 0;
  const showVehicleReport        = isCarRental && reportImages.length > 0
    && booking.status === "confirmed"
    && reportStatus === "pending_review";

  // Venue images for lightbox
  const venueImages: string[] = venue.images || [];

  // Clean notes — strip system-generated prefix
  const cleanedNotes   = cleanNotes(booking.notes);
  const displayOccasion = booking.special_occasion && booking.special_occasion !== "None"
    ? booking.special_occasion : null;

  // Can user manually open a dispute?
  const canManuallyDispute = !isCancelled && !isCompleted && !isDisputed
    && ["confirmed","checked_in","receipt_sent"].includes(booking.status);

  return (
    <MainLayout>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", backgroundColor: "#F7F5FA", paddingBottom: 60 }}>

        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, padding: "16px 16px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} style={{ color: "#FFFFFF" }} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>Booking</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: status.bg, borderRadius: 999, padding: "6px 14px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: status.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: status.color }}>{status.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                {formatCurrency(displayAmount)}
              </span>
              {isCompleted && booking.final_amount && booking.final_amount !== booking.reserved_amount && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", margin: "2px 0 0", textAlign: "right" }}>
                  reserved {formatCurrency(booking.reserved_amount)}
                </p>
              )}
            </div>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "8px 0 0" }}>
            Ref #{ref} · Booked {booking.booking_date ? format(parseISO(booking.booking_date), "dd MMM yyyy") : ""}
          </p>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14, marginTop: -12 }}>

          {/* ── Cancelled banner ── */}
          {isCancelled && (
            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 16, padding: "16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FECACA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={18} style={{ color: "#EF4444" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#EF4444", margin: "0 0 3px" }}>
                  {booking.notes?.startsWith("Rejected") ? "Booking Rejected" : "Booking Cancelled"}
                </p>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>
                  {formatCurrency(booking.reserved_amount)} has been refunded to your wallet.
                </p>
              </div>
            </div>
          )}

          {/* ── Disputed banner ── */}
          {isDisputed && (
            <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 16, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <AlertCircle size={18} style={{ color: "#D97706", flexShrink: 0 }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: "#D97706", margin: 0 }}>Dispute In Progress</p>
              </div>
              <p style={{ fontSize: 12, color: "#92400E", margin: "0 0 10px", lineHeight: 1.5 }}>
                Chillz support is reviewing. Resolution within 8 hours.
              </p>
              <button
                onClick={() => router.push(`/bookings/${id}/dispute`)}
                style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1.5px solid #FDE68A", backgroundColor: "#FFFFFF", color: "#D97706", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MessageCircle size={14} />Open Dispute Thread
              </button>
            </div>
          )}

          {/* ── Vehicle Report Review ── */}
          {showVehicleReport && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
              <div style={{ background: "linear-gradient(135deg,#0F766E,#0D9488)", padding: "14px 16px" }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF", margin: "0 0 2px" }}>🚗 Vehicle Condition Report</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", margin: 0 }}>
                  Review the vehicle photos before confirming pickup
                  {reportRejections > 0 ? ` · Attempt ${reportRejections + 1} of 4` : ""}
                </p>
              </div>
              <div style={{ position: "relative", backgroundColor: "#0A0A0A" }}>
                <img src={reportImages[reportIdx]} alt={`Vehicle photo ${reportIdx + 1}`}
                  onClick={() => openLightbox(reportImages, reportIdx)}
                  style={{ width: "100%", height: 240, objectFit: "contain", display: "block", cursor: "pointer" }} />
                {reportImages.length > 1 && (
                  <>
                    {reportIdx > 0 && (
                      <button onClick={() => setReportIdx(i => i - 1)}
                        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ChevronLeft size={18} style={{ color: "#FFFFFF" }} />
                      </button>
                    )}
                    {reportIdx < reportImages.length - 1 && (
                      <button onClick={() => setReportIdx(i => i + 1)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ChevronRight size={18} style={{ color: "#FFFFFF" }} />
                      </button>
                    )}
                    <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                      {reportImages.map((_: any, i: number) => (
                        <button key={i} onClick={() => setReportIdx(i)}
                          style={{ width: i === reportIdx ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === reportIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                      ))}
                    </div>
                  </>
                )}
                <div style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "3px 10px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{reportIdx + 1}/{reportImages.length}</span>
                </div>
              </div>
              <div style={{ padding: "14px 16px", display: "flex", gap: 10 }}>
                <button onClick={() => rejectReportMutation.mutate()}
                  disabled={rejectReportMutation.isPending || approveReportMutation.isPending}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <XCircle size={15} />
                  {reportRejections >= 3 ? "Dispute (final)" : "Reject"}
                </button>
                <button onClick={() => approveReportMutation.mutate()}
                  disabled={approveReportMutation.isPending || rejectReportMutation.isPending}
                  style={{ flex: 2, padding: "12px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#0F766E,#0D9488)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 3px 12px rgba(13,148,136,0.3)" }}>
                  <CheckCircle size={15} />
                  {approveReportMutation.isPending ? "Approving..." : "Approve & Confirm Pickup"}
                </button>
              </div>
              {reportRejections >= 3 && (
                <div style={{ padding: "0 16px 14px" }}>
                  <div style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }}>
                    <AlertCircle size={13} style={{ color: "#D97706", flexShrink: 0 }} />
                    <p style={{ fontSize: 11, color: "#92400E", margin: 0 }}>Final rejection will open a dispute with Chillz support.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Running tab / receipt banner ── */}
          {(isDraft || isReceipt || isCheckedIn) && (
            <button onClick={() => router.push(`/bookings/${id}/receipt`)}
              style={{ width: "100%", backgroundColor: isReceipt ? ACCENT : "#FFF8E1", border: `1.5px solid ${isReceipt ? ACCENT : "#FDE68A"}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Receipt size={18} style={{ color: isReceipt ? "#FFFFFF" : "#F59E0B", flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: isReceipt ? "#FFFFFF" : "#92400E", margin: "0 0 2px" }}>
                    {isReceipt ? "Receipt Ready — Review & Confirm" : "Running Tab in Progress"}
                  </p>
                  <p style={{ fontSize: 11, color: isReceipt ? "rgba(255,255,255,0.8)" : "#B45309", margin: 0 }}>
                    {isReceipt ? "Tap to confirm payment or dispute" : "Vendor is building your bill — updates live"}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: isReceipt ? "#FFFFFF" : "#F59E0B", flexShrink: 0 }} />
            </button>
          )}

          {/* ── Completed receipt link ── */}
          {isCompleted && hasReceipt && (
            <button onClick={() => router.push(`/bookings/${id}/receipt`)}
              style={{ width: "100%", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} style={{ color: "#059669" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Payment Confirmed — View Receipt</span>
              </div>
              <ChevronRight size={16} style={{ color: "#059669" }} />
            </button>
          )}

          {/* ── Venue images (tappable lightbox) ── */}
          {venueImages.length > 0 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EEF9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Venue Photos</p>
                <span style={{ fontSize: 11, color: "#9E9E9E" }}>Tap to view</span>
              </div>
              <div style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
                {venueImages.map((img: string, i: number) => (
                  <button key={i} onClick={() => openLightbox(venueImages, i)}
                    style={{ flexShrink: 0, width: 100, height: 80, borderRadius: 12, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", position: "relative" }}>
                    <img src={img} alt={`Venue photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {i === venueImages.length - 1 && venueImages.length > 4 && (
                      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>+{venueImages.length - 4}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Venue / vendor card ── */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F2EEF9" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                {isCarRental ? "Car Rental Company" : "Venue"}
              </p>
              <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                {venue.name || vendor.business_name || "Your Booking"}
              </p>
              {venue.address && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin size={12} style={{ color: "#9E9E9E" }} />
                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>{venue.address}</span>
                </div>
              )}
            </div>
            {(venue.whatsapp || venue.phone || (venue.lat && venue.lng)) && (
              <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(venue.whatsapp || venue.phone) && (
                  <a href={`https://wa.me/${(venue.whatsapp || venue.phone || "").replace(/[^0-9]/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 10, padding: "7px 12px" }}>
                    <MessageCircle size={12} style={{ color: "#059669" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span>
                  </a>
                )}
                {venue.lat && venue.lng && (
                  <button onClick={() => {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    if (isIOS) window.open(`maps://?daddr=${venue.lat},${venue.lng}`, "_blank");
                    else window.open(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`, "_blank");
                  }} style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", cursor: "pointer", border: "none" }}>
                    <Navigation size={12} style={{ color: "#6B6B6B" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Directions</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Booking details ── */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F2EEF9" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Booking Details</p>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {isCarRental && booking.package_name && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Car size={14} style={{ color: "#9E9E9E" }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>Vehicle</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{booking.package_name}</span>
                </div>
              )}
              {!isCarRental && booking.package_name && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={14} style={{ color: "#9E9E9E" }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>Package</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{booking.package_name}</span>
                </div>
              )}
              {isCarRental && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <UserCheck size={14} style={{ color: "#9E9E9E" }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>Driver</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                    {booking.with_driver ? "🧑‍✈️ With Driver" : "🔑 Self Drive"}
                  </span>
                </div>
              )}
              {booking.guest_count && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={14} style={{ color: "#9E9E9E" }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>{isCarRental ? "Passengers" : "Guests"}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{booking.guest_count}</span>
                </div>
              )}
              {booking.num_nights && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={14} style={{ color: "#9E9E9E" }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>Duration</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                    {booking.num_nights} {isCarRental ? "day" : "night"}{booking.num_nights !== 1 ? "s" : ""}
                    {!isCarRental && booking.num_rooms > 1 ? ` · ${booking.num_rooms} rooms` : ""}
                  </span>
                </div>
              )}
              {/* Occasion — dedicated row, not buried in notes */}
              {displayOccasion && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#6B6B6B" }}>Occasion</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>🎉 {displayOccasion}</span>
                </div>
              )}
              {/* Notes — cleaned, only real user notes shown */}
              {cleanedNotes && !cleanedNotes.startsWith("Rejected") && !cleanedNotes.startsWith("Cancelled") && (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#6B6B6B", flexShrink: 0 }}>Notes</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", textAlign: "right" }}>{cleanedNotes}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>Reserved</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(booking.reserved_amount)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>Booked on</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                  {booking.booking_date ? format(parseISO(booking.booking_date), "dd MMM yyyy") : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Stay summary ── */}
          {hasStaySummary && (
            <div style={{ backgroundColor: "#EFF6FF", borderRadius: 18, padding: "16px", border: "1px solid #BFDBFE" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Building2 size={16} style={{ color: "#2563EB" }} />
                <p style={{ fontSize: 13, fontWeight: 800, color: "#1D4ED8", margin: 0 }}>Stay Summary</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px", textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Check-in</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#1D4ED8", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                    {booking.checkin_date ? format(parseISO(booking.checkin_date), "dd MMM") : "—"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: "2px 0 0" }}>
                    {booking.checkin_date ? format(parseISO(booking.checkin_date), "yyyy") : ""}
                  </p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Clock size={16} style={{ color: "#2563EB" }} />
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", margin: "4px 0 0" }}>{booking.num_nights || 1}N</p>
                </div>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px", textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Check-out</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#1D4ED8", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                    {booking.checkout_date ? format(parseISO(booking.checkout_date), "dd MMM") : "—"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: "2px 0 0" }}>
                    {booking.checkout_date ? format(parseISO(booking.checkout_date), "yyyy") : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Car rental trip details ── */}
          {hasCarDetails && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EEF9" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Trip Details</p>
              </div>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {booking.checkin_date && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={13} style={{ color: "#059669" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Pickup Date</p>
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>
                        {format(parseISO(booking.checkin_date), "EEEE, dd MMM yyyy")}
                        {booking.pickup_time ? ` · ${booking.pickup_time}` : ""}
                      </p>
                    </div>
                  </div>
                )}
                {booking.checkout_date && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={13} style={{ color: "#D97706" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Return Date</p>
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>
                        {format(parseISO(booking.checkout_date), "EEEE, dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                )}
                {booking.pickup_location && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MapPin size={13} style={{ color: "#059669" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Pickup</p>
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{booking.pickup_location}</p>
                    </div>
                  </div>
                )}
                {booking.dropoff_location && !booking.same_return_location && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MapPin size={13} style={{ color: "#D97706" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Dropoff</p>
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, fontWeight: 600 }}>{booking.dropoff_location}</p>
                    </div>
                  </div>
                )}
                {booking.same_return_location && (
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, fontStyle: "italic" }}>↩ Return to pickup location</p>
                )}
              </div>
            </div>
          )}

          {/* ── Order items — field is qty not quantity ── */}
          {orderItems.length > 0 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EEF9", display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={14} style={{ color: ACCENT }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Your Order</p>
              </div>
              {orderItems.map((item: any, i: number) => (
                <div key={i} style={{ padding: "11px 16px", borderBottom: i < orderItems.length - 1 ? "1px solid #F2EEF9" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600 }}>{item.name}</span>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
                      {formatCurrency(item.price)} × {item.qty}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                    {formatCurrency(item.subtotal || item.price * item.qty)}
                  </span>
                </div>
              ))}
              <div style={{ padding: "11px 16px", backgroundColor: "#F7F5FA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: ACCENT }}>
                  {formatCurrency(orderItems.reduce((a: number, i: any) => a + (i.subtotal || i.price * i.qty), 0))}
                </span>
              </div>
            </div>
          )}

          {/* ── QR Code ── */}
          {!isCancelled && booking.qr_code_hash && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "20px 16px", border: "1px solid #F0EBF8", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                <QrCode size={16} style={{ color: ACCENT }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: ACCENT, margin: 0 }}>
                  {isCarRental ? "Your Booking Reference" : "Your Check-in QR Code"}
                </p>
              </div>
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "16px", display: "inline-block", marginBottom: 10 }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "monospace", letterSpacing: 4 }}>
                  #{ref}
                </p>
              </div>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                {isCarRental ? "Share this with the vendor when they arrive" : "Show this to the vendor at check-in"}
              </p>
            </div>
          )}

          {/* ── Manual dispute trigger ── */}
          {canManuallyDispute && !isDisputed && (
            <button onClick={() => setShowDispute(true)}
              style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <AlertCircle size={14} />Report an Issue
            </button>
          )}

          {/* ── Review section ── */}
          {isCompleted && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: "1px solid #F0EBF8" }}>
              {review ? (
                <div style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Your Review</p>
                  <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={16} style={{ color: s <= review.rating ? "#FBBF24" : "#E4DCF0", fill: s <= review.rating ? "#FBBF24" : "#E4DCF0" }} />
                    ))}
                  </div>
                  {review.comment && <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, fontStyle: "italic" }}>"{review.comment}"</p>}
                </div>
              ) : (
                <div style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Leave a Review</p>
                  <Link href={`/review/${id}`}
                    style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: ACCENT_BG, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Star size={16} style={{ color: ACCENT }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Rate your experience</span>
                    </div>
                    <ChevronRight size={16} style={{ color: ACCENT }} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Manual Dispute Sheet ── */}
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
                  <AlertCircle size={26} style={{ color: "#D97706" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px" }}>Report an Issue</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                  Describe the problem. Chillz support, you, and the vendor will have a 3-way chat to resolve it.
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  What happened? <span style={{ color: "#EF4444" }}>*</span>
                </p>
                <textarea
                  placeholder="e.g. Vendor billed me incorrectly, items not received, poor service..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  rows={3}
                  style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
              </div>
              {manualDisputeMutation.isError && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{(manualDisputeMutation.error as Error).message}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowDispute(false); setDisputeReason(""); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => manualDisputeMutation.mutate()}
                  disabled={manualDisputeMutation.isPending || !disputeReason.trim()}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: manualDisputeMutation.isPending || !disputeReason.trim() ? "#9E9E9E" : "#D97706", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: manualDisputeMutation.isPending || !disputeReason.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {manualDisputeMutation.isPending ? "Submitting..." : <><AlertCircle size={14} />Submit Report</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxImgs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeLightbox}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={closeLightbox}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{lightboxIdx + 1} / {lightboxImgs.length}</span>
            </div>
            {lightboxIdx > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i - 1); }}
                style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            {lightboxIdx < lightboxImgs.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i + 1); }}
                style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            <motion.img key={lightboxImgs[lightboxIdx]} src={lightboxImgs[lightboxIdx]}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }} />
            {lightboxImgs.length > 1 && (
              <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {lightboxImgs.map((_: any, i: number) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setLightboxIdx(i); }}
                    style={{ width: i === lightboxIdx ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === lightboxIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
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