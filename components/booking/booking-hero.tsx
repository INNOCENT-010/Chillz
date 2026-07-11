"use client";
import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { Car, Home } from "lucide-react";

export function openDirections(lat: number, lng: number, name: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const encodedName = encodeURIComponent(name);
  if (isIOS) window.open(`maps://?daddr=${lat},${lng}&q=${encodedName}`, "_blank");
  else if (isAndroid) window.open(`geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`, "_blank");
  else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

export function BookingHero({ heroName, heroAddress, heroImage, heroLat, heroLng, isCarRental, isApartment, onBack }: {
  heroName: string;
  heroAddress?: string;
  heroImage?: string;
  heroLat?: number;
  heroLng?: number;
  isCarRental?: boolean;
  isApartment?: boolean;
  onBack: () => void;
}) {
  return (
    <div style={{ position: "relative", height: 220, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
      {heroImage
        ? <img src={heroImage} alt={heroName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isCarRental ? <Car size={60} style={{ color: "rgba(255,255,255,0.3)" }} /> : isApartment ? <Home size={60} style={{ color: "rgba(255,255,255,0.3)" }} /> : null}
          </div>}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 50%, rgba(61,0,102,0.6) 100%)" }} />
      <button onClick={onBack}
        style={{ position: "absolute", top: 16, left: 16, width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
      </button>
      <div style={{ position: "absolute", bottom: 16, left: 16, right: heroLat ? 120 : 16 }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
          {heroName}
        </h1>
        {heroAddress && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} style={{ color: "rgba(255,255,255,0.8)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{heroAddress}</span>
          </div>
        )}
      </div>
      {heroLat && heroLng && (
        <button onClick={() => openDirections(heroLat, heroLng, heroName)}
          style={{ position: "absolute", bottom: 16, right: 16, display: "flex", alignItems: "center", gap: 5, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Navigation size={12} />Directions
        </button>
      )}
    </div>
  );
}