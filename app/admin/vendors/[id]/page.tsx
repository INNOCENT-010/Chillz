/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle, XCircle, Eye, EyeOff,
  Building2, Phone, Mail, MapPin, Wallet,
  AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleVenuePicker, type GoogleVenueResult } from "@/components/admin/google-venue-picker";

const VENUE_CATEGORIES = [
  { value: "bar-lounge",   label: "Bar & Lounge" },
  { value: "club",         label: "Club / Nightclub" },
  { value: "restaurant",   label: "Restaurant" },
  { value: "hotel",        label: "Hotel" },
  { value: "event-center", label: "Event Center" },
  { value: "spa",          label: "Spa & Wellness" },
  { value: "rooftop",      label: "Rooftop Bar" },
  { value: "beach-bar",    label: "Beach Bar" },
  { value: "co-working",   label: "Co-working Space" },
  { value: "other",        label: "Other" },
];

export default function AdminVendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showBVN, setShowBVN] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showBookings, setShowBookings] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [googleVenueSelection, setGoogleVenueSelection] = useState<GoogleVenueResult | null>(null);
  const [venueCategory, setVenueCategory] = useState("bar-lounge");
  const [venueError, setVenueError] = useState("");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["admin-vendor-detail", id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendors") as any)
        .select("*, users(full_name, email, phone, avatar_url)")
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 0,
  });

  const { data: assignedVenue } = useQuery({
    queryKey: ["vendor-detail-venue", vendor?.venue_id],
    queryFn: async () => {
      if (!vendor?.venue_id) return null;
      const { data } = await (supabase.from("venues") as any)
        .select("id, name, address, category, images")
        .eq("id", vendor.venue_id)
        .maybeSingle();
      return data as { id: string; name: string; address: string; category: string; images: string[] } | null;
    },
    enabled: !!vendor?.venue_id,
    staleTime: 0,
  });

  const { data: earnings } = useQuery({
    queryKey: ["vendor-earnings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount, account_type, created_at, note")
        .eq("account_id", id)
        .in("account_type", ["VENDOR_PENDING", "VENDOR_AVAILABLE"])
        .order("created_at", { ascending: false });

      let pending = 0; let available = 0; let totalEarned = 0;
      ((data || []) as any[]).forEach((row: any) => {
        const val = row.direction === "CREDIT" ? row.amount : -row.amount;
        if (row.account_type === "VENDOR_PENDING") pending += val;
        else available += val;
        if (row.direction === "CREDIT") totalEarned += row.amount;
      });
      return { pending: Math.max(0, pending), available: Math.max(0, available), totalEarned };
    },
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ["vendor-bookings", id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select("*, users(full_name), venues(name), receipts(subtotal, total, platform_fee)")
        .eq("vendor_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const createAndAssignVenueMutation = useMutation({
    mutationFn: async ({ place, category, approve }: {
      place: GoogleVenueResult;
      category: string;
      approve?: boolean;
    }) => {
      // Check if place already exists
      const { data: existingRaw } = await (supabase.from("venues") as any)
        .select("id, vendor_id")
        .eq("google_place_id", place.place_id)
        .maybeSingle();
      const existing = existingRaw as { id: string; vendor_id: string | null } | null;

      // Unlink any old venue from this vendor
      const { data: previousVenueRaw } = await (supabase.from("venues") as any)
        .select("id")
        .eq("vendor_id", id)
        .maybeSingle();
      const previousVenue = previousVenueRaw as { id: string } | null;

      if (previousVenue && previousVenue.id !== (existing?.id ?? "")) {
        await (supabase.from("venues") as any)
          .update({ vendor_id: null })
          .eq("id", previousVenue.id);
      }

      let venueId: string;

      if (existing) {
        if (existing.vendor_id && existing.vendor_id !== id) {
          throw new Error("This venue is already assigned to another vendor.");
        }
        venueId = existing.id;
        await (supabase.from("venues") as any).update({
          vendor_id: id,
          is_active: true,
          category,
        }).eq("id", venueId);
      } else {
        const { data: newVenue, error: createErr } = await (supabase.from("venues") as any)
          .insert({
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            google_place_id: place.place_id,
            category,
            vendor_id: id,
            is_active: true,
            is_featured: false,
            bookings_enabled: true,
            rating: 0,
            review_count: 0,
            filters: [],
            images: [],
            tags: [],
          })
          .select()
          .single();
        if (createErr) throw createErr;
        venueId = newVenue.id;
      }

      // Update vendor
      const updatePayload: any = { venue_id: venueId };
      if (approve) {
        updatePayload.kyc_status = "approved";
        updatePayload.is_active = true;
        updatePayload.rejection_reason = null;
      }
      const { error: vendorErr } = await (supabase.from("vendors") as any)
        .update(updatePayload)
        .eq("id", id);
      if (vendorErr) throw vendorErr;

      // Notify if approving
      if (approve && vendor?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: vendor.user_id,
          title: "You're live on Chillz! 🎉",
          body: `${vendor.business_name} is now visible to users.`,
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendor-detail", id] });
      qc.invalidateQueries({ queryKey: ["vendor-detail-venue"] });
      setGoogleVenueSelection(null);
      setVenueError("");
    },
    onError: (e: any) => setVenueError(e.message),
  });

  const kycMutation = useMutation({
  mutationFn: async (status: "approved" | "rejected") => {
    setProcessing(true);

    if (status === "approved" && !isVenueType) {
      // Auto-create venue row for hotel/apartment/car_rental
      let venueId = vendor.venue_id;
      if (!venueId) {
        const categoryMap: Record<string, string> = {
          hotel:      "hotel",
          apartment:  "apartment",
          car_rental: "car_rental",
        };
        const { data: newVenue, error: venueErr } = await (supabase.from("venues") as any).insert({
          name: vendor.business_name,
          address: vendor.address || null,
          category: categoryMap[vendor.vendor_type] || vendor.vendor_type,
          vendor_id: vendor.id,
          is_active: true,
          is_featured: false,
          bookings_enabled: true,
          rating: 0,
          review_count: 0,
          filters: [],
          images: [],
          tags: [],
        }).select().single();
        if (venueErr) throw venueErr;
        venueId = newVenue.id;

        await (supabase.from("vendors") as any)
          .update({ venue_id: venueId })
          .eq("id", vendor.id);
      }
    }

    const { error } = await (supabase.from("vendors") as any).update({
      kyc_status: status,
      is_active: status === "approved",
      rejection_reason: status === "rejected" ? rejectReason || null : null,
    }).eq("id", id);
    if (error) throw error;

    await (supabase.from("notifications") as any).insert({
      user_id: vendor.user_id,
      title: status === "approved" ? "Application approved! 🎉" : "Application not approved",
      body: status === "approved"
        ? `Your application for ${vendor.business_name} has been approved.`
        : `Your application for ${vendor.business_name} was not approved.${rejectReason ? " Reason: " + rejectReason : ""}`,
      type: "booking",
      is_read: false,
    });
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["admin-vendor-detail", id] });
    setProcessing(false);
  },
  onError: () => setProcessing(false),
});

  if (isLoading || !vendor) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const statusStyle = {
    pending:  { color: "#F59E0B", bg: "#FEF3C7" },
    approved: { color: "#00C853", bg: "#E0F7EA" },
    rejected: { color: "#EF4444", bg: "#FEF2F2" },
  }[vendor.kyc_status as string] || { color: "#9E9E9E", bg: "#F2EEF9" };

  const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
    completed:    { color: "#00C853", bg: "#E0F7EA" },
    confirmed:    { color: "#5B0EA6", bg: "#EDE0F7" },
    receipt_sent: { color: "#F59E0B", bg: "#FFF8E1" },
    disputed:     { color: "#D97706", bg: "#FEF3C7" },
    cancelled:    { color: "#EF4444", bg: "#FEF2F2" },
  };

  const isVenueType = vendor.vendor_type === "venue";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Vendors</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {vendor.users?.avatar_url
              ? <img src={vendor.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Building2 size={26} style={{ color: "#FFFFFF" }} />}
          </div>
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {vendor.business_name}
            </h1>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusStyle.color, backgroundColor: "rgba(255,255,255,0.15)", padding: "2px 10px", borderRadius: 999 }}>
                {vendor.kyc_status}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>
                {vendor.vendor_type?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Earnings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Total Earned", value: formatCurrency(earnings?.totalEarned || 0), color: "#5B0EA6", bg: "#EDE0F7" },
            { label: "Pending",      value: formatCurrency(earnings?.pending || 0),     color: "#F59E0B", bg: "#FFF8E1" },
            { label: "Available",    value: formatCurrency(earnings?.available || 0),   color: "#00C853", bg: "#E0F7EA" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                <Wallet size={13} style={{ color }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 900, color, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Business details */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "12px 16px" }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Business Details</p>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: Building2, label: "Business",  value: vendor.business_name },
              { icon: MapPin,    label: "Address",   value: vendor.address || "Not provided" },
              { icon: Mail,      label: "Email",     value: vendor.users?.email || "—" },
              { icon: Phone,     label: "Phone",     value: vendor.users?.phone || "Not provided" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} style={{ color: "#5B0EA6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                  <p style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600, margin: 0 }}>{value}</p>
                </div>
              </div>
            ))}
            {vendor.cac_number && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={14} style={{ color: "#5B0EA6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.04em" }}>CAC Number</p>
                  <p style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600, margin: 0 }}>{vendor.cac_number}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BVN / NIN */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Identity Number</p>
          {vendor.bvn_nin ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 4px" }}>BVN / NIN</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: "#0A0A0A", margin: 0, fontFamily: "monospace", letterSpacing: showBVN ? "0.12em" : "0.05em" }}>
                  {showBVN ? vendor.bvn_nin : `••••••••${vendor.bvn_nin.slice(-3)}`}
                </p>
              </div>
              <button onClick={() => setShowBVN(!showBVN)}
                style={{ background: "#EDE0F7", border: "none", cursor: "pointer", padding: "8px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 5 }}>
                {showBVN ? <EyeOff size={14} style={{ color: "#5B0EA6" }} /> : <Eye size={14} style={{ color: "#5B0EA6" }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{showBVN ? "Hide" : "Reveal"}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={15} style={{ color: "#EF4444" }} />
              <span style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>BVN/NIN not submitted</span>
            </div>
          )}
        </div>

        {/* ID documents */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Government ID Documents</p>
          {vendor.id_images && vendor.id_images.length > 0 ? (
            <div style={{ display: "flex", gap: 10 }}>
              {vendor.id_images.map((url: string, idx: number) => (
                <button key={idx} onClick={() => setLightboxImg(url)}
                  style={{ flex: 1, aspectRatio: "4/3", borderRadius: 12, overflow: "hidden", border: "2px solid #EDE0F7", cursor: "pointer", padding: 0, background: "none", position: "relative" }}>
                  <img src={url} alt={`ID ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ backgroundColor: "rgba(91,14,166,0.75)", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                      <Eye size={11} style={{ color: "#FFFFFF" }} />
                      <span style={{ fontSize: 10, color: "#FFFFFF", fontWeight: 700 }}>{idx === 0 ? "Front" : "Back"}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: "12px 14px" }}>
              <AlertTriangle size={15} style={{ color: "#EF4444" }} />
              <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, margin: 0 }}>No ID documents uploaded</p>
            </div>
          )}
        </div>

        {/* Venue assignment — venue type vendors only */}
        {isVenueType && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
              Venue Assignment
            </p>

            {assignedVenue ? (
              <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>✓ {assignedVenue.name}</p>
                <p style={{ fontSize: 12, color: "#047857", margin: "0 0 4px" }}>{assignedVenue.address}</p>
                {assignedVenue.category && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                    {assignedVenue.category.replace(/-/g, " ")}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>No venue assigned</p>
                <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>Search Google Places to find and assign their venue.</p>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>
              {assignedVenue ? "Reassign to a different venue:" : "Search Google Places:"}
            </p>
            <GoogleVenuePicker
              placeholder={`Search "${vendor.business_name}" on Google...`}
              onSelect={(place) => { setGoogleVenueSelection(place); setVenueError(""); }}
            />

            {googleVenueSelection && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Venue Category
                </p>
                <select
                  value={venueCategory}
                  onChange={(e) => setVenueCategory(e.target.value)}
                  style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", cursor: "pointer", appearance: "none", marginBottom: 10 }}>
                  {VENUE_CATEGORIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => createAndAssignVenueMutation.mutate({
                    place: googleVenueSelection,
                    category: venueCategory,
                    approve: vendor.kyc_status === "pending",
                  })}
                  disabled={createAndAssignVenueMutation.isPending}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", backgroundColor: createAndAssignVenueMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(91,14,166,0.25)" }}>
                  {createAndAssignVenueMutation.isPending
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Assigning...</>
                    : <><CheckCircle size={14} />{vendor.kyc_status === "pending" ? `Create Venue & Approve` : `Update Venue Assignment`}</>}
                </button>
              </div>
            )}

            {venueError && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", marginTop: 10, display: "flex", gap: 6 }}>
                <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{venueError}</p>
              </div>
            )}
          </div>
        )}

        {/* Booking history */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <button onClick={() => setShowBookings(!showBookings)}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>Booking History</p>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{bookings?.length || 0} bookings total</p>
            </div>
            {showBookings ? <ChevronUp size={16} style={{ color: "#9E9E9E" }} /> : <ChevronDown size={16} style={{ color: "#9E9E9E" }} />}
          </button>

          <AnimatePresence>
            {showBookings && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                  {bookings && bookings.length > 0 ? bookings.map((b: any) => {
                    const receipt = b.receipts?.[0];
                    const vendorAmount = receipt
                      ? (receipt.subtotal ?? receipt.total) - (receipt.platform_fee ?? Math.round((receipt.subtotal ?? receipt.total) * 0.05))
                      : (b.final_amount ?? b.reserved_amount) * 0.95;
                    const s = STATUS_COLORS[b.status] || { color: "#9E9E9E", bg: "#F2EEF9" };
                    return (
                      <div key={b.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {b.venues?.name || "Booking"}
                          </p>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                            {b.users?.full_name} · {format(new Date(b.created_at), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {formatCurrency(vendorAmount)}
                          </p>
                          <span style={{ fontSize: 9, fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: "1px 6px", borderRadius: 999 }}>
                            {b.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    );
                  }) : <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", padding: "12px 0" }}>No bookings yet</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* KYC actions */}
        {vendor.kyc_status === "pending" && !isVenueType && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>KYC Decision</p>
            <textarea
              placeholder="Rejection reason (required if rejecting)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => kycMutation.mutate("approved")} disabled={processing}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: processing ? "#9E9E9E" : "#00C853", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(0,200,83,0.3)" }}>
                {processing ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} /> : <><CheckCircle size={16} />Approve</>}
              </button>
              <button onClick={() => {
                if (!rejectReason.trim()) { alert("Please provide a rejection reason"); return; }
                kycMutation.mutate("rejected");
              }} disabled={processing}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#FEE2E2", color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <XCircle size={16} />Reject
              </button>
            </div>
          </div>
        )}

        {vendor.kyc_status === "pending" && isVenueType && !assignedVenue && !googleVenueSelection && (
          <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>Action required</p>
            <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>Search and assign a venue above to approve this venue vendor.</p>
          </div>
        )}

        {vendor.kyc_status === "rejected" && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
            {vendor.rejection_reason && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", margin: "0 0 4px" }}>Rejection Reason</p>
                <p style={{ fontSize: 13, color: "#991B1B", margin: 0 }}>{vendor.rejection_reason}</p>
              </div>
            )}
            {isVenueType ? (
              <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", margin: 0 }}>
                Search and assign a venue above to re-approve this vendor.
              </p>
            ) : (
              <button onClick={() => kycMutation.mutate("approved")} disabled={processing}
                style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle size={14} />Approve After Review
              </button>
            )}
          </div>
        )}

        {vendor.kyc_status === "approved" && (
          <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 16, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={18} style={{ color: "#00C853", flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>Vendor is approved and active</p>
              <p style={{ fontSize: 11, color: "#059669", margin: 0 }}>Full access to vendor dashboard</p>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxImg(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.img initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              src={lightboxImg} alt="ID"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setLightboxImg(null)}
              style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <p style={{ position: "absolute", bottom: 20, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Tap anywhere to close</p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}