"use client";
import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronDown, Navigation, X, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY  = "chillz_location";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

const NIGERIAN_AREAS = [
  "lekki","victoria island","ikeja","surulere","yaba","ikoyi",
  "ajah","festac","apapa","maryland","ojodu","ogba","gbagada",
  "magodo","ketu","berger","abuja","port harcourt","ibadan",
  "kano","enugu","benin","warri","calabar","owerri","uyo",
  "abeokuta","lagos","nigeria","rivers","ogun","oyo",
];

const POPULAR_CITIES = [
  "Lagos", "Victoria Island, Lagos", "Lekki, Lagos",
  "Ikoyi, Lagos", "Ikeja, Lagos", "Surulere, Lagos",
  "Port Harcourt, Rivers", "GRA, Port Harcourt",
  "Abuja, FCT", "Wuse 2, Abuja", "Maitama, Abuja",
  "Ibadan, Oyo", "Enugu", "Kano",
];

type LocationMode = "auto" | "manual" | "off";

interface StoredLocation {
  mode: LocationMode;
  location: string;
  confirmed: boolean;
}

function isNigerianLocation(loc: string): boolean {
  return NIGERIAN_AREAS.some((a) => loc.toLowerCase().includes(a));
}

interface Props {
  onLocationResolved?: (city: string) => void;
  onShowConfirm?: (display: string) => void;
  onHideConfirm?: () => void;
}

