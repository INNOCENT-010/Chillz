"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, X, Loader } from "lucide-react";
import {
  usePlacesAutocomplete,
  getPlaceDetails,
  PlaceDetail,
} from "@/hooks/use-places-autocomplete";

interface PlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceDetail) => void;
  placeholder?: string;
  hasError?: boolean;
}

export function PlacesInput({
  value,
  onChange,
  onSelect,
  placeholder = "Search for a location...",
  hasError = false,
}: PlacesInputProps) {
  const [focused, setFocused] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const { predictions, loading } = usePlacesAutocomplete(value, focused);

  const handleSelect = async (placeId: string, description: string) => {
    setSelecting(true);
    onChange(description);
    setFocused(false);
    const detail = await getPlaceDetails(placeId);
    if (detail) onSelect(detail);
    setSelecting(false);
  };

  const borderColor = hasError
    ? "#FECACA"
    : focused
    ? "#5B0EA6"
    : "#E4DCF0";

  const bgColor = hasError ? "#FEF2F2" : "#F7F5FA";

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          backgroundColor: bgColor,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 14,
          padding: "12px 14px",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
        }}
      >
        {selecting || loading ? (
          <Loader
            size={16}
            style={{
              color: "#5B0EA6",
              flexShrink: 0,
              animation: "spin 0.8s linear infinite",
            }}
          />
        ) : (
          <Search
            size={16}
            style={{ color: hasError ? "#EF4444" : "#9E9E9E", flexShrink: 0 }}
          />
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
            color: "#0A0A0A",
            fontFamily: "inherit",
          }}
        />
        {value && (
          <button
            onClick={() => onChange("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              flexShrink: 0,
            }}
          >
            <X size={15} style={{ color: "#9E9E9E" }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {focused && predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E4DCF0",
              borderRadius: 16,
              overflow: "hidden",
              zIndex: 100,
              boxShadow: "0 8px 32px rgba(91,14,166,0.15)",
            }}
          >
            {predictions.map((p, i) => (
              <button
                key={p.place_id}
                onMouseDown={() => handleSelect(p.place_id, p.description)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "none",
                  backgroundColor: "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  borderTop: i === 0 ? "none" : "1px solid #F2EEF9",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: "#EDE0F7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={14} style={{ color: "#5B0EA6" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#0A0A0A",
                      margin: "0 0 1px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.structured_formatting?.main_text || p.description}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#9E9E9E",
                      margin: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.structured_formatting?.secondary_text}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}