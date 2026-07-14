/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ArrowLeft, Star, MapPin, Navigation, Wifi, Car,
  Coffee, Waves, Dumbbell, Share2, Heart, CheckCircle,
  ChevronRight, Phone, Shield, X, Calendar, Moon,
  Users, AlertCircle, Building2, Play, ExternalLink,
  Mail, Zap, Wind, Tv, Snowflake, Camera, CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { reserveBookingAmount } from "@/lib/ledger";
import { format, differenceInDays, addDays } from "date-fns";

const ACCENT    = "#D97706";
const ACCENT_BG = "#FEF3C7";

const AMENITY_ICONS: Record<string, any> = {
  "WiFi": Wifi, "Parking": Car, "Pool": Waves, "Gym": Dumbbell,
  "Breakfast": Coffee, "Breakfast Included": Coffee,
  "AC": Wind, "Air Conditioning": Snowflake,
  "TV": Tv, "Generator": Zap,
  "Security": Shield, "CCTV": Shield,
};

const SPECIAL_OCCASIONS = [
  "None","Birthday","Anniversary","Honeymoon","Proposal",
  "Business Trip","Family Holiday","Other",
];

function detectVideoType(url: string) {
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
  const type  = detectVideoType(url);
  const ytId  = type === "youtube" ? getYouTubeId(url) : null;
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

export default function HotelDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [activeImage,       setActiveImage]       = useState(0);
  const [lightboxImages,    setLightboxImages]     = useState<string[]>([]);
  const [lightboxIndex,     setLightboxIndex]      = useState(0);
  const [showAllAmenities,  setShowAllAmenities]  = useState(false);
  const [showBooking,       setShowBooking]       = useState(false);
  const [pressing,          setPressing]          = useState(false);

  const [selectedRoomId,  setSelectedRoomId]  = useState<string|null>(null);
  const [checkIn,         setCheckIn]         = useState("");
  const [checkOut,        setCheckOut]        = useState("");
  const [guestCount,      setGuestCount]      = useState("1");
  const [numRooms,        setNumRooms]        = useState("1");
  const [specialOccasion, setSpecialOccasion] = useState("None");
  const [specialRequests, setSpecialRequests] = useState("");
  const [ninMode,         setNinMode]         = useState<"nin"|"upload">("nin");
  const [ninNumber,       setNinNumber]       = useState("");
  const [idImageUrl,      setIdImageUrl]      = useState("");
  const [idUploading,     setIdUploading]     = useState(false);
  const [availError,      setAvailError]      = useState("");
  const [whatsappNumber,  setWhatsappNumber]  = useState("");
  const [whatsappErr,     setWhatsappErr]     = useState("");

  const pressTimer = useRef<ReturnType<typeof setInterval>|null>(null);
  const pressStart = useRef<ReturnType<typeof setTimeout>|null>(null);

  const openLightbox  = (imgs: string[], idx: number) => { setLightboxImages(imgs); setLightboxIndex(idx); };
  const closeLightbox = () => setLightboxImages([]);

  const startPress = useCallback((imgs: string[]) => {
    if (imgs.length <= 1) return;
    pressStart.current = setTimeout(() => {
      setPressing(true);
      pressTimer.current = setInterval(() => setActiveImage(i => (i + 1) % imgs.length), 800);
    }, 300);
  }, []);
  const endPress = useCallback(() => {
    if (pressStart.current) clearTimeout(pressStart.current);
    if (pressTimer.current) clearInterval(pressTimer.current);
    setPressing(false);
  }, []);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["hotel-detail", id],
    queryFn: async () => {
      const { data: venue } = await (supabase.from("venues") as any)
        .select("id,name,description,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,contact_email,website,videos,category")
        .eq("id", id).maybeSingle();

      if (venue?.id) {
        let vendorRow: any = null;
        if (venue.vendor_id) {
          const { data } = await (supabase.from("vendors") as any)
            .select("id,business_name,description,vendor_type")
            .eq("id", venue.vendor_id).maybeSingle();
          vendorRow = data;
        }
        const { data: rooms } = await (supabase.from("vendor_listings") as any)
          .select("id,title,description,price_per_unit,unit_label,images,amenities,room_type,min_nights,available_units,max_bookings_per_day,checkin_time,checkout_time,availability,is_active,blocked_dates")
          .eq("vendor_id", venue.vendor_id).eq("is_active", true)
          .order("price_per_unit", { ascending: true });
        const minPrice = (rooms||[]).reduce((min: number, r: any) =>
          r.price_per_unit < min ? r.price_per_unit : min,
          (rooms||[])[0]?.price_per_unit || 0
        );
        return {
          id:             vendorRow?.id || venue.vendor_id,
          business_name:  vendorRow?.business_name || venue.name,
          description:    vendorRow?.description || venue.description || null,
          vendor_type:    vendorRow?.vendor_type || "hotel",
          starting_price: minPrice || null,
          venue,
          rooms: rooms || [],
        };
      }

      const { data: vendorData } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,vendor_type")
        .eq("id", id).maybeSingle();
      if (!vendorData?.id) return null;

      const { data: venueData } = await (supabase.from("venues") as any)
        .select("id,name,description,address,images,rating,review_count,filters,lat,lng,vendor_id,phone,whatsapp,instagram,contact_email,website,videos,category")
        .eq("vendor_id", vendorData.id).maybeSingle();
      const { data: rooms } = await (supabase.from("vendor_listings") as any)
        .select("id,title,description,price_per_unit,unit_label,images,amenities,room_type,min_nights,available_units,max_bookings_per_day,checkin_time,checkout_time,availability,is_active,blocked_dates")
        .eq("vendor_id", vendorData.id).eq("is_active", true)
        .order("price_per_unit", { ascending: true });
      const minPrice = (rooms||[]).reduce((min: number, r: any) =>
        r.price_per_unit < min ? r.price_per_unit : min,
        (rooms||[])[0]?.price_per_unit || 0
      );
      return {
        ...vendorData,
        description: vendorData.description || venueData?.description || null,
        starting_price: minPrice || null,
        venue: venueData || {},
        rooms: rooms || [],
      };
    },
    staleTime: 1000 * 60,
  });

  const { data: reviews } = useQuery({
    queryKey: ["hotel-reviews", id],
    queryFn: async () => {
      const venueId = vendor?.venue?.id;
      if (!venueId) return [];
      const { data } = await (supabase.from("reviews") as any)
        .select("*,users(full_name,avatar_url)")
        .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(5);
      return (data||[]) as any[];
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
      return ((data||[]) as any[]).reduce(
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
      if (!user?.id) { router.push(`/login?redirect=/hotel/${id}`); return; }
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
      qc.invalidateQueries({ queryKey: ["saved-venues", user?.id, "hotel"] });
    },
  });

  const venue        = vendor?.venue || {};
  const rooms        = vendor?.rooms || [];
  const heroImages   = venue.images?.length ? venue.images : rooms.flatMap((r: any) => r.images || []);
  const amenities    = venue.filters || [];
  const videoUrls    = (venue.videos || []).filter(Boolean) as string[];
  const pricePerNight = vendor?.starting_price || 0;
  const isVendorUser  = user?.id && venue?.vendor_id && user.id === venue?.vendor_id;

  const selectedRoom  = rooms.find((r: any) => r.id === selectedRoomId) || rooms[0];
  const roomPrice     = selectedRoom?.price_per_unit || pricePerNight;
  const minNights     = selectedRoom?.min_nights || 1;

  const numNights   = checkIn && checkOut ? Math.max(0, differenceInDays(new Date(checkOut), new Date(checkIn))) : 0;
  const roomCount   = Number(numRooms) || 1;
  const totalAmount = roomPrice > 0 && numNights > 0 ? roomPrice * numNights * roomCount : 0;

  const minCheckIn  = format(new Date(), "yyyy-MM-dd");
  const minCheckOut = checkIn
    ? format(addDays(new Date(checkIn), minNights), "yyyy-MM-dd")
    : format(addDays(new Date(), 1), "yyyy-MM-dd");

  const ratingLabel =
    (venue.rating||0) >= 4.5 ? "Exceptional" :
    (venue.rating||0) >= 4   ? "Very Good"   :
    (venue.rating||0) >= 3.5 ? "Good"        : "Pleasant";

  const idValid = ninMode === "nin"
    ? ninNumber.trim().length === 11 && /^\d+$/.test(ninNumber.trim())
    : !!idImageUrl;

  const whatsappValid = whatsappNumber.replace(/\D/g, "").length >= 10;
  const canBook = !!checkIn && !!checkOut && numNights >= minNights && idValid && whatsappValid;

  const checkAvailability = async (): Promise<boolean> => {
    setAvailError("");
    if (!selectedRoom?.id || !checkIn || !checkOut) return true;
    const blockedDates: string[] = selectedRoom.blocked_dates || [];
    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    for (let d = new Date(checkInDate); d < checkOutDate; d = addDays(d, 1)) {
      if (blockedDates.includes(format(d, "yyyy-MM-dd"))) {
        setAvailError(`This room is unavailable on ${format(d, "d MMM yyyy")}. Please choose different dates.`);
        return false;
      }
    }
    const maxPerDay  = selectedRoom.max_bookings_per_day || 1;
    const availUnits = selectedRoom.available_units || 1;
    const { data: existingBookings } = await (supabase.from("bookings") as any)
      .select("id,checkin_date,checkout_date")
      .eq("listing_id", selectedRoom.id)
      .in("status", ["confirmed", "pending"])
      .gte("checkout_date", new Date(checkIn).toISOString())
      .lte("checkin_date", new Date(checkOut).toISOString());
    const overlapping = (existingBookings || []).length;
    if (overlapping >= Math.min(maxPerDay, availUnits)) {
      setAvailError("This room is fully booked for your selected dates. Please choose different dates or a different room.");
      return false;
    }
    return true;
  };

  const handleIdUpload = async (file: File) => {
    setIdUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `id-verification/${user?.id||"guest"}_${Date.now()}.${ext}`;
      await supabase.storage.from("chillz-images").upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from("chillz-images").getPublicUrl(path);
      setIdImageUrl(urlData.publicUrl);
    } catch (e: any) {
      console.error("ID upload failed:", e.message);
    } finally {
      setIdUploading(false);
    }
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !vendor) throw new Error("Not authenticated");
      if (!checkIn)          throw new Error("Please select a check-in date");
      if (!checkOut)         throw new Error("Please select a check-out date");
      if (numNights < 1)     throw new Error("Check-out must be after check-in");
      if (numNights < minNights) throw new Error(`Minimum stay is ${minNights} night${minNights !== 1 ? "s" : ""}`);
      if (!idValid)          throw new Error(ninMode === "nin" ? "Please enter a valid 11-digit NIN" : "Please upload a valid ID document");
      const available = await checkAvailability();
      if (!available) throw new Error(availError || "Room not available for selected dates");
      const amount = totalAmount > 0 ? totalAmount : 5000;
      if (amount > (walletBalance||0)) throw new Error("Insufficient wallet balance. Fund your wallet first.");
      const qrHash = generateQRHash();
      const { data: booking, error } = await (supabase.from("bookings") as any)
        .insert({
          user_id:           user.id,
          venue_id:          venue.id || null,
          vendor_id:         vendor.id,
          listing_id:        selectedRoom?.id || null,
          status:            "confirmed",
          reserved_amount:   amount,
          qr_code_hash:      qrHash,
          booking_date:      new Date(checkIn).toISOString(),
          checkin_date:      new Date(checkIn).toISOString(),
          checkout_date:     new Date(checkOut).toISOString(),
          num_nights:        numNights,
          num_rooms:         roomCount,
          guest_count:       Number(guestCount) || 1,
          package_name:      selectedRoom?.title || selectedRoom?.room_type || null,
          package_price:     roomPrice || null,
          special_occasion:  specialOccasion !== "None" ? specialOccasion : null,
          notes: specialRequests.trim() || null,
          phone: whatsappNumber.trim() || null,
          id_document_url:   ninMode === "upload" ? idImageUrl : null,
          nin_number:        ninMode === "nin" ? ninNumber.trim() : null,
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
    const url  = `${window.location.origin}/hotel/${id}`;
    const name = vendor?.business_name || "this hotel";
    if (navigator.share) await navigator.share({ title: name, text: `Check out ${name} on Chillz`, url });
    else await navigator.clipboard.writeText(url);
  };

  if (isLoading) return (
    <MainLayout>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
        <div style={{ width:28, height:28, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!vendor) return (
    <MainLayout>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:12 }}>
        <p style={{ color:"#6B6B6B", fontSize:14 }}>Hotel not found.</p>
        <button onClick={() => router.back()} style={{ backgroundColor:ACCENT, color:"#FFFFFF", border:"none", borderRadius:12, padding:"10px 24px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Go Back</button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>

      {/* ── Hero ── */}
      <div
        style={{ position:"relative", height:300, backgroundColor:ACCENT_BG, overflow:"hidden", userSelect:"none" }}
        onMouseDown={() => startPress(heroImages)} onMouseUp={endPress} onMouseLeave={endPress}
        onTouchStart={() => startPress(heroImages)} onTouchEnd={endPress} onTouchCancel={endPress}
      >
        {heroImages.length > 0
          ? <img src={heroImages[activeImage]} alt={vendor.business_name}
              onClick={() => { if (!pressing) openLightbox(heroImages, activeImage); }}
              style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"pointer" }}
              draggable={false} />
          : <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#78350F,#D97706)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:60 }}>🏨</span>
            </div>}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,rgba(0,0,0,0.3) 0%,transparent 40%,rgba(0,0,0,0.5) 100%)", pointerEvents:"none" }} />

        {!pressing && heroImages.length > 1 && (
          <div style={{ position:"absolute", top:8, right:10, backgroundColor:"rgba(0,0,0,0.45)", borderRadius:999, padding:"2px 8px" }}>
            <span style={{ fontSize:9, fontWeight:700, color:"#FFFFFF" }}>Hold to browse</span>
          </div>
        )}
        {pressing && heroImages.length > 1 && (
          <div style={{ position:"absolute", top:8, left:0, right:0, display:"flex", justifyContent:"center", gap:4 }}>
            {heroImages.map((_: any, i: number) => (
              <div key={i} style={{ width:i===activeImage?16:5, height:5, borderRadius:999, backgroundColor:i===activeImage?"#FFFFFF":"rgba(255,255,255,0.45)", transition:"width 0.2s" }} />
            ))}
          </div>
        )}

        <div style={{ position:"absolute", top:0, left:0, right:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px" }}>
          <button onClick={() => router.back()} style={{ width:38, height:38, borderRadius:12, backgroundColor:"rgba(255,255,255,0.2)", backdropFilter:"blur(8px)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <ArrowLeft size={20} style={{ color:"#FFFFFF" }} />
          </button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => saveMutation.mutate()} style={{ width:38, height:38, borderRadius:12, backgroundColor:"rgba(255,255,255,0.2)", backdropFilter:"blur(8px)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Heart size={18} style={{ color:isSaved?"#FF4B6E":"#FFFFFF", fill:isSaved?"#FF4B6E":"none" }} />
            </button>
            <button onClick={handleShare} style={{ width:38, height:38, borderRadius:12, backgroundColor:"rgba(255,255,255,0.2)", backdropFilter:"blur(8px)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Share2 size={18} style={{ color:"#FFFFFF" }} />
            </button>
          </div>
        </div>

        {heroImages.length > 1 && !pressing && (
          <>
            <div style={{ position:"absolute", bottom:14, left:0, right:0, display:"flex", justifyContent:"center", gap:6 }}>
              {heroImages.map((_: any, i: number) => (
                <div key={i} style={{ width:i===activeImage?20:6, height:6, borderRadius:999, backgroundColor:i===activeImage?"#FFFFFF":"rgba(255,255,255,0.4)" }} />
              ))}
            </div>
            <button onClick={() => openLightbox(heroImages, activeImage)}
              style={{ position:"absolute", bottom:12, right:12, backgroundColor:"rgba(0,0,0,0.55)", borderRadius:999, padding:"4px 10px", border:"none", cursor:"pointer" }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#FFFFFF" }}>{activeImage+1}/{heroImages.length} · View all</span>
            </button>
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ backgroundColor:"#FFFFFF", borderRadius:"24px 24px 0 0", marginTop:-16, padding:"20px 16px 0", position:"relative", zIndex:1 }}>

        <div style={{ marginBottom:14 }}>
          <h1 style={{ fontSize:22, fontWeight:900, color:"#0A0A0A", margin:"0 0 8px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>
            {vendor.business_name}
          </h1>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, fontWeight:700, color:ACCENT, backgroundColor:ACCENT_BG, padding:"3px 9px", borderRadius:999 }}>🏨 Hotel</span>
            {(venue.rating||0) > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ backgroundColor:ACCENT, borderRadius:8, padding:"3px 8px" }}>
                  <span style={{ fontSize:12, fontWeight:800, color:"#FFFFFF" }}>{Number(venue.rating).toFixed(1)}</span>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:"#0A0A0A" }}>{ratingLabel}</span>
                {(venue.review_count||0) > 0 && <span style={{ fontSize:12, color:"#9E9E9E" }}>· {venue.review_count} reviews</span>}
              </div>
            )}
          </div>
        </div>

        {venue.address && (
          <div style={{ backgroundColor:"#F7F5FA", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <div style={{ width:36, height:36, borderRadius:10, backgroundColor:ACCENT_BG, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <MapPin size={16} style={{ color:ACCENT }} />
            </div>
            <p style={{ fontSize:13, color:"#0A0A0A", margin:0, flex:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{venue.address}</p>
            {venue.lat !== null && venue.lat !== undefined && venue.lng !== null && venue.lng !== undefined && venue.lat !== 0 && venue.lng !== 0 && (
              <button onClick={() => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) window.open(`maps://?daddr=${venue.lat},${venue.lng}`, "_blank");
                else window.open(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`, "_blank");
              }} style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:ACCENT, color:"#FFFFFF", border:"none", borderRadius:999, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                <Navigation size={11} />Go
              </button>
            )}
          </div>
        )}

        {vendor.description && (
          <>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 8px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>About this Hotel</h3>
            <p style={{ fontSize:13, color:"#6B6B6B", lineHeight:1.7, margin:"0 0 20px" }}>{vendor.description}</p>
          </>
        )}

        {amenities.length > 0 && (
          <>
            <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 12px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>Facilities</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {(showAllAmenities ? amenities : amenities.slice(0,6)).map((a: string) => {
                const Icon = AMENITY_ICONS[a] || CheckCircle;
                return (
                  <div key={a} style={{ display:"flex", alignItems:"center", gap:8, backgroundColor:"#F7F5FA", borderRadius:12, padding:"10px 12px" }}>
                    <Icon size={14} style={{ color:ACCENT, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:"#0A0A0A", fontWeight:500 }}>{a}</span>
                  </div>
                );
              })}
            </div>
            {amenities.length > 6 && (
              <button onClick={() => setShowAllAmenities(!showAllAmenities)}
                style={{ background:"none", border:"none", cursor:"pointer", color:ACCENT, fontSize:13, fontWeight:700, padding:"4px 0 18px", display:"flex", alignItems:"center", gap:4 }}>
                {showAllAmenities ? "Show less" : `Show all ${amenities.length} facilities`}
                <ChevronRight size={14} style={{ transform:showAllAmenities?"rotate(90deg)":"none", transition:"0.2s" }} />
              </button>
            )}
            {!showAllAmenities && <div style={{ marginBottom:18 }} />}
          </>
        )}

        {videoUrls.length > 0 && (
          <>
            <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 4px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>Watch Before You Book</h3>
            <p style={{ fontSize:12, color:"#9E9E9E", margin:"0 0 12px" }}>See the property and rooms up close</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
              {videoUrls.map((url, i) => <VideoCard key={i} url={url} />)}
            </div>
          </>
        )}

        {rooms.length > 0 && (
          <>
            <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 12px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>
              Rooms & Suites <span style={{ fontSize:12, fontWeight:600, color:"#9E9E9E" }}>({rooms.length})</span>
            </h3>
            <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:18 }}>
              {rooms.map((room: any) => {
                const imgs    = room.images  || [];
                const roomAmenities = room.amenities || [];
                const avail   = room.availability || {};
                return (
                  <div key={room.id} style={{ backgroundColor:"#F7F5FA", borderRadius:18, overflow:"hidden", border:"1.5px solid #E4DCF0" }}>
                    {imgs.length > 0 && (
                      <div style={{ height:160, overflow:"hidden", position:"relative" }}>
                        <img src={imgs[0]} alt={room.title}
                          onClick={() => openLightbox(imgs, 0)}
                          style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"pointer" }} />
                        {imgs.length > 1 && (
                          <div style={{ position:"absolute", top:8, right:8, backgroundColor:"rgba(0,0,0,0.55)", borderRadius:999, padding:"3px 9px" }}>
                            <span style={{ fontSize:10, fontWeight:700, color:"#FFFFFF" }}>{imgs.length} photos</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ padding:"14px" }}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:10 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontWeight:800, fontSize:15, color:"#0A0A0A", margin:"0 0 4px" }}>{room.title}</p>
                          {room.room_type && (
                            <span style={{ fontSize:11, fontWeight:600, color:ACCENT, backgroundColor:ACCENT_BG, padding:"2px 8px", borderRadius:999 }}>{room.room_type}</span>
                          )}
                          {room.description && <p style={{ fontSize:12, color:"#6B6B6B", margin:"6px 0 0", lineHeight:1.4 }}>{room.description}</p>}
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ fontSize:18, fontWeight:900, color:ACCENT, margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>{formatCurrency(room.price_per_unit)}</p>
                          <p style={{ fontSize:10, color:"#9E9E9E", margin:"1px 0 0" }}>per {room.unit_label||"night"}</p>
                          {room.min_nights > 1 && <p style={{ fontSize:10, color:"#F59E0B", margin:"2px 0 0", fontWeight:600 }}>Min {room.min_nights} nights</p>}
                        </div>
                      </div>

                      {(avail.bedrooms || avail.bathrooms || avail.max_guests || room.checkin_time) && (
                        <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                          {avail.bedrooms && (
                            <div style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:8, padding:"4px 9px" }}>
                              <Building2 size={10} style={{ color:ACCENT }} />
                              <span style={{ fontSize:10, fontWeight:600, color:"#0A0A0A" }}>{avail.bedrooms} bed{avail.bedrooms!==1?"s":""}</span>
                            </div>
                          )}
                          {avail.bathrooms && (
                            <div style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:8, padding:"4px 9px" }}>
                              <Waves size={10} style={{ color:ACCENT }} />
                              <span style={{ fontSize:10, fontWeight:600, color:"#0A0A0A" }}>{avail.bathrooms} bath{avail.bathrooms!==1?"s":""}</span>
                            </div>
                          )}
                          {avail.max_guests && (
                            <div style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:8, padding:"4px 9px" }}>
                              <Users size={10} style={{ color:ACCENT }} />
                              <span style={{ fontSize:10, fontWeight:600, color:"#0A0A0A" }}>Max {avail.max_guests}</span>
                            </div>
                          )}
                          {(room.checkin_time || room.checkout_time) && (
                            <div style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:8, padding:"4px 9px" }}>
                              <Moon size={10} style={{ color:ACCENT }} />
                              <span style={{ fontSize:10, fontWeight:600, color:"#0A0A0A" }}>{room.checkin_time}–{room.checkout_time}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {roomAmenities.length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                          {roomAmenities.slice(0,5).map((a: string) => (
                            <div key={a} style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:8, padding:"4px 9px" }}>
                              <CheckCircle size={10} style={{ color:ACCENT, flexShrink:0 }} />
                              <span style={{ fontSize:10, fontWeight:600, color:"#0A0A0A" }}>{a}</span>
                            </div>
                          ))}
                          {roomAmenities.length > 5 && <span style={{ fontSize:10, color:"#9E9E9E", alignSelf:"center" }}>+{roomAmenities.length-5} more</span>}
                        </div>
                      )}

                      {isVendorUser ? (
                        <div style={{ backgroundColor:"#F7F5FA", borderRadius:12, padding:"10px 14px", textAlign:"center" }}>
                          <p style={{ fontSize:12, color:"#9E9E9E", margin:0 }}>Vendor accounts cannot make bookings</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            if (!user) { router.push(`/login?redirect=/hotel/${id}`); return; }
                            setShowBooking(true);
                          }}
                          style={{ width:"100%", padding:"12px 0", borderRadius:14, border:"none", background:`linear-gradient(135deg,#B45309,${ACCENT})`, color:"#FFFFFF", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 3px 12px rgba(217,119,6,0.3)" }}>
                          Book This Room
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(venue.phone || venue.whatsapp || venue.contact_email || venue.instagram || venue.website) && (
          <>
            <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 12px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>Contact</h3>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
              {venue.whatsapp && (
                <a href={`https://wa.me/${venue.whatsapp.replace(/[^0-9]/g,"")}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:7, backgroundColor:"#E0F7EA", border:"1px solid #A7F3D0", borderRadius:12, padding:"10px 14px" }}>
                  <span style={{ fontSize:16 }}>💬</span><span style={{ fontSize:12, fontWeight:700, color:"#059669" }}>WhatsApp</span>
                </a>
              )}
              {venue.phone && (
                <a href={`tel:${venue.phone}`} style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:7, backgroundColor:ACCENT_BG, border:"1px solid #FDE68A", borderRadius:12, padding:"10px 14px" }}>
                  <Phone size={13} style={{ color:ACCENT }} /><span style={{ fontSize:12, fontWeight:700, color:ACCENT }}>Call</span>
                </a>
              )}
              {venue.contact_email && (
                <a href={`mailto:${venue.contact_email}`} style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:7, backgroundColor:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:12, padding:"10px 14px" }}>
                  <Mail size={13} style={{ color:"#2563EB" }} /><span style={{ fontSize:12, fontWeight:700, color:"#2563EB" }}>Email</span>
                </a>
              )}
              {venue.instagram && (
                <a href={`https://instagram.com/${venue.instagram.replace(/^@/,"")}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:7, backgroundColor:"#FDF2F8", border:"1px solid #F9A8D4", borderRadius:12, padding:"10px 14px" }}>
                  <span style={{ fontSize:14 }}>📸</span><span style={{ fontSize:12, fontWeight:700, color:"#C13584" }}>Instagram</span>
                </a>
              )}
              {venue.website && (
                <a href={venue.website.startsWith("http") ? venue.website : `https://${venue.website}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:7, backgroundColor:"#F7F5FA", border:"1px solid #E4DCF0", borderRadius:12, padding:"10px 14px" }}>
                  <span style={{ fontSize:14 }}>🌐</span><span style={{ fontSize:12, fontWeight:700, color:"#6B6B6B" }}>Website</span>
                </a>
              )}
            </div>
          </>
        )}

        {reviews && reviews.length > 0 && (
          <>
            <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 12px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>What Guests Say</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
              {reviews.map((review: any) => (
                <div key={review.id} style={{ backgroundColor:"#F7F5FA", borderRadius:16, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", backgroundColor:ACCENT_BG, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                        {review.users?.avatar_url
                          ? <img src={review.users.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : <span style={{ fontSize:12, fontWeight:700, color:ACCENT }}>{review.users?.full_name?.[0]}</span>}
                      </div>
                      <span style={{ fontWeight:600, fontSize:12, color:"#0A0A0A" }}>{review.users?.full_name||"Guest"}</span>
                    </div>
                    <div style={{ display:"flex", gap:2 }}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} style={{ color:s<=review.rating?"#FBBF24":"#E4DCF0", fill:s<=review.rating?"#FBBF24":"#E4DCF0" }} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p style={{ fontSize:12, color:"#6B6B6B", lineHeight:1.5, margin:0, fontStyle:"italic" }}>"{review.comment}"</p>}
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginBottom:120 }}>
          <div style={{ height:1, backgroundColor:"#F2EEF9", margin:"0 0 18px" }} />
          <h3 style={{ fontSize:15, fontWeight:800, color:"#0A0A0A", margin:"0 0 12px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>Booking Policies</h3>
          {[
            { icon:Shield,      text:"Secure payment via Chillz wallet" },
            { icon:CheckCircle, text:"Instant booking confirmation" },
            { icon:CreditCard,  text:"Valid ID or NIN required at check-in" },
            { icon:AlertCircle, text:"Cancellation policy set by the hotel" },
          ].map(({ icon:Icon, text }) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:9, backgroundColor:ACCENT_BG, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={14} style={{ color:ACCENT }} />
              </div>
              <span style={{ fontSize:13, color:"#6B6B6B" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ position:"fixed", bottom:72, left:0, right:0, padding:"12px 16px", backgroundColor:"rgba(255,255,255,0.97)", backdropFilter:"blur(8px)", borderTop:"1px solid #F2EEF9", maxWidth:480, margin:"0 auto", zIndex:40 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:11, color:"#9E9E9E", margin:"0 0 2px" }}>Starting from</p>
            <p style={{ fontSize:20, fontWeight:900, color:ACCENT, margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>
              {pricePerNight > 0
                ? <>{formatCurrency(pricePerNight)}<span style={{ fontSize:11, color:"#9E9E9E", fontWeight:400 }}>/night</span></>
                : "Contact for rates"}
            </p>
          </div>
          {isVendorUser ? (
            <div style={{ backgroundColor:"#F7F5FA", borderRadius:14, padding:"10px 18px" }}>
              <p style={{ fontSize:12, color:"#9E9E9E", margin:0 }}>Vendor account</p>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!user) { router.push(`/login?redirect=/hotel/${id}`); return; }
                setSelectedRoomId(rooms[0]?.id||null);
                setShowBooking(true);
              }}
              style={{ padding:"14px 28px", borderRadius:16, border:"none", background:`linear-gradient(135deg,#B45309,${ACCENT})`, color:"#FFFFFF", fontSize:15, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(217,119,6,0.35)" }}>
              Book Now
            </button>
          )}
        </div>
      </div>

      {/* ── Booking Sheet ── */}
      <AnimatePresence>
        {showBooking && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setShowBooking(false); bookMutation.reset(); setAvailError(""); }}
              style={{ position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.5)", zIndex:50 }} />
            <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:30, stiffness:300 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:51, backgroundColor:"#FFFFFF", borderRadius:"24px 24px 0 0", maxWidth:480, margin:"0 auto", maxHeight:"92vh", display:"flex", flexDirection:"column" }}>

              <div style={{ padding:"20px 20px 0", flexShrink:0 }}>
                <div style={{ width:40, height:4, backgroundColor:"#E4DCF0", borderRadius:999, margin:"0 auto 16px" }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div>
                    <h3 style={{ fontSize:18, fontWeight:900, color:"#0A0A0A", margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>Reserve a Room</h3>
                    <p style={{ fontSize:12, color:"#9E9E9E", margin:0 }}>{vendor.business_name}</p>
                  </div>
                  <button onClick={() => { setShowBooking(false); bookMutation.reset(); setAvailError(""); }}
                    style={{ width:32, height:32, borderRadius:10, backgroundColor:"#F2EEF9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <X size={16} style={{ color:"#6B6B6B" }} />
                  </button>
                </div>
                <div style={{ backgroundColor:"#F2EEF9", borderRadius:14, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:"#6B6B6B" }}>Wallet balance</span>
                  <span style={{ fontSize:14, fontWeight:900, color:ACCENT }}>{formatCurrency(walletBalance||0)}</span>
                </div>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"12px 20px 0" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:20 }}>

                  {rooms.length > 1 && (
                    <div>
                      <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 8px" }}>Select Room</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                        {rooms.map((r: any) => {
                          const sel = r.id === (selectedRoomId||rooms[0]?.id);
                          return (
                            <button key={r.id} onClick={() => { setSelectedRoomId(r.id); setAvailError(""); }}
                              style={{ width:"100%", padding:"11px 14px", borderRadius:14, border:"2px solid", borderColor:sel?ACCENT:"#E4DCF0", backgroundColor:sel?ACCENT_BG:"#FFFFFF", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ fontWeight:700, fontSize:13, color:"#0A0A0A", margin:"0 0 2px", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{r.title}</p>
                                {r.room_type && <span style={{ fontSize:10, color:ACCENT, fontWeight:600 }}>{r.room_type}</span>}
                              </div>
                              <span style={{ fontSize:14, fontWeight:900, color:ACCENT, flexShrink:0, marginLeft:8 }}>
                                {formatCurrency(r.price_per_unit)}<span style={{ fontSize:10, color:"#9E9E9E", fontWeight:400 }}>/night</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ backgroundColor:"#F7F5FA", borderRadius:16, overflow:"hidden", border:"1.5px solid #E4DCF0" }}>
                    <div style={{ padding:"14px", borderBottom:"1px solid #E4DCF0" }}>
                      <p style={{ fontSize:10, fontWeight:700, color:"#9E9E9E", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>Check-in</p>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Calendar size={16} style={{ color:ACCENT, flexShrink:0 }} />
                        <input type="date" min={minCheckIn} value={checkIn}
                          onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(""); setAvailError(""); }}
                          style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, fontWeight:700, color:"#0A0A0A", fontFamily:"inherit" }} />
                      </div>
                    </div>
                    <div style={{ padding:"14px" }}>
                      <p style={{ fontSize:10, fontWeight:700, color:"#9E9E9E", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>Check-out</p>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Calendar size={16} style={{ color:ACCENT, flexShrink:0 }} />
                        <input type="date" min={minCheckOut} value={checkOut}
                          onChange={e => { setCheckOut(e.target.value); setAvailError(""); }}
                          style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, fontWeight:700, color:"#0A0A0A", fontFamily:"inherit" }} />
                      </div>
                    </div>
                  </div>

                  {numNights > 0 && (
                    <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                      style={{ backgroundColor:ACCENT_BG, borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <Moon size={14} style={{ color:ACCENT }} />
                        <span style={{ fontSize:13, fontWeight:700, color:ACCENT }}>{numNights} night{numNights!==1?"s":""}</span>
                        {numNights < minNights && <span style={{ fontSize:11, color:"#EF4444", fontWeight:600 }}>· min {minNights}</span>}
                      </div>
                      {totalAmount > 0 && (
                        <span style={{ fontSize:15, fontWeight:900, color:ACCENT, fontFamily:"var(--font-display,Syne,sans-serif)" }}>{formatCurrency(totalAmount)}</span>
                      )}
                    </motion.div>
                  )}

                  {availError && (
                    <div style={{ backgroundColor:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
                      <AlertCircle size={14} style={{ color:"#EF4444", flexShrink:0 }} />
                      <p style={{ fontSize:12, color:"#EF4444", margin:0 }}>{availError}</p>
                    </div>
                  )}

                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>Guests</p>
                      <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#F7F5FA", border:"1.5px solid #E4DCF0", borderRadius:14, padding:"13px 14px" }}>
                        <Users size={16} style={{ color:"#9E9E9E", flexShrink:0 }} />
                        <input type="number" min="1" max="20" placeholder="1" value={guestCount}
                          onChange={e => setGuestCount(e.target.value)}
                          style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }} />
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>Rooms</p>
                      <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#F7F5FA", border:"1.5px solid #E4DCF0", borderRadius:14, padding:"13px 14px" }}>
                        <Building2 size={16} style={{ color:"#9E9E9E", flexShrink:0 }} />
                        <input type="number" min="1" max="20" placeholder="1" value={numRooms}
                          onChange={e => setNumRooms(e.target.value)}
                          style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 8px" }}>Special Occasion</p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {SPECIAL_OCCASIONS.map(occ => (
                        <button key={occ} onClick={() => setSpecialOccasion(occ)}
                          style={{ padding:"6px 12px", borderRadius:999, border:"1.5px solid", borderColor:specialOccasion===occ?ACCENT:"#E4DCF0", backgroundColor:specialOccasion===occ?ACCENT_BG:"#FFFFFF", color:specialOccasion===occ?ACCENT:"#6B6B6B", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          {occ}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>
                      Special Requests <span style={{ fontWeight:400, color:"#C4BAD8", textTransform:"none" }}>(optional)</span>
                    </p>
                    <textarea placeholder="Early check-in, high floor, dietary requirements..." value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)} rows={2}
                      style={{ width:"100%", backgroundColor:"#F7F5FA", border:"1.5px solid #E4DCF0", borderRadius:14, padding:"12px 14px", fontSize:14, color:"#0A0A0A", outline:"none", fontFamily:"inherit", resize:"none", lineHeight:1.5, boxSizing:"border-box" }} />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>
                      WhatsApp Number <span style={{ color:"#EF4444" }}>*</span>
                    </p>
                    <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#F7F5FA", border:`1.5px solid ${whatsappErr ? "#EF4444" : whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 ? "#00C853" : "#E4DCF0"}`, borderRadius:14, padding:"13px 14px" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>💬</span>
                      <input
                        type="tel"
                        placeholder="08012345678 or 2348012345678"
                        value={whatsappNumber}
                        onChange={e => { setWhatsappNumber(e.target.value); setWhatsappErr(""); }}
                        onBlur={() => {
                          const digits = whatsappNumber.replace(/\D/g,"");
                          if (whatsappNumber.trim() && digits.length < 10) setWhatsappErr("Enter a valid WhatsApp number");
                        }}
                        style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }}
                      />
                      {whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 && (
                        <CheckCircle size={16} style={{ color:"#00C853", flexShrink:0 }} />
                      )}
                    </div>
                    {whatsappErr && <p style={{ fontSize:11, color:"#EF4444", margin:"4px 0 0", fontWeight:600 }}>{whatsappErr}</p>}
                    <p style={{ fontSize:11, color:"#9E9E9E", margin:"5px 0 0" }}>The hotel will contact you on this number</p>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>
                      WhatsApp Number <span style={{ color:"#EF4444" }}>*</span>
                    </p>
                    <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#F7F5FA", border:`1.5px solid ${whatsappErr ? "#EF4444" : whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 ? "#00C853" : "#E4DCF0"}`, borderRadius:14, padding:"13px 14px" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>💬</span>
                      <input
                        type="tel"
                        placeholder="08012345678 or 2348012345678"
                        value={whatsappNumber}
                        onChange={e => { setWhatsappNumber(e.target.value); setWhatsappErr(""); }}
                        onBlur={() => {
                          const digits = whatsappNumber.replace(/\D/g,"");
                          if (whatsappNumber.trim() && digits.length < 10) setWhatsappErr("Enter a valid WhatsApp number");
                        }}
                        style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }}
                      />
                      {whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 && (
                        <CheckCircle size={16} style={{ color:"#00C853", flexShrink:0 }} />
                      )}
                    </div>
                    {whatsappErr && <p style={{ fontSize:11, color:"#EF4444", margin:"4px 0 0", fontWeight:600 }}>{whatsappErr}</p>}
                    <p style={{ fontSize:11, color:"#9E9E9E", margin:"5px 0 0" }}>The hotel will contact you on this number</p>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:"#6B6B6B", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 6px" }}>
                      WhatsApp Number <span style={{ color:"#EF4444" }}>*</span>
                    </p>
                    <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#F7F5FA", border:`1.5px solid ${whatsappErr ? "#EF4444" : whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 ? "#00C853" : "#E4DCF0"}`, borderRadius:14, padding:"13px 14px" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>💬</span>
                      <input
                        type="tel"
                        placeholder="08012345678 or 2348012345678"
                        value={whatsappNumber}
                        onChange={e => { setWhatsappNumber(e.target.value); setWhatsappErr(""); }}
                        onBlur={() => {
                          const digits = whatsappNumber.replace(/\D/g,"");
                          if (whatsappNumber.trim() && digits.length < 10) setWhatsappErr("Enter a valid WhatsApp number");
                        }}
                        style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }}
                      />
                      {whatsappNumber && whatsappNumber.replace(/\D/g,"").length >= 10 && (
                        <CheckCircle size={16} style={{ color:"#00C853", flexShrink:0 }} />
                      )}
                    </div>
                    {whatsappErr && <p style={{ fontSize:11, color:"#EF4444", margin:"4px 0 0", fontWeight:600 }}>{whatsappErr}</p>}
                    <p style={{ fontSize:11, color:"#9E9E9E", margin:"5px 0 0" }}>The hotel will contact you on this number</p>
                  </div>

                  <div style={{ backgroundColor:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:16, padding:"14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                      <div style={{ width:32, height:32, borderRadius:9, backgroundColor:ACCENT_BG, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <CreditCard size={15} style={{ color:ACCENT }} />
                      </div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:13, color:"#92400E", margin:"0 0 1px" }}>Identity Verification <span style={{ color:"#EF4444" }}>*</span></p>
                        <p style={{ fontSize:11, color:"#B45309", margin:0 }}>Required for hotel bookings</p>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                      <button onClick={() => setNinMode("nin")}
                        style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1.5px solid", borderColor:ninMode==="nin"?ACCENT:"#E4DCF0", backgroundColor:ninMode==="nin"?ACCENT_BG:"#FFFFFF", color:ninMode==="nin"?ACCENT:"#6B6B6B", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        NIN Number
                      </button>
                      <button onClick={() => setNinMode("upload")}
                        style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1.5px solid", borderColor:ninMode==="upload"?ACCENT:"#E4DCF0", backgroundColor:ninMode==="upload"?ACCENT_BG:"#FFFFFF", color:ninMode==="upload"?ACCENT:"#6B6B6B", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Upload ID
                      </button>
                    </div>

                    {ninMode === "nin" ? (
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:"#FFFFFF", border:`1.5px solid ${ninNumber.length > 0 && ninNumber.length !== 11 ? "#EF4444" : "#E4DCF0"}`, borderRadius:14, padding:"12px 14px" }}>
                          <CreditCard size={16} style={{ color:"#9E9E9E", flexShrink:0 }} />
                          <input type="tel" placeholder="Enter 11-digit NIN" maxLength={11} value={ninNumber}
                            onChange={e => setNinNumber(e.target.value.replace(/\D/g,"").slice(0,11))}
                            style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, fontWeight:700, color:"#0A0A0A", fontFamily:"monospace", letterSpacing:2 }} />
                          {ninNumber.length === 11 && <CheckCircle size={16} style={{ color:"#00C853", flexShrink:0 }} />}
                        </div>
                        {ninNumber.length > 0 && ninNumber.length !== 11 && (
                          <p style={{ fontSize:11, color:"#EF4444", margin:"4px 0 0", fontWeight:600 }}>NIN must be exactly 11 digits ({ninNumber.length}/11)</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {idImageUrl ? (
                          <div style={{ position:"relative", borderRadius:14, overflow:"hidden", border:"1.5px solid #A7F3D0" }}>
                            <img src={idImageUrl} alt="ID" style={{ width:"100%", height:140, objectFit:"cover", display:"block" }} />
                            <button onClick={() => setIdImageUrl("")}
                              style={{ position:"absolute", top:8, right:8, width:28, height:28, borderRadius:"50%", backgroundColor:"rgba(0,0,0,0.55)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <X size={13} style={{ color:"#FFFFFF" }} />
                            </button>
                            <div style={{ position:"absolute", bottom:8, left:12, display:"flex", alignItems:"center", gap:6, backgroundColor:"rgba(0,200,83,0.9)", borderRadius:8, padding:"3px 10px" }}>
                              <CheckCircle size={11} style={{ color:"#FFFFFF" }} />
                              <span style={{ fontSize:11, fontWeight:700, color:"#FFFFFF" }}>ID uploaded</span>
                            </div>
                          </div>
                        ) : (
                          <label style={{ display:"block", cursor:"pointer" }}>
                            <input type="file" accept="image/*" style={{ display:"none" }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleIdUpload(f); }} />
                            <div style={{ backgroundColor:"#FFFFFF", border:"2px dashed #FDE68A", borderRadius:14, padding:"20px", textAlign:"center" }}>
                              {idUploading ? (
                                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                                  <div style={{ width:24, height:24, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }} />
                                  <span style={{ fontSize:12, color:"#B45309", fontWeight:600 }}>Uploading...</span>
                                </div>
                              ) : (
                                <>
                                  <Camera size={28} style={{ color:ACCENT, marginBottom:8 }} />
                                  <p style={{ fontSize:13, fontWeight:700, color:"#92400E", margin:"0 0 3px" }}>Tap to upload your ID</p>
                                  <p style={{ fontSize:11, color:"#B45309", margin:0 }}>Driver's licence, passport, NIN slip, or voter card</p>
                                </>
                              )}
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {(walletBalance||0) === 0 && (
                    <div style={{ backgroundColor:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:12, padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
                      <AlertCircle size={14} style={{ color:"#D97706", flexShrink:0 }} />
                      <p style={{ fontSize:12, color:"#92400E", margin:0 }}>
                        Wallet empty.{" "}
                        <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                          style={{ background:"none", border:"none", color:"#D97706", fontWeight:700, fontSize:12, cursor:"pointer", padding:0 }}>
                          Fund now →
                        </button>
                      </p>
                    </div>
                  )}

                  {totalAmount > 0 && (walletBalance||0) < totalAmount && (walletBalance||0) > 0 && (
                    <div style={{ backgroundColor:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:12, padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
                      <AlertCircle size={14} style={{ color:"#D97706", flexShrink:0 }} />
                      <p style={{ fontSize:12, color:"#92400E", margin:0 }}>
                        You need {formatCurrency(totalAmount-(walletBalance||0))} more.{" "}
                        <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                          style={{ background:"none", border:"none", color:"#D97706", fontWeight:700, fontSize:12, cursor:"pointer", padding:0 }}>
                          Fund wallet →
                        </button>
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {bookMutation.isError && (
                      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                        style={{ backgroundColor:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:"10px 14px" }}>
                        <p style={{ color:"#EF4444", fontSize:13, margin:0 }}>{(bookMutation.error as Error).message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div style={{ padding:"12px 20px 40px", borderTop:"1px solid #F2EEF9", flexShrink:0 }}>
                {numNights > 0 && roomPrice > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, padding:"0 2px" }}>
                    <span style={{ fontSize:13, color:"#6B6B6B" }}>
                      {formatCurrency(roomPrice)} × {numNights} night{numNights!==1?"s":""}{roomCount>1?` × ${roomCount} rooms`:""}
                    </span>
                    <span style={{ fontSize:14, fontWeight:800, color:"#0A0A0A" }}>{formatCurrency(totalAmount)}</span>
                  </div>
                )}
                <button
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending || !canBook || (walletBalance||0) < totalAmount}
                  style={{ width:"100%", padding:"15px 0", borderRadius:16, border:"none", background:bookMutation.isPending||!canBook||(walletBalance||0)<totalAmount?"#9E9E9E":`linear-gradient(135deg,#B45309,${ACCENT})`, color:"#FFFFFF", fontSize:15, fontWeight:700, cursor:bookMutation.isPending||!canBook?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:canBook?"0 4px 20px rgba(217,119,6,0.35)":"none" }}>
                  {bookMutation.isPending
                    ? <><div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#FFFFFF", animation:"spin 0.8s linear infinite" }} />Confirming...</>
                    : <><CheckCircle size={18} />Confirm Reservation{totalAmount>0?` — ${formatCurrency(totalAmount)}`:""}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxImages.length > 0 && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={closeLightbox}
            style={{ position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.95)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <button onClick={closeLightbox}
              style={{ position:"absolute", top:16, right:16, width:38, height:38, borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:102 }}>
              <X size={20} style={{ color:"#FFFFFF" }} />
            </button>
            <div style={{ position:"absolute", top:20, left:"50%", transform:"translateX(-50%)", backgroundColor:"rgba(0,0,0,0.5)", borderRadius:999, padding:"4px 12px", zIndex:102 }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#FFFFFF" }}>{lightboxIndex+1} / {lightboxImages.length}</span>
            </div>
            {lightboxIndex > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i-1); }}
                style={{ position:"absolute", left:12, width:42, height:42, borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:102 }}>
                <ChevronRight size={22} style={{ color:"#FFFFFF", transform:"rotate(180deg)" }} />
              </button>
            )}
            {lightboxIndex < lightboxImages.length-1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i+1); }}
                style={{ position:"absolute", right:12, width:42, height:42, borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:102 }}>
                <ChevronRight size={22} style={{ color:"#FFFFFF" }} />
              </button>
            )}
            <motion.img key={lightboxImages[lightboxIndex]} src={lightboxImages[lightboxIndex]}
              initial={{ scale:0.92, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ duration:0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth:"90vw", maxHeight:"82vh", objectFit:"contain", borderRadius:12 }} />
            {lightboxImages.length > 1 && (
              <div style={{ position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)", display:"flex", gap:6 }}>
                {lightboxImages.map((_: any, i: number) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setLightboxIndex(i); }}
                    style={{ width:i===lightboxIndex?20:6, height:6, borderRadius:999, backgroundColor:i===lightboxIndex?"#FFFFFF":"rgba(255,255,255,0.4)", border:"none", cursor:"pointer", padding:0 }} />
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