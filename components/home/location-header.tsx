"use client";
import { useState, useEffect } from "react";
import { MapPin, ChevronDown, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "chillz_location";

const NIGERIAN_AREAS = [
  "lekki","victoria island","ikeja","surulere","yaba","ikoyi",
  "ajah","festac","apapa","maryland","ojodu","ogba","gbagada",
  "magodo","ketu","berger","abuja","port harcourt","ibadan",
  "kano","enugu","benin","warri","calabar","owerri","uyo",
  "abeokuta","lagos","nigeria","rivers","ogun","oyo",
];

function isNigerianLocation(loc: string): boolean {
  return NIGERIAN_AREAS.some((a) => loc.toLowerCase().includes(a));
}

interface Props {
  onLocationResolved?: (city: string) => void;
  // These are called by the parent to render banner outside this component
  onShowConfirm?: (display: string) => void;
  onHideConfirm?: () => void;
}

export function LocationHeader({ onLocationResolved, onShowConfirm, onHideConfirm }: Props) {
  const [display, setDisplay] = useState("Lagos");
  const [confirmed, setConfirmed] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const resolveAndNotify = (loc: string, isConfirmed = false) => {
    setDisplay(loc);
    const parts = loc.split(",").map((s) => s.trim());
    const city = parts[0] === parts[1] ? `${parts[0]}, Nigeria` : loc;
    onLocationResolved?.(city);
    if (!isConfirmed) {
      onShowConfirm?.(loc);
    } else {
      onHideConfirm?.();
    }
  };

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.location && parsed.confirmed) {
          setDisplay(parsed.location);
          setConfirmed(true);
          resolveAndNotify(parsed.location, true);
          return;
        }
        if (parsed.location && isNigerianLocation(parsed.location)) {
          setDisplay(parsed.location);
          resolveAndNotify(parsed.location, false);
          return;
        }
      }
    } catch { /* ignore */ }
    detect();
  }, []);

  const detect = async () => {
    setDetecting(true);
    setConfirmed(false);
    onHideConfirm?.();

    if (!navigator.geolocation) {
      setDisplay("Lagos");
      resolveAndNotify("Lagos", true);
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          const data = await res.json();
          const loc = data.location || "Lagos";

          if (!isNigerianLocation(loc)) {
            setDisplay("Lagos");
            resolveAndNotify("Lagos", true);
            setDetecting(false);
            return;
          }

          setDisplay(loc);
          resolveAndNotify(loc, false);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ location: loc, confirmed: false }));
        } catch {
          setDisplay("Lagos");
          resolveAndNotify("Lagos", true);
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setDisplay("Lagos");
        resolveAndNotify("Lagos", true);
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 * 60 * 5 }
    );
  };

  // These are called from the parent banner buttons
  const confirmLocation = () => {
    setConfirmed(true);
    onHideConfirm?.();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ location: display, confirmed: true }));
    } catch { /* ignore */ }
  };

  const changeLocation = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setConfirmed(false);
    detect();
  };

  // Expose methods via ref pattern — simplest is to use a global event
  // Instead we pass these back up through context, but since parent needs them
  // we use a simpler approach: expose via data attributes and parent reads state
  // Actually cleanest: parent renders the banner, this renders only the pill

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
      onClick={!detecting ? changeLocation : undefined}
    >
      <MapPin size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} strokeWidth={2.5} />
      {detecting ? (
        <span style={{ fontSize: 13, color: "#9E9E9E", fontWeight: 500 }}>Locating...</span>
      ) : (
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#0A0A0A",
          maxWidth: 120, overflow: "hidden",
          whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {display}
        </span>
      )}
      <ChevronDown size={13} style={{ color: "#9E9E9E", flexShrink: 0 }} />
    </div>
  );
}

// ── Separate exported banner component ───────────────────────────────────
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
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.22 }}
        style={{ overflow: "hidden", margin: "8px 16px 0" }}
      >
        <div style={{
          backgroundColor: "#EDE0F7",
          borderRadius: 14,
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}>
          <p style={{ fontSize: 13, color: "#5B0EA6", margin: 0, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
            Is this your location?{" "}
            <span style={{ fontWeight: 800 }}>{display}</span>
          </p>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={onRetry}
              style={{
                padding: "6px 12px", borderRadius: 9,
                border: "1.5px solid #C4A0E8",
                backgroundColor: "#FFFFFF",
                color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: "6px 14px", borderRadius: 9,
                border: "none", backgroundColor: "#5B0EA6",
                color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Yes
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}