/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronUp,
  Building2, Car, Home, Users,
  Eye, EyeOff, FileText,
  AlertTriangle, Phone, Mail, MapPin,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { GoogleVenuePicker, type GoogleVenueResult } from "@/components/admin/google-venue-picker";

// ── Constants ─────────────────────────────────────────────────────────────
const VENUE_CATEGORIES = [
  { value: "bar-lounge",   label: "Bar & Lounge"      },
  { value: "club",         label: "Club / Nightclub"  },
  { value: "restaurant",   label: "Restaurant & Café" },
  { value: "event-center", label: "Event Center"      },
  { value: "rooftop",      label: "Rooftop Bar"       },
  { value: "beach-bar",    label: "Beach Bar"         },
  { value: "spa",          label: "Spa & Wellness"    },
  { value: "co-working",   label: "Co-working Space"  },
  { value: "other",        label: "Other"             },
];

const LOCKED_CATEGORY: Record<string, string> = {
  hotel:           "hotel",
  apartment:       "apartment",
  car_rental:      "car_rental",
  event_organizer: "event",
};

const SHOW_ON_DISCOVERY: Record<string, boolean> = {
  venue:           true,
  hotel:           true,
  apartment:       true,
  car_rental:      true,
  event_organizer: false,
};

const TYPE_ICON: Record<string, React.ElementType> = {
  venue:           Building2,
  car_rental:      Car,
  apartment:       Home,
  event_organizer: Users,
  hotel:           Building2,
};

const TYPE_LABEL: Record<string, string> = {
  venue:           "Venue",
  hotel:           "Hotel",
  apartment:       "Apartment / Shortlet",
  car_rental:      "Car Rental",
  event_organizer: "Event Organizer",
};

const TABS = ["Pending", "Approved", "Rejected"] as const;
type Tab = typeof TABS[number];

