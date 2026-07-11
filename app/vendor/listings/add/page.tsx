/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/image-upload";
import { PlacesInput } from "@/components/ui/places-input";
import { PlaceDetail } from "@/hooks/use-places-autocomplete";
import {
  ArrowLeft, Plus, CheckCircle, AlertTriangle,
  MapPin, Navigation, Calendar, Play, X, User, Car as CarIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";

const APARTMENT_AMENITIES = [
  "WiFi", "AC", "Generator", "Pool", "Gym", "Parking", "Security",
  "Kitchen", "Balcony", "Sea View", "Breakfast Included", "Smart TV",
  "Washing Machine", "Hot Water", "CCTV",
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

// ── Video URL helpers ──────────────────────────────────────────────────────
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  if (url.includes("instagram.com")) return null;
  return null;
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

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VideoLinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [input, setInput] = useState(value || "");
  const [error, setError] = useState("");

  const handleApply = () => {
    const trimmed = input.trim();
    if (!trimmed) { onChange(""); setError(""); return; }
    if (!isValidVideoUrl(trimmed)) {
      setError("Please enter a valid YouTube, Instagram or TikTok URL");
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
          style={{ flex: 1, backgroundColor: "#F7F5FA", border: `1.5px solid ${error ? "#FECACA" : "#E4DCF0"}`, borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit" }}
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
          style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <Play size={16} style={{ color: "#00C853", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#059669", margin: "0 0 2px" }}>Instagram video linked</p>
            <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{value}</p>
          </div>
        </motion.div>
      )}

      {value && videoType === "tiktok" && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ backgroundColor: "#F7F7F7", borderRadius: 14, border: "1px solid #E4DCF0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#010101", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>TikTok video linked ✓</p>
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

// ── Blocked Dates Calendar ─────────────────────────────────────────────────
function BlockedDatesCalendar({ blockedDates, onChange }: {
  blockedDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1);
  const padded = [...Array(startPad).fill(null), ...days];

  const toggleDate = (date: Date) => {
    if (date < today) return;
    const key = format(date, "yyyy-MM-dd");
    if (blockedDates.includes(key)) {
      onChange(blockedDates.filter((d) => d !== key));
    } else {
      onChange([...blockedDates, key]);
    }
  };

  return (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, border: "1.5px solid #E4DCF0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#5B0EA6", padding: "0 4px" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{format(viewMonth, "MMMM yyyy")}</span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#5B0EA6", padding: "0 4px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9E9E9E", padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {padded.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const key = format(date, "yyyy-MM-dd");
          const isPast = date < today;
          const isBlocked = blockedDates.includes(key);
          const isTodayDate = isToday(date);
          return (
            <button key={key} onClick={() => toggleDate(date)} disabled={isPast}
              style={{ width: "100%", aspectRatio: "1", borderRadius: 8, border: "none", cursor: isPast ? "default" : "pointer", backgroundColor: isBlocked ? "#EF4444" : isTodayDate ? "#EDE0F7" : "#F7F5FA", color: isBlocked ? "#FFFFFF" : isPast ? "#C4BAD8" : "#0A0A0A", fontSize: 12, fontWeight: isBlocked || isTodayDate ? 700 : 400, opacity: isPast ? 0.4 : 1 }}>
              {format(date, "d")}
            </button>
          );
        })}
      </div>
      {blockedDates.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{blockedDates.length} date{blockedDates.length !== 1 ? "s" : ""} blocked</span>
          <button onClick={() => onChange([])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9E9E9E", fontWeight: 600, padding: 0 }}>Clear all</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AddListingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMode, setLocationMode] = useState<"search" | "live">("search");
  const [showCalendar, setShowCalendar] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price_per_unit: "",
    locationInput: "",
    selectedPlace: null as PlaceDetail | null,
    images: [] as string[],
    video_url: "",
    filters: [] as string[],
    amenities: [] as string[],
    is_active: true,
    // Apartment / Hotel fields
    room_type: "",
    bedrooms: "",
    bathrooms: "",
    max_guests: "",
    checkin_time: "14:00",
    checkout_time: "11:00",
    min_nights: "1",
    // Car rental fields
    fuel_policy: "Full-to-Full",
    mileage_policy: "Unlimited",
    mileage_limit: "",
    driver_option: "self_drive",
    driver_price: "",
    // Shared availability
    available_units: "1",
    max_bookings_per_day: "1",
    blocked_dates: [] as string[],
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id, vendor_type").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const isCarRental = vendor?.vendor_type === "car_rental";
  const isApartment = vendor?.vendor_type === "apartment";
  const isHotel = vendor?.vendor_type === "hotel";

  const toggleFilter = (f: string) =>
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.includes(f) ? prev.filters.filter((x) => x !== f) : [...prev.filters, f],
    }));

  const toggleAmenity = (a: string) =>
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a) ? prev.amenities.filter((x) => x !== a) : [...prev.amenities, a],
    }));

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`/api/places/reverse?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          const address = data.formatted_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setForm((prev) => ({
            ...prev,
            locationInput: address,
            selectedPlace: { place_id: data.place_id || `manual_${Date.now()}`, name: data.name || "Current Location", formatted_address: address, lat: latitude, lng: longitude },
          }));
          setLocationMode("live");
        } catch {
          const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setForm((prev) => ({
            ...prev,
            locationInput: address,
            selectedPlace: { place_id: `manual_${Date.now()}`, name: "Current Location", formatted_address: address, lat: latitude, lng: longitude },
          }));
          setLocationMode("live");
        } finally { setLocating(false); }
      },
      () => { setLocating(false); setError("Could not get location."); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.title.trim()) { setError(`${isCarRental ? "Vehicle" : "Listing"} name is required`); return; }
    if (!form.price_per_unit || Number(form.price_per_unit) <= 0) { setError("Price is required"); return; }
    if (!vendor?.id) { setError("Vendor account not found"); return; }
    if (!form.selectedPlace) { setError(isCarRental ? "Pickup address is required" : "Location is required"); return; }
    if (isCarRental && (form.driver_option === "with_driver" || form.driver_option === "both") && (!form.driver_price || Number(form.driver_price) <= 0)) {
      setError("Driver price per day is required"); return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await (supabase.from("vendor_listings") as any).insert({
        vendor_id: vendor.id,
        vendor_type: vendor.vendor_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_per_unit: Number(form.price_per_unit),
        unit_label: isCarRental ? "day" : "night",
        google_place_id: form.selectedPlace.place_id || null,
        address: form.selectedPlace.formatted_address,
        lat: form.selectedPlace.lat,
        lng: form.selectedPlace.lng,
        images: form.images,
        video_url: form.video_url || null,
        filters: form.filters,
        amenities: form.amenities,
        is_active: form.is_active,
        available_units: Number(form.available_units) || 1,
        max_bookings_per_day: Number(form.max_bookings_per_day) || 1,
        blocked_dates: form.blocked_dates,
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
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          {isCarRental ? "Vehicle" : "Listing"} Added
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Add {isCarRental ? "Vehicle" : isHotel ? "Room" : "Listing"}
        </h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
            {isCarRental ? "VEHICLE NAME" : isHotel ? "ROOM NAME" : "LISTING NAME"}
          </p>
          <input type="text"
            placeholder={
              isCarRental ? "e.g. 2023 Toyota Camry" :
              isHotel ? "e.g. Deluxe Ocean Suite" :
              "e.g. Luxury 2-Bedroom, VI"
            }
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
          <textarea placeholder="Describe this listing..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Price */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
            {isCarRental
              ? form.driver_option === "with_driver"
                ? "PRICE PER DAY (WITH DRIVER)"
                : "PRICE PER DAY (SELF DRIVE)"
              : "PRICE PER NIGHT"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
            <input type="number" placeholder="0" value={form.price_per_unit}
              onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
          </div>
        </div>

        {/* ── CAR RENTAL SPECIFIC ── */}
        {isCarRental && (
          <>
            {/* Driver Option */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>DRIVER OPTION</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DRIVER_OPTIONS.map((opt) => {
                  const isSelected = form.driver_option === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setForm({ ...form, driver_option: opt.value, driver_price: "" })}
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

              {/* Driver price field — shown when with_driver or both */}
              <AnimatePresence>
                {(form.driver_option === "with_driver" || form.driver_option === "both") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}>
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
                        {form.driver_option === "both" ? "DRIVER SURCHARGE PER DAY" : "DRIVER PRICE PER DAY"}
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
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>FUEL POLICY</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FUEL_POLICIES.map((policy) => (
                  <button key={policy} onClick={() => setForm({ ...form, fuel_policy: policy })}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid", borderColor: form.fuel_policy === policy ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.fuel_policy === policy ? "#EDE0F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: form.fuel_policy === policy ? "#5B0EA6" : "#0A0A0A", margin: 0 }}>{policy}</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                        {policy === "Full-to-Full" ? "Return with same fuel level as pickup" :
                         policy === "Full-to-Empty" ? "Tank full on pickup, return any level" :
                         "Pay for full tank upfront, return any level"}
                      </p>
                    </div>
                    {form.fuel_policy === policy && (
                      <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CheckCircle size={12} style={{ color: "#FFFFFF" }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Mileage Policy */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>MILEAGE POLICY</p>
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
                  <input type="number" placeholder="e.g. 200" value={form.mileage_limit}
                    onChange={(e) => setForm({ ...form, mileage_limit: e.target.value })}
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
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>ROOM / UNIT TYPE</p>
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
              {[
                { label: "Bedrooms", key: "bedrooms", placeholder: "0" },
                { label: "Bathrooms", key: "bathrooms", placeholder: "0" },
                { label: "Max Guests", key: "max_guests", placeholder: "0" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 4px", textTransform: "uppercase" }}>{label}</p>
                  <input type="number" placeholder={placeholder} value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>CHECK-IN TIME</p>
                <input type="time" value={form.checkin_time}
                  onChange={(e) => setForm({ ...form, checkin_time: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>CHECK-OUT TIME</p>
                <input type="time" value={form.checkout_time}
                  onChange={(e) => setForm({ ...form, checkout_time: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>MINIMUM NIGHTS</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                <input type="number" placeholder="1" min="1" value={form.min_nights}
                  onChange={(e) => setForm({ ...form, min_nights: e.target.value })}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                <span style={{ fontSize: 12, color: "#9E9E9E", fontWeight: 600 }}>night{Number(form.min_nights) !== 1 ? "s" : ""} minimum</span>
              </div>
            </div>
          </>
        )}

        {/* ── SHARED: Availability ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>AVAILABILITY SETTINGS</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase" }}>
                {isCarRental ? "No. of Vehicles" : "No. of Units"}
              </p>
              <input type="number" placeholder="1" min="1" value={form.available_units}
                onChange={(e) => setForm({ ...form, available_units: e.target.value })} style={inputStyle} />
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0" }}>
                {isCarRental ? "How many of this vehicle you have" : "How many of this unit you have"}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 6px", textTransform: "uppercase" }}>Max Bookings/Day</p>
              <input type="number" placeholder="1" min="1" value={form.max_bookings_per_day}
                onChange={(e) => setForm({ ...form, max_bookings_per_day: e.target.value })} style={inputStyle} />
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0" }}>When hit, shows as fully booked</p>
            </div>
          </div>

          <div>
            <button onClick={() => setShowCalendar(!showCalendar)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} style={{ color: "#5B0EA6" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>Block Unavailable Dates</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {form.blocked_dates.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 999 }}>
                    {form.blocked_dates.length} blocked
                  </span>
                )}
                <span style={{ fontSize: 14, color: "#9E9E9E" }}>{showCalendar ? "▲" : "▼"}</span>
              </div>
            </button>
            <AnimatePresence>
              {showCalendar && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginTop: 8 }}>
                  <BlockedDatesCalendar
                    blockedDates={form.blocked_dates}
                    onChange={(dates) => setForm({ ...form, blocked_dates: dates })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Location */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>
              {isCarRental ? "PICKUP LOCATION" : "PROPERTY LOCATION"}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setLocationMode("search")}
                style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid", borderColor: locationMode === "search" ? "#5B0EA6" : "#E4DCF0", backgroundColor: locationMode === "search" ? "#EDE0F7" : "#FFFFFF", color: locationMode === "search" ? "#5B0EA6" : "#9E9E9E", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} />Search
              </button>
              <button onClick={() => { setLocationMode("live"); handleUseCurrentLocation(); }} disabled={locating}
                style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid", borderColor: locationMode === "live" ? "#5B0EA6" : "#E4DCF0", backgroundColor: locationMode === "live" ? "#EDE0F7" : "#FFFFFF", color: locationMode === "live" ? "#5B0EA6" : "#9E9E9E", fontSize: 11, fontWeight: 700, cursor: locating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {locating
                  ? <div style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid rgba(91,14,166,0.3)", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                  : <Navigation size={11} />}
                {locating ? "Locating..." : "Use GPS"}
              </button>
            </div>
          </div>

          {locationMode === "search" && (
            <PlacesInput
              value={form.locationInput}
              onChange={(v) => setForm({ ...form, locationInput: v, selectedPlace: null })}
              onSelect={(place) => setForm({ ...form, locationInput: place.formatted_address || place.name || "", selectedPlace: place })}
              placeholder={isCarRental ? "Search pickup address..." : "Search property address..."}
            />
          )}

          {locationMode === "live" && !form.selectedPlace && (
            <div style={{ backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              {locating
                ? <><div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite", flexShrink: 0 }} /><p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Getting your location...</p></>
                : <><Navigation size={16} style={{ color: "#9E9E9E" }} /><p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Tap "Use GPS" to detect</p></>}
            </div>
          )}

          <AnimatePresence>
            {form.selectedPlace && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: locationMode === "search" ? 8 : 0, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckCircle size={15} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "#059669", margin: "0 0 2px", fontWeight: 700 }}>Location confirmed</p>
                  <p style={{ fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {form.selectedPlace.formatted_address}
                  </p>
                </div>
                <button onClick={() => { setForm({ ...form, selectedPlace: null, locationInput: "" }); setLocationMode("search"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9E9E9E", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vehicle Features */}
        {isCarRental && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>VEHICLE FEATURES</p>
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
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>AMENITIES</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {APARTMENT_AMENITIES.map((a) => (
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
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>PHOTOS</p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>Most recent upload becomes the cover.</p>
          <ImageUpload
            images={form.images}
            onChange={(imgs) => setForm({ ...form, images: imgs })}
            maxImages={8}
            folder="listings"
          />
        </div>

        {/* Video link */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 4px" }}>
            VIDEO <span style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 400 }}>(optional)</span>
          </p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 8px" }}>
            Paste a YouTube, Instagram or TikTok link showcasing this {isCarRental ? "vehicle" : isHotel ? "room" : "property"}.
          </p>
          <VideoLinkInput
            value={form.video_url}
            onChange={(url) => setForm({ ...form, video_url: url })}
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: loading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {loading
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Adding...</>
            : <><Plus size={18} />Add {isCarRental ? "Vehicle" : isHotel ? "Room" : "Listing"}</>}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}