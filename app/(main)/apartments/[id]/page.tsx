/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { reserveBookingAmount } from "@/lib/ledger";
import {
  ArrowLeft, MapPin, Navigation, Star, Heart, Share2,
  Home, CheckCircle, Shield, Phone, X, Calendar,
  Users, AlertCircle, ChevronRight, Clock, Wifi,
  Car, Coffee, Waves, Dumbbell, Wind, Tv, Mail,
  Moon, Play, ExternalLink, Zap, Snowflake,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, differenceInDays } from "date-fns";

const AMENITY_ICONS: Record<string, any> = {
  "WiFi": Wifi, "Parking": Car, "Pool": Waves,
  "Gym": Dumbbell, "Breakfast": Coffee, "AC": Wind,
  "TV": Tv, "Generator": Zap, "Air Conditioning": Snowflake,
  "Security": Shield, "CCTV": Shield,
};

const SPECIAL_OCCASIONS = [
  "None","Birthday","Anniversary","Honeymoon",
  "Proposal","Business Trip","Family Holiday","Other",
];

function isValidNigerianPhone(p: string): boolean {
  const d = p.replace(/\D/g, "");
  return (d.length === 11 && d.startsWith("0")) ||
         (d.length === 13 && d.startsWith("234"));
}

function detectVideoType(url: string): "youtube" | "instagram" | "tiktok" | "unknown" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
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
          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>
            Watch on {type === "instagram" ? "Instagram" : "TikTok"}
          </p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{url}</p>
        </div>
        <ExternalLink size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
      </div>
    </a>
  );
}

