/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft, CheckCircle, AlertTriangle, MapPin,
  Star, Calendar, Trash2, Eye, EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = [
  { id: "bar-lounge", label: "Bar & Lounge" },
  { id: "restaurant", label: "Restaurant" },
  { id: "club", label: "Club" },
  { id: "hotel", label: "Hotel" },
  { id: "outdoorsy", label: "Outdoorsy" },
  { id: "events", label: "Events" },
];

const COMMON_FILTERS = [
  "Rooftop", "Outdoor Seating", "Live Music", "DJ", "Shisha",
  "Cocktail Bar", "Fine Dining", "Buffet", "Sports Bar", "Pool",
  "Karaoke", "VIP Tables", "WiFi", "Parking", "AC",
];

export default function AdminVenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "bookings" | "reviews">("info");

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    filters: [] as string[],
    images: [] as string[],
    is_featured: false,
    is_active: true,
    bookings_enabled: true,
    address: "",
  });

  const { data: venue, isLoading } = useQuery({
    queryKey: ["admin-venue", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("venues")
        .select("*, vendors(business_name, kyc_status)")
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-venue-bookings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, users(full_name)")
        .eq("venue_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: activeTab === "bookings",
    staleTime: 1000 * 30,
  });

  const { data: reviews } = useQuery({
    queryKey: ["admin-venue-reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, users(full_name, avatar_url)")
        .eq("venue_id", id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: activeTab === "reviews",
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name || "",
        category: venue.category || "",
        description: venue.description || "",
        filters: venue.filters || [],
        images: venue.images || [],
        is_featured: venue.is_featured || false,
        is_active: venue.is_active !== false,
        bookings_enabled: venue.bookings_enabled !== false,
        address: venue.address || "",
      });
    }
  }, [venue]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("venues") as any)
        .update({
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim() || null,
          filters: form.filters,
          images: form.images,
          is_featured: form.is_featured,
          is_active: form.is_active,
          bookings_enabled: form.bookings_enabled,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-venue", id] });
      qc.invalidateQueries({ queryKey: ["admin-venues"] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("venues") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-venues"] });
      router.push("/admin/venues");
    },
    onError: (e: any) => setError(e.message),
  });

  const toggleFilter = (f: string) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.includes(f)
        ? prev.filters.filter((x) => x !== f)
        : [...prev.filters, f],
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    confirmed:    { bg: "#EDE0F7", color: "#5B0EA6", label: "Confirmed" },
    checked_in:   { bg: "#E0F7EA", color: "#00C853", label: "Checked In" },
    completed:    { bg: "#E0F7EA", color: "#00C853", label: "Completed" },
    receipt_sent: { bg: "#FFF8E1", color: "#F59E0B", label: "Receipt Sent" },
    disputed:     { bg: "#FEF3C7", color: "#D97706", label: "Disputed" },
    cancelled:    { bg: "#FEF2F2", color: "#EF4444", label: "Cancelled" },
    pending:      { bg: "#F2EEF9", color: "#9E9E9E", label: "Pending" },
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!venue) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Venue not found.</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066 0%, #5B0EA6 100%)", padding: "44px 20px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.15), transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 1, marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Admin · Venue</p>
              <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={11} style={{ color: "rgba(255,255,255,0.6)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.address}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: venue.is_active ? "rgba(0,200,83,0.2)" : "rgba(255,255,255,0.1)", borderRadius: 999, padding: "3px 10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: venue.is_active ? "#00C853" : "#9E9E9E" }} />
                <span style={{ fontSize: 10, color: venue.is_active ? "#00C853" : "#9E9E9E", fontWeight: 700 }}>{venue.is_active ? "Live" : "Hidden"}</span>
              </div>
              {venue.rating > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "3px 10px" }}>
                  <Star size={10} style={{ color: "#FBBF24", fill: "#FBBF24" }} />
                  <span style={{ fontSize: 10, color: "#FFFFFF", fontWeight: 700 }}>{venue.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {(["info", "bookings", "reviews"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "10px 8px 12px", border: "none", backgroundColor: "transparent",
                cursor: "pointer", borderBottom: activeTab === tab ? "2.5px solid #FFFFFF" : "2.5px solid transparent",
                color: activeTab === tab ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: activeTab === tab ? 700 : 500, textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* INFO TAB */}
        {activeTab === "info" && (
          <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Vendor info */}
            {venue.vendors && (
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Assigned Vendor</p>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{venue.vendors.business_name}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: venue.vendors.kyc_status === "approved" ? "#00C853" : "#F59E0B", backgroundColor: venue.vendors.kyc_status === "approved" ? "#E0F7EA" : "#FFF8E1", padding: "3px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                  {venue.vendors.kyc_status}
                </span>
              </div>
            )}

            {/* Toggle controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "is_active", label: "Venue Live", subtitle: "Visible to users in the app" },
                { key: "is_featured", label: "Featured", subtitle: "Highlighted on home page" },
                { key: "bookings_enabled", label: "Bookings Enabled", subtitle: "Users can book this venue" },
              ].map(({ key, label, subtitle }) => (
                <div key={key} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>{subtitle}</p>
                  </div>
                  <button
                    onClick={() => setForm((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                    style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: (form as any)[key] ? "#5B0EA6" : "#E4DCF0", position: "relative", transition: "background-color 0.2s ease", flexShrink: 0 }}
                  >
                    <motion.div
                      animate={{ x: (form as any)[key] ? 22 : 2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Name */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VENUE NAME</p>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>

            {/* Category */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>CATEGORY</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setForm({ ...form, category: cat.id })}
                    style={{ padding: "8px 16px", borderRadius: 12, border: "1.5px solid", borderColor: form.category === cat.id ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.category === cat.id ? "#EDE0F7" : "#FFFFFF", color: form.category === cat.id ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Describe the venue..."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>

            {/* Filters */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>FEATURES & FILTERS</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {COMMON_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.filters.includes(f) ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.filters.includes(f) ? "#EDE0F7" : "#FFFFFF", color: form.filters.includes(f) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>IMAGES</p>
              <ImageUpload
                images={form.images}
                onChange={(imgs) => setForm({ ...form, images: imgs })}
                maxImages={8}
                folder="venues"
              />
            </div>

            {/* Success / error */}
            <AnimatePresence>
              {success && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={15} style={{ color: "#00C853" }} />
                  <p style={{ color: "#059669", fontSize: 13, fontWeight: 600, margin: 0 }}>Changes saved</p>
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                  <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saveMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saveMutation.isPending ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}
            >
              {saveMutation.isPending ? (
                <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
              ) : (
                <><CheckCircle size={17} />Save Changes</>
              )}
            </button>

            {/* Delete venue */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Trash2 size={15} />
              Delete Venue
            </button>
          </motion.div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === "bookings" && (
          <motion.div key="bookings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!bookings ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 80, borderRadius: 14, backgroundColor: "#F2EEF9" }} />)}
              </div>
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <Calendar size={40} style={{ color: "#E4DCF0", marginBottom: 12 }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No bookings yet</p>
                <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Bookings for this venue will appear here</p>
              </div>
            ) : (
              bookings.map((booking: any, i: number) => {
                const statusStyle = STATUS_STYLE[booking.status] || STATUS_STYLE.pending;
                return (
                  <motion.div key={booking.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {booking.users?.full_name || "Guest"}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                          {format(new Date(booking.created_at), "dd MMM yyyy · HH:mm")}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                          {formatCurrency(booking.reserved_amount)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusStyle.color, backgroundColor: statusStyle.bg, padding: "2px 8px", borderRadius: 999 }}>
                          {statusStyle.label}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!reviews ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 100, borderRadius: 14, backgroundColor: "#F2EEF9" }} />)}
              </div>
            ) : reviews.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <Star size={40} style={{ color: "#E4DCF0", marginBottom: 12 }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No reviews yet</p>
                <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Reviews from guests will appear here</p>
              </div>
            ) : (
              reviews.map((review: any, i: number) => (
                <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                          {review.users?.avatar_url
                            ? <img src={review.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>{review.users?.full_name?.charAt(0)}</span>}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{review.users?.full_name}</p>
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{format(new Date(review.created_at), "dd MMM yyyy")}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12} style={{ color: s <= review.rating ? "#FBBF24" : "#E4DCF0", fill: s <= review.rating ? "#FBBF24" : "#E4DCF0" }} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>{review.comment}</p>}
                    {review.vendor_reply && (
                      <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: "2px solid #5B0EA6" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6", margin: "0 0 2px" }}>Venue Reply</p>
                        <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>{review.vendor_reply}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 8px", textAlign: "center" }}>Delete {venue.name}?</h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
                This permanently removes the venue, all its bookings history, and reviews. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: deleteMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {deleteMutation.isPending ? "Deleting..." : <><Trash2 size={15} />Delete</>}
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