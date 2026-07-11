/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle, XCircle, Search,
  Building2, AlertTriangle, X, ChevronRight,
  Car, Home, Hotel,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleVenuePicker, type GoogleVenueResult } from "@/components/admin/google-venue-picker";

const VENUE_CATEGORIES = [
  { value: "bar-lounge",    label: "Bar & Lounge" },
  { value: "club",          label: "Club / Nightclub" },
  { value: "restaurant",    label: "Restaurant" },
  { value: "hotel",         label: "Hotel" },
  { value: "event-center",  label: "Event Center" },
  { value: "spa",           label: "Spa & Wellness" },
  { value: "rooftop",       label: "Rooftop Bar" },
  { value: "beach-bar",     label: "Beach Bar" },
  { value: "co-working",    label: "Co-working Space" },
  { value: "other",         label: "Other" },
];

const VENDOR_TYPE_ICON: Record<string, React.ElementType> = {
  venue: Building2, hotel: Hotel, apartment: Home, car_rental: Car,
};

const VENDOR_TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  venue:      { color: "#5B0EA6", bg: "#EDE0F7" },
  hotel:      { color: "#E07B00", bg: "#FFF3E0" },
  apartment:  { color: "#059669", bg: "#E0F7EA" },
  car_rental: { color: "#2563EB", bg: "#EFF6FF" },
};

const NEEDS_VENUE = ["venue"];

