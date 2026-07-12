"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const COOKIE_KEY = "chillz_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
    } catch {}
  }, []);

  const accept = () => {
    try { localStorage.setItem(COOKIE_KEY, "accepted"); } catch {}
    setVisible(false);
  };

  const decline = () => {
    try { localStorage.setItem(COOKIE_KEY, "declined"); } catch {}
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 999, maxWidth: 480, margin: "0 auto",
            backgroundColor: "#FFFFFF",
            borderRadius: "20px 20px 0 0",
            padding: "20px 20px 36px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
            border: "1px solid #F2EEF9",
          }}>
          {/* Drag handle */}
          <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>🍪</span>
              </div>
              <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                We use cookies
              </p>
            </div>
            <button onClick={decline} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <X size={18} style={{ color: "#9E9E9E" }} />
            </button>
          </div>

          <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: "0 0 16px" }}>
            Chillz uses cookies and similar technologies to keep you signed in, remember your preferences, and improve your experience. We also use them to understand how you interact with the app so we can make it better.
          </p>

          <p style={{ fontSize: 12, color: "#9E9E9E", lineHeight: 1.6, margin: "0 0 16px" }}>
            By tapping <strong style={{ color: "#5B0EA6" }}>Accept</strong>, you agree to our use of cookies as described in our{" "}
            <a href="/privacy" style={{ color: "#5B0EA6", fontWeight: 600, textDecoration: "none" }}>Privacy Policy</a>.
            You can decline non-essential cookies without affecting core app functionality.
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={decline}
              style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Decline
            </button>
            <button onClick={accept}
              style={{ flex: 2, padding: "12px 0", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
              Accept All
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}