/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, MapPin, SlidersHorizontal, ArrowLeft,
  Heart, Star, Car, ChevronDown, CheckCircle,
  Fuel, Users, Shield,
} from "lucide-react";
import { LocationHeader } from "@/components/home/location-header";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const ACCENT    = "#0D9488";
const ACCENT_BG = "#CCFBF1";

const CAR_TYPES = ["Sedan","SUV","Bus / Van","Luxury","Convertible","Pickup","Mini Bus","Coaster","Truck"];
const FEATURES  = ["Self Drive","With Driver","Airport Pickup","Long Trip","AC","Tinted Windows","4WD","Fuel Inclusive"];
const PRICE_TIERS = [
  { label:"Budget",  icon:"💚", sub:"Under ₦30k/day", max:30000     },
  { label:"Mid",     icon:"💛", sub:"₦30k–₦100k",     max:100000    },
  { label:"Premium", icon:"💜", sub:"₦100k+",          max:999999999 },
];
const DURATION_OPTIONS = ["Hourly","Daily","Weekly"];

const FEATURE_ICONS: Record<string, any> = {
  "AC": CheckCircle, "Driver Included": Users, "With Driver": Users,
  "Self Drive": Car, "Fuel Included": Fuel, "Fuel Inclusive": Fuel,
  "Insured": Shield, "Airport Pickup": CheckCircle,
};

