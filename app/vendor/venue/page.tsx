/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock,
  Plus, Trash2, Tag, UtensilsCrossed, Calendar,
  MapPin, ToggleLeft, ToggleRight, Package,
  Users, Phone, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ALL_FILTERS = [
  "Sea View", "Rooftop", "Cozy", "Live Music", "Outdoor Seating",
  "VIP Section", "Shisha", "Private Dining", "Pool", "Parking",
  "WiFi", "AC", "Karaoke", "Sports Bar", "Fine Dining",
];
const SOCIAL_CATEGORIES = ["restaurant", "bar-lounge", "club", "bar", "lounge"];

type VenueTab = "details" | "hours" | "menu" | "packages" | "offers" | "events";

const DEFAULT_HOURS = () =>
  Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "22:00", closed: false }]));

export default function VendorVenuePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<VenueTab>("details");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    filters: [] as string[],
    images: [] as string[],
    videos: [] as string[],
    bookings_enabled: true,
    max_bookings_per_day: "",
    minimum_spend: "",
    phone: "",
    whatsapp: "",
    contact_email: "",
    website: "",
    instagram: "",
    twitter: "",
    tiktok: "",
  });

  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(DEFAULT_HOURS());
  const [menuForm, setMenuForm] = useState({ name: "", category: "", price: "", description: "" });
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [offerForm, setOfferForm] = useState({ title: "", description: "", discount_type: "percentage", discount_value: "", valid_from: "", valid_until: "" });
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [packageForm, setPackageForm] = useState({ name: "", description: "", price: "", min_guests: "1", includeInput: "", includes: [] as string[] });
  const [showPackageForm, setShowPackageForm] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendors") as any).select("*").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: venue, isLoading: venueLoading } = useQuery({
    queryKey: ["vendor-venue", vendor?.venue_id],
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("*").eq("id", vendor!.venue_id).single();
      return data as any;
    },
    enabled: !!vendor?.venue_id,
    staleTime: 1000 * 60,
  });

  const { data: menuItems, refetch: refetchMenu } = useQuery({
    queryKey: ["vendor-menu", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendor_menu")as any).select("*").eq("vendor_id", vendor!.id).order("category");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  const { data: offers, refetch: refetchOffers } = useQuery({
    queryKey: ["vendor-offers", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("offers") as any).select("*").eq("vendor_id", vendor!.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  const { data: packages, refetch: refetchPackages } = useQuery({
    queryKey: ["venue-packages", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("venue_packages") as any).select("*").eq("vendor_id", vendor!.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ["vendor-events", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("events") as any).select("*").eq("vendor_id", vendor!.id).order("start_date", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name || "",
        description: venue.description || "",
        filters: venue.filters || [],
        images: venue.images || [],
        videos: venue.videos || [],
        bookings_enabled: venue.bookings_enabled !== false,
        max_bookings_per_day: venue.max_bookings_per_day ? String(venue.max_bookings_per_day) : "",
        minimum_spend: venue.minimum_spend ? String(venue.minimum_spend) : "",
        phone: venue.phone || "",
        whatsapp: venue.whatsapp || "",
        contact_email: venue.contact_email || "",
        website: venue.website || "",
        instagram: venue.instagram || "",
        twitter: venue.twitter || "",
        tiktok: venue.tiktok || "",
      });
      if (venue.opening_hours && Object.keys(venue.opening_hours).length > 0) {
        setHours(venue.opening_hours);
      }
    }
  }, [venue]);

  const isSocialVenue = SOCIAL_CATEGORIES.includes(venue?.category);

  // ── FIXED: takes currentForm as parameter to avoid stale closure ──
  const saveDetailsMutation = useMutation({
    mutationFn: async (currentForm: typeof form) => {
      const { error } = await (supabase.from("venues") as any).update({
        name: currentForm.name.trim(),
        description: currentForm.description.trim() || null,
        filters: currentForm.filters,
        images: currentForm.images,
        videos: currentForm.videos,
        bookings_enabled: currentForm.bookings_enabled,
        minimum_spend: Number(currentForm.minimum_spend) || 0,
        max_bookings_per_day: Number(currentForm.max_bookings_per_day) || 0,
        phone: currentForm.phone.trim() || null,
        whatsapp: currentForm.whatsapp.trim() || null,
        contact_email: currentForm.contact_email.trim() || null,
        website: currentForm.website.trim() || null,
        instagram: currentForm.instagram.trim() || null,
        twitter: currentForm.twitter.trim() || null,
        tiktok: currentForm.tiktok.trim() || null,
      }).eq("id", venue.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-venue"] });
      setSuccess("Details saved");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const saveHoursMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("venues") as any).select("*").eq("id", vendor!.venue_id).single();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-venue"] });
      setSuccess("Hours saved");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const addMenuMutation = useMutation({
    mutationFn: async () => {
      if (!menuForm.name.trim()) throw new Error("Item name required");
      if (!menuForm.price || Number(menuForm.price) <= 0) throw new Error("Valid price required");
      const { error } = await (supabase.from("vendor_menu") as any).insert({
        vendor_id: vendor.id,
        name: menuForm.name.trim(),
        category: menuForm.category.trim() || "General",
        price: Number(menuForm.price),
        description: menuForm.description.trim() || null,
        is_available: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMenu();
      setMenuForm({ name: "", category: "", price: "", description: "" });
      setShowMenuForm(false);
      setSuccess("Menu item added");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase.from("vendor_menu") as any).delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => refetchMenu(),
  });

  const addOfferMutation = useMutation({
    mutationFn: async () => {
      if (!offerForm.title.trim()) throw new Error("Offer title required");
      if (!offerForm.discount_value || Number(offerForm.discount_value) <= 0) throw new Error("Discount value required");
      const { error } = await (supabase.from("offers") as any).insert({
        vendor_id: vendor.id,
        title: offerForm.title.trim(),
        description: offerForm.description.trim() || null,
        discount_type: offerForm.discount_type,
        discount_value: Number(offerForm.discount_value),
        valid_from: offerForm.valid_from || null,
        valid_until: offerForm.valid_until || null,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOffers();
      setOfferForm({ title: "", description: "", discount_type: "percentage", discount_value: "", valid_from: "", valid_until: "" });
      setShowOfferForm(false);
      setSuccess("Offer added");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await (supabase.from("offers") as any).delete().eq("id", offerId);
      if (error) throw error;
    },
    onSuccess: () => refetchOffers(),
  });

  const toggleOfferMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("offers") as any).update({ is_active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchOffers(),
  });

  const addPackageMutation = useMutation({
    mutationFn: async () => {
      if (!packageForm.name.trim()) throw new Error("Package name required");
      if (!packageForm.price || Number(packageForm.price) <= 0) throw new Error("Valid price required");
      const { error } = await (supabase.from("venue_packages") as any).insert({
        vendor_id: vendor.id,
        venue_id: vendor.venue_id,
        name: packageForm.name.trim(),
        description: packageForm.description.trim() || null,
        price: Number(packageForm.price),
        includes: packageForm.includes,
        min_guests: Number(packageForm.min_guests) || 1,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPackages();
      setPackageForm({ name: "", description: "", price: "", min_guests: "1", includeInput: "", includes: [] });
      setShowPackageForm(false);
      setSuccess("Package added");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (pkgId: string) => {
      const { error } = await (supabase.from("venue_packages") as any).delete().eq("id", pkgId);
      if (error) throw error;
    },
    onSuccess: () => refetchPackages(),
  });

  const togglePackageMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("venue_packages") as any).update({ is_active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchPackages(),
  });

  const toggleFilter = (f: string) =>
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.includes(f) ? prev.filters.filter((x) => x !== f) : [...prev.filters, f],
    }));

  const addInclude = () => {
    const val = packageForm.includeInput.trim();
    if (!val) return;
    setPackageForm((prev) => ({ ...prev, includes: [...prev.includes, val], includeInput: "" }));
  };

  const removeInclude = (i: number) =>
    setPackageForm((prev) => ({ ...prev, includes: prev.includes.filter((_, idx) => idx !== i) }));

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const baseTabs: { id: VenueTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "hours", label: "Hours" },
    { id: "menu", label: "Menu" },
    ...(isSocialVenue ? [{ id: "packages" as VenueTab, label: "Packages" }] : []),
    { id: "offers", label: "Offers" },
    { id: "events", label: "Events" },
  ];

  if (!vendor || venueLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!vendor.venue_id || !venue) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 28px" }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
          </button>
          <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: 0 }}>My Venue</h1>
        </div>
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <MapPin size={40} style={{ color: "#E4DCF0", marginBottom: 16 }} />
          <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 6px" }}>No venue assigned yet</p>
          <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0, lineHeight: 1.6 }}>Contact Chillz admin to claim or get assigned a venue.</p>
        </div>
      </div>
    );
  }

  const menuByCategory: Record<string, any[]> = {};
  (menuItems || []).forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Dashboard</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{venue.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
          <MapPin size={11} style={{ color: "rgba(255,255,255,0.6)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{venue.address}</span>
        </div>
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {baseTabs.map(({ id, label }) => (
            <button key={id} onClick={() => { setActiveTab(id); setError(""); setSuccess(""); }}
              style={{ flexShrink: 0, padding: "10px 16px 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === id ? "2.5px solid #FFFFFF" : "2.5px solid transparent" }}>
              <span style={{ fontSize: 12, fontWeight: activeTab === id ? 700 : 500, color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={15} style={{ color: "#00C853" }} />
              <p style={{ color: "#059669", fontSize: 13, fontWeight: 600, margin: 0 }}>{success}</p>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ── DETAILS ── */}
          {activeTab === "details" && (
            <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Bookings toggle */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Accept Bookings</p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Allow users to book this venue</p>
                </div>
                <button onClick={() => setForm((prev) => ({ ...prev, bookings_enabled: !prev.bookings_enabled }))}
                  style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: form.bookings_enabled ? "#5B0EA6" : "#E4DCF0", position: "relative", flexShrink: 0 }}>
                  <motion.div animate={{ x: form.bookings_enabled ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                </button>
              </div>

              {/* Max bookings per day */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>MAX BOOKINGS PER DAY</p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>Set 0 for unlimited.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                  <Users size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <input type="number" placeholder="0 = unlimited" min="0" value={form.max_bookings_per_day}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_bookings_per_day: e.target.value }))}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                </div>
              </div>

              {/* Minimum spend */}
              {isSocialVenue && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>MINIMUM SPEND</p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>Set 0 for none.</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                    <input type="number" placeholder="0" min="0" value={form.minimum_spend}
                      onChange={(e) => setForm((prev) => ({ ...prev, minimum_spend: e.target.value }))}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: "#0A0A0A", fontFamily: "inherit" }} />
                  </div>
                </div>
              )}

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VENUE NAME</p>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  style={inputStyle} />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
                <textarea value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4} placeholder="Describe the vibe, atmosphere, capacity..."
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              </div>

              {/* ── CONTACT & SOCIALS ── */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Contact & Socials
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <Phone size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="tel" placeholder="+234 800 000 0000" value={form.phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>WhatsApp Number</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>💬</span>
                      <input type="tel" placeholder="+234 800 000 0000" value={form.whatsapp}
                        onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0" }}>Include country code e.g. +2348012345678</p>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact Email</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <Mail size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="email" placeholder="hello@yourvenue.com" value={form.contact_email}
                        onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <span style={{ fontSize: 13, color: "#9E9E9E", flexShrink: 0, fontWeight: 600 }}>🌐</span>
                      <input type="url" placeholder="https://yourvenue.com" value={form.website}
                        onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Instagram</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>📸</span>
                      <span style={{ fontSize: 13, color: "#9E9E9E" }}>@</span>
                      <input type="text" placeholder="yourhandle" value={form.instagram.replace(/^@/, "")}
                        onChange={(e) => setForm((prev) => ({ ...prev, instagram: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Twitter / X</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#9E9E9E", flexShrink: 0 }}>𝕏</span>
                      <span style={{ fontSize: 13, color: "#9E9E9E" }}>@</span>
                      <input type="text" placeholder="yourhandle" value={form.twitter.replace(/^@/, "")}
                        onChange={(e) => setForm((prev) => ({ ...prev, twitter: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>TikTok</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>🎵</span>
                      <span style={{ fontSize: 13, color: "#9E9E9E" }}>@</span>
                      <input type="text" placeholder="yourhandle" value={form.tiktok.replace(/^@/, "")}
                        onChange={(e) => setForm((prev) => ({ ...prev, tiktok: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>FEATURES & VIBES</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {ALL_FILTERS.map((f) => (
                    <button key={f} onClick={() => toggleFilter(f)}
                      style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.filters.includes(f) ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.filters.includes(f) ? "#EDE0F7" : "#FFFFFF", color: form.filters.includes(f) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>VENUE IMAGES</p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>Most recent upload becomes the cover photo.</p>
                <ImageUpload
                  images={form.images}
                  onChange={(imgs) => setForm((prev) => ({ ...prev, images: imgs }))}
                  maxImages={12}
                  folder="venues"
                />
              </div>

              {/* Videos */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>VENUE VIDEOS</p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>Shorts and clips. Most recent shows first.</p>
                <ImageUpload
                  images={[]}
                  onChange={() => {}}
                  videos={form.videos}
                  onVideosChange={(vids) => setForm((prev) => ({ ...prev, videos: vids }))}
                  maxVideos={6}
                  folder="venues/videos"
                />
              </div>

              {/* ── FIXED: passes form explicitly so mutation gets current state ── */}
              <button onClick={() => saveDetailsMutation.mutate(form)} disabled={saveDetailsMutation.isPending}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saveDetailsMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveDetailsMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {saveDetailsMutation.isPending
                  ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                  : <><CheckCircle size={17} />Save Details</>}
              </button>
            </motion.div>
          )}

          {/* ── HOURS ── */}
          {activeTab === "hours" && (
            <motion.div key="hours" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>Set your operating hours. These show on your venue page.</p>
              </div>
              {DAYS.map((day) => {
                const dayHours = hours[day] || { open: "09:00", close: "22:00", closed: false };
                return (
                  <div key={day} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: dayHours.closed ? 0 : 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{day}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: dayHours.closed ? "#EF4444" : "#00C853", fontWeight: 600 }}>
                          {dayHours.closed ? "Closed" : "Open"}
                        </span>
                        <button onClick={() => setHours((prev) => ({ ...prev, [day]: { ...dayHours, closed: !dayHours.closed } }))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                          {dayHours.closed
                            ? <ToggleLeft size={28} style={{ color: "#E4DCF0" }} />
                            : <ToggleRight size={28} style={{ color: "#00C853" }} />}
                        </button>
                      </div>
                    </div>
                    {!dayHours.closed && (
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Opens</p>
                          <input type="time" value={dayHours.open}
                            onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...dayHours, open: e.target.value } }))}
                            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Closes</p>
                          <input type="time" value={dayHours.close}
                            onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...dayHours, close: e.target.value } }))}
                            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => saveHoursMutation.mutate()} disabled={saveHoursMutation.isPending}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saveHoursMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveHoursMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {saveHoursMutation.isPending
                  ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                  : <><Clock size={17} />Save Hours</>}
              </button>
            </motion.div>
          )}

          {/* ── MENU ── */}
          {activeTab === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <AnimatePresence>
                {showMenuForm && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "16px", boxShadow: "0 4px 20px rgba(91,14,166,0.1)", border: "1.5px solid #EDE0F7", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>New Menu Item</p>
                    <input type="text" placeholder="Item name" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} style={inputStyle} />
                    <input type="text" placeholder="Category (e.g. Starters, Drinks)" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} style={inputStyle} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                      <input type="number" placeholder="Price" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                    <input type="text" placeholder="Description (optional)" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowMenuForm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => addMenuMutation.mutate()} disabled={addMenuMutation.isPending}
                        style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: addMenuMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: addMenuMutation.isPending ? "not-allowed" : "pointer" }}>
                        {addMenuMutation.isPending ? "Adding..." : "Add Item"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={() => setShowMenuForm(true)}
                style={{ backgroundColor: "#5B0EA6", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} style={{ color: "#FFFFFF" }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF", margin: 0 }}>Add Menu Item</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Appears on your venue page</p>
                </div>
              </button>
              {Object.keys(menuByCategory).length > 0 ? (
                Object.entries(menuByCategory).map(([category, items]) => (
                  <div key={category}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 4px" }}>{category}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {items.map((item: any) => (
                        <div key={item.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{item.name}</p>
                            {item.description && <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.description}</p>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6" }}>{formatCurrency(item.price)}</span>
                            <button onClick={() => deleteMenuMutation.mutate(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                              <Trash2 size={14} style={{ color: "#EF4444" }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
                  <UtensilsCrossed size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No menu items yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Add items that users will see on your venue page</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PACKAGES ── */}
          {activeTab === "packages" && (
            <motion.div key="packages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                  Packages are curated experiences users can select when booking.
                </p>
              </div>
              <AnimatePresence>
                {showPackageForm && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "16px", boxShadow: "0 4px 20px rgba(91,14,166,0.1)", border: "1.5px solid #EDE0F7", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>New Package</p>
                    <input type="text" placeholder="Package name" value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} style={inputStyle} />
                    <textarea placeholder="Description (optional)" value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "none" }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Price</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 12px" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                          <input type="number" placeholder="0" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Min. Guests</p>
                        <input type="number" placeholder="1" min="1" value={packageForm.min_guests} onChange={(e) => setPackageForm({ ...packageForm, min_guests: e.target.value })} style={{ ...inputStyle, padding: "11px 12px" }} />
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase" }}>What's Included</p>
                      <div style={{ display: "flex", gap: 8, marginBottom: packageForm.includes.length > 0 ? 8 : 0 }}>
                        <input type="text" placeholder="e.g. 1 bottle of Hennessy" value={packageForm.includeInput}
                          onChange={(e) => setPackageForm({ ...packageForm, includeInput: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInclude(); } }}
                          style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
                        <button onClick={addInclude} style={{ width: 44, height: 44, borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                          <Plus size={16} style={{ color: "#FFFFFF" }} />
                        </button>
                      </div>
                      {packageForm.includes.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {packageForm.includes.map((inc, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "5px 10px" }}>
                              <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600 }}>{inc}</span>
                              <button onClick={() => removeInclude(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                <span style={{ fontSize: 14, color: "#9E9E9E", lineHeight: 1 }}>×</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowPackageForm(false); setPackageForm({ name: "", description: "", price: "", min_guests: "1", includeInput: "", includes: [] }); }}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => addPackageMutation.mutate()} disabled={addPackageMutation.isPending}
                        style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: addPackageMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: addPackageMutation.isPending ? "not-allowed" : "pointer" }}>
                        {addPackageMutation.isPending ? "Adding..." : "Add Package"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={() => setShowPackageForm(true)}
                style={{ backgroundColor: "#5B0EA6", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} style={{ color: "#FFFFFF" }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF", margin: 0 }}>Add Package</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Create a curated booking experience</p>
                </div>
              </button>
              {packages && packages.length > 0 ? packages.map((pkg: any) => (
                <div key={pkg.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: pkg.is_active ? "1.5px solid #EDE0F7" : "1.5px solid #F2EEF9", opacity: pkg.is_active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>{pkg.name}</p>
                      {pkg.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "0 0 6px", lineHeight: 1.4 }}>{pkg.description}</p>}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: "#5B0EA6" }}>{formatCurrency(pkg.price)}</span>
                        <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "2px 8px", borderRadius: 999 }}>Min. {pkg.min_guests} guest{pkg.min_guests !== 1 ? "s" : ""}</span>
                      </div>
                      {pkg.includes?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {pkg.includes.map((inc: string, i: number) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 600, color: "#00C853", backgroundColor: "#E0F7EA", padding: "2px 8px", borderRadius: 999 }}>✓ {inc}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => togglePackageMutation.mutate({ id: pkg.id, is_active: !pkg.is_active })} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        {pkg.is_active ? <ToggleRight size={22} style={{ color: "#00C853" }} /> : <ToggleLeft size={22} style={{ color: "#9E9E9E" }} />}
                      </button>
                      <button onClick={() => deletePackageMutation.mutate(pkg.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        <Trash2 size={15} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
                  <Package size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No packages yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, lineHeight: 1.5 }}>Create packages for birthdays, anniversaries and special occasions</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── OFFERS ── */}
          {activeTab === "offers" && (
            <motion.div key="offers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <AnimatePresence>
                {showOfferForm && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "16px", boxShadow: "0 4px 20px rgba(91,14,166,0.1)", border: "1.5px solid #EDE0F7", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>New Offer</p>
                    <input type="text" placeholder="Offer title" value={offerForm.title} onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })} style={inputStyle} />
                    <textarea placeholder="Description (optional)" value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "none" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["percentage", "fixed", "freebie"] as const).map((type) => (
                        <button key={type} onClick={() => setOfferForm({ ...offerForm, discount_type: type })}
                          style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: "1.5px solid", borderColor: offerForm.discount_type === type ? "#5B0EA6" : "#E4DCF0", backgroundColor: offerForm.discount_type === type ? "#EDE0F7" : "#FFFFFF", color: offerForm.discount_type === type ? "#5B0EA6" : "#6B6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                          {type === "percentage" ? "%" : type === "fixed" ? "₦ off" : "Freebie"}
                        </button>
                      ))}
                    </div>
                    {offerForm.discount_type !== "freebie" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6" }}>{offerForm.discount_type === "percentage" ? "%" : "₦"}</span>
                        <input type="number" placeholder="Value" value={offerForm.discount_value} onChange={(e) => setOfferForm({ ...offerForm, discount_value: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Valid From</p>
                        <input type="date" value={offerForm.valid_from} onChange={(e) => setOfferForm({ ...offerForm, valid_from: e.target.value })} style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>Valid Until</p>
                        <input type="date" value={offerForm.valid_until} onChange={(e) => setOfferForm({ ...offerForm, valid_until: e.target.value })} style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowOfferForm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => addOfferMutation.mutate()} disabled={addOfferMutation.isPending}
                        style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: addOfferMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: addOfferMutation.isPending ? "not-allowed" : "pointer" }}>
                        {addOfferMutation.isPending ? "Adding..." : "Add Offer"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={() => setShowOfferForm(true)}
                style={{ backgroundColor: "#5B0EA6", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} style={{ color: "#FFFFFF" }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF", margin: 0 }}>Add Offer</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Deals and perks users see on your venue</p>
                </div>
              </button>
              {offers && offers.length > 0 ? offers.map((offer: any) => (
                <div key={offer.id}
                  onClick={() => router.push(`/vendor/offers/${offer.id}`)}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: offer.is_active ? "1.5px solid #EDE0F7" : "1.5px solid #F2EEF9", opacity: offer.is_active ? 1 : 0.6, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px" }}>{offer.title}</p>
                      {offer.description && <p style={{ fontSize: 11, color: "#6B6B6B", margin: "0 0 6px", lineHeight: 1.4 }}>{offer.description}</p>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#00C853", backgroundColor: "#E0F7EA", padding: "2px 8px", borderRadius: 999 }}>
                        {offer.discount_type === "percentage" ? `${offer.discount_value}% off` : offer.discount_type === "fixed" ? `₦${offer.discount_value} off` : "Freebie"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleOfferMutation.mutate({ id: offer.id, is_active: !offer.is_active }); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        {offer.is_active ? <ToggleRight size={22} style={{ color: "#00C853" }} /> : <ToggleLeft size={22} style={{ color: "#9E9E9E" }} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteOfferMutation.mutate(offer.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        <Trash2 size={15} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  </div>
                  {(offer.valid_from || offer.valid_until) && (
                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: "8px 0 0" }}>
                      {offer.valid_from && `From ${format(new Date(offer.valid_from), "dd MMM")}`}
                      {offer.valid_from && offer.valid_until && " · "}
                      {offer.valid_until && `Until ${format(new Date(offer.valid_until), "dd MMM yyyy")}`}
                    </p>
                  )}
                </div>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
                  <Tag size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No offers yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Create deals visible to users on your venue page</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === "events" && (
            <motion.div key="events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => router.push("/vendor/events/add")}
                style={{ backgroundColor: "#5B0EA6", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} style={{ color: "#FFFFFF" }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontWeight: 800, fontSize: 13, color: "#FFFFFF", margin: 0 }}>Add Event</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Create an event at this venue</p>
                </div>
              </button>
              {events && events.length > 0 ? events.map((event: any) => (
                <div key={event.id} onClick={() => router.push(`/vendor/events/${event.id}`)}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", display: "flex", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", cursor: "pointer", opacity: event.is_active ? 1 : 0.6 }}>
                  <div style={{ width: 70, flexShrink: 0, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
                    {event.images?.[0]
                      ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 80 }} />
                      : <div style={{ width: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}><Calendar size={20} style={{ color: "#7B2FBE" }} /></div>}
                  </div>
                  <div style={{ flex: 1, padding: "11px 12px" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.title}</p>
                    <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: "0 0 4px" }}>{format(new Date(event.start_date), "dd MMM yyyy · HH:mm")}</p>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: event.is_active ? "#00C853" : "#9E9E9E", backgroundColor: event.is_active ? "#E0F7EA" : "#F2EEF9", padding: "2px 7px", borderRadius: 999 }}>
                        {event.is_active ? "Live" : "Hidden"}
                      </span>
                      {event.crowd_type && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 7px", borderRadius: 999 }}>{event.crowd_type}</span>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
                  <Calendar size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No events yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Add your first event above</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}