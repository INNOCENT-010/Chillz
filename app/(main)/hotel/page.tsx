/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, MapPin, SlidersHorizontal, ArrowLeft,
  Heart, Star, Wifi, Waves,
  Dumbbell, Coffee, ChevronDown, Shield, CheckCircle, Zap, Snowflake,
  Wind, Tv, UtensilsCrossed, Bus, ParkingCircle,
} from "lucide-react";
import { LocationHeader } from "@/components/home/location-header";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const ACCENT    = "#D97706";
const ACCENT_BG = "#FEF3C7";
const CATEGORY_EMOJI = "🏨";

const AMENITIES = [
  "Pool","Gym","Spa","Breakfast Included","Airport Shuttle",
  "Parking","WiFi","Restaurant","Bar","Conference Room",
  "Beach Access","Room Service",
];
const PRICE_TIERS = [
  { label:"Budget",    icon:"💚", sub:"Under ₦30k/night", max:30000      },
  { label:"Mid-range", icon:"💛", sub:"₦30k–₦100k",       max:100000     },
  { label:"Luxury",    icon:"💜", sub:"₦100k+",            max:999999999  },
];
const STAR_RATINGS = [
  { label:"3★", min:3 }, { label:"4★", min:4 }, { label:"4.5★+", min:4.5 },
];

const AMENITY_ICONS: Record<string, any> = {
  "WiFi": Wifi, "wi-fi": Wifi,
  "Parking": ParkingCircle, "Car Park": ParkingCircle,
  "Pool": Waves, "Swimming Pool": Waves,
  "Gym": Dumbbell, "Fitness": Dumbbell,
  "Breakfast": Coffee, "Breakfast Included": Coffee,
  "Restaurant": UtensilsCrossed, "Dining": UtensilsCrossed,
  "AC": Wind, "Air Conditioning": Snowflake,
  "TV": Tv, "Generator": Zap,
  "Security": Shield, "CCTV": Shield,
  "Spa": Waves, "Airport Shuttle": Bus,
  "Bar": Coffee, "Room Service": CheckCircle,
  "Conference Room": CheckCircle, "Beach Access": Waves,
};

function getAmenityIcon(tag: string) {
  if (AMENITY_ICONS[tag]) return AMENITY_ICONS[tag];
  const lower = tag.toLowerCase();
  for (const key of Object.keys(AMENITY_ICONS)) {
    if (key.toLowerCase() === lower) return AMENITY_ICONS[key];
  }
  return CheckCircle;
}

