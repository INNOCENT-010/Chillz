/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Search, X, MapPin, ToggleLeft,
  ToggleRight, Building2, CheckCircle, Star,
  Link2, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminVenuesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "claimed" | "unclaimed" | "inactive">("all");
  const [selected, setSelected] = useState<any>(null);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");

  const { data: venues, isLoading } = useQuery({
    queryKey: ["admin-venues", filter],
    queryFn: async () => {
      let q = (supabase.from("venues") as any)
        .select("id, name, address, images, category, is_active, vendor_id, rating, review_count, lat, lng, google_place_id, created_at")
        .order("created_at", { ascending: false });
      if (filter === "claimed") q = q.not("vendor_id", "is", null);
      if (filter === "unclaimed") q = q.is("vendor_id", null);
      if (filter === "inactive") q = q.eq("is_active", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
  });

  // Fetch vendor info separately when a venue with vendor_id is selected
  const { data: assignedVendor } = useQuery({
    queryKey: ["venue-vendor", selected?.vendor_id],
    queryFn: async () => {
      if (!selected?.vendor_id) return null;
      const { data } = await (supabase.from("vendors") as any)
        .select("id, business_name, kyc_status, users(full_name, email)")
        .eq("id", selected.vendor_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!selected?.vendor_id,
    staleTime: 0,
  });

  // Approved venue vendors without a venue assigned
  const { data: availableVendors } = useQuery({
    queryKey: ["available-venue-vendors", vendorSearch],
    queryFn: async () => {
      let q = (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type, users(full_name, email)")
        .eq("kyc_status", "approved")
        .eq("vendor_type", "venue")
        .is("venue_id", null);
      if (vendorSearch.trim()) q = q.ilike("business_name", `%${vendorSearch}%`);
      q = q.limit(10);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: showVendorPicker,
    staleTime: 0,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ venueId, is_active }: { venueId: string; is_active: boolean }) => {
      const { error } = await (supabase.from("venues") as any)
        .update({ is_active })
        .eq("id", venueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-venues"] });
      setSelected((prev: any) => prev ? { ...prev, is_active: !prev.is_active } : null);
    },
  });

  const linkVendorMutation = useMutation({
    mutationFn: async ({ venueId, vendorId }: { venueId: string; vendorId: string }) => {
      // Link venue → vendor
      const { error: venueErr } = await (supabase.from("venues") as any)
        .update({ vendor_id: vendorId, is_active: true })
        .eq("id", venueId);
      if (venueErr) throw venueErr;

      // Link vendor → venue
      const { error: vendorErr } = await (supabase.from("vendors") as any)
        .update({ venue_id: venueId })
        .eq("id", vendorId);
      if (vendorErr) throw vendorErr;

      // Notify vendor
      const { data: vendor } = await (supabase.from("vendors") as any)
        .select("user_id, business_name")
        .eq("id", vendorId)
        .single();
      if (vendor?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: vendor.user_id,
          title: "Venue linked ✓",
          body: `Your venue has been linked to your dashboard. Log in to manage it.`,
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: (_, { vendorId }) => {
      qc.invalidateQueries({ queryKey: ["admin-venues"] });
      qc.invalidateQueries({ queryKey: ["venue-vendor"] });
      qc.invalidateQueries({ queryKey: ["available-venue-vendors"] });
      setSelected((prev: any) => prev ? { ...prev, vendor_id: vendorId } : null);
      setShowVendorPicker(false);
      setVendorSearch("");
    },
  });

  const unlinkVendorMutation = useMutation({
    mutationFn: async ({ venueId, vendorId }: { venueId: string; vendorId: string }) => {
      await (supabase.from("venues") as any).update({ vendor_id: null }).eq("id", venueId);
      await (supabase.from("vendors") as any).update({ venue_id: null }).eq("id", vendorId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-venues"] });
      qc.invalidateQueries({ queryKey: ["venue-vendor"] });
      setSelected((prev: any) => prev ? { ...prev, vendor_id: null } : null);
    },
  });

  const filtered = (venues || []).filter((v: any) =>
    !search ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.address?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: (venues || []).length,
    claimed: (venues || []).filter((v: any) => v.vendor_id).length,
    unclaimed: (venues || []).filter((v: any) => !v.vendor_id).length,
    inactive: (venues || []).filter((v: any) => !v.is_active).length,
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
          All Venues
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "0 0 16px" }}>
          {counts.unclaimed > 0 && `${counts.unclaimed} unclaimed · `}{counts.all} total
        </p>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", "claimed", "unclaimed", "inactive"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: "10px 10px 0 0", border: "none", backgroundColor: filter === f ? "#FFFFFF" : "rgba(255,255,255,0.15)", color: filter === f ? "#5B0EA6" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 5 }}>
              {f}
              {counts[f] > 0 && (
                <span style={{ backgroundColor: filter === f ? "#EDE0F7" : "rgba(255,255,255,0.2)", color: filter === f ? "#5B0EA6" : "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
          <input type="text" placeholder="Search venues..." value={search}
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
            <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No venues found</p>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Try a different filter</p>
          </div>
        ) : (
          filtered.map((venue: any) => (
            <button key={venue.id} onClick={() => { setSelected(venue); setShowVendorPicker(false); setVendorSearch(""); }}
              style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", display: "flex", border: venue.is_active ? "1.5px solid #F2EEF9" : "1.5px solid #FECACA", cursor: "pointer", boxShadow: "0 1px 8px rgba(91,14,166,0.05)", textAlign: "left", opacity: venue.is_active ? 1 : 0.75 }}>

              <div style={{ width: 72, flexShrink: 0, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
                {venue.images?.[0]
                  ? <img src={venue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 80 }} />
                  : <div style={{ width: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MapPin size={20} style={{ color: "#C4BAD8" }} />
                    </div>}
              </div>

              <div style={{ flex: 1, padding: "11px 12px", minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {venue.name}
                </p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 5px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {venue.address}
                </p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  {venue.vendor_id ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#E0F7EA", padding: "2px 7px", borderRadius: 999 }}>
                      ✓ Claimed
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", backgroundColor: "#FEF3C7", padding: "2px 7px", borderRadius: 999 }}>
                      Unclaimed
                    </span>
                  )}
                  {!venue.is_active && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 7px", borderRadius: 999 }}>
                      Inactive
                    </span>
                  )}
                  {venue.rating > 0 && (
                    <span style={{ fontSize: 10, color: "#9E9E9E", display: "flex", alignItems: "center", gap: 2 }}>
                      <Star size={10} style={{ color: "#FBBF24", fill: "#FBBF24" }} />
                      {venue.rating}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "2px 7px", borderRadius: 999, textTransform: "capitalize" }}>
                    {venue.category?.replace(/-/g, " ")}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Venue detail sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowVendorPicker(false); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

              {selected.images?.[0] && (
                <div style={{ height: 130, overflow: "hidden", borderRadius: "24px 24px 0 0", flexShrink: 0 }}>
                  <img src={selected.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 14px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {selected.name}
                    </h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {selected.address}
                    </p>
                  </div>
                  <button onClick={() => { setSelected(null); setShowVendorPicker(false); }}
                    style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={14} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>

                {/* Stats */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Status", value: selected.is_active ? "Live" : "Inactive", color: selected.is_active ? "#059669" : "#EF4444", bg: selected.is_active ? "#E0F7EA" : "#FEF2F2" },
                    { label: "Rating", value: selected.rating > 0 ? `${selected.rating} ★` : "—", color: "#D97706", bg: "#FEF3C7" },
                    { label: "Reviews", value: String(selected.review_count || 0), color: "#5B0EA6", bg: "#EDE0F7" },
                  ].map((stat) => (
                    <div key={stat.label} style={{ flex: 1, backgroundColor: stat.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 900, color: stat.color, margin: "0 0 2px" }}>{stat.value}</p>
                      <p style={{ fontSize: 10, color: stat.color, margin: 0, opacity: 0.75 }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                  {[
                    { label: "Category", value: selected.category?.replace(/-/g, " ") || "—" },
                    { label: "Google Place ID", value: selected.google_place_id || "—" },
                    { label: "Coordinates", value: selected.lat ? `${selected.lat?.toFixed(4)}, ${selected.lng?.toFixed(4)}` : "—" },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #F2EEF9" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", textAlign: "right", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Vendor assignment section */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Vendor Assignment
                  </p>

                  {selected.vendor_id && assignedVendor ? (
                    <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>
                            ✓ {assignedVendor.business_name}
                          </p>
                          <p style={{ fontSize: 12, color: "#0A0A0A", margin: "0 0 1px" }}>{assignedVendor.users?.full_name}</p>
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{assignedVendor.users?.email}</p>
                        </div>
                        <button
                          onClick={() => unlinkVendorMutation.mutate({ venueId: selected.id, vendorId: selected.vendor_id })}
                          disabled={unlinkVendorMutation.isPending}
                          style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : selected.vendor_id ? (
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
                      <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Loading vendor...</p>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px" }}>No vendor assigned</p>
                      <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>Link an approved venue vendor below.</p>
                    </div>
                  )}

                  {/* Link vendor picker */}
                  <button onClick={() => setShowVendorPicker(!showVendorPicker)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5B0EA6" }}>
                    <Link2 size={14} style={{ color: "#5B0EA6" }} />
                    {selected.vendor_id ? "Reassign vendor" : "Link a vendor"}
                  </button>

                  <AnimatePresence>
                    {showVendorPicker && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginTop: 8 }}>
                        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1.5px solid #E4DCF0", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #F2EEF9" }}>
                            <Search size={13} style={{ color: "#9E9E9E" }} />
                            <input type="text" placeholder="Search vendors..." value={vendorSearch}
                              onChange={(e) => setVendorSearch(e.target.value)}
                              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                          </div>
                          <div style={{ maxHeight: 220, overflowY: "auto" }}>
                            {(availableVendors || []).length === 0 ? (
                              <p style={{ textAlign: "center", color: "#9E9E9E", fontSize: 12, padding: "16px" }}>
                                {vendorSearch ? "No vendors found" : "No approved venue vendors without a venue"}
                              </p>
                            ) : (availableVendors || []).map((v: any) => (
                              <button key={v.id}
                                onClick={() => linkVendorMutation.mutate({ venueId: selected.id, vendorId: v.id })}
                                disabled={linkVendorMutation.isPending}
                                style={{ width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid #F7F5FA", backgroundColor: "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v.business_name}</p>
                                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v.users?.full_name} · {v.users?.email}</p>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>
                                  Link
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Active toggle */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)", marginBottom: 14 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>
                      {selected.is_active ? "Venue is Live" : "Venue is Hidden"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
                      {selected.is_active ? "Visible to users on the app" : "Not shown in discovery or search"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ venueId: selected.id, is_active: !selected.is_active })}
                    disabled={toggleActiveMutation.isPending}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {selected.is_active
                      ? <ToggleRight size={32} style={{ color: "#5B0EA6" }} />
                      : <ToggleLeft size={32} style={{ color: "#E4DCF0" }} />}
                  </button>
                </div>

                <button
                  onClick={() => { setSelected(null); router.push(`/venue/${selected.id}`); }}
                  style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #EDE0F7", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <CheckCircle size={14} />View Venue Page
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}