/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, X, MapPin, SlidersHorizontal,
  Star, Clock, ChevronDown, Zap, Utensils, Heart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isOpenNowWAT, getOpenStatusLabel } from "@/lib/time-utils";
import { formatCurrency } from "@/lib/utils";
import { priceLevelLabel } from "@/lib/price-utils";
import { useAuthStore } from "@/store/auth";

const ACCENT    = "#D97706";
const ACCENT_BG = "#FEF3C7";

const NIGERIAN_STATES = [
  "All","Lagos","FCT","Rivers","Kano","Ogun","Oyo","Delta","Enugu",
  "Edo","Imo","Anambra","Cross River","Kaduna","Kwara","Katsina",
  "Benue","Plateau","Bayelsa","Ekiti","Osun","Ondo","Abia",
  "Ebonyi","Akwa Ibom","Taraba","Niger","Sokoto","Kebbi","Adamawa",
];

const CUISINE_TYPES = [
  "All","Nigerian","Continental","Chinese","Indian","Italian",
  "Lebanese","American","Japanese","Korean","Mediterranean",
  "Fast Food","Seafood","Grill & BBQ","Vegetarian","Pizza",
];

const PRICE_RANGES = [
  { label: "All",      value: "all"  },
  { label: "₦ Budget", value: "low"  },
  { label: "₦₦ Mid",   value: "mid"  },
  { label: "₦₦₦ Fine", value: "high" },
];

interface Filters {
  city:       string;
  cuisine:    string;
  priceRange: string;
  openNow:    boolean;
  minRating:  number;
}

const DEFAULT_FILTERS: Filters = {
  city: "All", cuisine: "All", priceRange: "all", openNow: false, minRating: 0,
};

