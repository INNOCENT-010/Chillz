/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/image-upload";
import { ArrowLeft, CheckCircle, Trash2, AlertTriangle, Calendar, Play, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";

const APARTMENT_AMENITIES = [
  "WiFi", "AC", "Generator", "Pool", "Gym", "Parking", "Security",
  "Kitchen", "Balcony", "Sea View", "Breakfast Included", "Smart TV",
  "Washing Machine", "Hot Water", "CCTV",
];
const HOTEL_FACILITIES = [
  "WiFi", "AC", "TV", "Mini Bar", "Safe", "Balcony", "Sea View",
  "Bathtub", "Shower", "Hair Dryer", "Room Service", "Breakfast Included",
  "King Bed", "Twin Beds", "Sofa Bed", "Work Desk",
];
const CAR_FEATURES = [
  "AC", "GPS", "Automatic", "Manual",
  "SUV", "Sedan", "Luxury", "Bus/Van", "Dashcam", "Bluetooth",
];
const FUEL_POLICIES = ["Full-to-Full", "Full-to-Empty", "Prepaid Fuel"];
const MILEAGE_POLICIES = ["Unlimited", "Limited"];
const ROOM_TYPES = ["Single", "Double", "Twin", "Suite", "Studio", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Penthouse", "Entire Apartment"];

const DRIVER_OPTIONS = [
  {
    value: "self_drive",
    label: "Self Drive",
    subtitle: "Customer drives themselves — no driver included",
    icon: "🚗",
  },
  {
    value: "with_driver",
    label: "With Driver",
    subtitle: "A driver is always included with this vehicle",
    icon: "👨‍✈️",
  },
  {
    value: "both",
    label: "Both Available",
    subtitle: "Customer can choose self drive or add a driver",
    icon: "⚙️",
  },
];

// ── Video helpers ─────────────────────────────────────────────────────────
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return null;
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVideoType(url: string): "youtube" | "instagram" | "tiktok" | "unknown" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}

function isValidVideoUrl(url: string): boolean {
  const type = getVideoType(url.trim());
  return type === "youtube" || type === "instagram" || type === "tiktok";
}

function VideoLinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [input, setInput] = useState(value || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (value && !input) setInput(value);
  }, [value]);

  const handleApply = () => {
    const trimmed = input.trim();
    if (!trimmed) { onChange(""); setError(""); return; }
    if (!isValidVideoUrl(trimmed)) {
      setError("Please enter a valid YouTube, Instagram, or TikTok URL");
      return;
    }
    setError("");
    onChange(trimmed);
  };

  const ytId = value ? getYouTubeId(value) : null;
  const videoType = value ? getVideoType(value) : null;
  const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          placeholder="Paste YouTube, Instagram or TikTok link..."
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(""); }}
          onBlur={handleApply}
          style={{
            flex: 1, backgroundColor: "#F7F5FA",
            border: `1.5px solid ${error ? "#FECACA" : "#E4DCF0"}`,
            borderRadius: 14, padding: "11px 14px", fontSize: 13,
            color: "#0A0A0A", outline: "none", fontFamily: "inherit",
          }}
        />
        {input && (
          <button onClick={() => { setInput(""); onChange(""); setError(""); }}
            style={{ width: 44, height: 44, borderRadius: 12, border: "none", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={16} style={{ color: "#EF4444" }} />
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: "#EF4444", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={11} />{error}
        </p>
      )}

      {value && videoType === "youtube" && ytThumb && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid #E4DCF0", position: "relative" }}>
          <img src={ytThumb} alt="YouTube preview" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={20} style={{ color: "#FF0000", fill: "#FF0000", marginLeft: 3 }} />
            </div>
          </div>
        </motion.div>
      )}

      {value && videoType === "instagram" && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #F2EEF9", background: "linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)", padding: 2 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px" }}>Instagram Reel linked ✓</p>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{value}</p>
            </div>
          </div>
        </motion.div>
      )}

      {value && videoType === "tiktok" && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ backgroundColor: "#F7F7F7", borderRadius: 14, border: "1px solid #E4DCF0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#010101", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px" }}>TikTok video linked ✓</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{value}</p>
          </div>
        </motion.div>
      )}

      {!value && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>▶ YouTube</span>
          <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>📸 Instagram</span>
          <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>🎵 TikTok</span>
        </div>
      )}
    </div>
  );
}

