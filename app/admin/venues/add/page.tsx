/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PlacesInput } from "@/components/ui/places-input";
import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceDetail } from "@/hooks/use-places-autocomplete";
import {
  ArrowLeft, Plus, AlertTriangle, CheckCircle,
  MapPin, Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES } from "@/lib/constants";

const VENUE_CATEGORIES = CATEGORIES.filter(
  (c) => !["events", "outdoorsy", "lets-plan", "flight-booking"].includes(c.slug)
);

const ALL_FILTERS = [
  "Sea View", "Rooftop", "Cozy", "Live Music",
  "Outdoor Seating", "VIP Section", "Shisha",
  "Private Dining", "Airport Pickup", "Event Rental",
  "Standard Rental", "Shortlet", "Weekend Getaway", "Extended Stay",
];

export default function AddVenuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error" | "unchecked">("unchecked");
  const [apiMessage, setApiMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationMode, setLocationMode] = useState<"search" | "live">("search");

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    locationInput: "",
    selectedPlace: null as PlaceDetail | null,
    filters: [] as string[],
    images: [] as string[],
    isFeatured: false,
  });

  // Check Places API status on mount
  useEffect(() => {
    const checkApi = async () => {
      setApiStatus("checking");
      try {
        const res = await fetch("/api/places/autocomplete?input=lagos");
        const data = await res.json();
        if (data.predictions && data.predictions.length > 0) {
          setApiStatus("ok");
          setApiMessage(`API working — ${data.predictions.length} results for "lagos"`);
        } else if (data.error) {
          setApiStatus("error");
          setApiMessage(data.error);
        } else {
          setApiStatus("error");
          setApiMessage("API returned no results.");
        }
      } catch (e: any) {
        setApiStatus("error");
        setApiMessage(e.message);
      }
    };
    checkApi();
  }, []);

  const toggleFilter = (f: string) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.includes(f)
        ? prev.filters.filter((x) => x !== f)
        : [...prev.filters, f],
    }));
  };

  // Use device GPS to get current location and reverse geocode
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get address
          const res = await fetch(
            `/api/places/geocode?lat=${latitude}&lng=${longitude}`
          );
          const data = await res.json();

          // Also get a proper formatted address using reverse geocode details endpoint
          const detailRes = await fetch(
            `/api/places/reverse?lat=${latitude}&lng=${longitude}`
          );
          const detailData = await detailRes.json();

          const address = detailData.formatted_address || data.location || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          const name = detailData.name || data.location || "Current Location";

          setForm((prev) => ({
            ...prev,
            locationInput: address,
            selectedPlace: {
              place_id: detailData.place_id || `manual_${Date.now()}`,
              name,
              formatted_address: address,
              lat: latitude,
              lng: longitude,
            },
          }));
          setLocationMode("live");
        } catch {
          // Even if reverse geocode fails, we have coordinates
          const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setForm((prev) => ({
            ...prev,
            locationInput: address,
            selectedPlace: {
              place_id: `manual_${Date.now()}`,
              name: "Current Location",
              formatted_address: address,
              lat: latitude,
              lng: longitude,
            },
          }));
          setLocationMode("live");
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        setLocating(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError("Location permission denied. Please allow location access or use the search instead.");
            break;
          case geoError.POSITION_UNAVAILABLE:
            setError("Location unavailable. Please use the search instead.");
            break;
          case geoError.TIMEOUT:
            setError("Location request timed out. Please try again or use search.");
            break;
          default:
            setError("Could not get your location. Please use the search instead.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) { setError("Venue name is required"); return; }
    if (!form.category) { setError("Please select a category"); return; }
    if (!form.selectedPlace) {
      setError("Please select a location from the dropdown or use your current location");
      return;
    }
    if (!form.selectedPlace.lat || !form.selectedPlace.lng) {
      setError("Location coordinates are missing. Please select again.");
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await (supabase.from("venues") as any).insert({
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        google_place_id: form.selectedPlace.place_id,
        address: form.selectedPlace.formatted_address,
        lat: form.selectedPlace.lat,
        lng: form.selectedPlace.lng,
        filters: form.filters,
        images: form.images,
        is_featured: form.isFeatured,
        is_active: true,
        rating: 0,
        review_count: 0,
        vendor_id: null,
        tags: [],
      });

      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => router.push("/admin/venues"), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#F7F5FA",
    border: "1.5px solid #E4DCF0",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0A0A0A",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 20, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Venue Added</p>
        <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Redirecting to venues list...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Add Venue
        </h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* API Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: 14, padding: "12px 14px",
            display: "flex", alignItems: "flex-start", gap: 10,
            backgroundColor: apiStatus === "ok" ? "#E0F7EA" : apiStatus === "error" ? "#FEF2F2" : "#F2EEF9",
            border: `1px solid ${apiStatus === "ok" ? "#A7F3D0" : apiStatus === "error" ? "#FECACA" : "#E4DCF0"}`,
          }}
        >
          {apiStatus === "checking" && (
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite", flexShrink: 0, marginTop: 1 }} />
          )}
          {apiStatus === "ok" && <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }} />}
          {apiStatus === "error" && <AlertTriangle size={16} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 2px", color: apiStatus === "ok" ? "#059669" : apiStatus === "error" ? "#EF4444" : "#5B0EA6" }}>
              {apiStatus === "checking" && "Checking Google Places API..."}
              {apiStatus === "ok" && "Google Places API is working"}
              {apiStatus === "error" && "Google Places API issue detected"}
              {apiStatus === "unchecked" && "API status unknown"}
            </p>
            {apiMessage && (
              <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0, lineHeight: 1.4 }}>{apiMessage}</p>
            )}
          </div>
        </motion.div>

        {/* Venue name */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VENUE NAME</p>
          <input
            type="text"
            placeholder="e.g. Quilox Club Lagos"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* Category */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>CATEGORY</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {VENUE_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setForm({ ...form, category: cat.slug })}
                style={{
                  padding: "10px 6px", borderRadius: 12, border: "1.5px solid",
                  borderColor: form.category === cat.slug ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: form.category === cat.slug ? "#EDE0F7" : "#FFFFFF",
                  color: form.category === cat.slug ? "#5B0EA6" : "#6B6B6B",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", lineHeight: 1.3,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>LOCATION</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setLocationMode("search")}
                style={{
                  padding: "4px 10px", borderRadius: 999, border: "1.5px solid",
                  borderColor: locationMode === "search" ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: locationMode === "search" ? "#EDE0F7" : "#FFFFFF",
                  color: locationMode === "search" ? "#5B0EA6" : "#9E9E9E",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <MapPin size={11} />
                Search
              </button>
              <button
                onClick={() => {
                  setLocationMode("live");
                  handleUseCurrentLocation();
                }}
                disabled={locating}
                style={{
                  padding: "4px 10px", borderRadius: 999, border: "1.5px solid",
                  borderColor: locationMode === "live" ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: locationMode === "live" ? "#EDE0F7" : "#FFFFFF",
                  color: locationMode === "live" ? "#5B0EA6" : "#9E9E9E",
                  fontSize: 11, fontWeight: 700, cursor: locating ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {locating ? (
                  <div style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid rgba(91,14,166,0.3)", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <Navigation size={11} />
                )}
                {locating ? "Locating..." : "Use My Location"}
              </button>
            </div>
          </div>

          {/* Search mode */}
          {locationMode === "search" && (
            <PlacesInput
              value={form.locationInput}
              onChange={(v) => setForm({ ...form, locationInput: v, selectedPlace: null })}
              onSelect={(place) =>
                setForm({
                  ...form,
                  locationInput: place.formatted_address || place.name || "",
                  selectedPlace: place,
                })
              }
              placeholder="Search on Google Maps..."
            />
          )}

          {/* Live location mode — shows address or locating state */}
          {locationMode === "live" && !form.selectedPlace && (
            <div style={{ backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              {locating ? (
                <>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Getting your location...</p>
                </>
              ) : (
                <>
                  <Navigation size={16} style={{ color: "#9E9E9E" }} />
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Tap "Use My Location" to detect</p>
                </>
              )}
            </div>
          )}

          {/* Selected place confirmation */}
          <AnimatePresence>
            {form.selectedPlace && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: locationMode === "search" ? 8 : 0,
                  backgroundColor: "#E0F7EA",
                  border: "1px solid #A7F3D0",
                  borderRadius: 12,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <CheckCircle size={15} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "#059669", margin: "0 0 2px", fontWeight: 700 }}>
                    {locationMode === "live" ? "Live Location Captured" : "Location Selected"}
                  </p>
                  <p style={{ fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {form.selectedPlace.name !== "Current Location"
                      ? form.selectedPlace.name
                      : form.selectedPlace.formatted_address}
                  </p>
                  <p style={{ fontSize: 11, color: "#6B6B6B", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {form.selectedPlace.formatted_address}
                  </p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                    {form.selectedPlace.lat?.toFixed(6)}, {form.selectedPlace.lng?.toFixed(6)}
                  </p>
                </div>
                {/* Allow clearing to search again */}
                <button
                  onClick={() => {
                    setForm({ ...form, selectedPlace: null, locationInput: "" });
                    setLocationMode("search");
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9E9E9E", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
          <textarea
            placeholder="Describe the venue — vibe, capacity, specialties..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Filters */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>FILTERS & TAGS</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {ALL_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: 999, border: "1.5px solid",
                  borderColor: form.filters.includes(f) ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: form.filters.includes(f) ? "#EDE0F7" : "#FFFFFF",
                  color: form.filters.includes(f) ? "#5B0EA6" : "#6B6B6B",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
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
            maxImages={6}
            folder="venues"
          />
        </div>

        {/* Featured toggle */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Featured Venue</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Show on home page featured section</p>
          </div>
          <button
            onClick={() => setForm({ ...form, isFeatured: !form.isFeatured })}
            style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: form.isFeatured ? "#5B0EA6" : "#E4DCF0", position: "relative", transition: "background-color 0.2s ease", flexShrink: 0 }}
          >
            <motion.div
              animate={{ x: form.isFeatured ? 22 : 2 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
            />
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit — no longer blocked by API status */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            backgroundColor: loading ? "#9E9E9E" : "#5B0EA6",
            color: "#FFFFFF", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginTop: 4, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)",
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
              Adding Venue...
            </>
          ) : (
            <><Plus size={18} />Add Venue</>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}