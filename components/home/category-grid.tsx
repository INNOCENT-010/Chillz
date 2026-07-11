"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const CATEGORIES = [
  {
    id: "events",
    label: "Events",
    href: "/events",
    active: true,
    bg: "#1A0533",
    accent: "#C084FC",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Person silhouette */}
        <ellipse cx="28" cy="38" rx="7" ry="9" fill="#C084FC" />
        <circle cx="28" cy="24" r="6" fill="#C084FC" />
        {/* Arms raised */}
        <path d="M21 32 L11 22" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" />
        <path d="M35 32 L45 22" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" />
        {/* Confetti */}
        <rect x="8" y="8" width="5" height="5" rx="1.5" fill="#F472B6" transform="rotate(25 8 8)" />
        <rect x="42" y="6" width="4" height="4" rx="1" fill="#FCD34D" transform="rotate(-15 42 6)" />
        <rect x="46" y="18" width="4" height="4" rx="1" fill="#C084FC" transform="rotate(30 46 18)" />
        <rect x="6" y="20" width="4" height="4" rx="1" fill="#34D399" transform="rotate(-30 6 20)" />
        <circle cx="14" cy="10" r="3" fill="#F472B6" />
        <circle cx="42" cy="14" r="2.5" fill="#FCD34D" />
        <circle cx="48" cy="30" r="2" fill="#34D399" />
        <circle cx="10" cy="32" r="2" fill="#FCD34D" />
        {/* Star */}
        <path d="M26 11 L27.2 14.6 L31 14.6 L28 16.8 L29.2 20.4 L26 18.2 L22.8 20.4 L24 16.8 L21 14.6 L24.8 14.6 Z" fill="#FCD34D" />
      </svg>
    ),
  },
  {
    id: "bar-lounge",
    label: "Bar & Lounge",
    href: "/bar-lounge",
    active: true,
    bg: "#0C1A2E",
    accent: "#38BDF8",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Left cocktail glass */}
        <path d="M14 12 L10 24 L18 24 L18 34 L14 34" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M10 24 L18 24" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        {/* Left liquid fill */}
        <path d="M11.5 19 L16.5 19 L18 24 L10 24 Z" fill="#0EA5E9" opacity="0.9" />
        {/* Right glass */}
        <path d="M42 12 L46 24 L38 24 L38 34 L42 34" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M46 24 L38 24" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round" />
        {/* Right liquid */}
        <path d="M44.5 19 L41.5 19 L38 24 L46 24 Z" fill="#EC4899" opacity="0.9" />
        {/* Clink sparkle */}
        <circle cx="28" cy="14" r="3" fill="#FCD34D" />
        <path d="M28 8 L28 11" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 14 L25 14" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
        <path d="M31 14 L34 14" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 10 L26 12" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M32 10 L30 12" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bubbles */}
        <circle cx="13" cy="22" r="1.5" fill="#BAE6FD" opacity="0.8" />
        <circle cx="43" cy="21" r="1.5" fill="#FBCFE8" opacity="0.8" />
        <circle cx="15" cy="20" r="1" fill="#BAE6FD" opacity="0.5" />
        {/* Stars */}
        <circle cx="8" cy="8" r="1.5" fill="#FCD34D" opacity="0.7" />
        <circle cx="48" cy="10" r="1.5" fill="#C084FC" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "club",
    label: "Club",
    href: "/club",
    active: true,
    bg: "#0F0520",
    accent: "#A855F7",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Disco ball */}
        <circle cx="28" cy="13" r="8" fill="#1E0A3C" stroke="#A855F7" strokeWidth="1" />
        {/* Disco tiles */}
        <rect x="20" y="9" width="4" height="3" rx="0.5" fill="#C084FC" opacity="0.9" />
        <rect x="25" y="9" width="4" height="3" rx="0.5" fill="#E9D5FF" opacity="0.8" />
        <rect x="30" y="9" width="4" height="3" rx="0.5" fill="#A855F7" opacity="0.9" />
        <rect x="21" y="13" width="3" height="3" rx="0.5" fill="#E9D5FF" opacity="0.7" />
        <rect x="26" y="13" width="4" height="3" rx="0.5" fill="#C084FC" opacity="0.9" />
        <rect x="31" y="13" width="3" height="3" rx="0.5" fill="#E9D5FF" opacity="0.8" />
        <rect x="22" y="17" width="4" height="3" rx="0.5" fill="#A855F7" opacity="0.9" />
        <rect x="28" y="17" width="4" height="3" rx="0.5" fill="#C084FC" opacity="0.7" />
        {/* Light rays */}
        <path d="M28 21 L12 44" stroke="#F472B6" strokeWidth="1.5" opacity="0.5" />
        <path d="M28 21 L44 44" stroke="#FCD34D" strokeWidth="1.5" opacity="0.5" />
        <path d="M28 21 L6 34" stroke="#C084FC" strokeWidth="1" opacity="0.4" />
        <path d="M28 21 L50 34" stroke="#38BDF8" strokeWidth="1" opacity="0.4" />
        {/* Dancer left */}
        <circle cx="16" cy="36" r="4" fill="#C084FC" />
        <ellipse cx="16" cy="47" rx="4" ry="5" fill="#C084FC" />
        <path d="M16 40 L8 34" stroke="#E9D5FF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M16 40 L24 34" stroke="#E9D5FF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Dancer right */}
        <circle cx="40" cy="34" r="4" fill="#F472B6" />
        <ellipse cx="40" cy="45" rx="4" ry="5" fill="#F472B6" />
        <path d="M40 38 L32 44" stroke="#FBCFE8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 38 L48 44" stroke="#FBCFE8" strokeWidth="2.5" strokeLinecap="round" />
        {/* Music */}
        <text x="5" y="28" fill="#FCD34D" fontSize="10" fontFamily="serif">♪</text>
        <text x="46" y="26" fill="#34D399" fontSize="8" fontFamily="serif">♫</text>
      </svg>
    ),
  },
  {
    id: "restaurant",
    label: "Restaurant",
    href: "/restaurant",
    active: true,
    bg: "#1C0A00",
    accent: "#FB923C",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Plate */}
        <circle cx="28" cy="34" r="15" fill="#2D1400" stroke="#FB923C" strokeWidth="1.5" />
        <circle cx="28" cy="34" r="10" fill="#3D1A00" />
        {/* Food */}
        <path d="M22 32 Q28 24 34 32 Q31 40 28 38 Q25 40 22 32Z" fill="#FB923C" />
        <path d="M24 31 Q28 28 32 31" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <circle cx="28" cy="30" r="2" fill="#FCD34D" opacity="0.8" />
        {/* Fork */}
        <path d="M12 14 L12 24" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 14 L10 19" stroke="#FDBA74" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 14 L12 19" stroke="#FDBA74" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 14 L14 19" stroke="#FDBA74" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 19 Q12 21 14 19" stroke="#FDBA74" strokeWidth="1.5" fill="none" />
        {/* Knife */}
        <path d="M44 14 L44 24" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 14 Q46 16 44 20" stroke="#FDBA74" strokeWidth="1.5" fill="none" />
        {/* Steam */}
        <path d="M22 20 Q20 17 22 14 Q24 11 22 8" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M28 20 Q26 17 28 14 Q30 11 28 8" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M34 20 Q32 17 34 14 Q36 11 34 8" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* Stars */}
        <circle cx="46" cy="10" r="2" fill="#FCD34D" />
        <circle cx="10" cy="10" r="1.5" fill="#FCD34D" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "hotel",
    label: "Hotel",
    href: "/hotel",
    active: true,
    bg: "#001628",
    accent: "#34D399",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Building */}
        <rect x="12" y="18" width="32" height="34" rx="2" fill="#003322" />
        {/* Roof */}
        <path d="M10 18 L28 8 L46 18 Z" fill="#00472E" stroke="#34D399" strokeWidth="1" />
        {/* Windows lit */}
        <rect x="15" y="22" width="6" height="5" rx="1" fill="#34D399" opacity="0.9" />
        <rect x="25" y="22" width="6" height="5" rx="1" fill="#FCD34D" opacity="0.9" />
        <rect x="35" y="22" width="6" height="5" rx="1" fill="#34D399" opacity="0.7" />
        <rect x="15" y="30" width="6" height="5" rx="1" fill="#FCD34D" opacity="0.8" />
        <rect x="25" y="30" width="6" height="5" rx="1" fill="#34D399" opacity="0.9" />
        <rect x="35" y="30" width="6" height="5" rx="1" fill="#FCD34D" opacity="0.6" />
        <rect x="15" y="38" width="6" height="5" rx="1" fill="#34D399" opacity="0.7" />
        <rect x="35" y="38" width="6" height="5" rx="1" fill="#FCD34D" opacity="0.8" />
        {/* Door */}
        <rect x="23" y="42" width="10" height="10" rx="1.5" fill="#005C3A" stroke="#34D399" strokeWidth="0.8" />
        <circle cx="29" cy="47" r="1" fill="#34D399" />
        {/* Moon */}
        <path d="M6 12 Q4 8 8 6 Q5 10 9 12 Q7 12 6 12Z" fill="#FCD34D" />
        <circle cx="48" cy="8" r="1.5" fill="rgba(255,255,255,0.6)" />
        <circle cx="52" cy="14" r="1" fill="rgba(255,255,255,0.4)" />
      </svg>
    ),
  },
  {
    id: "car-rentals",
    label: "Car Rentals",
    href: "/car-rentals",
    active: true,
    bg: "#0A0A1A",
    accent: "#60A5FA",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Speed lines */}
        <path d="M2 34 L16 34" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <path d="M2 38 L14 38" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M4 30 L14 30" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
        {/* Car body */}
        <path d="M12 38 L12 32 Q15 24 24 22 L38 22 Q46 22 48 26 L50 32 L50 38 Z" fill="#1D4ED8" />
        {/* Car roof */}
        <path d="M17 32 Q20 24 28 24 L38 24 Q44 24 46 32 Z" fill="#2563EB" />
        {/* Windshield */}
        <path d="M19 31 Q22 26 28 26 L36 26 Q41 26 43 31 Z" fill="#60A5FA" opacity="0.8" />
        {/* Wheels */}
        <circle cx="19" cy="39" r="6" fill="#111827" stroke="#60A5FA" strokeWidth="2" />
        <circle cx="19" cy="39" r="2.5" fill="#60A5FA" />
        <circle cx="43" cy="39" r="6" fill="#111827" stroke="#60A5FA" strokeWidth="2" />
        <circle cx="43" cy="39" r="2.5" fill="#60A5FA" />
        {/* Headlights */}
        <ellipse cx="50" cy="30" rx="3" ry="2" fill="#FCD34D" />
        <path d="M53 29 L57 26" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <path d="M53 31 L57 31" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        {/* Road */}
        <path d="M2 46 L54 46" stroke="#3B82F6" strokeWidth="1" strokeDasharray="5 4" opacity="0.3" />
        {/* Stars */}
        <circle cx="8" cy="10" r="1.5" fill="#FCD34D" opacity="0.6" />
        <circle cx="48" cy="8" r="1" fill="#FCD34D" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "apartments",
    label: "Apartments",
    href: "/apartments",
    active: true,
    bg: "#120A20",
    accent: "#F472B6",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40 }}>
        {/* Room wall */}
        <rect x="6" y="14" width="44" height="34" rx="2" fill="#1E0A2E" />
        {/* Bed frame */}
        <rect x="10" y="36" width="36" height="10" rx="3" fill="#F472B6" />
        {/* Duvet */}
        <rect x="10" y="34" width="36" height="6" rx="3" fill="#C026D3" opacity="0.8" />
        {/* Pillows */}
        <rect x="12" y="30" width="12" height="6" rx="2" fill="#E9D5FF" />
        <rect x="26" y="30" width="12" height="6" rx="2" fill="#E9D5FF" />
        {/* Window */}
        <rect x="14" y="16" width="14" height="12" rx="2" fill="#1E3A5F" stroke="#F472B6" strokeWidth="1" />
        <path d="M21 16 L21 28" stroke="#F472B6" strokeWidth="0.8" opacity="0.5" />
        <path d="M14 22 L28 22" stroke="#F472B6" strokeWidth="0.8" opacity="0.5" />
        {/* Stars in window */}
        <circle cx="18" cy="19" r="1.5" fill="#FCD34D" />
        <circle cx="25" cy="18" r="1" fill="rgba(255,255,255,0.7)" />
        <circle cx="22" cy="25" r="0.8" fill="rgba(255,255,255,0.5)" />
        {/* Lamp */}
        <rect x="36" y="22" width="8" height="6" rx="1" fill="#FCD34D" opacity="0.8" />
        <path d="M40 16 L40 22" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M36 16 L44 16" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
        {/* Glow */}
        <ellipse cx="40" cy="28" rx="8" ry="3" fill="#FCD34D" opacity="0.12" />
        {/* Stars outside */}
        <circle cx="50" cy="10" r="1.5" fill="#F472B6" opacity="0.7" />
        <circle cx="6" cy="10" r="1" fill="#C084FC" opacity="0.6" />
        <path d="M4 14 L5 16 L4 18 L3 16 Z" fill="#FCD34D" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "flight",
    label: "Flight Booking",
    href: "#",
    active: false,
    bg: "#111111",
    accent: "#666666",
    illustration: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 40, height: 40, opacity: 0.35 }}>
        <path d="M6 28 L28 16 L50 23 L37 28 L46 39 L39 37 L31 28 L20 32 L24 39 L18 37 L14 28 Z" fill="rgba(255,255,255,0.5)" />
        <path d="M34 14 Q36 10 40 10 Q44 8 48 11 Q52 11 52 15 Q52 19 48 19 L34 19 Q30 19 30 15Z" fill="rgba(255,255,255,0.15)" />
        <path d="M6 44 Q18 36 28 32 Q38 28 50 17" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      </svg>
    ),
  },
];

export function CategoryGrid() {
  const router = useRouter();

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.id}
            onClick={() => cat.active && router.push(cat.href)}
            disabled={!cat.active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={cat.active ? { scale: 0.93 } : {}}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: cat.active ? "pointer" : "default",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div style={{
              width: "100%",
              aspectRatio: "1",
              borderRadius: 20,
              backgroundColor: cat.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              opacity: cat.active ? 1 : 0.35,
              boxShadow: cat.active
                ? `0 4px 20px ${cat.accent}30, inset 0 1px 0 rgba(255,255,255,0.06)`
                : "none",
              border: cat.active ? `1px solid ${cat.accent}25` : "1px solid #222",
            }}>
              {/* Top-left grain texture overlay */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                background: "radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.05) 0%, transparent 65%)",
                pointerEvents: "none",
              }} />
              {cat.illustration}
              {!cat.active && (
                <div style={{
                  position: "absolute",
                  bottom: 5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  whiteSpace: "nowrap",
                }}>
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.06em" }}>SOON</span>
                </div>
              )}
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: cat.active ? "#0A0A0A" : "#AAAAAA",
              textAlign: "center",
              lineHeight: 1.2,
            }}>
              {cat.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}