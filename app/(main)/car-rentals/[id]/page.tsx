/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { reserveBookingAmount } from "@/lib/ledger";
import {
  ArrowLeft, MapPin, Navigation, Star, Heart, Share2,
  Car, CheckCircle, Shield, Phone, X, Calendar,
  Users, AlertCircle, ChevronRight, Clock, Play,
  ExternalLink, Mail, LocateFixed,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays } from "date-fns";

const ACCENT    = "#0D9488";
const ACCENT_BG = "#CCFBF1";

interface PlaceResult { address: string; lat: number; lng: number; }

function LocationAutocompleteInput({ label, required, value, onChange, onSelect, placeholder }: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; onSelect: (r: PlaceResult) => void; placeholder: string;
}) {
  const [predictions, setPredictions] = useState<{ place_id: string; description: string }[]>([]);
  const [showDrop,    setShowDrop]    = useState(false);
  const [geoLoading,  setGeoLoading]  = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch_ = useCallback(async (input: string) => {
    if (input.length < 2) { setPredictions([]); setShowDrop(false); return; }
    try {
      const res  = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setPredictions(data.predictions || []);
      setShowDrop(true);
    } catch { setPredictions([]); }
  }, []);

  const handleInput = (val: string) => {
    onChange(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetch_(val), 300);
  };

  const handleSelect = async (p: { place_id: string; description: string }) => {
    onChange(p.description);
    setShowDrop(false);
    setPredictions([]);
    try {
      const res  = await fetch(`/api/places/details?place_id=${p.place_id}`);
      const data = await res.json();
      onSelect({ address: data.address || p.description, lat: data.lat || 0, lng: data.lng || 0 });
    } catch { onSelect({ address: p.description, lat: 0, lng: 0 }); }
  };

  const handleGeo = () => {
    setGeoLoading(true);
    navigator.geolocation?.getCurrentPosition(async pos => {
      try {
        const res  = await fetch(`/api/places/reverse-geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        const data = await res.json();
        const addr = data.formatted_address || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        onChange(addr);
        onSelect({ address: addr, lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        onChange("Current Location");
        onSelect({ address: "Current Location", lat: pos.coords.latitude, lng: pos.coords.longitude });
      } finally { setGeoLoading(false); }
    }, () => setGeoLoading(false));
  };

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  return (
    <div style={{ position: "relative" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
        <MapPin size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
        <input type="text" placeholder={placeholder} value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (predictions.length > 0) setShowDrop(true); }}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
        {value
          ? <button onClick={() => { onChange(""); setPredictions([]); setShowDrop(false); onSelect({ address: "", lat: 0, lng: 0 }); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
              <X size={14} style={{ color: "#9E9E9E" }} />
            </button>
          : <button onClick={handleGeo} disabled={geoLoading}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
              {geoLoading
                ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
                : <LocateFixed size={15} style={{ color: ACCENT }} />}
            </button>}
      </div>
      <AnimatePresence>
        {showDrop && predictions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", marginTop: 4, overflow: "hidden", border: "1px solid #F2EEF9" }}>
            {predictions.map((p, i) => (
              <button key={p.place_id} onMouseDown={() => handleSelect(p)}
                style={{ width: "100%", padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, border: "none", backgroundColor: "transparent", cursor: "pointer", textAlign: "left", borderBottom: i < predictions.length - 1 ? "1px solid #F7F5FA" : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={12} style={{ color: ACCENT }} />
                </div>
                <span style={{ fontSize: 13, color: "#0A0A0A", flex: 1, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.description}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function detectVideoType(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}
function VideoCard({ url }: { url: string }) {
  const type = detectVideoType(url);
  const ytId = type === "youtube" ? getYouTubeId(url) : null;
  const [playing, setPlaying] = useState(false);
  if (type === "youtube" && ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #F2EEF9" }}>
        {playing
          ? <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              style={{ width: "100%", height: 210, border: "none", display: "block" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          : <button onClick={() => setPlaying(true)} style={{ width: "100%", border: "none", padding: 0, cursor: "pointer", position: "relative", display: "block" }}>
              <img src={thumb} alt="" style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={22} style={{ color: "#FF0000", fill: "#FF0000", marginLeft: 3 }} />
                </div>
              </div>
            </button>}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div style={{ borderRadius: 16, border: "1px solid #F2EEF9", backgroundColor: "#F7F5FA", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>{type === "instagram" ? "📸" : "🎵"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>Watch on {type === "instagram" ? "Instagram" : "TikTok"}</p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{url}</p>
        </div>
        <ExternalLink size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
      </div>
    </a>
  );
}

export default function CarRentalDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [activeImage,   setActiveImage]   = useState(0);
  const [lightboxImgs,  setLightboxImgs]  = useState<string[]>([]);
  const [lightboxIdx,   setLightboxIdx]   = useState(0);
  const [showBooking,   setShowBooking]   = useState(false);
  const [selectedCarId, setSelectedCarId] = useState("");
  const [pickupDate,    setPickupDate]    = useState("");
  const [returnDate,    setReturnDate]    = useState("");
  const [pickupTime,    setPickupTime]    = useState("");
  const [withDriver,    setWithDriver]    = useState(false);
  const [passengers,    setPassengers]    = useState("1");
  const [bookingNotes,  setBookingNotes]  = useState("");

  const [pickupAddress,  setPickupAddress]  = useState("");
  const [pickupLat,      setPickupLat]      = useState<number>(0);
  const [pickupLng,      setPickupLng]      = useState<number>(0);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat,     setDropoffLat]     = useState<number>(0);
  const [dropoffLng,     setDropoffLng]     = useState<number>(0);
  const [sameReturn,     setSameReturn]     = useState(true);

  const openLightbox  = (imgs: string[], idx: number) => { setLightboxImgs(imgs); setLightboxIdx(idx); };
  const closeLightbox = () => setLightboxImgs([]);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["car-rental-detail", id],
    queryFn: async () => {
      const { data: vd } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,vendor_type")
        .eq("id", id).maybeSingle();
      if (vd?.id) {
        const { data: venue } = await (supabase.from("venues") as any)
          .select("id,name,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,tiktok,website,contact_email,videos")
          .eq("vendor_id", vd.id).maybeSingle();
        const { data: fleet } = await (supabase.from("vendor_listings") as any)
          .select("id,title,description,price_per_unit,is_active,images,filters,fuel_policy,mileage_policy,mileage_limit,available_units,driver_option,driver_price")
          .eq("vendor_id", vd.id).eq("is_active", true)
          .order("price_per_unit", { ascending: true });
        return { ...vd, venue: venue || {}, fleet: fleet || [] };
      }
      const { data: venue } = await (supabase.from("venues") as any)
        .select("id,name,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,tiktok,website,contact_email,videos")
        .eq("id", id).maybeSingle();
      if (!venue?.id) return null;
      const { data: vendorRow } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,vendor_type")
        .eq("id", venue.vendor_id).maybeSingle();
      const { data: fleet } = await (supabase.from("vendor_listings") as any)
        .select("id,title,description,price_per_unit,is_active,images,filters,fuel_policy,mileage_policy,mileage_limit,available_units,driver_option,driver_price")
        .eq("vendor_id", venue.vendor_id).eq("is_active", true)
        .order("price_per_unit", { ascending: true });
      return { ...vendorRow, venue, fleet: fleet || [] };
    },
    staleTime: 1000 * 60,
  });

  const { data: reviews } = useQuery({
    queryKey: ["car-reviews", id],
    queryFn: async () => {
      const venueId = vendor?.venue?.id;
      if (!venueId) return [];
      const { data } = await (supabase.from("reviews") as any)
        .select("*,users(full_name,avatar_url)")
        .eq("venue_id", venueId).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.venue?.id,
    staleTime: 1000 * 60,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.from("ledger_entries")
        .select("direction,amount")
        .eq("account_id", user.id).eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce(
        (acc: number, r: any) => r.direction === "CREDIT" ? acc + r.amount : acc - r.amount, 0
      );
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });

  // ── Saved / heart state ──────────────────────────────────────────────
  const venueId = vendor?.venue?.id || null;

  const { data: isSaved } = useQuery({
    queryKey: ["saved-venue", venueId, user?.id],
    queryFn: async () => {
      if (!user?.id || !venueId) return false;
      const { data } = await (supabase.from("saved_venues") as any)
        .select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!venueId,
    staleTime: 1000 * 60,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) { router.push(`/login?redirect=/car-rentals/${id}`); return; }
      if (!venueId) return;
      if (isSaved) {
        await (supabase.from("saved_venues") as any)
          .delete().eq("user_id", user.id).eq("venue_id", venueId);
      } else {
        await (supabase.from("saved_venues") as any)
          .upsert({ user_id: user.id, venue_id: venueId }, { onConflict: "user_id,venue_id" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-venue", venueId, user?.id] });
      qc.invalidateQueries({ queryKey: ["saved-venues", user?.id, "car_rental"] });
    },
  });

  const venue     = vendor?.venue || {};
  const fleet     = vendor?.fleet || [];
  const heroImgs  = venue.images?.length ? venue.images : fleet.flatMap((l: any) => l.images || []);
  const videoUrls = (venue.videos || []).filter(Boolean) as string[];

  const selectedCar  = fleet.find((c: any) => c.id === selectedCarId) || fleet[0];
  const dayPrice     = selectedCar?.price_per_unit || 0;
  const driverPrice  = selectedCar?.driver_price || 0;
  const driverOption = selectedCar?.driver_option || "self_drive";

  useEffect(() => {
    if (driverOption === "with_driver") setWithDriver(true);
    else if (driverOption === "self_drive") setWithDriver(false);
  }, [driverOption, selectedCarId]);

  const numDays = pickupDate && returnDate
    ? Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000))
    : 1;

  const vehicleTotal = dayPrice * numDays;
  const driverTotal  = withDriver && driverPrice > 0 ? driverPrice * numDays : 0;
  const totalAmount  = vehicleTotal + driverTotal;

  const minPickup = format(new Date(), "yyyy-MM-dd");
  const minReturn = pickupDate
    ? format(addDays(new Date(pickupDate), 1), "yyyy-MM-dd")
    : format(addDays(new Date(), 1), "yyyy-MM-dd");

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !vendor)       throw new Error("Not authenticated");
      if (!pickupDate)            throw new Error("Please select a pickup date");
      if (!returnDate)            throw new Error("Please select a return date");
      if (!pickupAddress.trim())  throw new Error("Please enter a pickup location");
      if (!sameReturn && !dropoffAddress.trim()) throw new Error("Please enter a dropoff location");

      const serverVehicle = dayPrice * numDays;
      const serverDriver  = withDriver && driverPrice > 0 ? driverPrice * numDays : 0;
      const amount        = (serverVehicle + serverDriver) || 10000;

      if (amount > (walletBalance || 0)) throw new Error("Insufficient wallet balance. Fund your wallet first.");

      const qrHash = generateQRHash();
      const { data: booking, error } = await (supabase.from("bookings") as any)
        .insert({
          user_id:              user.id,
          venue_id:             venue.id || null,
          vendor_id:            vendor.id,
          listing_id:           selectedCar?.id || null,
          status:               "confirmed",
          reserved_amount:      amount,
          qr_code_hash:         qrHash,
          booking_date:         new Date(pickupDate).toISOString(),
          checkin_date:         new Date(pickupDate).toISOString(),
          checkout_date:        new Date(returnDate).toISOString(),
          num_nights:           numDays,
          guest_count:          Number(passengers) || 1,
          package_name:         selectedCar?.title || null,
          package_price:        selectedCar?.price_per_unit || null,
          with_driver:          withDriver,
          pickup_time:          pickupTime || null,
          pickup_location:      pickupAddress.trim(),
          pickup_lat:           pickupLat || null,
          pickup_lng:           pickupLng || null,
          dropoff_location:     sameReturn ? pickupAddress.trim() : dropoffAddress.trim(),
          dropoff_lat:          sameReturn ? (pickupLat || null) : (dropoffLat || null),
          dropoff_lng:          sameReturn ? (pickupLng || null) : (dropoffLng || null),
          same_return_location: sameReturn,
          notes:                bookingNotes.trim() || null,
        })
        .select().single();

      if (error) throw error;
      const reserveRes = await fetch("/api/bookings/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, booking_id: booking.id, amount }),
      });
      if (!reserveRes.ok) {
        const reserveErr = await reserveRes.json();
        throw new Error(reserveErr.error || "Failed to reserve booking amount");
      }
      return booking;
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      router.push(`/bookings/${booking.id}`);
    },
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/car-rentals/${id}`;
    if (navigator.share) await navigator.share({ title: vendor?.business_name || "Car Rental", url });
    else await navigator.clipboard.writeText(url);
  };

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!vendor) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Car rental not found.</p>
        <button onClick={() => router.back()} style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>

      {/* Hero */}
      <div style={{ position: "relative", height: 300, backgroundColor: ACCENT_BG, overflow: "hidden" }}>
        {heroImgs.length > 0
          ? <img src={heroImgs[activeImage]} alt={vendor.business_name}
              onClick={() => openLightbox(heroImgs, activeImage)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
          : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,#134E4A,${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={60} style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,0.3) 0%,transparent 40%,rgba(0,0,0,0.5) 100%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
          <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => saveMutation.mutate()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={18} style={{ color: isSaved ? "#FF4B6E" : "#FFFFFF", fill: isSaved ? "#FF4B6E" : "none" }} />
            </button>
            <button onClick={handleShare} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} style={{ color: "#FFFFFF" }} />
            </button>
          </div>
        </div>

        {heroImgs.length > 1 && (
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {heroImgs.map((_: any, i: number) => (
              <button key={i} onClick={() => setActiveImage(i)}
                style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        )}

        {heroImgs.length > 1 && (
          <button onClick={() => openLightbox(heroImgs, activeImage)}
            style={{ position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "4px 10px", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{activeImage + 1}/{heroImgs.length} · View all</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", marginTop: -16, padding: "20px 16px 0", position: "relative", zIndex: 1 }}>

        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>{vendor.business_name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, backgroundColor: ACCENT_BG, padding: "3px 9px", borderRadius: 999 }}>🚗 Car Rental</span>
            {(venue.rating || 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={13} style={{ color: s <= Math.round(venue.rating) ? "#FBBF24" : "#E4DCF0", fill: s <= Math.round(venue.rating) ? "#FBBF24" : "#E4DCF0" }} />
                ))}
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A" }}>{Number(venue.rating).toFixed(1)}</span>
                {venue.review_count > 0 && <span style={{ fontSize: 12, color: "#9E9E9E" }}>({venue.review_count})</span>}
              </div>
            )}
          </div>
        </div>

        {venue.address && (
          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MapPin size={16} style={{ color: ACCENT }} />
            </div>
            <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.address}</p>
            {venue.lat !== null && venue.lat !== undefined && venue.lng !== null && venue.lng !== undefined && (
              <button onClick={() => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) window.open(`maps://?daddr=${venue.lat},${venue.lng}`, "_blank");
                else window.open(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`, "_blank");
              }} style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                <Navigation size={11} />Go
              </button>
            )}
          </div>
        )}

        {vendor.description && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>About</h3>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: "0 0 18px" }}>{vendor.description}</p>
          </>
        )}

        {videoUrls.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>See Our Fleet</h3>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 12px" }}>Watch before you book</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {videoUrls.map((url, i) => <VideoCard key={i} url={url} />)}
            </div>
          </>
        )}

        {fleet.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              Available Fleet <span style={{ fontSize: 12, fontWeight: 600, color: "#9E9E9E" }}>({fleet.length})</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              {fleet.map((car: any) => {
                const carImgs    = car.images  || [];
                const carFilts   = car.filters || [];
                const carOpt     = car.driver_option || "self_drive";
                const carDriverP = car.driver_price  || 0;
                return (
                  <div key={car.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 18, overflow: "hidden", border: "1.5px solid #E4DCF0" }}>
                    {carImgs.length > 0 && (
                      <div style={{ position: "relative", height: 160, overflow: "hidden", backgroundColor: ACCENT_BG }}>
                        <img src={carImgs[0]} alt={car.title}
                          onClick={() => openLightbox(carImgs, 0)}
                          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
                        {carImgs.length > 1 && (
                          <div style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "3px 9px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>{carImgs.length} photos</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 4px" }}>{car.title}</p>
                          {car.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.4 }}>{car.description}</p>}
                          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            {carOpt === "self_drive" && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: ACCENT_BG, borderRadius: 8, padding: "3px 8px" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>🔑 Self Drive</span>
                              </div>
                            )}
                            {carOpt === "with_driver" && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: ACCENT_BG, borderRadius: 8, padding: "3px 8px" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>🧑‍✈️ Driver Included</span>
                              </div>
                            )}
                            {carOpt === "both" && (
                              <>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: ACCENT_BG, borderRadius: 8, padding: "3px 8px" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>🔑 Self Drive</span>
                                </div>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: ACCENT_BG, borderRadius: 8, padding: "3px 8px" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>🧑‍✈️ +{formatCurrency(carDriverP)}/day</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 18, fontWeight: 900, color: ACCENT, margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(car.price_per_unit)}</p>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "1px 0 0" }}>
                            {carOpt === "with_driver" ? "per day (with driver)" : "per day"}
                          </p>
                        </div>
                      </div>

                      {(car.fuel_policy || car.mileage_policy) && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          {car.fuel_policy && (
                            <div style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: "8px 12px", border: "1px solid #E4DCF0" }}>
                              <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Fuel Policy</p>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{car.fuel_policy}</p>
                            </div>
                          )}
                          {car.mileage_policy && (
                            <div style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: "8px 12px", border: "1px solid #E4DCF0" }}>
                              <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", margin: "0 0 2px" }}>Mileage</p>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                                {car.mileage_policy === "Limited" && car.mileage_limit ? `${car.mileage_limit}km/day` : car.mileage_policy}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {carFilts.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {carFilts.map((f: string) => (
                            <div key={f} style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", border: "1px solid #E4DCF0", borderRadius: 8, padding: "4px 9px" }}>
                              <CheckCircle size={10} style={{ color: ACCENT, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#0A0A0A" }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => { setSelectedCarId(car.id); if (!user) { router.push(`/login?redirect=/car-rentals/${id}`); return; } setShowBooking(true); }}
                        style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg,#0F766E,${ACCENT})`, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(13,148,136,0.3)" }}>
                        Book This Vehicle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(venue.filters || []).length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Features & Services</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {(venue.filters || []).map((f: string) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: ACCENT_BG, border: "1px solid #99F6E4", borderRadius: 10, padding: "7px 12px" }}>
                  <CheckCircle size={12} style={{ color: ACCENT, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{f}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(venue.phone || venue.whatsapp || venue.contact_email || venue.instagram || venue.website) && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Contact</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {venue.whatsapp && (
                <a href={`https://wa.me/${venue.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 16 }}>💬</span><span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span>
                </a>
              )}
              {venue.phone && (
                <a href={`tel:${venue.phone}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: ACCENT_BG, border: "1px solid #99F6E4", borderRadius: 12, padding: "10px 14px" }}>
                  <Phone size={13} style={{ color: ACCENT }} /><span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Call</span>
                </a>
              )}
              {venue.contact_email && (
                <a href={`mailto:${venue.contact_email}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "10px 14px" }}>
                  <Mail size={13} style={{ color: "#2563EB" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Email</span>
                </a>
              )}
              {venue.instagram && (
                <a href={`https://instagram.com/${venue.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#FDF2F8", border: "1px solid #F9A8D4", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 14 }}>📸</span><span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>Instagram</span>
                </a>
              )}
              {venue.website && (
                <a href={venue.website.startsWith("http") ? venue.website : `https://${venue.website}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 14 }}>🌐</span><span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Website</span>
                </a>
              )}
            </div>
          </>
        )}

        {reviews && reviews.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Customer Reviews</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map((r: any) => (
                <div key={r.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {r.users?.avatar_url
                          ? <img src={r.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{r.users?.full_name?.[0]}</span>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A" }}>{r.users?.full_name || "Customer"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} style={{ color: s <= r.rating ? "#FBBF24" : "#E4DCF0", fill: s <= r.rating ? "#FBBF24" : "#E4DCF0" }} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{r.comment}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 120 }}>
          <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Rental Policies</h3>
          {[
            { icon: Shield,      text: "Secure payment via Chillz wallet" },
            { icon: CheckCircle, text: "Instant booking confirmation" },
            { icon: Car,         text: "Vehicle subject to availability" },
            { icon: AlertCircle, text: "Valid driver's licence required for self-drive" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} style={{ color: ACCENT }} />
              </div>
              <span style={{ fontSize: 13, color: "#6B6B6B" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 2px" }}>Starting from</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: ACCENT, margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              {fleet[0]?.price_per_unit
                ? <>{formatCurrency(fleet[0].price_per_unit)}<span style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 400 }}>/day</span></>
                : "Contact for rates"}
            </p>
          </div>
          <button
            onClick={() => { if (!user) { router.push(`/login?redirect=/car-rentals/${id}`); return; } setSelectedCarId(fleet[0]?.id || ""); setShowBooking(true); }}
            style={{ padding: "14px 28px", borderRadius: 16, border: "none", background: `linear-gradient(135deg,#0F766E,${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,148,136,0.35)" }}>
            Book Now
          </button>
        </div>
      </div>

      {/* ── Booking Sheet ── */}
      <AnimatePresence>
        {showBooking && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowBooking(false); bookMutation.reset(); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Book Vehicle</h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>{vendor.business_name}</p>
                  </div>
                  <button onClick={() => { setShowBooking(false); bookMutation.reset(); }}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
                <div style={{ backgroundColor: "#F2EEF9", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>Wallet balance</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{formatCurrency(walletBalance || 0)}</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>

                  {driverOption === "self_drive" && (
                    <div style={{ backgroundColor: ACCENT_BG, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🔑</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: ACCENT, margin: "0 0 1px" }}>Self Drive</p>
                        <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>No driver included — valid licence required</p>
                      </div>
                    </div>
                  )}
                  {driverOption === "with_driver" && (
                    <div style={{ backgroundColor: ACCENT_BG, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🧑‍✈️</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: ACCENT, margin: "0 0 1px" }}>Driver Included</p>
                        <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>
                          A professional driver is always provided with this vehicle
                          {driverPrice > 0 ? ` · ${formatCurrency(driverPrice)}/day` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                  {driverOption === "both" && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Driver Option</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setWithDriver(false)}
                          style={{ flex: 1, padding: "14px 8px", borderRadius: 14, border: "2px solid", borderColor: !withDriver ? ACCENT : "#E4DCF0", backgroundColor: !withDriver ? ACCENT_BG : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 22 }}>🔑</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: !withDriver ? ACCENT : "#6B6B6B" }}>Self Drive</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#9E9E9E" }}>No driver fee</span>
                        </button>
                        <button onClick={() => setWithDriver(true)}
                          style={{ flex: 1, padding: "14px 8px", borderRadius: 14, border: "2px solid", borderColor: withDriver ? ACCENT : "#E4DCF0", backgroundColor: withDriver ? ACCENT_BG : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 22 }}>🧑‍✈️</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: withDriver ? ACCENT : "#6B6B6B" }}>With Driver</span>
                          {driverPrice > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: withDriver ? ACCENT : "#9E9E9E" }}>
                              +{formatCurrency(driverPrice)}/day
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {fleet.length > 1 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Select Vehicle</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {fleet.map((car: any) => {
                          const sel = car.id === selectedCarId || (!selectedCarId && fleet[0]?.id === car.id);
                          return (
                            <button key={car.id} onClick={() => setSelectedCarId(car.id)}
                              style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: "2px solid", borderColor: sel ? ACCENT : "#E4DCF0", backgroundColor: sel ? ACCENT_BG : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{car.title}</p>
                              <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT, flexShrink: 0 }}>
                                {formatCurrency(car.price_per_unit)}<span style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 400 }}>/day</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, overflow: "hidden", border: "1.5px solid #E4DCF0" }}>
                    <div style={{ padding: "14px", borderBottom: "1px solid #E4DCF0" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Pickup Date</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} style={{ color: ACCENT, flexShrink: 0 }} />
                        <input type="date" min={minPickup} value={pickupDate}
                          onChange={e => { setPickupDate(e.target.value); if (returnDate && e.target.value >= returnDate) setReturnDate(""); }}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    </div>
                    <div style={{ padding: "14px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Return Date</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} style={{ color: ACCENT, flexShrink: 0 }} />
                        <input type="date" min={minReturn} value={returnDate}
                          onChange={e => setReturnDate(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Pickup Time <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                      <Clock size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  {pickupDate && returnDate && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      style={{ backgroundColor: ACCENT_BG, borderRadius: 14, padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: (withDriver && driverPrice > 0) ? 6 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={14} style={{ color: ACCENT }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{numDays} day{numDays !== 1 ? "s" : ""}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(vehicleTotal)}</span>
                      </div>
                      {withDriver && driverPrice > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: ACCENT }}>🧑‍✈️ Driver × {numDays} day{numDays !== 1 ? "s" : ""}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>+{formatCurrency(driverTotal)}</span>
                        </div>
                      )}
                      {totalAmount > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${ACCENT}33` }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>Total</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: ACCENT, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(totalAmount)}</span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Passengers</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                      <Users size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="number" min="1" max="50" value={passengers} onChange={e => setPassengers(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <LocationAutocompleteInput
                    label="Pickup Location" required
                    value={pickupAddress}
                    onChange={setPickupAddress}
                    onSelect={r => { setPickupAddress(r.address); setPickupLat(r.lat); setPickupLng(r.lng); }}
                    placeholder="Search address or use current location"
                  />

                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>Return to same location</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Drop-off at pickup point</p>
                    </div>
                    <button onClick={() => setSameReturn(!sameReturn)}
                      style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: sameReturn ? ACCENT : "#E4DCF0", position: "relative", flexShrink: 0 }}>
                      <motion.div animate={{ x: sameReturn ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  </div>

                  {!sameReturn && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "visible" }}>
                      <LocationAutocompleteInput
                        label="Dropoff Location" required
                        value={dropoffAddress}
                        onChange={setDropoffAddress}
                        onSelect={r => { setDropoffAddress(r.address); setDropoffLat(r.lat); setDropoffLng(r.lng); }}
                        placeholder="e.g. Murtala Muhammed Airport, Lagos"
                      />
                    </motion.div>
                  )}

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Additional Notes <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    <textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)}
                      placeholder="Flight number, special requests..." rows={2}
                      style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
                  </div>

                  {(walletBalance || 0) === 0 && (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                      <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                        Wallet empty.{" "}
                        <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                          style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
                          Fund now →
                        </button>
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {bookMutation.isError && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                        <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{(bookMutation.error as Error).message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div style={{ padding: "12px 20px 40px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                <button onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: bookMutation.isPending ? "#9E9E9E" : `linear-gradient(135deg,#0F766E,${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: bookMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: bookMutation.isPending ? "none" : "0 4px 20px rgba(13,148,136,0.35)" }}>
                  {bookMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Confirming...</>
                    : <><CheckCircle size={18} />Confirm Booking{pickupDate && returnDate && totalAmount > 0 ? ` — ${formatCurrency(totalAmount)}` : ""}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
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
                <ChevronRight size={22} style={{ color: "#FFFFFF", transform: "rotate(180deg)" }} />
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