// ── Blocked Dates Calendar ────────────────────────────────────────────────
function BlockedDatesCalendar({ blockedDates, onChange }: { blockedDates: string[]; onChange: (d: string[]) => void }) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  const startPad = startOfMonth(viewMonth).getDay() === 0 ? 6 : startOfMonth(viewMonth).getDay() - 1;
  const padded = [...Array(startPad).fill(null), ...days];

  const toggle = (date: Date) => {
    if (date < today) return;
    const key = format(date, "yyyy-MM-dd");
    onChange(blockedDates.includes(key) ? blockedDates.filter((d) => d !== key) : [...blockedDates, key]);
  };

  return (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, border: "1.5px solid #E4DCF0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setViewMonth(addMonths(viewMonth, -1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#5B0EA6", padding: "0 4px" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{format(viewMonth, "MMMM yyyy")}</span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#5B0EA6", padding: "0 4px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9E9E9E" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {padded.map((date, i) => {
          if (!date) return <div key={`p-${i}`} />;
          const key = format(date, "yyyy-MM-dd");
          const isPast = date < today;
          const isBlocked = blockedDates.includes(key);
          return (
            <button key={key} onClick={() => toggle(date)} disabled={isPast}
              style={{ width: "100%", aspectRatio: "1", borderRadius: 8, border: "none", cursor: isPast ? "default" : "pointer", backgroundColor: isBlocked ? "#EF4444" : isToday(date) ? "#EDE0F7" : "#F7F5FA", color: isBlocked ? "#FFFFFF" : isPast ? "#C4BAD8" : "#0A0A0A", fontSize: 12, fontWeight: isBlocked ? 700 : 400, opacity: isPast ? 0.4 : 1 }}>
              {format(date, "d")}
            </button>
          );
        })}
      </div>
      {blockedDates.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{blockedDates.length} blocked</span>
          <button onClick={() => onChange([])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9E9E9E", fontWeight: 600 }}>Clear all</button>
        </div>
      )}
    </div>
  );
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", price_per_unit: "", address: "",
    images: [] as string[], filters: [] as string[], amenities: [] as string[],
    is_active: true, vendor_type: "",
    fuel_policy: "Full-to-Full", mileage_policy: "Unlimited", mileage_limit: "",
    driver_option: "self_drive", driver_price: "",
    room_type: "", checkin_time: "14:00", checkout_time: "11:00",
    min_nights: "1", bedrooms: "", bathrooms: "", max_guests: "",
    available_units: "1", max_bookings_per_day: "1", blocked_dates: [] as string[],
    video_url: "",
  });

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_listings").select("*").eq("id", id).single();
      return data as any;
    },
  });

  useEffect(() => {
    if (!listing) return;
    setForm({
      title: listing.title || "",
      description: listing.description || "",
      price_per_unit: String(listing.price_per_unit || ""),
      address: listing.address || "",
      images: listing.images || [],
      filters: listing.filters || [],
      amenities: listing.amenities || [],
      is_active: listing.is_active !== false,
      vendor_type: listing.vendor_type || "",
      fuel_policy: listing.fuel_policy || "Full-to-Full",
      mileage_policy: listing.mileage_policy || "Unlimited",
      mileage_limit: listing.mileage_limit ? String(listing.mileage_limit) : "",
      driver_option: listing.driver_option || "self_drive",
      driver_price: listing.driver_price ? String(listing.driver_price) : "",
      room_type: listing.room_type || "",
      checkin_time: listing.checkin_time || "14:00",
      checkout_time: listing.checkout_time || "11:00",
      min_nights: listing.min_nights ? String(listing.min_nights) : "1",
      bedrooms: listing.availability?.bedrooms ? String(listing.availability.bedrooms) : "",
      bathrooms: listing.availability?.bathrooms ? String(listing.availability.bathrooms) : "",
      max_guests: listing.availability?.max_guests ? String(listing.availability.max_guests) : "",
      available_units: listing.available_units ? String(listing.available_units) : "1",
      max_bookings_per_day: listing.max_bookings_per_day ? String(listing.max_bookings_per_day) : "1",
      blocked_dates: listing.blocked_dates || [],
      video_url: listing.video_url || "",
    });
  }, [listing]);

  const isCarRental = form.vendor_type === "car_rental";
  const isApartment = form.vendor_type === "apartment";
  const isHotel = form.vendor_type === "hotel";

  const toggleFilter = (f: string) => setForm((p) => ({ ...p, filters: p.filters.includes(f) ? p.filters.filter((x) => x !== f) : [...p.filters, f] }));
  const toggleAmenity = (a: string) => setForm((p) => ({ ...p, amenities: p.amenities.includes(a) ? p.amenities.filter((x) => x !== a) : [...p.amenities, a] }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (isCarRental && (form.driver_option === "with_driver" || form.driver_option === "both") && (!form.driver_price || Number(form.driver_price) <= 0)) {
        throw new Error("Driver price per day is required");
      }
      const { error } = await (supabase.from("vendor_listings") as any).update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_per_unit: Number(form.price_per_unit),
        address: form.address.trim() || null,
        images: form.images,
        filters: form.filters,
        amenities: form.amenities,
        is_active: form.is_active,
        available_units: Number(form.available_units) || 1,
        max_bookings_per_day: Number(form.max_bookings_per_day) || 1,
        blocked_dates: form.blocked_dates,
        video_url: form.video_url || null,
        ...(isCarRental ? {
          fuel_policy: form.fuel_policy,
          mileage_policy: form.mileage_policy,
          mileage_limit: form.mileage_policy === "Limited" ? Number(form.mileage_limit) || 0 : 0,
          driver_option: form.driver_option,
          driver_price: (form.driver_option === "with_driver" || form.driver_option === "both")
            ? Number(form.driver_price) || 0
            : 0,
        } : {}),
        ...((isApartment || isHotel) ? {
          room_type: form.room_type || null,
          checkin_time: form.checkin_time,
          checkout_time: form.checkout_time,
          min_nights: Number(form.min_nights) || 1,
          availability: {
            bedrooms: Number(form.bedrooms) || null,
            bathrooms: Number(form.bathrooms) || null,
            max_guests: Number(form.max_guests) || null,
          },
        } : {}),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-listings"] });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("vendor_listings") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-listings"] }); router.back(); },
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (success) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
      <CheckCircle size={48} style={{ color: "#00C853" }} />
      <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: 0 }}>Listing Updated</p>
    </div>
  );

  const pageTitle = isCarRental ? "Edit Vehicle" : isHotel ? "Edit Room" : isApartment ? "Edit Unit" : "Edit Listing";
  const amenitiesList = isHotel ? HOTEL_FACILITIES : APARTMENT_AMENITIES;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{pageTitle}</h1>
        </div>
        <button onClick={() => setShowDelete(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
          <Trash2 size={18} style={{ color: "#EF4444" }} />
        </button>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</p>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</p>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Price */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {isCarRental
              ? form.driver_option === "with_driver"
                ? "Price Per Day (With Driver)"
                : "Price Per Day (Self Drive)"
              : `Price Per ${isCarRental ? "Day" : "Night"}`}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
            <input type="number" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
          </div>
        </div>

        {/* ── CAR RENTAL SPECIFIC ── */}
        {isCarRental && (
          <>
            {/* Driver Option */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Driver Option</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DRIVER_OPTIONS.map((opt) => {
                  const isSelected = form.driver_option === opt.value;
                  return (
                    <button key={opt.value}
                      onClick={() => setForm({ ...form, driver_option: opt.value, driver_price: "" })}
                      style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "1.5px solid", borderColor: isSelected ? "#5B0EA6" : "#E4DCF0", backgroundColor: isSelected ? "#EDE0F7" : "#FFFFFF", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#5B0EA6" : "#0A0A0A", margin: "0 0 2px" }}>{opt.label}</p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{opt.subtitle}</p>
                      </div>
                      {isSelected && (
                        <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <CheckCircle size={12} style={{ color: "#FFFFFF" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Driver price field */}
              <AnimatePresence>
                {(form.driver_option === "with_driver" || form.driver_option === "both") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}>
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {form.driver_option === "both" ? "Driver Surcharge Per Day" : "Driver Price Per Day"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                        <input
                          type="number"
                          placeholder={form.driver_option === "both" ? "e.g. 15000 added on top of base price" : "e.g. 45000"}
                          value={form.driver_price}
                          onChange={(e) => setForm({ ...form, driver_price: e.target.value })}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }}
                        />
                        <span style={{ fontSize: 12, color: "#9E9E9E", fontWeight: 600 }}>/ day</span>
                      </div>
                      {form.driver_option === "both" && form.price_per_unit && form.driver_price && (
                        <div style={{ marginTop: 8, backgroundColor: "#EDE0F7", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>Self Drive</span>
                          <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 700 }}>₦{Number(form.price_per_unit).toLocaleString()}/day</span>
                          <span style={{ fontSize: 11, color: "#9E9E9E" }}>·</span>
                          <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>With Driver</span>
                          <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 700 }}>₦{(Number(form.price_per_unit) + Number(form.driver_price)).toLocaleString()}/day</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fuel Policy */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fuel Policy</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FUEL_POLICIES.map((policy) => (
                  <button key={policy} onClick={() => setForm({ ...form, fuel_policy: policy })}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid", borderColor: form.fuel_policy === policy ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.fuel_policy === policy ? "#EDE0F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: form.fuel_policy === policy ? "#5B0EA6" : "#0A0A0A", margin: 0 }}>{policy}</p>
                    {form.fuel_policy === policy && <CheckCircle size={16} style={{ color: "#5B0EA6" }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Mileage Policy */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mileage Policy</p>
              <div style={{ display: "flex", gap: 8 }}>
                {MILEAGE_POLICIES.map((policy) => (
                  <button key={policy} onClick={() => setForm({ ...form, mileage_policy: policy })}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid", borderColor: form.mileage_policy === policy ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.mileage_policy === policy ? "#EDE0F7" : "#FFFFFF", color: form.mileage_policy === policy ? "#5B0EA6" : "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {policy}
                  </button>
                ))}
              </div>
              {form.mileage_policy === "Limited" && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
                  <input type="number" placeholder="e.g. 200" value={form.mileage_limit} onChange={(e) => setForm({ ...form, mileage_limit: e.target.value })}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                  <span style={{ fontSize: 12, color: "#9E9E9E", fontWeight: 600 }}>km / day</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── APARTMENT / HOTEL SPECIFIC ── */}
        {(isApartment || isHotel) && (
          <>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {isHotel ? "Room Type" : "Unit Type"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {ROOM_TYPES.map((rt) => (
                  <button key={rt} onClick={() => setForm({ ...form, room_type: form.room_type === rt ? "" : rt })}
                    style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.room_type === rt ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.room_type === rt ? "#EDE0F7" : "#FFFFFF", color: form.room_type === rt ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {rt}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[{ label: "Bedrooms", key: "bedrooms" }, { label: "Bathrooms", key: "bathrooms" }, { label: "Max Guests", key: "max_guests" }].map(({ label, key }) => (
                <div key={key}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>{label}</p>
                  <input type="number" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-in</p>
                <input type="time" value={form.checkin_time} onChange={(e) => setForm({ ...form, checkin_time: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Check-out</p>
                <input type="time" value={form.checkout_time} onChange={(e) => setForm({ ...form, checkout_time: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Minimum Nights</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                <input type="number" min="1" value={form.min_nights} onChange={(e) => setForm({ ...form, min_nights: e.target.value })}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>night{Number(form.min_nights) !== 1 ? "s" : ""} min</span>
              </div>
            </div>
          </>
        )}

        {/* Availability */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Availability Settings</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase" }}>{isCarRental ? "No. of Vehicles" : "No. of Units"}</p>
              <input type="number" min="1" value={form.available_units} onChange={(e) => setForm({ ...form, available_units: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase" }}>Max/Day</p>
              <input type="number" min="1" value={form.max_bookings_per_day} onChange={(e) => setForm({ ...form, max_bookings_per_day: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <button onClick={() => setShowCalendar(!showCalendar)}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>Block Unavailable Dates</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {form.blocked_dates.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 999 }}>{form.blocked_dates.length} blocked</span>
              )}
              <span style={{ fontSize: 14, color: "#9E9E9E" }}>{showCalendar ? "▲" : "▼"}</span>
            </div>
          </button>
          <AnimatePresence>
            {showCalendar && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <BlockedDatesCalendar blockedDates={form.blocked_dates} onChange={(dates) => setForm({ ...form, blocked_dates: dates })} />
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Listed as Available</p>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Turn off to hide from users</p>
            </div>
            <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
              style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: form.is_active ? "#5B0EA6" : "#E4DCF0", position: "relative", flexShrink: 0 }}>
              <motion.div animate={{ x: form.is_active ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
            </button>
          </div>
        </div>

        {/* Vehicle Features */}
        {isCarRental && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vehicle Features</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {CAR_FEATURES.map((f) => (
                <button key={f} onClick={() => toggleFilter(f)}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.filters.includes(f) ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.filters.includes(f) ? "#EDE0F7" : "#FFFFFF", color: form.filters.includes(f) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amenities */}
        {(isApartment || isHotel) && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {isHotel ? "Room Facilities" : "Amenities"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {amenitiesList.map((a) => (
                <button key={a} onClick={() => toggleAmenity(a)}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.amenities.includes(a) ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.amenities.includes(a) ? "#EDE0F7" : "#FFFFFF", color: form.amenities.includes(a) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Photos</p>
          <ImageUpload images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} maxImages={8} folder="listings" />
        </div>

        {/* Video Link */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Video Link <span style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 400, textTransform: "none" }}>(optional)</span>
          </p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>
            YouTube, Instagram or TikTok — users see this before booking
          </p>
          <VideoLinkInput value={form.video_url} onChange={(url) => setForm({ ...form, video_url: url })} />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saveMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          {saveMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><CheckCircle size={17} />Save Changes</>}
        </button>
      </div>

      {/* Delete confirmation sheet */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDelete(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <h3 style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 8px", textAlign: "center" }}>Delete {isHotel ? "Room" : isCarRental ? "Vehicle" : "Listing"}?</h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", margin: "0 0 20px" }}>This cannot be undone.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDelete(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: deleteMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {deleteMutation.isPending ? "Deleting..." : <><Trash2 size={14} />Delete</>}
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