// ── Component ─────────────────────────────────────────────────────────────
export default function AdminKYCPage() {
  const router = useRouter();
  const qc     = useQueryClient();

  const [activeTab,        setActiveTab]        = useState<Tab>("Pending");
  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [processingId,     setProcessingId]     = useState<string | null>(null);
  const [rejectReason,     setRejectReason]     = useState<Record<string, string>>({});
  const [showBVN,          setShowBVN]          = useState<Record<string, boolean>>({});
  const [lightboxImg,      setLightboxImg]      = useState<string | null>(null);
  const [googleSelections, setGoogleSelections] = useState<Record<string, GoogleVenueResult>>({});
  const [venueCategories,  setVenueCategories]  = useState<Record<string, string>>({});
  const [assignErrors,     setAssignErrors]     = useState<Record<string, string>>({});
  const [copiedId,         setCopiedId]         = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("*, users(full_name, email, phone, avatar_url)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    staleTime: 1000 * 30,
  });

  const pending  = vendors?.filter((v: any) => v.kyc_status === "pending")  || [];
  const approved = vendors?.filter((v: any) => v.kyc_status === "approved") || [];
  const rejected = vendors?.filter((v: any) => v.kyc_status === "rejected") || [];

  const currentList =
    activeTab === "Pending"  ? pending  :
    activeTab === "Approved" ? approved : rejected;

  // ── Approve — all vendor types ───────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ vendor, place, category }: {
      vendor:   any;
      place:    GoogleVenueResult;
      category: string;
    }) => {
      setProcessingId(vendor.id);

      const showOnDiscovery = SHOW_ON_DISCOVERY[vendor.vendor_type] ?? true;

      // 1 — check if Google place already exists
      const { data: existing } = await (supabase.from("venues") as any)
        .select("id, vendor_id")
        .eq("google_place_id", place.place_id)
        .maybeSingle();

      // 2 — unlink vendor from any previous venue
      const { data: previousVenue } = await (supabase.from("venues") as any)
        .select("id")
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (previousVenue && previousVenue.id !== (existing?.id ?? "")) {
        await (supabase.from("venues") as any)
          .update({ vendor_id: null })
          .eq("id", previousVenue.id);
      }

      // 3 — assign existing or create new venue
      let venueId: string;

      if (existing) {
        if (existing.vendor_id && existing.vendor_id !== vendor.id) {
          throw new Error("This Google place is already assigned to another vendor.");
        }
        venueId = existing.id;
        await (supabase.from("venues") as any)
          .update({ vendor_id: vendor.id, is_active: showOnDiscovery, category })
          .eq("id", venueId);
      } else {
        const { data: newVenue, error: createErr } = await (supabase.from("venues") as any)
          .insert({
            name:             place.name,
            address:          place.address,
            lat:              place.lat,
            lng:              place.lng,
            google_place_id:  place.place_id,
            category,
            vendor_id:        vendor.id,
            is_active:        showOnDiscovery,
            is_featured:      false,
            bookings_enabled: true,
            rating:           0,
            review_count:     0,
            filters:          [],
            images:           [],
            tags:             [],
          })
          .select()
          .single();
        if (createErr) throw createErr;
        venueId = newVenue.id;
      }

      // 4 — approve vendor
      const { error: vendorErr } = await (supabase.from("vendors") as any)
        .update({
          kyc_status:       "approved",
          is_active:        true,
          rejection_reason: null,
          venue_id:         venueId,
        })
        .eq("id", vendor.id);
      if (vendorErr) throw vendorErr;

      // 5 — notify
      await (supabase.from("notifications") as any).insert({
        user_id:  vendor.user_id,
        title:    "You're live on Chillz! 🎉",
        body:     `${vendor.business_name} has been approved. Log in to complete your profile.`,
        type:     "booking",
        is_read:  false,
      });
    },

    onSuccess: (_, { vendor }) => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      setProcessingId(null);
      setExpandedId(null);
      setGoogleSelections((prev) => { const n = { ...prev }; delete n[vendor.id]; return n; });
      setVenueCategories((prev)   => { const n = { ...prev }; delete n[vendor.id]; return n; });
      setAssignErrors((prev)      => { const n = { ...prev }; delete n[vendor.id]; return n; });
    },
    onError: (e: any, { vendor }) => {
      setProcessingId(null);
      setAssignErrors((prev) => ({ ...prev, [vendor.id]: e.message }));
    },
  });

  // ── Reject ───────────────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async ({ id, userId, businessName }: {
      id: string; userId: string; businessName: string;
    }) => {
      setProcessingId(id);
      const { error } = await (supabase.from("vendors") as any)
        .update({
          kyc_status:       "rejected",
          is_active:        false,
          rejection_reason: rejectReason[id] || null,
        })
        .eq("id", id);
      if (error) throw error;

      await (supabase.from("notifications") as any).insert({
        user_id:  userId,
        title:    "Vendor application not approved",
        body:     `Your application for ${businessName} was not approved. ${rejectReason[id] ? "Reason: " + rejectReason[id] : "Contact support for details."}`,
        type:     "booking",
        is_read:  false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      setProcessingId(null);
      setExpandedId(null);
    },
    onError: () => setProcessingId(null),
  });

  const TAB_COUNTS: Record<Tab, number> = {
    Pending:  pending.length,
    Approved: approved.length,
    Rejected: rejected.length,
  };

  const handleCopyAddress = (vendorId: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(vendorId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066 0%, #5B0EA6 100%)", padding: "44px 20px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.15), transparent 70%)" }}/>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }}/>
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={20} style={{ color: "#FFFFFF" }}/>
          </div>
          <div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Admin</p>
            <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>KYC Applications</h1>
          </div>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setExpandedId(null); }}
              style={{ flex: 1, padding: "10px 8px 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === tab ? "2.5px solid #FFFFFF" : "2.5px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: activeTab === tab ? "#FFFFFF" : "rgba(255,255,255,0.4)", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{TAB_COUNTS[tab]}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: activeTab === tab ? "#FFFFFF" : "rgba(255,255,255,0.4)" }}>{tab}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 160, borderRadius: 20, backgroundColor: "#F2EEF9" }}/>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: "#F2EEF9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={28} style={{ color: "#9E9E9E" }}/>
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: 0 }}>No {activeTab.toLowerCase()} applications</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {currentList.map((vendor: any, i: number) => {
              const Icon           = TYPE_ICON[vendor.vendor_type]  || Building2;
              const typeLabel      = TYPE_LABEL[vendor.vendor_type] || vendor.vendor_type;
              const isExpanded     = expandedId === vendor.id;
              const bvnVisible     = showBVN[vendor.id];
              const googlePlace    = googleSelections[vendor.id];
              const assignError    = assignErrors[vendor.id];
              const isLocked       = !!LOCKED_CATEGORY[vendor.vendor_type];
              const lockedCategory = LOCKED_CATEGORY[vendor.vendor_type];
              const selectedCategory = isLocked
                ? lockedCategory
                : (venueCategories[vendor.id] || vendor.venue_category || "bar-lounge");
              const isEventOrg     = vendor.vendor_type === "event_organizer";

              return (
                <motion.div key={vendor.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(91,14,166,0.08)", border: activeTab === "Pending" ? "1.5px solid #FDE68A" : activeTab === "Approved" ? "1.5px solid #A7F3D0" : "1.5px solid #FECACA" }}>

                  <div style={{ height: 5, backgroundColor: activeTab === "Pending" ? "#F59E0B" : activeTab === "Approved" ? "#00C853" : "#EF4444" }}/>

                  <div style={{ padding: "16px" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={24} style={{ color: "#5B0EA6" }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 900, fontSize: 16, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {vendor.business_name}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>
                            {typeLabel}
                          </span>
                          {isEventOrg && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", backgroundColor: "#F3E8FF", padding: "2px 8px", borderRadius: 999 }}>
                              Events only
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "2px 8px", borderRadius: 999 }}>
                            {format(new Date(vendor.created_at), "dd MMM yyyy · HH:mm")}
                          </span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {activeTab === "Pending"  && <Clock       size={20} style={{ color: "#F59E0B" }}/>}
                        {activeTab === "Approved" && <CheckCircle size={20} style={{ color: "#00C853" }}/>}
                        {activeTab === "Rejected" && <XCircle     size={20} style={{ color: "#EF4444" }}/>}
                      </div>
                    </div>

                    {/* Applicant info */}
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Applicant</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                          {vendor.users?.avatar_url
                            ? <img src={vendor.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                            : <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>{vendor.users?.full_name?.charAt(0)}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{vendor.users?.full_name}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={10} style={{ color: "#9E9E9E" }}/>
                            <span style={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{vendor.users?.email}</span>
                          </div>
                        </div>
                      </div>
                      {vendor.users?.phone && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Phone size={11} style={{ color: "#9E9E9E" }}/>
                          <span style={{ fontSize: 11, color: "#6B6B6B" }}>{vendor.users.phone}</span>
                        </div>
                      )}

                      {/* Address row with copy button */}
                      {vendor.address && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <MapPin size={11} style={{ color: "#9E9E9E", marginTop: 2, flexShrink: 0 }}/>
                          <span style={{ fontSize: 11, color: "#6B6B6B", lineHeight: 1.4, flex: 1 }}>{vendor.address}</span>
                          <button
                            onClick={() => handleCopyAddress(vendor.id, vendor.address)}
                            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, backgroundColor: copiedId === vendor.id ? "#E0F7EA" : "#EDE0F7", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer", transition: "all 0.15s ease" }}>
                            {copiedId === vendor.id
                              ? <><CheckCircle size={11} style={{ color: "#00C853" }}/><span style={{ fontSize: 10, fontWeight: 700, color: "#00C853" }}>Copied</span></>
                              : <><Copy size={11} style={{ color: "#5B0EA6" }}/><span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6" }}>Copy</span></>}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button onClick={() => setExpandedId(isExpanded ? null : vendor.id)}
                      style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FileText size={14}/>
                      {isExpanded ? "Hide KYC Documents" : "View KYC Documents & Details"}
                      {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                  </div>

                  {/* Expanded KYC section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                        <div style={{ borderTop: "1px solid #F2EEF9", padding: "16px" }}>

                          {/* Business details */}
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Business Details</p>
                          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "4px 14px", marginBottom: 16 }}>
                            {[
                              { label: "Business Name", value: vendor.business_name },
                              { label: "Type",          value: typeLabel },
                              { label: "Address",       value: vendor.address || "Not provided" },
                              { label: "CAC Number",    value: vendor.cac_number || "Not provided" },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #EDE0F7" }}>
                                <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", textAlign: "right" }}>{value}</span>
                              </div>
                            ))}
                          </div>

                          {/* BVN/NIN */}
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Identity Number</p>
                          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            {vendor.bvn_nin ? (
                              <>
                                <div>
                                  <p style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 600, margin: "0 0 4px" }}>BVN / NIN</p>
                                  <p style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A", margin: 0, letterSpacing: bvnVisible ? "0.1em" : "0.05em", fontFamily: "monospace" }}>
                                    {bvnVisible ? vendor.bvn_nin : `••••••••${vendor.bvn_nin.slice(-3)}`}
                                  </p>
                                </div>
                                <button onClick={() => setShowBVN((prev) => ({ ...prev, [vendor.id]: !bvnVisible }))}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 10, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", gap: 4 }}>
                                  {bvnVisible ? <EyeOff size={15} style={{ color: "#5B0EA6" }}/> : <Eye size={15} style={{ color: "#5B0EA6" }}/>}
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{bvnVisible ? "Hide" : "Reveal"}</span>
                                </button>
                              </>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <AlertTriangle size={15} style={{ color: "#EF4444" }}/>
                                <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>BVN/NIN not submitted</span>
                              </div>
                            )}
                          </div>

                          {/* ID documents */}
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Government ID Documents</p>
                          {vendor.id_images?.length > 0 ? (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                              {vendor.id_images.map((url: string, idx: number) => (
                                <button key={idx} onClick={() => setLightboxImg(url)}
                                  style={{ position: "relative", width: "calc(50% - 5px)", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", border: "2px solid #EDE0F7", cursor: "pointer", padding: 0, background: "none" }}>
                                  <img src={url} alt={`ID ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                                  <div style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(91,14,166,0.8)", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                                    <Eye size={11} style={{ color: "#FFFFFF" }}/>
                                    <span style={{ fontSize: 10, color: "#FFFFFF", fontWeight: 700 }}>{idx === 0 ? "Front" : "Back"}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                              <AlertTriangle size={16} style={{ color: "#EF4444", flexShrink: 0 }}/>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", margin: "0 0 2px" }}>No ID documents uploaded</p>
                                <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>Consider rejecting this application</p>
                              </div>
                            </div>
                          )}

                          {/* Rejection reason display */}
                          {activeTab === "Rejected" && vendor.rejection_reason && (
                            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rejection Reason</p>
                              <p style={{ fontSize: 13, color: "#991B1B", margin: 0 }}>{vendor.rejection_reason}</p>
                            </div>
                          )}

                          {/* Google Places — all vendor types */}
                          {(activeTab === "Pending" || activeTab === "Rejected") && (
                            <div style={{ marginBottom: 14 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                                Verify Business via Google Places
                              </p>

                              {/* Context banner */}
                              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
                                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                                  {isEventOrg
                                    ? "Search for this organiser's registered business address. Their venue will NOT appear on discovery — only their posted events will be visible to users."
                                    : `Search Google Maps for "${vendor.business_name}". Select the correct result to verify their address and create their venue listing. Copy their address above if needed.`}
                                </p>
                              </div>

                              <GoogleVenuePicker
                                placeholder={`Search "${vendor.business_name}" on Google Maps...`}
                                onSelect={(place) => {
                                  setGoogleSelections((prev) => ({ ...prev, [vendor.id]: place }));
                                  setAssignErrors((prev) => { const n = { ...prev }; delete n[vendor.id]; return n; });
                                }}
                              />

                              {/* Selected place preview */}
                              {googlePlace && (
                                <div style={{ marginTop: 10, backgroundColor: "#F0FDF4", border: "1.5px solid #A7F3D0", borderRadius: 12, padding: "10px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <CheckCircle size={14} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }}/>
                                    <div>
                                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>{googlePlace.name}</p>
                                      <p style={{ fontSize: 11, color: "#6B6B6B", margin: "0 0 2px" }}>{googlePlace.address}</p>
                                      <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontFamily: "monospace" }}>
                                        {googlePlace.lat?.toFixed(5)}, {googlePlace.lng?.toFixed(5)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Category dropdown — only for generic "venue" type */}
                              {googlePlace && !isLocked && (
                                <div style={{ marginTop: 12 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Venue Category
                                  </p>
                                  <select
                                    value={venueCategories[vendor.id] || vendor.venue_category || "bar-lounge"}
                                    onChange={(e) => setVenueCategories((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                                    style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", cursor: "pointer", appearance: "none" }}>
                                    {VENUE_CATEGORIES.map(({ value, label }) => (
                                      <option key={value} value={value}>{label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Auto-assigned category badge */}
                              {googlePlace && isLocked && (
                                <div style={{ marginTop: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>Category</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", textTransform: "capitalize" }}>
                                    {lockedCategory?.replace(/_/g, " ")} — auto-assigned
                                  </span>
                                </div>
                              )}

                              {/* Error */}
                              {assignError && (
                                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", marginTop: 8, display: "flex", gap: 6 }}>
                                  <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0 }}/>
                                  <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{assignError}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Rejection reason textarea */}
                          {activeTab === "Pending" && (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                                Rejection Reason (required if rejecting)
                              </p>
                              <textarea
                                placeholder="e.g. ID document unclear, BVN mismatch, business not found on Google Maps..."
                                value={rejectReason[vendor.id] || ""}
                                onChange={(e) => setRejectReason((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                                rows={2}
                                style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
                              />
                            </div>
                          )}

                          {/* Action buttons */}
                          {(activeTab === "Pending" || activeTab === "Rejected") && (
                            <>
                              <button
                                onClick={() => {
                                  if (!googlePlace) {
                                    setAssignErrors((prev) => ({ ...prev, [vendor.id]: "Please search and select a verified business on Google Maps first." }));
                                    return;
                                  }
                                  approveMutation.mutate({ vendor, place: googlePlace, category: selectedCategory });
                                }}
                                disabled={processingId === vendor.id}
                                style={{
                                  width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                                  backgroundColor: processingId === vendor.id ? "#9E9E9E" : googlePlace ? "#00C853" : "#C4C4C4",
                                  color: "#FFFFFF", fontSize: 14, fontWeight: 700,
                                  cursor: processingId === vendor.id ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                  marginBottom: activeTab === "Pending" ? 8 : 0,
                                  boxShadow: googlePlace ? "0 4px 12px rgba(0,200,83,0.3)" : "none",
                                  transition: "all 0.2s ease",
                                }}>
                                {processingId === vendor.id ? (
                                  <>
                                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }}/>
                                    Verifying & approving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle size={16}/>
                                    {googlePlace ? `Approve — ${googlePlace.name}` : "Select a verified business first"}
                                  </>
                                )}
                              </button>

                              {activeTab === "Pending" && (
                                <button
                                  onClick={() => {
                                    if (!rejectReason[vendor.id]?.trim()) {
                                      alert("Please provide a rejection reason before rejecting.");
                                      return;
                                    }
                                    rejectMutation.mutate({ id: vendor.id, userId: vendor.user_id, businessName: vendor.business_name });
                                  }}
                                  disabled={processingId === vendor.id}
                                  style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", backgroundColor: "#FEE2E2", color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: processingId === vendor.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                  <XCircle size={16}/>Reject Application
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxImg(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              src={lightboxImg} alt="ID Document"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain" }}
              onClick={(e) => e.stopPropagation()}/>
            <button onClick={() => setLightboxImg(null)}
              style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={20} style={{ color: "#FFFFFF" }}/>
            </button>
            <p style={{ position: "absolute", bottom: 20, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              Tap anywhere to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}