export default function AdminVendorsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [actionError, setActionError] = useState("");
  const [googleVenueSelection, setGoogleVenueSelection] = useState<GoogleVenueResult | null>(null);
  const [venueCategory, setVenueCategory] = useState("bar-lounge");

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin-vendors", statusFilter],
    queryFn: async () => {
      let q = (supabase.from("vendors") as any)
        .select("*, users(full_name, email, avatar_url)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("kyc_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
  });

  const { data: assignedVenue } = useQuery({
    queryKey: ["vendor-assigned-venue", selectedVendor?.venue_id],
    queryFn: async () => {
      if (!selectedVendor?.venue_id) return null;
      const { data } = await (supabase.from("venues") as any)
        .select("id, name, address, category")
        .eq("id", selectedVendor.venue_id)
        .maybeSingle();
      return data as { id: string; name: string; address: string; category: string } | null;
    },
    enabled: !!selectedVendor?.venue_id,
    staleTime: 0,
  });

  const createAndAssignVenueMutation = useMutation({
  mutationFn: async ({ vendorId, place, category, approve }: {
    vendorId: string;
    place: GoogleVenueResult;
    category: string;
    approve?: boolean;
  }) => {
    // 1. Check if this Google place already exists in DB
    const { data: existingRaw } = await (supabase.from("venues") as any)
      .select("id, vendor_id")
      .eq("google_place_id", place.place_id)
      .maybeSingle();
    const existing = existingRaw as { id: string; vendor_id: string | null } | null;

    // 2. Unlink vendor from any OLD venue to clear unique constraint
    const { data: previousVenueRaw } = await (supabase.from("venues") as any)
      .select("id")
      .eq("vendor_id", vendorId)
      .maybeSingle();
    const previousVenue = previousVenueRaw as { id: string } | null;

    if (previousVenue && previousVenue.id !== (existing?.id ?? "")) {
      await (supabase.from("venues") as any)
        .update({ vendor_id: null })
        .eq("id", previousVenue.id);
    }

    // 3. Assign to existing or create new venue
    let venueId: string;

    if (existing) {
      if (existing.vendor_id && existing.vendor_id !== vendorId) {
        throw new Error("This venue is already assigned to another vendor.");
      }
      venueId = existing.id;
      await (supabase.from("venues") as any).update({
        vendor_id: vendorId,
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
          vendor_id: vendorId,
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

    // 4. Update vendor
    const updatePayload: any = { venue_id: venueId };
    if (approve) {
      updatePayload.kyc_status = "approved";
      updatePayload.is_active = true;
    }
    const { error: vendorErr } = await (supabase.from("vendors") as any)
      .update(updatePayload)
      .eq("id", vendorId);
    if (vendorErr) throw vendorErr;

    // 5. Notify if approving
    if (approve) {
      const { data: vendor } = await (supabase.from("vendors") as any)
        .select("user_id, business_name").eq("id", vendorId).single();
      if (vendor?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: vendor.user_id,
          title: "You're live on Chillz! 🎉",
          body: `${vendor.business_name} is now visible to users.`,
          type: "booking",
          is_read: false,
        });
      }
    }
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["admin-vendors"] });
    qc.invalidateQueries({ queryKey: ["vendor-assigned-venue"] });
    setGoogleVenueSelection(null);
    setSelectedVendor(null);
    setActionError("");
    setVenueCategory("bar-lounge");
  },
  onError: (e: any) => setActionError(e.message),
});

  const rejectMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const { data: vendor } = await (supabase.from("vendors") as any)
        .select("user_id, business_name").eq("id", vendorId).single();
      const { error } = await (supabase.from("vendors") as any)
        .update({ kyc_status: "rejected", is_active: false }).eq("id", vendorId);
      if (error) throw error;
      if (vendor) {
        await (supabase.from("notifications") as any).insert({
          user_id: vendor.user_id,
          title: "Application not approved",
          body: `Your vendor application for ${vendor.business_name} was not approved.`,
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      setSelectedVendor(null);
    },
    onError: (e: any) => setActionError(e.message),
  });

  const approveNonVenueMutation = useMutation({
  mutationFn: async (vendorId: string) => {
    const { data: vendor } = await (supabase.from("vendors") as any)
      .select("user_id, business_name, vendor_type, address, venue_id")
      .eq("id", vendorId)
      .single();
    if (!vendor) throw new Error("Vendor not found");

    // Auto-create venue row if not already linked
    let venueId = vendor.venue_id;
    if (!venueId) {
      const categoryMap: Record<string, string> = {
        hotel:      "hotel",
        apartment:  "apartment",
        car_rental: "car_rental",
      };
      const category = categoryMap[vendor.vendor_type] || vendor.vendor_type;

      const { data: newVenue, error: venueErr } = await (supabase.from("venues") as any).insert({
        name: vendor.business_name,
        address: vendor.address || null,
        category,
        vendor_id: vendorId,
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
    }

    // Approve vendor and link venue
    const { error } = await (supabase.from("vendors") as any).update({
      kyc_status: "approved",
      is_active: true,
      venue_id: venueId,
    }).eq("id", vendorId);
    if (error) throw error;

    // Notify vendor
    await (supabase.from("notifications") as any).insert({
      user_id: vendor.user_id,
      title: "Application approved! 🎉",
      body: `Your ${vendor.vendor_type?.replace(/_/g, " ")} account for ${vendor.business_name} is now active.`,
      type: "booking",
      is_read: false,
    });
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["admin-vendors"] });
    setSelectedVendor(null);
  },
  onError: (e: any) => setActionError(e.message),
});

  const filtered = (vendors || []).filter((v: any) =>
    !search ||
    v.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.users?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const needsVenue = selectedVendor ? NEEDS_VENUE.includes(selectedVendor.vendor_type) : false;

  const closeSheet = () => {
    setSelectedVendor(null);
    setActionError("");
    setGoogleVenueSelection(null);
    setVenueCategory("bar-lounge");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 0" }}>
        <button onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Admin</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Vendor Management
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: "0 0 16px" }}>
          {(vendors || []).filter((v: any) => v.kyc_status === "pending").length} pending · {(vendors || []).length} total
        </p>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", "pending", "approved", "rejected"] as const).map((s) => {
            const count = s === "all" ? (vendors || []).length : (vendors || []).filter((v: any) => v.kyc_status === s).length;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ flexShrink: 0, padding: "8px 14px", borderRadius: "10px 10px 0 0", border: "none", backgroundColor: statusFilter === s ? "#FFFFFF" : "rgba(255,255,255,0.15)", color: statusFilter === s ? "#5B0EA6" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 5 }}>
                {s}
                {count > 0 && (
                  <span style={{ backgroundColor: statusFilter === s ? "#EDE0F7" : "rgba(255,255,255,0.2)", color: statusFilter === s ? "#5B0EA6" : "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
          <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#9E9E9E" }} /></button>}
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
            <Building2 size={36} style={{ color: "#E4DCF0", marginBottom: 10 }} />
            <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No vendors found</p>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
              {statusFilter === "pending" ? "No pending applications" : `No ${statusFilter} vendors`}
            </p>
          </div>
        ) : (
          filtered.map((vendor: any) => {
            const typeStyle = VENDOR_TYPE_COLOR[vendor.vendor_type] || VENDOR_TYPE_COLOR.venue;
            const TypeIcon = VENDOR_TYPE_ICON[vendor.vendor_type] || Building2;
            return (
              <button key={vendor.id}
                onClick={() => { setSelectedVendor(vendor); setActionError(""); setGoogleVenueSelection(null); setVenueCategory("bar-lounge"); }}
                style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #F2EEF9", cursor: "pointer", boxShadow: "0 1px 8px rgba(91,14,166,0.05)", textAlign: "left" }}>

                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: typeStyle.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TypeIcon size={20} style={{ color: typeStyle.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {vendor.business_name}
                  </p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {vendor.users?.full_name} · {vendor.users?.email}
                  </p>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      backgroundColor: vendor.kyc_status === "approved" ? "#E0F7EA" : vendor.kyc_status === "rejected" ? "#FEF2F2" : "#FFF8E1",
                      color: vendor.kyc_status === "approved" ? "#059669" : vendor.kyc_status === "rejected" ? "#EF4444" : "#D97706" }}>
                      {vendor.kyc_status}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeStyle.color, backgroundColor: typeStyle.bg, padding: "2px 8px", borderRadius: 999 }}>
                      {vendor.vendor_type?.replace(/_/g, " ")}
                    </span>
                    {vendor.venue_id && (
                      <span style={{ fontSize: 10, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>
                        📍 venue linked
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "#9E9E9E" }}>{format(new Date(vendor.created_at), "dd MMM")}</span>
                  </div>
                </div>

                <ChevronRight size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
              </button>
            );
          })
        )}
      </div>

      {/* Vendor detail sheet */}
      <AnimatePresence>
        {selectedVendor && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeSheet}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {(() => {
                      const ts = VENDOR_TYPE_COLOR[selectedVendor.vendor_type] || VENDOR_TYPE_COLOR.venue;
                      const TIcon = VENDOR_TYPE_ICON[selectedVendor.vendor_type] || Building2;
                      return (
                        <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: ts.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <TIcon size={18} style={{ color: ts.color }} />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 style={{ fontWeight: 900, fontSize: 16, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                        {selectedVendor.business_name}
                      </h3>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, textTransform: "capitalize" }}>
                        {selectedVendor.vendor_type?.replace(/_/g, " ")}
                        {selectedVendor.venue_category ? ` · ${selectedVendor.venue_category.replace(/-/g, " ")}` : ""}
                      </p>
                    </div>
                  </div>
                  <button onClick={closeSheet}
                    style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={14} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>

                {/* Details */}
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                  {[
                    { label: "Owner", value: selectedVendor.users?.full_name || "—" },
                    { label: "Email", value: selectedVendor.users?.email || "—" },
                    { label: "Phone", value: selectedVendor.phone || "—" },
                    { label: "Address", value: selectedVendor.address || "—" },
                    { label: "Vendor Type", value: selectedVendor.vendor_type?.replace(/_/g, " ") || "—" },
                    selectedVendor.venue_category ? { label: "Venue Category", value: selectedVendor.venue_category.replace(/-/g, " ") } : null,
                    { label: "Status", value: selectedVendor.kyc_status },
                    { label: "Applied", value: format(new Date(selectedVendor.created_at), "dd MMM yyyy · HH:mm") },
                    { label: "CAC", value: selectedVendor.cac_number || "Not provided" },
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #F2EEF9" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", textAlign: "right", textTransform: "capitalize" }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* ID images */}
                {selectedVendor.id_images?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>ID Documents</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {selectedVendor.id_images.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", width: 100, height: 70, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Venue assignment — Google Places */}
                {needsVenue && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Venue Assignment
                    </p>

                    {assignedVenue && (
                      <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>✓ {assignedVenue.name}</p>
                        <p style={{ fontSize: 12, color: "#0A0A0A", margin: "0 0 2px" }}>{assignedVenue.address}</p>
                        {assignedVenue.category && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                            {assignedVenue.category.replace(/-/g, " ")}
                          </span>
                        )}
                      </div>
                    )}

                    {!assignedVenue && (
                      <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>No venue assigned</p>
                        <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>Search Google Places to find and assign a venue.</p>
                      </div>
                    )}

                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 6px" }}>
                      {assignedVenue ? "Reassign to a different venue:" : "Search Google Places:"}
                    </p>
                    <GoogleVenuePicker
                      placeholder={`Search "${selectedVendor.business_name}" on Google...`}
                      onSelect={(place) => { setGoogleVenueSelection(place); setActionError(""); }}
                    />

                    {googleVenueSelection && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Venue Category
                        </p>
                        <select
                          value={venueCategory}
                          onChange={(e) => setVenueCategory(e.target.value)}
                          style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", marginBottom: 10, cursor: "pointer", appearance: "none" }}>
                          {VENUE_CATEGORIES.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => createAndAssignVenueMutation.mutate({
                            vendorId: selectedVendor.id,
                            place: googleVenueSelection,
                            category: venueCategory,
                            approve: selectedVendor.kyc_status === "pending",
                          })}
                          disabled={createAndAssignVenueMutation.isPending}
                          style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", backgroundColor: createAndAssignVenueMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(91,14,166,0.25)" }}>
                          {createAndAssignVenueMutation.isPending
                            ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Creating venue...</>
                            : <><CheckCircle size={14} />{selectedVendor.kyc_status === "pending" ? `Create "${googleVenueSelection.name}" & Approve` : `Create "${googleVenueSelection.name}" & Assign`}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-venue info */}
                {!needsVenue && selectedVendor.kyc_status === "pending" && (
                  <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", margin: "0 0 4px" }}>
                      {selectedVendor.vendor_type === "hotel" ? "🏨 Hotel vendor" :
                       selectedVendor.vendor_type === "apartment" ? "🏠 Apartment vendor" :
                       "🚗 Car rental vendor"}
                    </p>
                    <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                      Approving will activate their dashboard. No venue assignment needed.
                    </p>
                  </div>
                )}

                <AnimatePresence>
                  {actionError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
                      <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                      <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{actionError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pending — non-venue: approve + reject buttons */}
                {selectedVendor.kyc_status === "pending" && !needsVenue && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setActionError(""); rejectMutation.mutate(selectedVendor.id); }}
                      disabled={rejectMutation.isPending}
                      style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {rejectMutation.isPending
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.3)", borderTopColor: "#EF4444", animation: "spin 0.8s linear infinite" }} />
                        : <><XCircle size={15} />Reject</>}
                    </button>
                    <button
                      onClick={() => { setActionError(""); approveNonVenueMutation.mutate(selectedVendor.id); }}
                      disabled={approveNonVenueMutation.isPending}
                      style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: approveNonVenueMutation.isPending ? "#9E9E9E" : "#00C853", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: approveNonVenueMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(0,200,83,0.3)" }}>
                      {approveNonVenueMutation.isPending
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                        : <><CheckCircle size={15} />Approve & Activate</>}
                    </button>
                  </div>
                )}

                {/* Pending venue vendor — reject only (approve via picker above) */}
                {selectedVendor.kyc_status === "pending" && needsVenue && (
                  <button onClick={() => { setActionError(""); rejectMutation.mutate(selectedVendor.id); }}
                    disabled={rejectMutation.isPending}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
                    {rejectMutation.isPending
                      ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.3)", borderTopColor: "#EF4444", animation: "spin 0.8s linear infinite" }} />
                      : <><XCircle size={15} />Reject Application</>}
                  </button>
                )}

                {/* Approved status */}
                {selectedVendor.kyc_status === "approved" && (
                  <div style={{ marginTop: 12, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
                    <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>Vendor is active</p>
                      <p style={{ fontSize: 12, color: "#047857", margin: 0 }}>Full access to vendor dashboard</p>
                    </div>
                  </div>
                )}

                {/* Rejected */}
                {selectedVendor.kyc_status === "rejected" && (
                  <div style={{ marginTop: 12 }}>
                    {!needsVenue && (
                      <button onClick={() => { setActionError(""); approveNonVenueMutation.mutate(selectedVendor.id); }}
                        disabled={approveNonVenueMutation.isPending}
                        style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <CheckCircle size={15} />Approve After Review
                      </button>
                    )}
                    {needsVenue && !googleVenueSelection && (
                      <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", margin: 0 }}>
                        Search and select a venue above to re-approve
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}