function haversineKm(la1:number,ln1:number,la2:number,ln2:number){
  const R=6371,dL=((la2-la1)*Math.PI)/180,dN=((ln2-ln1)*Math.PI)/180;
  const a=Math.sin(dL/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function HotelCard({ vendor, isSaved, onToggleSave }: {
  vendor: any;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const venue    = vendor.venue || {};
  const listings = vendor.listings || [];
  const images   = venue.images?.length ? venue.images : listings.flatMap((l: any) => l.images || []);

  const [imgIndex, setImgIndex] = useState(0);
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStart = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const startPress = useCallback(() => {
    if (images.length <= 1) return;
    pressStart.current = setTimeout(() => {
      setPressing(true);
      pressTimer.current = setInterval(() => {
        setImgIndex(i => (i + 1) % images.length);
      }, 800);
    }, 300);
  }, [images.length]);

  const endPress = useCallback(() => {
    if (pressStart.current) clearTimeout(pressStart.current);
    if (pressTimer.current) clearInterval(pressTimer.current);
    setPressing(false);
  }, []);

  // Amenities from first listing's amenities or venue filters
  const topAmenities = (listings[0]?.amenities || venue.filters || []).slice(0, 3);

  // Room type chips from listings
  const roomTypes = [...new Set(listings.map((l: any) => l.room_type).filter(Boolean))] as string[];

  // Min nights from first listing
  const minNights = listings[0]?.min_nights || 0;

  const rating      = venue.rating      || 0;
  const reviewCount = venue.review_count || 0;

  return (
    <Link href={`/hotel/${venue.id}`} style={{ textDecoration:"none", display:"block", marginBottom:14 }}>
      <div style={{ backgroundColor:"#FFFFFF", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.08)", border:"1px solid #F0EBF8" }}>

        {/* Hero */}
        <div
          style={{ height:190, position:"relative", overflow:"hidden", backgroundColor:"#1a0a2e", userSelect:"none" }}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={endPress}
        >
          {images.length > 0
            ? <img src={images[imgIndex]} alt={vendor.business_name}
                style={{ width:"100%", height:"100%", objectFit:"cover", transition: pressing ? "none" : "opacity 0.2s" }}
                draggable={false} />
            : <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#1a0a2e,#2d1054)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:44, opacity:0.3 }}>{CATEGORY_EMOJI}</span>
              </div>}

          <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,rgba(0,0,0,0.15) 0%,transparent 40%,rgba(0,0,0,0.72) 100%)", pointerEvents:"none" }}/>

          {/* Slideshow dots */}
          {pressing && images.length > 1 && (
            <div style={{ position:"absolute", top:8, left:0, right:0, display:"flex", justifyContent:"center", gap:4, zIndex:2 }}>
              {images.map((_:any, i:number) => (
                <div key={i} style={{ width: i === imgIndex ? 16 : 5, height:5, borderRadius:999, backgroundColor: i === imgIndex ? "#FFFFFF" : "rgba(255,255,255,0.45)", transition:"width 0.2s" }} />
              ))}
            </div>
          )}

          {/* Hold hint */}
          {!pressing && images.length > 1 && (
            <div style={{ position:"absolute", top:8, right:10, backgroundColor:"rgba(0,0,0,0.45)", borderRadius:999, padding:"2px 8px" }}>
              <span style={{ fontSize:9, fontWeight:700, color:"#FFFFFF" }}>Hold to browse</span>
            </div>
          )}

          {/* Heart */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
            style={{ position:"absolute", top:10, left:10, width:34, height:34, borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.18)", backdropFilter:"blur(6px)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:3 }}>
            <Heart size={16} style={{ color: isSaved ? "#FF4B6E" : "#FFFFFF", fill: isSaved ? "#FF4B6E" : "none", transition:"all 0.2s" }} />
          </button>

          {/* Featured */}
          {venue.is_featured && (
            <div style={{ position:"absolute", top:10, right:images.length > 1 ? 80 : 10, backgroundColor:"#00C853", borderRadius:999, padding:"3px 10px" }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#FFFFFF" }}>Featured</span>
            </div>
          )}

          {/* Rating */}
          {rating > 0 && (
            <div style={{ position:"absolute", bottom:40, right:10, backgroundColor:"rgba(0,0,0,0.55)", borderRadius:8, padding:"3px 8px", display:"flex", alignItems:"center", gap:3 }}>
              <Star size={10} style={{ color:"#FFD700", fill:"#FFD700" }}/>
              <span style={{ fontSize:11, fontWeight:700, color:"#FFFFFF" }}>{Number(rating).toFixed(1)}</span>
              {reviewCount > 0 && <span style={{ fontSize:9, color:"rgba(255,255,255,0.7)" }}>({reviewCount})</span>}
            </div>
          )}

          {/* Name + address overlay */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 12px 10px" }}>
            <p style={{ fontWeight:900, fontSize:15, color:"#FFFFFF", margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)", textShadow:"0 1px 4px rgba(0,0,0,0.5)", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
              {vendor.business_name}
            </p>
            {venue.address && (
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <MapPin size={10} style={{ color:"rgba(255,255,255,0.8)", flexShrink:0 }}/>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.8)", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                  {venue.address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card body — matches apartment card exactly */}
        <div style={{ padding:"12px 14px" }}>

          {/* Amenity icon pills */}
          {topAmenities.length > 0 && (
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
              {topAmenities.map((a: string) => {
                const Icon = getAmenityIcon(a);
                return (
                  <div key={a} style={{ display:"flex", alignItems:"center", gap:4, backgroundColor:ACCENT_BG, borderRadius:8, padding:"4px 8px" }}>
                    <Icon size={11} style={{ color:ACCENT, flexShrink:0 }} />
                    <span style={{ fontSize:10, fontWeight:600, color:ACCENT }}>{a}</span>
                  </div>
                );
              })}
              {(listings[0]?.amenities || venue.filters || []).length > 3 && (
                <span style={{ fontSize:10, color:"#9E9E9E" }}>+{(listings[0]?.amenities || venue.filters || []).length - 3} more</span>
              )}
            </div>
          )}

          {/* Room type chips */}
          {roomTypes.length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {roomTypes.slice(0, 3).map((rt: string) => (
                <span key={rt} style={{ fontSize:10, fontWeight:600, color:"#6B6B6B", backgroundColor:"#F7F5FA", padding:"3px 8px", borderRadius:999, border:"1px solid #E4DCF0" }}>
                  {rt}
                </span>
              ))}
              {roomTypes.length > 3 && (
                <span style={{ fontSize:10, color:"#9E9E9E" }}>+{roomTypes.length - 3}</span>
              )}
            </div>
          )}

          {/* Price row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:10, borderTop:"1px solid #F2EEF9" }}>
            <div>
              <p style={{ fontSize:10, color:"#9E9E9E", margin:"0 0 1px" }}>Starting from</p>
              <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                <p style={{ fontSize:16, fontWeight:900, color:ACCENT, margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>
                  {vendor.starting_price ? formatCurrency(vendor.starting_price) : "See rates"}
                </p>
                {vendor.starting_price && <span style={{ fontSize:10, color:"#9E9E9E" }}>/night</span>}
              </div>
              {minNights > 1 && (
                <p style={{ fontSize:9, color:"#D97706", fontWeight:700, margin:"2px 0 0" }}>Min {minNights} nights</p>
              )}
            </div>
            <button style={{ backgroundColor:ACCENT, color:"#FFFFFF", border:"none", borderRadius:12, padding:"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              See rooms
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LocationPill({ onCityResolved }: { onCityResolved:(c:string)=>void }) {
  const [display,   setDisplay]   = useState("Lagos");
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const r = await fetch(`/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        const d = await r.json();
        const loc = (d.location||"Lagos").split(",")[0].trim();
        setDisplay(loc); onCityResolved(loc);
      } catch { setDisplay("Lagos"); onCityResolved("Lagos"); }
      finally  { setDetecting(false); }
    }, () => { setDisplay("Lagos"); onCityResolved("Lagos"); setDetecting(false); });
  }, []);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
      <MapPin size={13} style={{ color:ACCENT, flexShrink:0 }} strokeWidth={2.5}/>
      <span style={{ fontSize:12, fontWeight:700, color:"#0A0A0A", maxWidth:90, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
        {detecting ? "..." : display}
      </span>
      <ChevronDown size={12} style={{ color:"#9E9E9E", flexShrink:0 }}/>
    </div>
  );
}

function Section({ title, subtitle, children }: { title:string; subtitle:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800, color:"#0A0A0A", margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>{title}</h2>
        <p style={{ fontSize:11, color:"#9E9E9E", margin:0 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function HotelPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [search,      setSearch]      = useState("");
  const [showSearch,  setShowSearch]  = useState(false);
  const [showFilter,  setShowFilter]  = useState(false);
  const [showSaved,   setShowSaved]   = useState(false);
  const [nearMe,      setNearMe]      = useState(false);
  const [userLat,     setUserLat]     = useState<number|null>(null);
  const [userLng,     setUserLng]     = useState<number|null>(null);
  const [userCity,    setUserCity]    = useState("Lagos");

  const [amenities,   setAmenities]   = useState<string[]>([]);
  const [priceTier,   setPriceTier]   = useState<number|null>(null);
  const [starRating,  setStarRating]  = useState<number|null>(null);
  const [aAmenities,  setAAmenities]  = useState<string[]>([]);
  const [aPriceTier,  setAPriceTier]  = useState<number|null>(null);
  const [aStarRating, setAStarRating] = useState<number|null>(null);

  const openFilter  = () => { setAmenities(aAmenities); setPriceTier(aPriceTier); setStarRating(aStarRating); setShowFilter(true); };
  const applyFilter = () => { setAAmenities(amenities); setAPriceTier(priceTier); setAStarRating(starRating); setShowFilter(false); };
  const clearAll    = () => { setSearch(""); setNearMe(false); setShowSaved(false); setAAmenities([]); setAPriceTier(null); setAStarRating(null); };

  const PAGE_SIZE = 16;
  const [vendors,        setVendors]        = useState<any[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore,        setHasMore]        = useState(true);
  const [phase,          setPhase]          = useState<"neighbourhood"|"city"|"national">("neighbourhood");
  const [phasePageNum,   setPhasePageNum]   = useState(0);
  const [seenIds,        setSeenIds]        = useState<Set<string>>(new Set());
  const [showNationalDivider, setShowNationalDivider] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function parseLocation(loc: string): { neighbourhood: string | null; city: string | null } {
    if (!loc || loc === "__everywhere__") return { neighbourhood: null, city: null };
    const parts = loc.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) return { neighbourhood: null, city: parts[0] };
    return { neighbourhood: parts[0], city: parts[1] };
  }

  const buildVendors = async (venues: any[]) => {
    if (!venues.length) return [];
    const vendorIds = venues.filter((v:any) => v.vendor_id).map((v:any) => v.vendor_id);
    let vendorMap:  Record<string,any>    = {};
    let listingMap: Record<string,any[]>  = {};
    let priceMap:   Record<string,number> = {};
    if (vendorIds.length) {
      const { data: vds } = await (supabase.from("vendors") as any)
        .select("id,business_name,description").in("id", vendorIds);
      (vds||[]).forEach((v:any) => { vendorMap[v.id] = v; });
      const { data: listings } = await (supabase.from("vendor_listings") as any)
        .select("vendor_id,price_per_unit,amenities,room_type,min_nights,images")
        .in("vendor_id", vendorIds).eq("is_active", true);
      (listings||[]).forEach((l:any) => {
        if (!listingMap[l.vendor_id]) listingMap[l.vendor_id] = [];
        listingMap[l.vendor_id].push(l);
        if (!priceMap[l.vendor_id]||l.price_per_unit<priceMap[l.vendor_id]) priceMap[l.vendor_id]=l.price_per_unit;
      });
    }
    return venues.map((venue:any) => {
      const vd = vendorMap[venue.vendor_id] || {};
      return {
        id:             vd.id || venue.vendor_id || venue.id,
        venueId:        venue.id,
        business_name:  vd.business_name || venue.name,
        description:    vd.description   || null,
        starting_price: priceMap[venue.vendor_id] || null,
        listings:       listingMap[venue.vendor_id] || [],
        venue,
      };
    });
  };

  const fetchPhase = async (
    currentPhase: "neighbourhood"|"city"|"national",
    pageNum: number,
    city: string,
    currentSeenIds: Set<string>
  ) => {
    const from = pageNum * PAGE_SIZE;
    const { neighbourhood, city: cityName } = parseLocation(city);
    let query = (supabase.from("venues") as any)
      .select("id,name,address,images,rating,review_count,filters,lat,lng,is_featured,created_at,vendor_id")
      .eq("is_active", true).eq("category", "hotel")
      .order("rating", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (currentPhase === "neighbourhood" && neighbourhood) {
      query = query.or(`address.ilike.%${neighbourhood}%,city.ilike.%${neighbourhood}%`);
    } else if (currentPhase === "city" && cityName) {
      query = query.or(`address.ilike.%${cityName}%,city.ilike.%${cityName}%`);
    }
    const { data } = await query;
    return ((data||[]) as any[]).filter((v:any) => !currentSeenIds.has(v.id));
  };

  const initFetch = async (city: string) => {
    setIsLoading(true);
    setVendors([]);
    setSeenIds(new Set());
    setShowNationalDivider(false);
    const { neighbourhood, city: cityName } = parseLocation(city);
    const startPhase: "neighbourhood"|"city"|"national" =
      !neighbourhood && !cityName ? "national" : neighbourhood ? "neighbourhood" : "city";
    setPhase(startPhase);
    setPhasePageNum(0);
    const venues = await fetchPhase(startPhase, 0, city, new Set());
    const built  = await buildVendors(venues);
    setVendors(built);
    setSeenIds(new Set(venues.map((v:any) => v.id)));
    setHasMore(venues.length === PAGE_SIZE || (venues.length < PAGE_SIZE && startPhase !== "national"));
    setIsLoading(false);
  };

  useEffect(() => { initFetch(userCity); }, [userCity]);

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const { city: cityName } = parseLocation(userCity);
    let currentPhase: "neighbourhood" | "city" | "national" = phase;
    let currentPageNum = phasePageNum + 1;

    let venues = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);

    if (venues.length < PAGE_SIZE) {
      if (currentPhase === "neighbourhood") {
        if (cityName) {
          currentPhase = "city";
          currentPageNum = 0;
          venues = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
          if (venues.length < PAGE_SIZE) {
            currentPhase = "national";
            currentPageNum = 0;
            setShowNationalDivider(true);
            venues = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
          }
        } else {
          currentPhase = "national";
          currentPageNum = 0;
          setShowNationalDivider(true);
          venues = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
        }
      } else if (currentPhase === "city") {
        currentPhase = "national";
        currentPageNum = 0;
        setShowNationalDivider(true);
        venues = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
      }
      // national exhausted → hasMore becomes false
    }

    if (venues.length > 0) {
      const built = await buildVendors(venues);
      setVendors(prev => [...prev, ...built]);
      setSeenIds(prev => { const s = new Set(prev); venues.forEach((v:any) => s.add(v.id)); return s; });
    }
    setPhase(currentPhase);
    setPhasePageNum(currentPageNum);
    setHasMore(venues.length > 0);
    setIsFetchingMore(false);
  };

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !isFetchingMore && hasMore) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFetchingMore, hasMore, phase, phasePageNum, seenIds, userCity]);

  // ── Saved — persisted to DB ───────────────────────────────────────────
  const { data: savedVenueIds = [] } = useQuery({
    queryKey: ["saved-venues", user?.id, "hotel"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("saved_venues") as any)
        .select("venue_id").eq("user_id", user.id);
      return (data || []).map((r: any) => r.venue_id) as string[];
    },
    enabled:   !!user?.id,
    staleTime: 1000 * 30,
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async (venueId: string) => {
      if (!user?.id) { router.push("/login"); return; }
      const isSaved = savedVenueIds.includes(venueId);
      if (isSaved) {
        await (supabase.from("saved_venues") as any)
          .delete().eq("user_id", user.id).eq("venue_id", venueId);
      } else {
        await (supabase.from("saved_venues") as any)
          .insert({ user_id: user.id, venue_id: venueId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-venues", user?.id, "hotel"] }),
  });

  const filtered = (vendors || []).filter((v: any) => {
    const venue = v.venue || {};
    if (showSaved && !savedVenueIds.includes(v.venueId)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!v.business_name?.toLowerCase().includes(q) && !venue.address?.toLowerCase().includes(q)) return false;
    }
    if (nearMe && userLat && userLng) {
      if (!venue.lat || !venue.lng) return false;
      if (haversineKm(userLat, userLng, venue.lat, venue.lng) > 25) return false;
    }
    if (aAmenities.length > 0) {
      const tags = (v.listings[0]?.amenities || venue.filters || []).map((t: string) => t.toLowerCase());
      if (!aAmenities.some(a => tags.includes(a.toLowerCase()))) return false;
    }
    if (aPriceTier !== null) {
      const pt    = PRICE_TIERS[aPriceTier];
      const price = v.starting_price || 0;
      if (aPriceTier === 0 && price > pt.max)                 return false;
      if (aPriceTier === 1 && (price <= 0 || price > pt.max)) return false;
      if (aPriceTier === 2 && price < 100000)                 return false;
    }
    if (aStarRating !== null && (venue.rating || 0) < aStarRating) return false;
    return true;
  });

  const featured = filtered.filter((v: any) =>  v.venue?.is_featured);
  const topRated = filtered.filter((v: any) => !v.venue?.is_featured && (v.venue?.rating || 0) >= 4).slice(0, 8);
  const nearby   = userLat && userLng
    ? filtered
        .filter((v: any) => v.venue?.lat && v.venue?.lng)
        .map((v: any) => ({ ...v, _d: haversineKm(userLat, userLng, v.venue.lat, v.venue.lng) }))
        .sort((a: any, b: any) => a._d - b._d).slice(0, 6)
    : [];
  const newAdded = [...filtered]
    .sort((a: any, b: any) => new Date(b.venue?.created_at || 0).getTime() - new Date(a.venue?.created_at || 0).getTime())
    .slice(0, 6);

  const filterActive = aAmenities.length > 0 || aPriceTier !== null || aStarRating !== null;
  const anyActive    = search.trim() !== "" || nearMe || showSaved || filterActive;

  const pill = (active: boolean, color = ACCENT, bg = ACCENT_BG): React.CSSProperties => ({
    display:"flex", alignItems:"center", gap:5, padding:"7px 13px",
    borderRadius:999, border:"1.5px solid",
    borderColor: active ? color : "#E4DCF0",
    backgroundColor: active ? bg : "#F7F5FA",
    cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" as const,
    fontSize:12, fontWeight: active ? 700 : 600,
    color: active ? color : "#6B6B6B",
  });

  const renderCard = (v: any, i: number) => (
    <motion.div key={v.id || v.venueId} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}>
      <HotelCard
        vendor={v}
        isSaved={savedVenueIds.includes(v.venueId)}
        onToggleSave={() => toggleSaveMutation.mutate(v.venueId)}
      />
    </motion.div>
  );

  return (
    <MainLayout>
      <div style={{ backgroundColor:"#FFFFFF", position:"sticky", top:0, zIndex:40, borderBottom:showFilter?"none":"1px solid #F2EEF9", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 16px 8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => router.back()} style={{ background:"none", border:"none", cursor:"pointer", padding:6, marginLeft:-6, display:"flex" }}>
              <ArrowLeft size={22} style={{ color:"#0A0A0A" }}/>
            </button>
            <div>
              <h1 style={{ fontSize:20, fontWeight:900, color:"#0A0A0A", margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>
                {CATEGORY_EMOJI} Hotels & Resorts
              </h1>
              <p style={{ fontSize:11, color:"#9E9E9E", margin:0 }}>
                {isLoading ? "Loading..." : `${filtered.length} hotel${filtered.length !== 1 ? "s" : ""} found`}
              </p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {anyActive && (
              <button onClick={clearAll} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"1px solid #FECACA", borderRadius:999, padding:"4px 10px", cursor:"pointer" }}>
                <X size={10} style={{ color:"#EF4444" }}/><span style={{ fontSize:11, fontWeight:700, color:"#EF4444" }}>Clear</span>
              </button>
            )}
            <LocationHeader
              onLocationResolved={(city) => {
                setUserCity(city === "__everywhere__" ? "__everywhere__" : city);
                if (city !== "__everywhere__") {
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
                    () => {}
                  );
                }
              }}
            />
          </div>
        </div>

        <div style={{ display:"flex", gap:8, padding:"0 16px 12px", overflowX:"auto", scrollbarWidth:"none" }}>
          <button onClick={openFilter} style={pill(filterActive || showFilter)}>
            <SlidersHorizontal size={13}/>Filter
            {filterActive && <div style={{ width:6, height:6, borderRadius:"50%", backgroundColor:ACCENT }}/>}
          </button>
          <button onClick={() => setShowSaved(!showSaved)} style={pill(showSaved, "#FF4B6E", "#FFF0F3")}>
            <Heart size={13} style={{ fill:showSaved?"#FF4B6E":"none" }}/>Saved
          </button>
          <button onClick={() => {
            setNearMe(!nearMe);
            if (!nearMe) navigator.geolocation?.getCurrentPosition(
              (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
              () => {}
            );
          }} style={pill(nearMe)}>
            <MapPin size={13}/>Near Me
          </button>
          <button onClick={() => setShowSearch(!showSearch)} style={pill(showSearch || !!search)}>
            <Search size={13}/>Search
          </button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }} style={{ overflow:"hidden" }}>
              <div style={{ padding:"0 16px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, backgroundColor:"#F7F5FA", border:`1.5px solid ${ACCENT}`, borderRadius:14, padding:"11px 14px" }}>
                  <Search size={15} style={{ color:ACCENT }}/>
                  <input autoFocus type="text" placeholder="Search hotels..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }}/>
                  {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={14} style={{ color:"#9E9E9E" }}/></button>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFilter && (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                onClick={applyFilter}
                style={{ position:"fixed", inset:0, zIndex:38, backgroundColor:"rgba(0,0,0,0.25)" }}/>
              <motion.div initial={{ y:-12, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:-12, opacity:0 }}
                transition={{ type:"spring", damping:30, stiffness:350 }}
                style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:39, backgroundColor:"#FFFFFF", borderRadius:"0 0 24px 24px", boxShadow:"0 12px 40px rgba(0,0,0,0.12)", maxHeight:"72vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>

                <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 0" }}>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#0A0A0A", margin:0 }}>Price per Night</p>
                      <button onClick={() => setPriceTier(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      {PRICE_TIERS.map((pt, idx) => (
                        <button key={pt.label} onClick={() => setPriceTier(priceTier === idx ? null : idx)}
                          style={{ flex:1, padding:"12px 8px", borderRadius:16, border:"2px solid", borderColor:priceTier===idx?ACCENT:"#E4DCF0", backgroundColor:priceTier===idx?ACCENT_BG:"#FFFFFF", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                          <span style={{ fontSize:20 }}>{pt.icon}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:priceTier===idx?ACCENT:"#0A0A0A" }}>{pt.label}</span>
                          <span style={{ fontSize:10, color:"#9E9E9E" }}>{pt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#0A0A0A", margin:0 }}>Guest Rating</p>
                      <button onClick={() => setStarRating(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      {STAR_RATINGS.map(sr => (
                        <button key={sr.label} onClick={() => setStarRating(starRating === sr.min ? null : sr.min)}
                          style={{ flex:1, padding:"10px 0", borderRadius:12, border:"2px solid", borderColor:starRating===sr.min?ACCENT:"#E4DCF0", backgroundColor:starRating===sr.min?ACCENT_BG:"#FFFFFF", color:starRating===sr.min?ACCENT:"#6B6B6B", fontSize:13, fontWeight:starRating===sr.min?700:500, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                          <Star size={12} style={{ color:starRating===sr.min?ACCENT:"#FBBF24", fill:starRating===sr.min?ACCENT:"#FBBF24" }}/>{sr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#0A0A0A", margin:0 }}>Amenities</p>
                      <button onClick={() => setAmenities([])} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {AMENITIES.map(a => {
                        const on = amenities.includes(a);
                        return (
                          <button key={a} onClick={() => setAmenities(on ? amenities.filter(x => x !== a) : [...amenities, a])}
                            style={{ padding:"8px 14px", borderRadius:999, border:"1.5px solid", borderColor:on?ACCENT:"#E4DCF0", backgroundColor:on?ACCENT_BG:"#FFFFFF", color:on?ACCENT:"#6B6B6B", fontSize:12, fontWeight:on?700:500, cursor:"pointer" }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ padding:"12px 20px 24px", borderTop:"1px solid #F2EEF9", flexShrink:0 }}>
                  <button onClick={applyFilter}
                    style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"none", backgroundColor:"#0A0A0A", color:"#FFFFFF", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {showNationalDivider && vendors.length > 0 && (
        <div style={{ margin:"8px 16px 0", backgroundColor:"#FEF3C7", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🇳🇬</span>
          <p style={{ fontSize:12, fontWeight:700, color:"#D97706", margin:0 }}>More from across Nigeria</p>
        </div>
      )}
      <div style={{ padding:"16px" }}>
        {isLoading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {Array.from({ length:4 }).map((_,i) => (
              <div key={i} style={{ height:260, borderRadius:20, backgroundColor:"#F2EEF9" }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", paddingTop:80 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>{showSaved ? "❤️" : CATEGORY_EMOJI}</div>
            <p style={{ fontWeight:800, fontSize:16, color:"#0A0A0A", margin:"0 0 6px" }}>
              {showSaved ? "No saved hotels yet" : "No hotels found"}
            </p>
            <p style={{ fontSize:13, color:"#9E9E9E", margin:"0 0 20px" }}>
              {showSaved ? "Tap the heart on any hotel to save it" : "Try adjusting your filters"}
            </p>
            <button onClick={clearAll}
              style={{ padding:"10px 28px", borderRadius:12, border:"none", backgroundColor:ACCENT, color:"#FFFFFF", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Clear filters
            </button>
          </div>
        ) : showSaved ? (
          <Section title="❤️ Your Saved" subtitle="Hotels you've saved">
            {filtered.map(renderCard)}
          </Section>
        ) : anyActive ? (
          <Section title={`${filtered.length} result${filtered.length !== 1 ? "s" : ""}`} subtitle="Matching your filters">
            {filtered.map(renderCard)}
          </Section>
        ) : (
          <>
            {featured.length > 0 && <Section title="✨ Featured" subtitle="Top-rated hotels">{featured.map(renderCard)}</Section>}
            {topRated.length > 0 && <Section title={`⭐ Top Rated in ${userCity}`} subtitle="Highly rated by guests">{topRated.map(renderCard)}</Section>}
            {nearby.length   > 0 && <Section title="📍 Near You" subtitle="Closest hotels">{nearby.map(renderCard)}</Section>}
            {newAdded.length  > 0 && <Section title="🆕 New on Chillz" subtitle="Recently listed">{newAdded.map(renderCard)}</Section>}
          </>
        )}
      </div>
    <div ref={bottomRef} style={{ height: 1 }} />
      {isFetchingMore && (
        <div style={{ display:"flex", justifyContent:"center", padding:"20px 0" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }}/>
        </div>
      )}
      {!hasMore && vendors.length > 0 && (
        <p style={{ textAlign:"center", fontSize:12, color:"#C4BAD8", padding:"16px 0 32px" }}>You've seen all hotels ✓</p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}