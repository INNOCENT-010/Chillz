/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { reserveBookingAmount } from "@/lib/ledger";
import { PlacesInput } from "@/components/ui/places-input";
import { PlaceDetail } from "@/hooks/use-places-autocomplete";
import {
  ArrowLeft, MapPin, Heart, Share2, CheckCircle,
  X, Navigation, Car, Home, Calendar, Clock, Users,
  Fuel, Gauge, Play, ChevronLeft, ChevronRight, Grid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInDays } from "date-fns";

function openDirections(lat: number, lng: number, name: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const encodedName = encodeURIComponent(name);
  if (isIOS) window.open(`maps://?daddr=${lat},${lng}&q=${encodedName}`, "_blank");
  else if (isAndroid) window.open(`geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`, "_blank");
  else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

// ── Full-screen gallery ───────────────────────────────────────────────────
function GalleryModal({
  items,
  startIndex,
  onClose,
}: {
  items: { type: "image" | "video"; url: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const item = items[current];

  const prev = () => setCurrent((c) => (c - 1 + items.length) % items.length);
  const next = () => setCurrent((c) => (c + 1) % items.length);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, backgroundColor: "#000000",
        zIndex: 100, display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "48px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10, background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)" }}>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={20} style={{ color: "#FFFFFF" }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
          {current + 1} / {items.length}
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Main media */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {item.type === "video" ? (
              <video
                src={item.url}
                controls
                autoPlay
                playsInline
                style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 4 }}
              />
            ) : (
              <img
                src={item.url}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 4 }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Prev / Next */}
        {items.length > 1 && (
          <>
            <button onClick={prev}
              style={{ position: "absolute", left: 12, width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={22} style={{ color: "#FFFFFF" }} />
            </button>
            <button onClick={next}
              style={{ position: "absolute", right: 12, width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div style={{ padding: "12px 16px 36px", background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", justifyContent: items.length <= 5 ? "center" : "flex-start" }}>
            {items.map((thumb, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 10, overflow: "hidden", border: i === current ? "2.5px solid #FFFFFF" : "2.5px solid transparent", padding: 0, cursor: "pointer", position: "relative", backgroundColor: "#1A1A1A" }}>
                {thumb.type === "video" ? (
                  <>
                    <video src={thumb.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" }}>
                      <Play size={14} style={{ color: "#FFFFFF", fill: "#FFFFFF" }} />
                    </div>
                  </>
                ) : (
                  <img src={thumb.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  // Car rental booking state
  const [pickupInput, setPickupInput] = useState("");
  const [pickupPlace, setPickupPlace] = useState<PlaceDetail | null>(null);
  const [dropoffInput, setDropoffInput] = useState("");
  const [dropoffPlace, setDropoffPlace] = useState<PlaceDetail | null>(null);
  const [sameReturn, setSameReturn] = useState(true);
  const [pickupDate, setPickupDate] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [driverAge, setDriverAge] = useState("25");

  // Apartment booking state
  const [checkinDate, setCheckinDate] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [numGuests, setNumGuests] = useState("1");
  const [numRooms, setNumRooms] = useState("1");
  const [specialRequests, setSpecialRequests] = useState("");

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_listings").select("*").eq("id", id).single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.from("ledger_entries").select("direction, amount").eq("account_id", user.id).eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce((acc: number, row: any) => row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });

  const isCarRental = listing?.vendor_type === "car_rental";
  const isApartment = listing?.vendor_type === "apartment";

  const rentalDays = (pickupDate && dropoffDate)
    ? Math.max(1, differenceInDays(new Date(dropoffDate), new Date(pickupDate)))
    : 0;
  const stayNights = (checkinDate && checkoutDate)
    ? Math.max(0, differenceInDays(new Date(checkoutDate), new Date(checkinDate)))
    : 0;
  const totalAmount = isCarRental
    ? rentalDays * (listing?.price_per_unit || 0)
    : stayNights * Number(numRooms || 1) * (listing?.price_per_unit || 0);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !listing) throw new Error("Not authenticated");
      if (!totalAmount || totalAmount <= 0) throw new Error("Invalid booking dates");
      if (totalAmount > (walletBalance || 0)) throw new Error("Insufficient wallet balance");

      if (isCarRental) {
        if (!pickupDate) throw new Error("Select a pickup date");
        if (!dropoffDate) throw new Error("Select a drop-off date");
        if (!pickupPlace) throw new Error("Enter a pickup location");
        if (rentalDays < 1) throw new Error("Drop-off must be after pickup");
      }

      if (isApartment) {
        if (!checkinDate) throw new Error("Select a check-in date");
        if (!checkoutDate) throw new Error("Select a check-out date");
        if (stayNights < (listing.min_nights || 1)) throw new Error(`Minimum stay is ${listing.min_nights || 1} night${listing.min_nights !== 1 ? "s" : ""}`);
      }

      const qrHash = generateQRHash();
      const { data: booking, error } = await (supabase.from("bookings") as any)
        .insert({
          user_id: user.id,
          vendor_id: listing.vendor_id,
          listing_id: listing.id,
          status: "confirmed",
          reserved_amount: totalAmount,
          qr_code_hash: qrHash,
          notes: isApartment ? specialRequests || null : null,
          ...(isCarRental ? {
            pickup_location: pickupPlace?.formatted_address || pickupInput,
            pickup_lat: pickupPlace?.lat || null,
            pickup_lng: pickupPlace?.lng || null,
            dropoff_location: sameReturn ? (pickupPlace?.formatted_address || pickupInput) : (dropoffPlace?.formatted_address || dropoffInput),
            dropoff_lat: sameReturn ? pickupPlace?.lat : dropoffPlace?.lat,
            dropoff_lng: sameReturn ? pickupPlace?.lng : dropoffPlace?.lng,
            same_return_location: sameReturn,
            booking_date: new Date(pickupDate).toISOString(),
            driver_age: Number(driverAge) || null,
          } : {}),
          ...(isApartment ? {
            checkin_date: checkinDate,
            checkout_date: checkoutDate,
            num_nights: stayNights,
            num_rooms: Number(numRooms) || 1,
            guest_count: Number(numGuests) || null,
            booking_date: new Date(checkinDate).toISOString(),
          } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      await reserveBookingAmount(user.id, booking.id, totalAmount);
      return booking;
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      router.push(`/bookings/${booking.id}`);
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </MainLayout>
    );
  }

  if (!listing) {
    return (
      <MainLayout>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
          <p style={{ color: "#6B6B6B", fontSize: 14 }}>Listing not found.</p>
          <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
        </div>
      </MainLayout>
    );
  }

  const images: string[] = listing.images || [];
  const videos: string[] = listing.videos || [];
  const amenities: string[] = listing.amenities || listing.filters || [];

  // Build unified gallery items: images first, then videos
  const galleryItems: { type: "image" | "video"; url: string }[] = [
    ...images.map((url: string) => ({ type: "image" as const, url })),
    ...videos.map((url: string) => ({ type: "video" as const, url })),
  ];
  const totalMedia = galleryItems.length;

  return (
    <MainLayout>

      {/* ── GALLERY MODAL ── */}
      <AnimatePresence>
        {galleryIndex !== null && (
          <GalleryModal
            items={galleryItems}
            startIndex={galleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <div style={{ position: "relative", height: 300, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
        {images.length > 0
          ? <img src={images[activeImage]} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={() => setGalleryIndex(activeImage)} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isCarRental ? <Car size={60} style={{ color: "rgba(255,255,255,0.3)" }} /> : <Home size={60} style={{ color: "rgba(255,255,255,0.3)" }} />}
            </div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(61,0,102,0.7) 100%)", pointerEvents: "none" }} />

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
          <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setLiked(!liked)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={18} style={{ color: liked ? "#FF4B6E" : "#FFFFFF", fill: liked ? "#FF4B6E" : "none" }} />
            </button>
            <button style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} style={{ color: "#FFFFFF" }} />
            </button>
          </div>
        </div>

        {/* Image dots */}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setActiveImage(i)}
                style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        )}

        {/* Bottom bar: title + View All button */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{listing.title}</h1>
            {listing.address && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={11} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{listing.address}</span>
              </div>
            )}
          </div>
          {totalMedia > 0 && (
            <button onClick={() => setGalleryIndex(0)}
              style={{ flexShrink: 0, marginLeft: 12, display: "flex", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "6px 12px", cursor: "pointer" }}>
              <Grid size={13} style={{ color: "#FFFFFF" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>
                {totalMedia} {totalMedia === 1 ? "photo" : "photos/videos"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", marginTop: -16, position: "relative", zIndex: 1, paddingBottom: 140 }}>

        {/* Price + directions */}
        <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {formatCurrency(listing.price_per_unit)}
            </span>
            <span style={{ fontSize: 13, color: "#9E9E9E", fontWeight: 500 }}>{isCarRental ? " / day" : " / night"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ backgroundColor: "#EDE0F7", color: "#5B0EA6", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, textTransform: "capitalize" }}>
              {isCarRental ? "Car Rental" : listing.room_type || "Apartment"}
            </span>
            {listing.lat && listing.lng && (
              <button onClick={() => openDirections(listing.lat, listing.lng, listing.title)}
                style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Navigation size={12} />Directions
              </button>
            )}
          </div>
        </div>

        {/* Car rental badges */}
        {isCarRental && (listing.fuel_policy || listing.mileage_policy) && (
          <div style={{ padding: "0 16px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {listing.fuel_policy && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 999, padding: "5px 12px" }}>
                <Fuel size={12} style={{ color: "#D97706" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>{listing.fuel_policy}</span>
              </div>
            )}
            {listing.mileage_policy && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", border: "1px solid #C4BAD8", borderRadius: 999, padding: "5px 12px" }}>
                <Gauge size={12} style={{ color: "#5B0EA6" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>
                  {listing.mileage_policy === "Limited" ? `${listing.mileage_limit || 0} km/day` : "Unlimited km"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Apartment badges */}
        {isApartment && (listing.checkin_time || listing.checkout_time || listing.min_nights > 1) && (
          <div style={{ padding: "0 16px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {listing.checkin_time && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 999, padding: "5px 12px" }}>
                <Clock size={12} style={{ color: "#059669" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Check-in {listing.checkin_time}</span>
              </div>
            )}
            {listing.checkout_time && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 999, padding: "5px 12px" }}>
                <Clock size={12} style={{ color: "#EF4444" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>Check-out {listing.checkout_time}</span>
              </div>
            )}
            {listing.min_nights > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 999, padding: "5px 12px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>Min. {listing.min_nights} nights</span>
              </div>
            )}
          </div>
        )}

        {/* Apartment room details */}
        {isApartment && (listing.availability?.bedrooms || listing.availability?.bathrooms || listing.availability?.max_guests) && (
          <div style={{ padding: "0 16px", marginBottom: 14 }}>
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 20 }}>
              {listing.availability?.bedrooms && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", margin: 0 }}>{listing.availability.bedrooms}</p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontWeight: 600 }}>BED</p>
                </div>
              )}
              {listing.availability?.bathrooms && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", margin: 0 }}>{listing.availability.bathrooms}</p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontWeight: 600 }}>BATH</p>
                </div>
              )}
              {listing.availability?.max_guests && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", margin: 0 }}>{listing.availability.max_guests}</p>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontWeight: 600 }}>GUESTS</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: 0 }}>{listing.description}</p>
          </div>
        )}

        {/* ── MEDIA GALLERY STRIP ── */}
        {galleryItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Photos & Videos</h3>
              {galleryItems.length > 4 && (
                <button onClick={() => setGalleryIndex(0)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>
                  See all {galleryItems.length}
                </button>
              )}
            </div>

            {/* Grid — first 4 items, 5th shows +N overlay */}
            <div style={{ padding: "0 16px" }}>
              {galleryItems.length === 1 ? (
                // Single item — full width
                <div onClick={() => setGalleryIndex(0)} style={{ height: 200, borderRadius: 16, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                  {galleryItems[0].type === "video"
                    ? <>
                        <video src={galleryItems[0].url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" }}>
                          <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Play size={24} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 3 }} />
                          </div>
                        </div>
                      </>
                    : <img src={galleryItems[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
              ) : galleryItems.length === 2 ? (
                // Two items side by side
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {galleryItems.slice(0, 2).map((item, i) => (
                    <div key={i} onClick={() => setGalleryIndex(i)} style={{ height: 160, borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative", backgroundColor: "#0A0A0A" }}>
                      {item.type === "video"
                        ? <>
                            <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} muted playsInline />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Play size={18} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 2 }} />
                              </div>
                            </div>
                          </>
                        : <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                  ))}
                </div>
              ) : (
                // 3+ items — hero left + 2 stacked right, with +N overlay on last
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8, height: 240 }}>
                  {/* Hero — spans 2 rows */}
                  <div onClick={() => setGalleryIndex(0)}
                    style={{ gridRow: "1 / 3", borderRadius: 16, overflow: "hidden", cursor: "pointer", position: "relative", backgroundColor: "#0A0A0A" }}>
                    {galleryItems[0].type === "video"
                      ? <>
                          <video src={galleryItems[0].url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} muted playsInline />
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Play size={24} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 3 }} />
                            </div>
                          </div>
                        </>
                      : <img src={galleryItems[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>

                  {/* Top right */}
                  <div onClick={() => setGalleryIndex(1)}
                    style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative", backgroundColor: "#0A0A0A" }}>
                    {galleryItems[1].type === "video"
                      ? <>
                          <video src={galleryItems[1].url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} muted playsInline />
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Play size={14} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 2 }} />
                            </div>
                          </div>
                        </>
                      : <img src={galleryItems[1].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>

                  {/* Bottom right — show +N if more */}
                  <div onClick={() => setGalleryIndex(2)}
                    style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative", backgroundColor: "#0A0A0A" }}>
                    {galleryItems[2].type === "video"
                      ? <>
                          <video src={galleryItems[2].url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: galleryItems.length > 3 ? 0.4 : 0.85 }} muted playsInline />
                          {galleryItems.length <= 3 && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Play size={14} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 2 }} />
                              </div>
                            </div>
                          )}
                        </>
                      : <img src={galleryItems[2].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: galleryItems.length > 3 ? 0.4 : 1 }} />}
                    {galleryItems.length > 3 && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" }}>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>+{galleryItems.length - 3}</p>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", margin: 0, fontWeight: 600 }}>more</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Amenities / Features */}
        {amenities.length > 0 && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A", margin: "0 0 10px" }}>
              {isCarRental ? "Features" : "Amenities"}
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {amenities.map((a: string) => (
                <span key={a} style={{ backgroundColor: "#F2EEF9", color: "#5B0EA6", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: "1px solid #E4DCF0" }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Available units */}
        {listing.available_units > 1 && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                {listing.available_units} {isCarRental ? "vehicle" : "unit"}{listing.available_units !== 1 ? "s" : ""} available
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── BOOK CTA ── */}
      <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        {!listing.is_active ? (
          <div style={{ width: "100%", padding: "14px 0", borderRadius: 16, backgroundColor: "#F2EEF9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#9E9E9E", fontSize: 14, fontWeight: 600, margin: 0 }}>
              {isCarRental ? "Vehicle not available" : "Listing not available"}
            </p>
          </div>
        ) : (
          <button onClick={() => { if (!user) { router.push(`/login?redirect=/listing/${id}`); return; } setShowBooking(true); }}
            style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(91,14,166,0.35)" }}>
            {isCarRental ? "Reserve This Vehicle" : "Book This Property"}
          </button>
        )}
      </div>

      {/* ── BOOKING SHEET ── */}
      <AnimatePresence>
        {showBooking && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBooking(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {isCarRental ? "Reserve Vehicle" : "Book Property"}
                    </h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>{listing.title}</p>
                  </div>
                  <button onClick={() => setShowBooking(false)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
                <div style={{ backgroundColor: "#F2EEF9", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 500 }}>Wallet balance</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(walletBalance || 0)}</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>

                  {/* CAR RENTAL */}
                  {isCarRental && (
                    <>
                      {listing.fuel_policy && (
                        <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                          <Fuel size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: "#92400E", fontWeight: 600, margin: 0 }}>Fuel policy: {listing.fuel_policy}</p>
                        </div>
                      )}

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Pickup Date & Time <span style={{ color: "#EF4444" }}>*</span></p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                          <Calendar size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                          <input type="datetime-local" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Drop-off Date & Time <span style={{ color: "#EF4444" }}>*</span></p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                          <Calendar size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                          <input type="datetime-local" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                        </div>
                        {rentalDays > 0 && (
                          <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 700, margin: "4px 0 0" }}>
                            {rentalDays} day{rentalDays !== 1 ? "s" : ""} · {formatCurrency(totalAmount)} total
                          </p>
                        )}
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Pickup Location <span style={{ color: "#EF4444" }}>*</span></p>
                        <PlacesInput
                          value={pickupInput}
                          onChange={(v) => { setPickupInput(v); setPickupPlace(null); }}
                          onSelect={(place) => {
                            setPickupInput(place.formatted_address || place.name || "");
                            setPickupPlace(place);
                            if (sameReturn) { setDropoffInput(place.formatted_address || place.name || ""); setDropoffPlace(place); }
                          }}
                          placeholder="Where to pick up?"
                        />
                      </div>

                      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, border: "1px solid #F2EEF9", padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>Return to same location</p>
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Drop-off same as pickup</p>
                        </div>
                        <button onClick={() => setSameReturn(!sameReturn)}
                          style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: sameReturn ? "#5B0EA6" : "#E4DCF0", position: "relative", flexShrink: 0 }}>
                          <motion.div animate={{ x: sameReturn ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2 }} />
                        </button>
                      </div>

                      {!sameReturn && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Drop-off Location</p>
                          <PlacesInput
                            value={dropoffInput}
                            onChange={(v) => { setDropoffInput(v); setDropoffPlace(null); }}
                            onSelect={(place) => { setDropoffInput(place.formatted_address || place.name || ""); setDropoffPlace(place); }}
                            placeholder="Where to return?"
                          />
                        </div>
                      )}

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Driver's Age</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                          <Users size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                          <input type="number" placeholder="25" min="18" max="99" value={driverAge} onChange={(e) => setDriverAge(e.target.value)}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                          <span style={{ fontSize: 12, color: "#9E9E9E" }}>years old</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* APARTMENT */}
                  {isApartment && (
                    <>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Check-in <span style={{ color: "#EF4444" }}>*</span></p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 12px" }}>
                            <Calendar size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                            <input type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)}
                              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Check-out <span style={{ color: "#EF4444" }}>*</span></p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 12px" }}>
                            <Calendar size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                            <input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)}
                              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                          </div>
                        </div>
                      </div>

                      {stayNights > 0 && (
                        <div style={{ backgroundColor: stayNights < (listing.min_nights || 1) ? "#FEF2F2" : "#EDE0F7", borderRadius: 12, padding: "8px 14px" }}>
                          <p style={{ fontSize: 12, color: stayNights < (listing.min_nights || 1) ? "#EF4444" : "#5B0EA6", fontWeight: 700, margin: 0 }}>
                            {stayNights} night{stayNights !== 1 ? "s" : ""}
                            {stayNights < (listing.min_nights || 1) ? ` — minimum is ${listing.min_nights} nights` : ` · ${formatCurrency(totalAmount)} total`}
                          </p>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Guests</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 12px" }}>
                            <Users size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                            <input type="number" min="1" value={numGuests} onChange={(e) => setNumGuests(e.target.value)}
                              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Rooms</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 12px" }}>
                            <Home size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                            <input type="number" min="1" value={numRooms} onChange={(e) => setNumRooms(e.target.value)}
                              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                          Special Requests <span style={{ color: "#C4BAD8", fontWeight: 400 }}>(optional)</span>
                        </p>
                        <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                          placeholder="e.g. Late check-in, extra pillows..."
                          rows={2}
                          style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none" }} />
                      </div>

                      {(listing.checkin_time || listing.checkout_time) && (
                        <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px" }}>
                          <p style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 600, margin: 0 }}>
                            Check-in from {listing.checkin_time || "14:00"} · Check-out by {listing.checkout_time || "11:00"}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Price summary */}
                  {totalAmount > 0 && (
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#9E9E9E" }}>
                          {isCarRental
                            ? `${formatCurrency(listing.price_per_unit)} × ${rentalDays} day${rentalDays !== 1 ? "s" : ""}`
                            : `${formatCurrency(listing.price_per_unit)} × ${stayNights} night${stayNights !== 1 ? "s" : ""}${Number(numRooms) > 1 ? ` × ${numRooms} rooms` : ""}`}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6" }}>{formatCurrency(totalAmount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#9E9E9E" }}>Deducted from wallet</span>
                        <span style={{ fontSize: 11, color: (walletBalance || 0) >= totalAmount ? "#00C853" : "#EF4444", fontWeight: 700 }}>
                          {(walletBalance || 0) >= totalAmount ? "✓ Sufficient" : "✗ Insufficient"}
                        </span>
                      </div>
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

              <div style={{ padding: "12px 20px 36px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                <button onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending || totalAmount === 0}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: bookMutation.isPending || totalAmount === 0 ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: bookMutation.isPending || totalAmount === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {bookMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Confirming...</>
                    : <><CheckCircle size={18} />{totalAmount > 0 ? `Reserve · ${formatCurrency(totalAmount)}` : "Select dates to continue"}</>}
                </button>
                {(walletBalance || 0) < totalAmount && totalAmount > 0 && (
                  <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                    style={{ width: "100%", marginTop: 10, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Fund Wallet First
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}