export default function ApartmentDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [activeImage,      setActiveImage]      = useState(0);
  const [lightboxImages,   setLightboxImages]   = useState<string[]>([]);
  const [lightboxIndex,    setLightboxIndex]    = useState(0);
  const [showBooking,      setShowBooking]      = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  // Booking form state
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [checkIn,           setCheckIn]           = useState("");
  const [checkOut,          setCheckOut]          = useState("");
  const [guests,            setGuests]            = useState("1");
  const [phone,             setPhone]             = useState("");
  const [phoneErr,          setPhoneErr]          = useState("");
  const [specialOccasion,   setSpecialOccasion]   = useState("None");
  const [notes,             setNotes]             = useState("");

  const openLightbox  = (imgs: string[], idx: number) => { setLightboxImages(imgs); setLightboxIndex(idx); };
  const closeLightbox = () => setLightboxImages([]);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["apartment-detail", id],
    queryFn: async () => {
      const { data: vd } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,vendor_type")
        .eq("id", id).maybeSingle();
      if (vd?.id) {
        const { data: venue } = await (supabase.from("venues") as any)
          .select("id,name,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,contact_email,website,videos")
          .eq("vendor_id", vd.id).maybeSingle();
        const { data: listings } = await (supabase.from("vendor_listings") as any)
          .select("id,title,description,price_per_unit,unit_label,is_active,images,filters,amenities,room_type,min_nights,available_units")
          .eq("vendor_id", vd.id).eq("is_active", true)
          .order("price_per_unit", { ascending: true });
        return { ...vd, venue: venue || {}, listings: listings || [] };
      }
      const { data: venue } = await (supabase.from("venues") as any)
        .select("id,name,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,contact_email,website,videos")
        .eq("id", id).maybeSingle();
      if (!venue?.id) return null;
      const { data: vendorRow } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,vendor_type")
        .eq("id", venue.vendor_id).maybeSingle();
      const { data: listings } = await (supabase.from("vendor_listings") as any)
        .select("id,title,description,price_per_unit,unit_label,is_active,images,filters,amenities,room_type,min_nights,available_units")
        .eq("vendor_id", venue.vendor_id).eq("is_active", true)
        .order("price_per_unit", { ascending: true });
      return { ...vendorRow, venue, listings: listings || [] };
    },
    staleTime: 1000 * 60,
  });

  const { data: reviews } = useQuery({
    queryKey: ["apartment-reviews", id],
    queryFn: async () => {
      const venueId = vendor?.venue?.id;
      if (!venueId) return [];
      const { data } = await (supabase.from("reviews") as any)
        .select("*,users(full_name,avatar_url)")
        .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(5);
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
      if (!user?.id) { router.push(`/login?redirect=/apartments/${id}`); return; }
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
      qc.invalidateQueries({ queryKey: ["saved-venues", user?.id, "apartment"] });
    },
  });

  const venue    = vendor?.venue    || {};
  const listings = vendor?.listings || [];
  const venueImgs   = venue.images?.length ? venue.images : [];
  const listingImgs = listings.flatMap((l: any) => l.images || []);
  const heroImages  = venueImgs.length ? venueImgs : listingImgs;
  const videoUrls   = (venue.videos || []).filter(Boolean) as string[];
  const amenities   = venue.filters || [];

  const selectedListing = listings.find((l: any) => l.id === selectedListingId) || listings[0];
  const pricePerUnit    = selectedListing?.price_per_unit || 0;
  const unitLabel       = selectedListing?.unit_label || "night";

  const numNights = checkIn && checkOut
    ? Math.max(0, differenceInDays(new Date(checkOut), new Date(checkIn)))
    : 0;

  const totalAmount = pricePerUnit > 0 && numNights > 0 ? pricePerUnit * numNights : 0;

  const minCheckIn  = format(new Date(), "yyyy-MM-dd");
  const minCheckOut = checkIn
    ? format(addDays(new Date(checkIn), selectedListing?.min_nights || 1), "yyyy-MM-dd")
    : format(addDays(new Date(), 1), "yyyy-MM-dd");

  const avgRating   = venue.rating       || 0;
  const reviewCount = venue.review_count || 0;

  const phoneValid = isValidNigerianPhone(phone);
  const canBook    = !!checkIn && !!checkOut && numNights > 0 && phoneValid &&
    (!(selectedListing?.min_nights > 1) || numNights >= selectedListing.min_nights);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !vendor) throw new Error("Not authenticated");
      if (!checkIn)          throw new Error("Please select a check-in date");
      if (!checkOut)         throw new Error("Please select a check-out date");
      if (numNights < 1)     throw new Error("Check-out must be after check-in");
      if (!phoneValid)       throw new Error("Please enter a valid Nigerian phone number");
      if (selectedListing?.min_nights && numNights < selectedListing.min_nights)
        throw new Error(`Minimum stay is ${selectedListing.min_nights} night${selectedListing.min_nights !== 1 ? "s" : ""}`);
      const amount = totalAmount > 0 ? totalAmount : 5000;
      if (amount > (walletBalance || 0)) throw new Error("Insufficient wallet balance. Fund your wallet first.");
      const qrHash = generateQRHash();
      const { data: booking, error } = await (supabase.from("bookings") as any)
        .insert({
          user_id:          user.id,
          venue_id:         venue.id || null,
          vendor_id:        vendor.id,
          listing_id:       selectedListing?.id || null,
          package_name:     selectedListing?.title || selectedListing?.room_type || null,
          package_price:    pricePerUnit || null,
          status:           "confirmed",
          reserved_amount:  amount,
          qr_code_hash:     qrHash,
          booking_date:     new Date(checkIn).toISOString(),
          checkin_date:     new Date(checkIn).toISOString(),
          checkout_date:    new Date(checkOut).toISOString(),
          num_nights:       numNights,
          guest_count:      Number(guests) || 1,
          phone:            phone.trim(),
          special_occasion: specialOccasion !== "None" ? specialOccasion : null,
          notes:            notes.trim() || null,
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
    const url = `${window.location.origin}/apartments/${id}`;
    if (navigator.share) await navigator.share({ title: vendor?.business_name || "Apartment", url });
    else await navigator.clipboard.writeText(url);
  };

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #DBEAFE", borderTopColor: "#2563EB", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!vendor) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Apartment not found.</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>

      {/* Hero */}
      <div style={{ position: "relative", height: 300, backgroundColor: "#DBEAFE", overflow: "hidden" }}>
        {heroImages.length > 0
          ? <img src={heroImages[activeImage]} alt={vendor.business_name}
              onClick={() => openLightbox(heroImages, activeImage)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1e3a5f,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Home size={60} style={{ color: "rgba(255,255,255,0.3)" }} />
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
        {heroImages.length > 1 && (
          <>
            <button onClick={() => openLightbox(heroImages, activeImage)}
              style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "5px 12px", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>View all {heroImages.length} photos</span>
            </button>
            <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
              {heroImages.map((_: any, i: number) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 32, right: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "3px 9px" }}>
              <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: 600 }}>{activeImage + 1}/{heroImages.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", marginTop: -16, padding: "20px 16px 0", position: "relative", zIndex: 1 }}>

        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>{vendor.business_name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", backgroundColor: "#DBEAFE", padding: "3px 9px", borderRadius: 999 }}>🏠 Shortlet / Apartment</span>
            {avgRating > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={13} style={{ color: s <= Math.round(avgRating) ? "#FBBF24" : "#E4DCF0", fill: s <= Math.round(avgRating) ? "#FBBF24" : "#E4DCF0" }} />
                ))}
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A" }}>{Number(avgRating).toFixed(1)}</span>
                {reviewCount > 0 && <span style={{ fontSize: 12, color: "#9E9E9E" }}>({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>}
              </div>
            )}
          </div>
        </div>

        {venue.address && (
          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MapPin size={16} style={{ color: "#2563EB" }} />
            </div>
            <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.address}</p>
            {venue.lat && venue.lng && (
              <button onClick={() => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) window.open(`maps://?daddr=${venue.lat},${venue.lng}`, "_blank");
                else window.open(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`, "_blank");
              }} style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                <Navigation size={11} />Go
              </button>
            )}
          </div>
        )}

        {vendor.description && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>About this Property</h3>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: "0 0 18px" }}>{vendor.description}</p>
          </>
        )}

        {amenities.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Amenities</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {(showAllAmenities ? amenities : amenities.slice(0, 6)).map((a: string) => {
                const Icon = AMENITY_ICONS[a] || CheckCircle;
                return (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px" }}>
                    <Icon size={14} style={{ color: "#2563EB", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 500 }}>{a}</span>
                  </div>
                );
              })}
            </div>
            {amenities.length > 6 && (
              <button onClick={() => setShowAllAmenities(!showAllAmenities)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB", fontSize: 13, fontWeight: 700, padding: "0 0 18px", display: "flex", alignItems: "center", gap: 4 }}>
                {showAllAmenities ? "Show less" : `Show all ${amenities.length} amenities`}
                <ChevronRight size={14} style={{ transform: showAllAmenities ? "rotate(90deg)" : "none" }} />
              </button>
            )}
            {!showAllAmenities && <div style={{ marginBottom: 18 }} />}
          </>
        )}

        {videoUrls.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>See it in Action</h3>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 12px" }}>Watch before you book</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {videoUrls.map((url, i) => <VideoCard key={i} url={url} />)}
            </div>
          </>
        )}

        {listings.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", margin: "0 0 18px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              Available Units <span style={{ fontSize: 12, fontWeight: 600, color: "#9E9E9E" }}>({listings.length})</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              {listings.map((listing: any) => {
                const imgs    = listing.images || [];
                const filters = listing.filters || [];
                return (
                  <div key={listing.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 18, overflow: "hidden", border: "1.5px solid #E4DCF0" }}>
                    {imgs.length > 0 && (
                      <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
                        <img src={imgs[0]} alt={listing.title}
                          onClick={() => openLightbox(imgs, 0)}
                          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
                        {imgs.length > 1 && (
                          <div style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "3px 9px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>{imgs.length} photos</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 4px" }}>{listing.title}</p>
                          {listing.room_type && <span style={{ fontSize: 11, fontWeight: 600, color: "#2563EB", backgroundColor: "#DBEAFE", padding: "2px 8px", borderRadius: 999 }}>{listing.room_type}</span>}
                          {listing.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "6px 0 0", lineHeight: 1.4 }}>{listing.description}</p>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 18, fontWeight: 900, color: "#2563EB", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(listing.price_per_unit)}</p>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "1px 0 0" }}>per {listing.unit_label || "night"}</p>
                          {listing.min_nights > 1 && (
                            <p style={{ fontSize: 10, color: "#F59E0B", margin: "2px 0 0", fontWeight: 600 }}>Min {listing.min_nights} nights</p>
                          )}
                        </div>
                      </div>
                      {filters.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {filters.map((f: string) => (
                            <div key={f} style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", border: "1px solid #E4DCF0", borderRadius: 8, padding: "4px 9px" }}>
                              <CheckCircle size={10} style={{ color: "#2563EB", flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#0A0A0A" }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => { setSelectedListingId(listing.id); if (!user) { router.push(`/login?redirect=/apartments/${id}`); return; } setShowBooking(true); }}
                        style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(37,99,235,0.3)" }}>
                        Book This Unit
                      </button>
                    </div>
                  </div>
                );
              })}
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
                <a href={`tel:${venue.phone}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#DBEAFE", border: "1px solid #BFDBFE", borderRadius: 12, padding: "10px 14px" }}>
                  <Phone size={13} style={{ color: "#2563EB" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Call</span>
                </a>
              )}
              {venue.contact_email && (
                <a href={`mailto:${venue.contact_email}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 12, padding: "10px 14px" }}>
                  <Mail size={13} style={{ color: "#6B6B6B" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Email</span>
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
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Guest Reviews</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map((r: any) => (
                <div key={r.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {r.users?.avatar_url
                          ? <img src={r.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>{r.users?.full_name?.[0]}</span>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A" }}>{r.users?.full_name || "Guest"}</span>
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
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Booking Policies</h3>
          {[
            { icon: Shield,      text: "Secure payment via Chillz wallet" },
            { icon: CheckCircle, text: "Instant booking confirmation" },
            { icon: Phone,       text: "Direct contact with host after booking" },
            { icon: AlertCircle, text: "Cancellation policy set by the host" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} style={{ color: "#2563EB" }} />
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
            <p style={{ fontSize: 20, fontWeight: 900, color: "#2563EB", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              {listings[0]?.price_per_unit
                ? <>{formatCurrency(listings[0].price_per_unit)}<span style={{ fontSize: 11, color: "#9E9E9E", fontWeight: 400 }}>/{listings[0].unit_label || "night"}</span></>
                : "Contact for rates"}
            </p>
          </div>
          <button
            onClick={() => { if (!user) { router.push(`/login?redirect=/apartments/${id}`); return; } setSelectedListingId(listings[0]?.id || null); setShowBooking(true); }}
            style={{ padding: "14px 28px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(37,99,235,0.35)" }}>
            Book Now
          </button>
        </div>
      </div>

      {/* Booking Sheet */}
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
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>Book Stay</h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>{selectedListing?.title || vendor.business_name}</p>
                  </div>
                  <button onClick={() => { setShowBooking(false); bookMutation.reset(); }}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
                <div style={{ backgroundColor: "#DBEAFE", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#1D4ED8" }}>Wallet balance</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#1D4ED8" }}>{formatCurrency(walletBalance || 0)}</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>

                  {listings.length > 1 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Select Unit</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {listings.map((l: any) => {
                          const sel = l.id === (selectedListingId || listings[0]?.id);
                          return (
                            <button key={l.id} onClick={() => setSelectedListingId(l.id)}
                              style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: "2px solid", borderColor: sel ? "#2563EB" : "#E4DCF0", backgroundColor: sel ? "#DBEAFE" : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{l.title}</p>
                                {l.room_type && <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 600 }}>{l.room_type}</span>}
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 900, color: "#2563EB", flexShrink: 0, marginLeft: 8 }}>
                                {formatCurrency(l.price_per_unit)}<span style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 400 }}>/{l.unit_label || "night"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedListing?.min_nights > 1 && (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                      <AlertCircle size={13} style={{ color: "#D97706", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                        Minimum stay: {selectedListing.min_nights} night{selectedListing.min_nights !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, overflow: "hidden", border: "1.5px solid #E4DCF0" }}>
                    <div style={{ padding: "14px", borderBottom: "1px solid #E4DCF0" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Check-in</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} style={{ color: "#2563EB", flexShrink: 0 }} />
                        <input type="date" min={minCheckIn} value={checkIn}
                          onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(""); }}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    </div>
                    <div style={{ padding: "14px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Check-out</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} style={{ color: "#2563EB", flexShrink: 0 }} />
                        <input type="date" min={minCheckOut} value={checkOut}
                          onChange={e => setCheckOut(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    </div>
                  </div>

                  {numNights > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      style={{ backgroundColor: "#DBEAFE", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Moon size={14} style={{ color: "#2563EB" }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#2563EB" }}>{numNights} {unitLabel}{numNights !== 1 ? "s" : ""}</span>
                        {selectedListing?.min_nights > 1 && numNights < selectedListing.min_nights && (
                          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700 }}>· min {selectedListing.min_nights} required</span>
                        )}
                      </div>
                      {totalAmount > 0 && <span style={{ fontSize: 15, fontWeight: 900, color: "#2563EB" }}>{formatCurrency(totalAmount)}</span>}
                    </motion.div>
                  )}

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Guests</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                      <Users size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="number" min="1" max="20" placeholder="1"
                        value={guests} onChange={e => setGuests(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Phone Number <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${phoneErr ? "#EF4444" : "#E4DCF0"}`, borderRadius: 14, padding: "13px 14px" }}>
                      <Phone size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="tel" placeholder="08012345678 or 2348012345678"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setPhoneErr(""); }}
                        onBlur={() => { if (phone.trim() && !isValidNigerianPhone(phone)) setPhoneErr("Enter a valid Nigerian number e.g. 08012345678"); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                    {phoneErr && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0", fontWeight: 600 }}>{phoneErr}</p>}
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Special Occasion</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {SPECIAL_OCCASIONS.map(occ => (
                        <button key={occ} onClick={() => setSpecialOccasion(occ)}
                          style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: specialOccasion === occ ? "#2563EB" : "#E4DCF0", backgroundColor: specialOccasion === occ ? "#DBEAFE" : "#FFFFFF", color: specialOccasion === occ ? "#2563EB" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {occ}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Special Requests <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    <textarea placeholder="Early check-in, dietary needs, late checkout..."
                      value={notes} onChange={e => setNotes(e.target.value)} rows={2}
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
                {numNights > 0 && pricePerUnit > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                      {formatCurrency(pricePerUnit)} × {numNights} {unitLabel}{numNights !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>{formatCurrency(totalAmount)}</span>
                  </div>
                )}
                <button onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending || !canBook}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: bookMutation.isPending || !canBook ? "#9E9E9E" : "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: bookMutation.isPending || !canBook ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: canBook ? "0 4px 20px rgba(37,99,235,0.35)" : "none" }}>
                  {bookMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Confirming...</>
                    : <><CheckCircle size={18} />Confirm Booking{numNights > 0 && totalAmount > 0 ? ` — ${formatCurrency(totalAmount)}` : ""}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImages.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeLightbox}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={closeLightbox}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px", zIndex: 102 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{lightboxIndex + 1} / {lightboxImages.length}</span>
            </div>
            {lightboxIndex > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i - 1); }}
                style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF", transform: "rotate(180deg)" }} />
              </button>
            )}
            {lightboxIndex < lightboxImages.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i + 1); }}
                style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            <motion.img key={lightboxImages[lightboxIndex]} src={lightboxImages[lightboxIndex]}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }} />
            {lightboxImages.length > 1 && (
              <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {lightboxImages.map((_: any, i: number) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setLightboxIndex(i); }}
                    style={{ width: i === lightboxIndex ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === lightboxIndex ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
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