function haversineKm(la1: number, ln1: number, la2: number, ln2: number) {
  const R = 6371, dL = ((la2-la1)*Math.PI)/180, dN = ((ln2-ln1)*Math.PI)/180;
  const a = Math.sin(dL/2)**2 + Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ── Restaurant card with long-press slideshow + save ──────────────────────
function RestaurantCard({ venue, savedIds, onToggleSave }: {
  venue: any;
  savedIds: string[];
  onToggleSave: (venueId: string) => void;
}) {
  const images   = venue.images || [];
  const [imgIdx, setImgIdx]     = useState(0);
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStart = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const startPress = useCallback(() => {
    if (images.length <= 1) return;
    pressStart.current = setTimeout(() => {
      setPressing(true);
      pressTimer.current = setInterval(() => {
        setImgIdx(i => (i + 1) % images.length);
      }, 800);
    }, 300);
  }, [images.length]);

  const endPress = useCallback(() => {
    if (pressStart.current) clearTimeout(pressStart.current);
    if (pressTimer.current) clearInterval(pressTimer.current);
    setPressing(false);
  }, []);

  const hasHours = venue.opening_hours && Object.keys(venue.opening_hours).length > 0;
  const { isOpen, label: openLabel } = getOpenStatusLabel(venue.opening_hours);
  const rating      = venue.rating       || 0;
  const reviewCount = venue.review_count || 0;
  const isSaved     = savedIds.includes(venue.id);

  return (
    <Link href={`/venue/${venue.id}`} style={{ textDecoration: "none", display: "block", marginBottom: 14 }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(217,119,6,0.08)", border: "1.5px solid #FEF3C7" }}>

        {/* Hero with long-press slideshow */}
        <div
          style={{ height: 190, position: "relative", overflow: "hidden", backgroundColor: ACCENT_BG, userSelect: "none" }}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={endPress}
        >
          {images.length > 0
            ? <img src={images[imgIdx]} alt={venue.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", transition: pressing ? "none" : "opacity 0.2s" }}
                draggable={false} />
            : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,#92400E,${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Utensils size={44} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>}

          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 35%,rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }} />

          {/* Slideshow dots */}
          {pressing && images.length > 1 && (
            <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 2 }}>
              {images.map((_: any, i: number) => (
                <div key={i} style={{ width: i === imgIdx ? 16 : 5, height: 5, borderRadius: 999, backgroundColor: i === imgIdx ? "#FFFFFF" : "rgba(255,255,255,0.45)", transition: "width 0.2s" }} />
              ))}
            </div>
          )}
          {!pressing && images.length > 1 && (
            <div style={{ position: "absolute", top: 8, right: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, padding: "2px 8px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF" }}>Hold to browse</span>
            </div>
          )}

          {/* Save / heart */}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSave(venue.id); }}
            style={{ position: "absolute", top: 10, left: 10, width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.15)" }}>
            <Heart size={15} style={{ color: isSaved ? "#EF4444" : "#9E9E9E", fill: isSaved ? "#EF4444" : "none" }} />
          </button>

          {/* Open badge — only show if we have reliable hours data */}
          {hasHours && (
            <div style={{ position: "absolute", top: 10, right: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", backgroundColor: isOpen ? "rgba(0,200,83,0.85)" : "rgba(239,68,68,0.85)", padding: "3px 9px", borderRadius: 999 }}>
                {isOpen ? "Open" : "Closed"}
              </span>
            </div>
          )}

          {venue.is_featured && (
            <div style={{ position: "absolute", bottom: 10, left: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF", backgroundColor: "#00C853", padding: "2px 8px", borderRadius: 999 }}>Featured</span>
            </div>
          )}

          {/* Bottom overlay — name + address */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 12px 10px" }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#FFFFFF", margin: "0 0 3px", fontFamily: "var(--font-display,Syne,sans-serif)", textShadow: "0 1px 4px rgba(0,0,0,0.4)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {venue.name}
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

        {/* Card body */}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Open status */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={11} style={{ color: isOpen ? "#00C853" : "#EF4444", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: isOpen ? "#00C853" : "#EF4444" }}>{openLabel}</span>
            </div>
            {/* Price indicator — vendor minimum spend or Google price level */}
            {venue.minimum_spend > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, backgroundColor: ACCENT_BG, padding: "2px 8px", borderRadius: 999 }}>
                From {formatCurrency(venue.minimum_spend)}
              </span>
            ) : priceLevelLabel(venue.google_data?.price_level) ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, backgroundColor: ACCENT_BG, padding: "2px 8px", borderRadius: 999 }}>
                {priceLevelLabel(venue.google_data?.price_level)}
              </span>
            ) : null}
          </div>

          {/* Tags */}
          {(venue.filters || venue.tags || []).length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {(venue.filters || venue.tags || []).slice(0, 3).map((tag: string) => (
                <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: "#6B6B6B", backgroundColor: "#F7F5FA", padding: "3px 8px", borderRadius: 999, border: "1px solid #E4DCF0" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function LocationPill({ onCityResolved }: { onCityResolved: (c: string) => void }) {
  const [display,   setDisplay]   = useState("Lagos");
  const [detecting, setDetecting] = useState(false);
  useEffect(() => {
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(async pos => {
      try {
        const r = await fetch(`/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        const d = await r.json();
        const loc = (d.location || "Lagos").split(",")[0].trim();
        setDisplay(loc); onCityResolved(loc);
      } catch { setDisplay("Lagos"); onCityResolved("Lagos"); }
      finally   { setDetecting(false); }
    }, () => { setDisplay("Lagos"); onCityResolved("Lagos"); setDetecting(false); });
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
      <MapPin size={13} style={{ color: ACCENT, flexShrink: 0 }} strokeWidth={2.5} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", maxWidth: 90, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {detecting ? "..." : display}
      </span>
      <ChevronDown size={12} style={{ color: "#9E9E9E", flexShrink: 0 }} />
    </div>
  );
}

export default function RestaurantsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [filters,     setFilters]     = useState<Filters>({ ...DEFAULT_FILTERS });
  const [localF,      setLocalF]      = useState<Filters>({ ...DEFAULT_FILTERS });
  const [showFilter,  setShowFilter]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch,  setShowSearch]  = useState(false);
  const [showSaved,   setShowSaved]   = useState(false);
  const [nearMe,      setNearMe]      = useState(false);
  const [userLat,     setUserLat]     = useState<number|null>(null);
  const [userLng,     setUserLng]     = useState<number|null>(null);
  const [userCity,    setUserCity]    = useState("Lagos");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
    }, () => {});
  }, []);

  const PAGE_SIZE = 20;
  const [venues,         setVenues]         = useState<any[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore,        setHasMore]        = useState(true);
  const [currentPage,    setCurrentPage]    = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchPage = async (pageNum: number) => {
    const from = pageNum * PAGE_SIZE;
    const { data } = await (supabase.from("venues") as any)
      .select("id,name,address,images,rating,review_count,filters,tags,category,opening_hours,lat,lng,is_featured,minimum_spend,vendor_id,source,bookings_enabled,google_data")
      .eq("is_active", true)
      .in("category", ["restaurant","cafe"])
      .order("rating", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    return (data || []) as any[];
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPage(0).then(data => {
      setVenues(data);
      setHasMore(data.length === PAGE_SIZE);
      setIsLoading(false);
    });
  }, []);

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const next = currentPage + 1;
    const data = await fetchPage(next);
    setVenues(prev => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setCurrentPage(next);
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
  }, [isFetchingMore, hasMore, currentPage]);

  // Saved venues
  const { data: savedVenueIds = [], refetch: refetchSaved } = useQuery({
    queryKey: ["saved-venues", user?.id, "restaurant"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("saved_venues") as any)
        .select("venue_id").eq("user_id", user.id);
      return (data || []).map((r: any) => r.venue_id) as string[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const handleToggleSave = async (venueId: string) => {
    if (!user?.id) { router.push(`/login?redirect=/restaurants`); return; }
    const isSaved = savedVenueIds.includes(venueId);
    if (isSaved) {
      await (supabase.from("saved_venues") as any)
        .delete().eq("user_id", user.id).eq("venue_id", venueId);
    } else {
      await (supabase.from("saved_venues") as any)
        .insert({ user_id: user.id, venue_id: venueId });
    }
    refetchSaved();
  };

  const filtered = venues.filter((venue: any) => {
    if (showSaved && !savedVenueIds.includes(venue.id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!venue.name?.toLowerCase().includes(q) && !venue.address?.toLowerCase().includes(q)) return false;
    }
    if (filters.city !== "All" && !venue.address?.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.cuisine !== "All") {
      const tags        = (venue.tags || []).map((t: string) => t.toLowerCase());
      const filters_arr = (venue.filters || []).map((t: string) => t.toLowerCase());
      const googleTypes = (venue.google_data?.types || []).map((t: string) => t.toLowerCase().replace(/_/g, " "));
      const cat         = (venue.category || "").toLowerCase();
      const name        = (venue.name || "").toLowerCase();
      const filt        = filters.cuisine.toLowerCase();
      const hasAnyTags  = tags.length > 0 || filters_arr.length > 0;
      // Only apply cuisine filter to vendor venues that have tags; Google venues pass through
      if (hasAnyTags && !tags.includes(filt) && !filters_arr.includes(filt) && !cat.includes(filt) && !googleTypes.some((t:string) => t.includes(filt))) return false;
    }
    if (filters.openNow && !isOpenNowWAT(venue.opening_hours)) return false;
    if (filters.minRating > 0 && (venue.rating || 0) < filters.minRating) return false;
    if (nearMe && userLat && userLng && venue.lat && venue.lng) {
      if (haversineKm(userLat, userLng, venue.lat, venue.lng) > 10) return false;
    }
    return true;
  });

  const openFilter  = () => { setLocalF({ ...filters }); setShowFilter(true); };
  const applyFilter = () => { setFilters({ ...localF }); setShowFilter(false); };
  const clearAll    = () => { setFilters({ ...DEFAULT_FILTERS }); setSearchQuery(""); setNearMe(false); setShowSaved(false); };

  const anyActive = filters.openNow || filters.city !== "All" || filters.cuisine !== "All"
    || filters.priceRange !== "all" || filters.minRating > 0 || searchQuery.trim() || nearMe || showSaved;

  const pill = (active: boolean, color = ACCENT, bg = ACCENT_BG): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5,
    padding: "7px 13px", borderRadius: 999, border: "1.5px solid",
    borderColor: active ? color : "#E4DCF0",
    backgroundColor: active ? bg : "#F7F5FA",
    cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as const,
    fontSize: 12, fontWeight: active ? 700 : 600,
    color: active ? color : "#6B6B6B",
  });

  return (
    <MainLayout>
      {/* Sticky header */}
      <div style={{ backgroundColor: "#FFFFFF", position: "sticky", top: 0, zIndex: 40, borderBottom: "1px solid #FEF3C7", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
              <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>🍽️ Restaurants</h1>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                {isLoading ? "Loading..." : `${filtered.length} restaurant${filtered.length !== 1 ? "s" : ""} found`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {anyActive && (
              <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #FECACA", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                <X size={10} style={{ color: "#EF4444" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>Clear</span>
              </button>
            )}
            <LocationPill onCityResolved={c => { setUserCity(c); navigator.geolocation?.getCurrentPosition(p => { setUserLat(p.coords.latitude); setUserLng(p.coords.longitude); }, () => {}); }} />
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
          <button onClick={openFilter} style={pill(showFilter || (filters.cuisine !== "All" || filters.priceRange !== "all" || filters.minRating > 0 || filters.city !== "All"))}>
            <SlidersHorizontal size={13} />Filter
          </button>
          <button onClick={() => setShowSaved(!showSaved)} style={pill(showSaved, "#EF4444", "#FFF0F3")}>
            <Heart size={13} style={{ fill: showSaved ? "#EF4444" : "none" }} />Saved
          </button>
          <button onClick={() => setFilters(f => ({ ...f, openNow: !f.openNow }))} style={pill(filters.openNow)}>
            <Zap size={13} />Open Now
          </button>
          <button onClick={() => { setNearMe(!nearMe); if (!nearMe) navigator.geolocation?.getCurrentPosition(p => { setUserLat(p.coords.latitude); setUserLng(p.coords.longitude); }, () => {}); }} style={pill(nearMe)}>
            <MapPin size={13} />Near Me
          </button>
          <button onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchRef.current?.focus(), 100); }} style={pill(showSearch || !!searchQuery)}>
            <Search size={13} />Search
          </button>
          {CUISINE_TYPES.filter(c => c !== "All").map(cuisine => (
            <button key={cuisine}
              onClick={() => setFilters(f => ({ ...f, cuisine: f.cuisine === cuisine ? "All" : cuisine }))}
              style={pill(filters.cuisine === cuisine)}>
              {cuisine}
            </button>
          ))}
        </div>

        {/* Search input */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
              <div style={{ padding: "0 16px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: `1.5px solid ${ACCENT}`, borderRadius: 14, padding: "11px 14px" }}>
                  <Search size={15} style={{ color: ACCENT }} />
                  <input ref={searchRef} type="text" placeholder="Search restaurants..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                  {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={14} style={{ color: "#9E9E9E" }} /></button>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilter && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={applyFilter}
                style={{ position: "fixed", inset: 0, zIndex: 38, backgroundColor: "rgba(0,0,0,0.25)" }} />
              <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 39, backgroundColor: "#FFFFFF", borderRadius: "0 0 24px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", maxHeight: "70vh", overflowY: "auto", padding: 20 }}>

                {/* City */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>City / State</p>
                    <button onClick={() => setLocalF(f => ({ ...f, city: "All" }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {NIGERIAN_STATES.slice(0, 12).map(s => (
                      <button key={s} onClick={() => setLocalF(f => ({ ...f, city: s }))}
                        style={{ padding: "7px 13px", borderRadius: 999, border: "1.5px solid", borderColor: localF.city === s ? ACCENT : "#E4DCF0", backgroundColor: localF.city === s ? ACCENT_BG : "#FFFFFF", color: localF.city === s ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: localF.city === s ? 700 : 500, cursor: "pointer" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuisine */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Cuisine</p>
                    <button onClick={() => setLocalF(f => ({ ...f, cuisine: "All" }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {CUISINE_TYPES.map(c => (
                      <button key={c} onClick={() => setLocalF(f => ({ ...f, cuisine: c }))}
                        style={{ padding: "7px 13px", borderRadius: 999, border: "1.5px solid", borderColor: localF.cuisine === c ? ACCENT : "#E4DCF0", backgroundColor: localF.cuisine === c ? ACCENT_BG : "#FFFFFF", color: localF.cuisine === c ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: localF.cuisine === c ? 700 : 500, cursor: "pointer" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minimum rating */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Minimum Rating</p>
                    <button onClick={() => setLocalF(f => ({ ...f, minRating: 0 }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Clear</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[0, 3, 3.5, 4, 4.5].map(r => (
                      <button key={r} onClick={() => setLocalF(f => ({ ...f, minRating: r }))}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 12, border: "1.5px solid", borderColor: localF.minRating === r ? ACCENT : "#E4DCF0", backgroundColor: localF.minRating === r ? ACCENT_BG : "#FFFFFF", color: localF.minRating === r ? ACCENT : "#6B6B6B", fontSize: 12, fontWeight: localF.minRating === r ? 700 : 500, cursor: "pointer" }}>
                        {r === 0 ? "Any" : `${r}+⭐`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open Now toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px" }}>Open Now</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Only show currently open restaurants</p>
                  </div>
                  <button onClick={() => setLocalF(f => ({ ...f, openNow: !f.openNow }))}
                    style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: localF.openNow ? ACCENT : "#E4DCF0", position: "relative", flexShrink: 0 }}>
                    <motion.div animate={{ x: localF.openNow ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>

                <button onClick={applyFilter}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", backgroundColor: ACCENT, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Apply Filters
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Venue list */}
      <div style={{ padding: "14px 16px" }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 240, borderRadius: 20, backgroundColor: "#F2EEF9", marginBottom: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Utensils size={28} style={{ color: ACCENT }} />
            </motion.div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>No restaurants found</p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px" }}>Try adjusting your filters</p>
            <button onClick={clearAll}
              style={{ padding: "10px 28px", borderRadius: 12, border: "none", backgroundColor: ACCENT, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((venue: any, i: number) => (
            <motion.div key={venue.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <RestaurantCard
                venue={venue}
                savedIds={savedVenueIds}
                onToggleSave={handleToggleSave}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={bottomRef} style={{height:1}}/>
      {isFetchingMore && (
        <div style={{display:"flex",justifyContent:"center",padding:"16px 0"}}>
          <div style={{width:24,height:24,borderRadius:"50%",border:`2.5px solid ${ACCENT_BG}`,borderTopColor:ACCENT,animation:"spin 0.8s linear infinite"}}/>
        </div>
      )}
      <div ref={bottomRef} style={{ height: 1 }} />
      {isFetchingMore && (
        <div style={{ display:"flex", justifyContent:"center", padding:"20px 0" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }}/>
        </div>
      )}
      {!hasMore && venues.length > 0 && (
        <p style={{ textAlign:"center", fontSize:12, color:"#C4BAD8", padding:"16px 0 32px" }}>You've seen all restaurants ✓</p>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}