function haversineKm(la1:number,ln1:number,la2:number,ln2:number){
  const R=6371,dL=((la2-la1)*Math.PI)/180,dN=((ln2-ln1)*Math.PI)/180;
  const a=Math.sin(dL/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function CarCard({ vendor }: { vendor: any }) {
  const venue    = vendor.venue || {};
  const listings = vendor.listings || [];

  const venueImgs   = venue.images || [];
  const listingImgs = listings.flatMap((l: any) => l.images || []);
  const allImages   = venueImgs.length ? venueImgs : listingImgs;

  const [imgIndex, setImgIndex] = useState(0);
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStart = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const startPress = useCallback(() => {
    if (allImages.length <= 1) return;
    pressStart.current = setTimeout(() => {
      setPressing(true);
      pressTimer.current = setInterval(() => {
        setImgIndex(i => (i + 1) % allImages.length);
      }, 800);
    }, 300);
  }, [allImages.length]);

  const endPress = useCallback(() => {
    if (pressStart.current) clearTimeout(pressStart.current);
    if (pressTimer.current) clearInterval(pressTimer.current);
    setPressing(false);
  }, []);

  const topFeatures  = (venue.filters || []).slice(0, 3);
  const vehicleTypes = [...new Set(
    listings.map((l: any) => l.filters?.find((f: string) =>
      ["Sedan","SUV","Bus","Van","Luxury","Pickup","Truck","Automatic","Manual"].some(t => f.includes(t))
    )).filter(Boolean)
  )] as string[];

  const rating      = venue.rating      || 0;
  const reviewCount = venue.review_count || 0;

  return (
    <Link href={`/car-rentals/${vendor.id}`} style={{ textDecoration: "none", display: "block", marginBottom: 14 }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(13,148,136,0.08)", border: "1.5px solid #CCFBF1" }}>

        <div
          style={{ height: 190, position: "relative", overflow: "hidden", backgroundColor: "#CCFBF1", userSelect: "none" }}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={endPress}
        >
          {allImages.length > 0
            ? <img src={allImages[imgIndex]} alt={vendor.business_name}
                style={{ width: "100%", height: "100%", objectFit: "cover", transition: pressing ? "none" : "opacity 0.2s" }}
                draggable={false} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#134E4A,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Car size={44} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>}

          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 35%,rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }} />

          {pressing && allImages.length > 1 && (
            <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 2 }}>
              {allImages.map((_: any, i: number) => (
                <div key={i} style={{ width: i === imgIndex ? 16 : 5, height: 5, borderRadius: 999, backgroundColor: i === imgIndex ? "#FFFFFF" : "rgba(255,255,255,0.45)", transition: "width 0.2s" }} />
              ))}
            </div>
          )}

          {!pressing && allImages.length > 1 && (
            <div style={{ position: "absolute", top: 8, right: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, padding: "2px 8px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF" }}>Hold to browse</span>
            </div>
          )}

          {venue.is_featured && (
            <div style={{ position: "absolute", top: 10, left: 10, backgroundColor: "#00C853", borderRadius: 999, padding: "3px 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>Featured</span>
            </div>
          )}

          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 12px 10px" }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#FFFFFF", margin: "0 0 3px", fontFamily: "var(--font-display,Syne,sans-serif)", textShadow: "0 1px 4px rgba(0,0,0,0.4)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {vendor.business_name}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {venue.address && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, minWidth: 0 }}>
                  <MapPin size={10} style={{ color: "rgba(255,255,255,0.8)", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.address}</span>
                </div>
              )}
              {rating > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "2px 6px" }}>
                  <Star size={10} style={{ color: "#FFD700", fill: "#FFD700" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>{Number(rating).toFixed(1)}</span>
                  {reviewCount > 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>({reviewCount})</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 14px" }}>
          {topFeatures.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              {topFeatures.map((f: string) => {
                const Icon = FEATURE_ICONS[f] || CheckCircle;
                return (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: ACCENT_BG, borderRadius: 8, padding: "4px 8px" }}>
                    <Icon size={11} style={{ color: ACCENT, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT }}>{f}</span>
                  </div>
                );
              })}
              {(venue.filters || []).length > 3 && (
                <span style={{ fontSize: 10, color: "#9E9E9E" }}>+{(venue.filters || []).length - 3} more</span>
              )}
            </div>
          )}

          {vehicleTypes.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {vehicleTypes.slice(0, 3).map((vt: string) => (
                <span key={vt} style={{ fontSize: 10, fontWeight: 600, color: "#6B6B6B", backgroundColor: "#F7F5FA", padding: "3px 8px", borderRadius: 999, border: "1px solid #E4DCF0" }}>
                  {vt}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #F2EEF9" }}>
            <div>
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 1px" }}>Starting from</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: ACCENT, margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                  {vendor.starting_price ? formatCurrency(vendor.starting_price) : "See fleet"}
                </p>
                {vendor.starting_price && <span style={{ fontSize: 10, color: "#9E9E9E" }}>/day</span>}
              </div>
            </div>
            <button style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              View Fleet
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}



function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>{title}</h2>
        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function CarRentalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [search,       setSearch]       = useState("");
  const [showSearch,   setShowSearch]   = useState(false);
  const [showFilter,   setShowFilter]   = useState(false);
  const [showSaved,    setShowSaved]    = useState(false);
  const [quickDriver,  setQuickDriver]  = useState(false);
  const [quickSelf,    setQuickSelf]    = useState(false);
  const [quickAirport, setQuickAirport] = useState(false);
  const [nearMe,       setNearMe]       = useState(false);
  const [userLat,      setUserLat]      = useState<number | null>(null);
  const [userLng,      setUserLng]      = useState<number | null>(null);
  const [userCity,     setUserCity]     = useState("Lagos");

  const [carTypes,   setCarTypes]   = useState<string[]>([]);
  const [features,   setFeatures]   = useState<string[]>([]);
  const [priceTier,  setPriceTier]  = useState<number | null>(null);
  const [duration,   setDuration]   = useState<string | null>(null);
  const [aCarTypes,  setACarTypes]  = useState<string[]>([]);
  const [aFeatures,  setAFeatures]  = useState<string[]>([]);
  const [aPriceTier, setAPriceTier] = useState<number | null>(null);
  const [aDuration,  setADuration]  = useState<string | null>(null);

  const openFilter  = () => { setCarTypes(aCarTypes); setFeatures(aFeatures); setPriceTier(aPriceTier); setDuration(aDuration); setShowFilter(true); };
  const applyFilter = () => { setACarTypes(carTypes); setAFeatures(features); setAPriceTier(priceTier); setADuration(duration); setShowFilter(false); };
  const clearAll    = () => { setSearch(""); setNearMe(false); setShowSaved(false); setQuickDriver(false); setQuickSelf(false); setQuickAirport(false); setACarTypes([]); setAFeatures([]); setAPriceTier(null); setADuration(null); };

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
    let vendorMap: Record<string,any> = {};
    let listingMap: Record<string,any[]> = {};
    let priceMap: Record<string,number> = {};
    if (vendorIds.length) {
      const { data: vds } = await (supabase.from("vendors") as any)
        .select("id,business_name,description").in("id", vendorIds);
      (vds||[]).forEach((v:any) => { vendorMap[v.id] = v; });
      const { data: listings } = await (supabase.from("vendor_listings") as any)
        .select("vendor_id,price_per_unit,filters,images,title,driver_option")
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
        id: vd.id || venue.vendor_id || venue.id,
        venueId: venue.id,
        business_name: vd.business_name || venue.name,
        description: vd.description || null,
        starting_price: priceMap[venue.vendor_id] || null,
        listings: listingMap[venue.vendor_id] || [],
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
      .eq("is_active", true).eq("category", "car_rental")
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

  const { data: savedVenueIds } = useQuery({
    queryKey: ["saved-venues", user?.id, "car_rental"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("saved_venues") as any)
        .select("venue_id").eq("user_id", user.id);
      return (data || []).map((r: any) => r.venue_id) as string[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const filtered = (vendors || []).filter((v: any) => {
    const venue = v.venue || {};
    if (showSaved && !(savedVenueIds || []).includes(v.venueId)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!v.business_name?.toLowerCase().includes(q) && !venue.address?.toLowerCase().includes(q)) return false;
    }
    if (nearMe && userLat && userLng) {
      if (!venue.lat || !venue.lng) return false;
      if (haversineKm(userLat, userLng, venue.lat, venue.lng) > 25) return false;
    }
    const tags = (venue.filters || []).map((t: string) => t.toLowerCase());

    // ── Fixed: filter by driver_option on listings, not tags ──────────
    if (quickDriver && !v.listings.some((l: any) =>
      ["with_driver", "both"].includes(l.driver_option))) return false;
    if (quickSelf && !v.listings.some((l: any) =>
      ["self_drive", "both"].includes(l.driver_option))) return false;
    // ─────────────────────────────────────────────────────────────────

    if (quickAirport && !tags.includes("airport pickup")) return false;
    if (aFeatures.length > 0 && !aFeatures.some(f => tags.includes(f.toLowerCase()))) return false;
    if (aPriceTier !== null) {
      const pt    = PRICE_TIERS[aPriceTier];
      const price = v.starting_price || 0;
      if (aPriceTier === 0 && price > pt.max)                 return false;
      if (aPriceTier === 1 && (price <= 0 || price > pt.max)) return false;
      if (aPriceTier === 2 && price < 100000)                 return false;
    }
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

  const filterActive = aCarTypes.length > 0 || aFeatures.length > 0 || aPriceTier !== null || aDuration !== null;
  const anyActive    = search.trim() !== "" || nearMe || showSaved || quickDriver || quickSelf || quickAirport || filterActive;

  const pill = (active: boolean, color = ACCENT, bg = ACCENT_BG): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5, padding: "7px 13px",
    borderRadius: 999, border: "1.5px solid",
    borderColor: active ? color : "#E4DCF0",
    backgroundColor: active ? bg : "#F7F5FA",
    cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as const,
    fontSize: 12, fontWeight: active ? 700 : 600,
    color: active ? color : "#6B6B6B",
  });

  const renderCard = (v: any, i: number) => (
    <motion.div key={v.id || v.venueId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <CarCard vendor={v} />
    </motion.div>
  );

  return (
    <MainLayout>
      <div style={{ backgroundColor: "#FFFFFF", position: "sticky", top: 0, zIndex: 40, borderBottom: showFilter ? "none" : "1px solid #CCFBF1", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
              <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                🚗 Car Rentals
              </h1>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                {isLoading ? "Loading..." : `${filtered.length} rental${filtered.length !== 1 ? "s" : ""} found`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {anyActive && (
              <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #FECACA", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                <X size={10} style={{ color: "#EF4444" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>Clear</span>
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

        <div style={{ display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
          <button onClick={openFilter} style={pill(filterActive || showFilter)}>
            <SlidersHorizontal size={13} />Filter
            {filterActive && <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ACCENT }} />}
          </button>
          <button onClick={() => setShowSaved(!showSaved)} style={pill(showSaved, "#FF4B6E", "#FFF0F3")}>
            <Heart size={13} style={{ fill: showSaved ? "#FF4B6E" : "none" }} />Saved
          </button>
          <button onClick={() => { setQuickDriver(!quickDriver); if (quickSelf) setQuickSelf(false); }} style={pill(quickDriver)}>
            🧑‍✈️ With Driver
          </button>
          <button onClick={() => { setQuickSelf(!quickSelf); if (quickDriver) setQuickDriver(false); }} style={pill(quickSelf)}>
            🔑 Self Drive
          </button>
          <button onClick={() => setQuickAirport(!quickAirport)} style={pill(quickAirport)}>
            ✈️ Airport Pickup
          </button>
          <button onClick={() => {
            setNearMe(!nearMe);
            if (!nearMe) navigator.geolocation?.getCurrentPosition(
              (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); }, () => {}
            );
          }} style={pill(nearMe)}>
            <MapPin size={13} />Near Me
          </button>
          <button onClick={() => setShowSearch(!showSearch)} style={pill(showSearch || !!search)}>
            <Search size={13} />Search
          </button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
              <div style={{ padding: "0 16px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: `1.5px solid ${ACCENT}`, borderRadius: 14, padding: "11px 14px" }}>
                  <Search size={15} style={{ color: ACCENT }} />
                  <input autoFocus type="text" placeholder="Search car rentals..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                  {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={14} style={{ color: "#9E9E9E" }} /></button>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFilter && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={applyFilter}
                style={{ position: "fixed", inset: 0, zIndex: 38, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 39, backgroundColor: "#FFFFFF", borderRadius: "0 0 24px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", maxHeight: "72vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Price Range</p>
                      <button onClick={() => setPriceTier(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {PRICE_TIERS.map((pt, idx) => (
                        <button key={pt.label} onClick={() => setPriceTier(priceTier === idx ? null : idx)}
                          style={{ flex: 1, padding: "12px 8px", borderRadius: 16, border: "2px solid", borderColor: priceTier === idx ? ACCENT : "#E4DCF0", backgroundColor: priceTier === idx ? ACCENT_BG : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 20 }}>{pt.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: priceTier === idx ? ACCENT : "#0A0A0A" }}>{pt.label}</span>
                          <span style={{ fontSize: 10, color: "#9E9E9E" }}>{pt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Rental Period</p>
                      <button onClick={() => setDuration(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {DURATION_OPTIONS.map(d => (
                        <button key={d} onClick={() => setDuration(duration === d ? null : d)}
                          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "2px solid", borderColor: duration === d ? ACCENT : "#E4DCF0", backgroundColor: duration === d ? ACCENT_BG : "#FFFFFF", color: duration === d ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: duration === d ? 700 : 500, cursor: "pointer" }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Vehicle Type</p>
                      <button onClick={() => setCarTypes([])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {CAR_TYPES.map(t => {
                        const on = carTypes.includes(t);
                        return (
                          <button key={t} onClick={() => setCarTypes(on ? carTypes.filter(x => x !== t) : [...carTypes, t])}
                            style={{ padding: "8px 14px", borderRadius: 999, border: "1.5px solid", borderColor: on ? ACCENT : "#E4DCF0", backgroundColor: on ? ACCENT_BG : "#FFFFFF", color: on ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Features</p>
                      <button onClick={() => setFeatures([])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {FEATURES.map(f => {
                        const on = features.includes(f);
                        return (
                          <button key={f} onClick={() => setFeatures(on ? features.filter(x => x !== f) : [...features, f])}
                            style={{ padding: "8px 14px", borderRadius: 999, border: "1.5px solid", borderColor: on ? ACCENT : "#E4DCF0", backgroundColor: on ? ACCENT_BG : "#FFFFFF", color: on ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ padding: "12px 20px 24px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                  <button onClick={applyFilter}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", backgroundColor: "#0A0A0A", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 270, borderRadius: 20, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{showSaved ? "❤️" : "🚗"}</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>
              {showSaved ? "No saved rentals yet" : "No car rentals found"}
            </p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px" }}>
              {showSaved ? "Tap the heart on any listing to save it" : "Try adjusting your filters"}
            </p>
            <button onClick={clearAll}
              style={{ padding: "10px 28px", borderRadius: 12, border: "none", backgroundColor: ACCENT, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Clear filters
            </button>
          </div>
        ) : showSaved ? (
          <Section title="❤️ Your Saved" subtitle="Car rentals you've saved">
            {filtered.map(renderCard)}
          </Section>
        ) : anyActive ? (
          <Section title={`${filtered.length} result${filtered.length !== 1 ? "s" : ""}`} subtitle="Matching your filters">
            {filtered.map(renderCard)}
          </Section>
        ) : (
          <>
            {featured.length > 0 && <Section title="✨ Featured" subtitle="Top-rated rentals">{featured.map(renderCard)}</Section>}
            {topRated.length > 0 && <Section title={`⭐ Top Rated in ${userCity}`} subtitle="Highly rated by customers">{topRated.map(renderCard)}</Section>}
            {nearby.length   > 0 && <Section title="📍 Near You" subtitle="Closest rental companies">{nearby.map(renderCard)}</Section>}
            {newAdded.length  > 0 && <Section title="🆕 New on Chillz" subtitle="Recently joined vendors">{newAdded.map(renderCard)}</Section>}
          </>
        )}
      </div>
      {showNationalDivider && vendors.length > 0 && (
        <div style={{ margin:"8px 16px 0", backgroundColor:"#CCFBF1", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🇳🇬</span>
          <p style={{ fontSize:12, fontWeight:700, color:"#0D9488", margin:0 }}>More from across Nigeria</p>
        </div>
      )}
      <div ref={bottomRef} style={{ height:1 }}/>
      {isFetchingMore && (
        <div style={{ display:"flex", justifyContent:"center", padding:"20px 0" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }}/>
        </div>
      )}
      {!hasMore && vendors.length > 0 && (
        <p style={{ textAlign:"center", fontSize:12, color:"#C4BAD8", padding:"16px 0 32px" }}>You've seen all rentals ✓</p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}