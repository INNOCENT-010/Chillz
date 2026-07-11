"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const VIBES = [
  {
    key: "nightlife",
    emoji: "🎉",
    label: "Nightlife & Clubs",
    sub: "Bars, clubs, lounges",
    gradient: "linear-gradient(135deg, #3D0066 0%, #7B2FBE 100%)",
    accent: "#A855F7",
  },
  {
    key: "dining",
    emoji: "🍽️",
    label: "Dining & Cafés",
    sub: "Restaurants, cafés, brunches",
    gradient: "linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)",
    accent: "#FB923C",
  },
  {
    key: "events",
    emoji: "🎵",
    label: "Events & Shows",
    sub: "Concerts, parties, experiences",
    gradient: "linear-gradient(135deg, #064E3B 0%, #059669 100%)",
    accent: "#34D399",
  },
  {
    key: "stays",
    emoji: "🏨",
    label: "Stays & Getaways",
    sub: "Hotels, apartments, shortlets",
    gradient: "linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)",
    accent: "#60A5FA",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (key: string) => {
    setSelected(key);
    setSaving(true);
    localStorage.setItem("chillz_vibe", key);
    localStorage.setItem("chillz_onboarded", "1");
    if (user?.id) {
      await (supabase.from("users") as any).update({ vibe: key }).eq("id", user.id);
    }
    await new Promise((r) => setTimeout(r, 480));
    router.replace("/home");
  };

  return (
    <div style={{
      minHeight: "100vh",
      // @ts-ignore
      minHeight: "100dvh",
      background: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
      padding: "0 0 40px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Subtle top-right glow accent */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 60, left: -40,
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(91,14,166,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ padding: "64px 28px 0", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 10 }}>
          <Image
            src="/chillz-icon.png"
            alt="Chillz"
            width={38}
            height={38}
            style={{ borderRadius: 10 }}
          />
          <span style={{
            fontSize: 19, fontWeight: 900, color: "#0A0A0A",
            letterSpacing: "0.14em",
            fontFamily: "var(--font-display, Syne, sans-serif)",
          }}>
            CHILLZ
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p style={{
            fontSize: 12, fontWeight: 700, color: "#5B0EA6",
            letterSpacing: "0.14em", textTransform: "uppercase",
            margin: "0 0 10px",
          }}>
            Welcome to Chillz
          </p>
          <h1 style={{
            fontSize: 30, fontWeight: 900, color: "#0A0A0A",
            lineHeight: 1.15, margin: "0 0 10px",
            fontFamily: "var(--font-display, Syne, sans-serif)",
          }}>
            What's your<br />
            <span style={{ color: "#5B0EA6" }}>vibe?</span>
          </h1>
          <p style={{
            fontSize: 14, color: "#6B6B6B",
            margin: 0, lineHeight: 1.6,
          }}>
            Help us show you the best of Lagos & Port Harcourt — personalised for you.
          </p>
        </motion.div>
      </div>

      {/* Vibe grid */}
      <div style={{
        flex: 1, padding: "32px 20px 0",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
        position: "relative", zIndex: 1,
      }}>
        {VIBES.map((vibe, i) => {
          const isSelected = selected === vibe.key;
          return (
            <motion.button
              key={vibe.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 300, damping: 28 }}
              onClick={() => !saving && handleSelect(vibe.key)}
              disabled={saving}
              style={{
                background: vibe.gradient,
                borderRadius: 24,
                border: isSelected
                  ? `2.5px solid ${vibe.accent}`
                  : "2.5px solid transparent",
                padding: "26px 16px",
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                position: "relative",
                overflow: "hidden",
                boxShadow: isSelected
                  ? `0 0 0 1px ${vibe.accent}, 0 8px 28px rgba(0,0,0,0.18)`
                  : "0 4px 16px rgba(0,0,0,0.10)",
                transform: isSelected ? "scale(0.97)" : "scale(1)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                minHeight: 158,
                textAlign: "left",
              }}
            >
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      position: "absolute", top: 12, right: 12,
                      width: 22, height: 22, borderRadius: "50%",
                      backgroundColor: vibe.accent,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#FFFFFF" }}>✓</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{
                position: "absolute", bottom: -20, right: -20,
                width: 90, height: 90, borderRadius: "50%",
                background: `radial-gradient(circle, ${vibe.accent}40 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />

              <span style={{ fontSize: 34 }}>{vibe.emoji}</span>
              <div>
                <p style={{
                  fontWeight: 800, fontSize: 13, color: "#FFFFFF",
                  margin: "0 0 3px",
                  fontFamily: "var(--font-display, Syne, sans-serif)",
                  lineHeight: 1.25,
                }}>
                  {vibe.label}
                </p>
                <p style={{
                  fontSize: 11, color: "rgba(255,255,255,0.65)",
                  margin: 0, lineHeight: 1.4,
                }}>
                  {vibe.sub}
                </p>
              </div>

              {isSelected && saving && (
                <div style={{
                  position: "absolute", bottom: 12, right: 12,
                  width: 16, height: 16, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 0.7s linear infinite",
                }} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Skip */}
      <div style={{ padding: "24px 28px 0", textAlign: "center", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => {
            localStorage.setItem("chillz_onboarded", "1");
            router.replace("/home");
          }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: "#BDBDBD",
            fontWeight: 500, letterSpacing: "0.04em",
          }}
        >
          Skip for now
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}