export function LocationHeader({ onLocationResolved, onShowConfirm, onHideConfirm }: Props) {
  const [display,    setDisplay]    = useState("Lagos");
  const [detecting,  setDetecting]  = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [mode,       setMode]       = useState<LocationMode>("auto");
  const [search,     setSearch]     = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const notify = (loc: string) => {
    onLocationResolved?.(loc);
    onHideConfirm?.();
  };

  // Load saved preference on mount — cache valid for 3 hrs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredLocation & { savedAt?: number } = JSON.parse(saved);
        const age = Date.now() - (parsed.savedAt || 0);
        const fresh = age < CACHE_TTL_MS;

        if (parsed.mode === "off") {
          setMode("off");
          setDisplay("Everywhere");
          notify("__everywhere__");
          return;
        }
        if (parsed.mode === "manual" && parsed.location) {
          setMode("manual");
          setDisplay(parsed.location);
          notify(parsed.location);
          return;
        }
        if (parsed.mode === "auto" && parsed.location && fresh) {
          // Cache still valid — use saved location, no re-detect
          setMode("auto");
          setDisplay(parsed.location);
          notify(parsed.location);
          return;
        }
      }
    } catch { /* ignore */ }
    // No cache or expired — auto-detect silently
    autoDetect();
  }, []);

  const autoDetect = async () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      setDisplay("Lagos");
      notify("Lagos");
      setDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res  = await fetch(`/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = await res.json();
          const loc  = data.location || "Lagos";
          const clean = isNigerianLocation(loc) ? loc : "Lagos";
          setDisplay(clean);
          setMode("auto");
          notify(clean);
          onShowConfirm?.(clean);
          // Save with timestamp — persists across refreshes for 3 hrs
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            mode: "auto", location: clean, confirmed: false, savedAt: Date.now(),
          }));
        } catch {
          setDisplay("Lagos"); notify("Lagos");
        } finally { setDetecting(false); }
      },
      () => { setDisplay("Lagos"); notify("Lagos"); setDetecting(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 * 60 * 5 }
    );
  };

  const selectCity = (mainText: string, description: string) => {
    // Strip country suffix
    const clean = description
      .replace(/, Nigeria$/i, "")
      .replace(/, Federal Republic of Nigeria$/i, "")
      .trim();

    const parts = clean.split(",").map(s => s.trim()).filter(Boolean);

    let city: string;
    if (parts.length === 1) {
      // e.g. "Lagos" — use as-is
      city = parts[0];
    } else if (parts.length === 2) {
      // e.g. "Woji, Port Harcourt" — perfect, use as-is
      city = `${parts[0]}, ${parts[1]}`;
    } else {
      // e.g. "Tombia Street, Woji, Port Harcourt, Rivers"
      // We want neighbourhood + city — skip street (part[0]), take next two
      // But with (regions) type streets won't appear, so parts[0] is neighbourhood
      // and parts[1] is the city. Take those two.
      city = `${parts[0]}, ${parts[1]}`;
    }

    setDisplay(city);
    setMode("manual");
    notify(city);
    setShowPicker(false);
    setSearch("");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: "manual", location: city, confirmed: true, savedAt: Date.now(),
    }));
  };

  const setOff = () => {
    setDisplay("Everywhere");
    setMode("off");
    notify("__everywhere__");
    setShowPicker(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: "off", location: "", confirmed: true, savedAt: Date.now(),
    }));
  };

  const setAuto = () => {
    setShowPicker(false);
    setMode("auto");
    // Clear cache so fresh detection runs
    localStorage.removeItem(STORAGE_KEY);
    autoDetect();
  };

  const [suggestions,     setSuggestions]     = useState<{placeId:string; description:string; mainText:string}[]>([]);
  const [suggestLoading,  setSuggestLoading]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res  = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(search)}`);
        const data = await res.json();
        const mapped = (data.predictions || []).map((p: any) => ({
          placeId:     p.place_id,
          description: p.description,
          mainText:    p.structured_formatting?.main_text || p.description,
        }));
        setSuggestions(mapped);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const filteredCities = POPULAR_CITIES; // used only when search is empty

  return (
    <>
      {/* Pill button */}
      <button
        onClick={() => { setShowPicker(true); setTimeout(() => searchRef.current?.focus(), 100); }}
        style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", background:"none", border:"none", padding:0 }}
      >
        <MapPin size={14} style={{ color:"#5B0EA6", flexShrink:0 }} strokeWidth={2.5}/>
        <span style={{ fontSize:13, fontWeight:700, color:"#0A0A0A", maxWidth:110, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
          {detecting ? "Locating..." : display}
        </span>
        <ChevronDown size={13} style={{ color:"#9E9E9E", flexShrink:0 }}/>
      </button>

      {/* Picker sheet */}
      <AnimatePresence>
        {showPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setShowPicker(false); setSearch(""); }}
              style={{ position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.45)", zIndex:60 }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ type:"spring", damping:30, stiffness:300 }}
              style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:61, backgroundColor:"#FFFFFF", borderRadius:"24px 24px 0 0", maxWidth:480, margin:"0 auto", maxHeight:"82vh", display:"flex", flexDirection:"column" }}
            >
              {/* Handle + header */}
              <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
                <div style={{ width:40, height:4, backgroundColor:"#E4DCF0", borderRadius:999, margin:"12px auto 14px" }}/>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <h3 style={{ fontSize:17, fontWeight:900, color:"#0A0A0A", margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>
                    Choose Location
                  </h3>
                  <button onClick={() => { setShowPicker(false); setSearch(""); }}
                    style={{ width:32, height:32, borderRadius:10, backgroundColor:"#F2EEF9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <X size={16} style={{ color:"#6B6B6B" }}/>
                  </button>
                </div>

                {/* Mode buttons */}
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  <button
                    onClick={setAuto}
                    style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1.5px solid", borderColor:mode==="auto"?"#5B0EA6":"#E4DCF0", backgroundColor:mode==="auto"?"#EDE0F7":"#F7F5FA", color:mode==="auto"?"#5B0EA6":"#6B6B6B", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                    <Navigation size={13}/> Auto-detect
                    {mode==="auto" && <Check size={12}/>}
                  </button>
                  <button
                    onClick={setOff}
                    style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1.5px solid", borderColor:mode==="off"?"#5B0EA6":"#E4DCF0", backgroundColor:mode==="off"?"#EDE0F7":"#F7F5FA", color:mode==="off"?"#5B0EA6":"#6B6B6B", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                    🌍 Everywhere
                    {mode==="off" && <Check size={12}/>}
                  </button>
                </div>

                {/* Search */}
                <div style={{ display:"flex", alignItems:"center", gap:8, backgroundColor:"#F7F5FA", border:"1.5px solid #E4DCF0", borderRadius:14, padding:"11px 14px", marginBottom:12 }}>
                  <Search size={14} style={{ color:"#9E9E9E", flexShrink:0 }}/>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search city or area..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#0A0A0A", fontFamily:"inherit" }}
                  />
                  {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={13} style={{ color:"#9E9E9E" }}/></button>}
                </div>
              </div>

              {/* City list */}
              <div style={{ flex:1, overflowY:"auto", padding:"0 20px 32px" }}>

                {/* ── Searching: Google autocomplete results ── */}
                {search.trim() ? (
                  suggestLoading ? (
                    <div style={{ display:"flex", justifyContent:"center", padding:"32px 0" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", border:"2.5px solid #EDE0F7", borderTopColor:"#5B0EA6", animation:"spin 0.8s linear infinite" }}/>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"32px 0", color:"#9E9E9E", fontSize:13 }}>
                      No results for "{search}"
                    </div>
                  ) : (
                    suggestions.map(s => (
                      <button
                        key={s.placeId}
                        onClick={() => selectCity(s.mainText, s.description)}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"13px 14px", borderRadius:14, border:"none", backgroundColor:"transparent", cursor:"pointer", marginBottom:4, textAlign:"left" }}
                      >
                        <div style={{ width:34, height:34, borderRadius:10, backgroundColor:"#F2EEF9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <MapPin size={14} style={{ color:"#9E9E9E" }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:14, fontWeight:600, color:"#0A0A0A", margin:"0 0 2px", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                            {s.mainText}
                          </p>
                          <p style={{ fontSize:11, color:"#9E9E9E", margin:0, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                            {s.description}
                          </p>
                        </div>
                        <MapPin size={13} style={{ color:"#C4BAD8", flexShrink:0 }}/>
                      </button>
                    ))
                  )
                ) : (
                  /* ── No search: popular cities ── */
                  <>
                    <p style={{ fontSize:11, fontWeight:700, color:"#9E9E9E", textTransform:"uppercase", letterSpacing:"0.07em", margin:"0 0 10px" }}>
                      Popular Cities
                    </p>
                    {filteredCities.map(city => (
                      <button
                        key={city}
                        onClick={() => selectCity(city, `${city}, Nigeria`)}
                        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 14px", borderRadius:14, border:"none", backgroundColor:display===city&&mode==="manual"?"#EDE0F7":"transparent", cursor:"pointer", marginBottom:4, textAlign:"left" }}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, backgroundColor:display===city&&mode==="manual"?"#C4A0E8":"#F2EEF9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <MapPin size={14} style={{ color:display===city&&mode==="manual"?"#5B0EA6":"#9E9E9E" }}/>
                          </div>
                          <span style={{ fontSize:14, fontWeight:display===city&&mode==="manual"?700:500, color:display===city&&mode==="manual"?"#5B0EA6":"#0A0A0A" }}>
                            {city}
                          </span>
                        </div>
                        {display===city&&mode==="manual" && <Check size={16} style={{ color:"#5B0EA6", flexShrink:0 }}/>}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Confirm banner — still exported for home page ─────────────────────────
interface BannerProps {
  display: string;
  onConfirm: () => void;
  onRetry: () => void;
}

export function LocationConfirmBanner({ display, onConfirm, onRetry }: BannerProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="location-banner"
        initial={{ opacity:0, y:-8, height:0 }}
        animate={{ opacity:1, y:0, height:"auto" }}
        exit={{ opacity:0, y:-8, height:0 }}
        transition={{ duration:0.22 }}
        style={{ overflow:"hidden", margin:"8px 16px 0" }}
      >
        <div style={{ backgroundColor:"#EDE0F7", borderRadius:14, padding:"11px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <p style={{ fontSize:13, color:"#5B0EA6", margin:0, fontWeight:500, flex:1, lineHeight:1.4 }}>
            Is this your location? <span style={{ fontWeight:800 }}>{display}</span>
          </p>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button onClick={onRetry}
              style={{ padding:"6px 12px", borderRadius:9, border:"1.5px solid #C4A0E8", backgroundColor:"#FFFFFF", color:"#5B0EA6", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Retry
            </button>
            <button onClick={onConfirm}
              style={{ padding:"6px 14px", borderRadius:9, border:"none", backgroundColor:"#5B0EA6", color:"#FFFFFF", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Yes
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}