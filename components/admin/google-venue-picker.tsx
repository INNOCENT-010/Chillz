/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect } from "react";
import { Search, MapPin, X, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type GoogleVenueResult = {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
};

interface Props {
  onSelect: (venue: GoogleVenueResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function GoogleVenuePicker({ onSelect, placeholder = "Search venue on Google...", disabled }: Props) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GoogleVenueResult | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query.length < 2) { setPredictions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
        const data = await res.json();
        setPredictions(data.predictions || []);
      } catch {}
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = async (prediction: any) => {
    setFetchingDetails(true);
    setPredictions([]);
    setQuery(prediction.description);
    try {
      const res = await fetch(`/api/places/details?place_id=${prediction.place_id}`);
      const data = await res.json();
      if (data.place_id) {
        setSelected(data);
        onSelect(data);
      }
    } catch {}
    finally { setFetchingDetails(false); }
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setPredictions([]);
  };

  return (
    <div style={{ position: "relative" }}>
      {selected ? (
        <div style={{ backgroundColor: "#E0F7EA", border: "1.5px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#065F46", margin: "0 0 2px" }}>{selected.name}</p>
            <p style={{ fontSize: 11, color: "#047857", margin: "0 0 2px" }}>{selected.address}</p>
            <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontFamily: "monospace" }}>
              {selected.lat?.toFixed(5)}, {selected.lng?.toFixed(5)}
            </p>
          </div>
          <button onClick={handleClear}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <X size={14} style={{ color: "#059669" }} />
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "11px 14px" }}>
            {loading || fetchingDetails
              ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              : <Search size={14} style={{ color: "#9E9E9E", flexShrink: 0 }} />}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              disabled={disabled || fetchingDetails}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }}
            />
            {query && (
              <button onClick={handleClear} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <X size={12} style={{ color: "#9E9E9E" }} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {predictions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100, backgroundColor: "#FFFFFF", borderRadius: 14, border: "1.5px solid #E4DCF0", overflow: "hidden", boxShadow: "0 8px 24px rgba(91,14,166,0.12)" }}>
                {predictions.map((pred: any) => (
                  <button key={pred.place_id} onClick={() => handleSelect(pred)}
                    style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #F7F5FA", backgroundColor: "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <MapPin size={13} style={{ color: "#9E9E9E", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {pred.structured_formatting?.main_text || pred.description}
                      </p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {pred.structured_formatting?.secondary_text || ""}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}