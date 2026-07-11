/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Shield, Camera } from "lucide-react";

const STRICTNESS_OPTIONS = [
  { value: "strict",   label: "Strictly Enforced", desc: "No exceptions. Entry refused if not compliant.", color: "#EF4444", bg: "#FEF2F2", dot: "🔴" },
  { value: "moderate", label: "Moderate",           desc: "General dress standards expected.",              color: "#D97706", bg: "#FFF8E1", dot: "🟡" },
  { value: "relaxed",  label: "Relaxed",            desc: "Smart casual minimum. Come comfortable.",        color: "#059669", bg: "#E0F7EA", dot: "🟢" },
];

const PICTURE_PRESETS = [
  "Photography welcome for personal use only. Professional cameras not permitted.",
  "No photography or videography allowed inside the venue.",
  "Photography and videography freely permitted. Tag us on Instagram!",
  "Flash photography not permitted. Personal photos welcome.",
];

export default function DressCodePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<"dress" | "picture">("dress");

  const [dressPolicy, setDressPolicy] = useState("");
  const [dressStrictness, setDressStrictness] = useState("moderate");
  const [dressDescription, setDressDescription] = useState("");
  const [dressSaved, setDressSaved] = useState(false);

  const [picturePolicy, setPicturePolicy] = useState("");
  const [pictureSaved, setPictureSaved] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors").select("*")
        .eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: venue } = useQuery({
    queryKey: ["vendor-venue-policies", vendor?.id],
    queryFn: async () => {
      if (!vendor?.venue_id) return null;
      const { data } = await supabase.from("venues")
        .select("dress_policy, dress_policy_strictness, dress_policy_description, picture_policy, instagram")
        .eq("id", vendor.venue_id).maybeSingle();
      return data as any;
    },
    enabled: !!vendor?.venue_id,
    staleTime: 0,
  });

  useEffect(() => {
    if (venue) {
      setDressPolicy(venue.dress_policy || "");
      setDressStrictness(venue.dress_policy_strictness || "moderate");
      setDressDescription(venue.dress_policy_description || "");
      setPicturePolicy(venue.picture_policy || "");
    }
  }, [venue]);

  const saveDressMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.venue_id) throw new Error("No venue linked");
      await (supabase.from("venues") as any).update({
        dress_policy: dressPolicy.trim() || null,
        dress_policy_strictness: dressStrictness || null,
        dress_policy_description: dressDescription.trim() || null,
      } as any).eq("id", vendor.venue_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-venue-policies"] });
      qc.invalidateQueries({ queryKey: ["venue", vendor?.venue_id] });
      setDressSaved(true);
      setTimeout(() => setDressSaved(false), 2500);
    },
  });

  const savePictureMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.venue_id) throw new Error("No venue linked");
      await (supabase.from("venues") as any).update({
        picture_policy: picturePolicy.trim() || null,
      }).eq("id", vendor.venue_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-venue-policies"] });
      qc.invalidateQueries({ queryKey: ["venue", vendor?.venue_id] });
      setPictureSaved(true);
      setTimeout(() => setPictureSaved(false), 2500);
    },
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Policies
            </h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              Dress code & photo policy
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[
            { id: "dress",   label: "Dress Code",   icon: Shield },
            { id: "picture", label: "Photo Policy",  icon: Camera },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id as any)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: "1.5px solid", borderColor: activeSection === id ? "#FFFFFF" : "rgba(255,255,255,0.3)", backgroundColor: activeSection === id ? "#FFFFFF" : "transparent", color: activeSection === id ? "#5B0EA6" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <AnimatePresence mode="wait">

          {/* DRESS CODE */}
          {activeSection === "dress" && (
            <motion.div key="dress" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#3D0066", margin: "0 0 3px" }}>Dress Code Policy</p>
                <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5 }}>
                  Let guests know your dress requirements. This appears on your venue's Info tab.
                </p>
              </div>

              {/* Strictness selector */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  Enforcement Level
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {STRICTNESS_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setDressStrictness(opt.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid", borderColor: dressStrictness === opt.value ? opt.color : "#E4DCF0", backgroundColor: dressStrictness === opt.value ? opt.bg : "#FFFFFF", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: dressStrictness === opt.value ? opt.color : "#0A0A0A", margin: "0 0 2px" }}>
                          {opt.dot} {opt.label}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{opt.desc}</p>
                      </div>
                      {dressStrictness === opt.value && (
                        <CheckCircle size={16} style={{ color: opt.color, flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dress code summary */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                  Dress Code Summary
                </p>
                <input type="text"
                  placeholder="e.g. Smart Casual — No Slippers, No Shorts"
                  value={dressPolicy}
                  onChange={(e) => setDressPolicy(e.target.value)}
                  style={inputStyle} />
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "6px 0 0" }}>
                  Short headline shown on your venue page
                </p>
              </div>

              {/* Additional details */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                  Additional Details <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                </p>
                <textarea
                  placeholder="e.g. Gentlemen must wear collared shirts. No flip flops. Management reserves the right to refuse entry..."
                  value={dressDescription}
                  onChange={(e) => setDressDescription(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} />
              </div>

              <AnimatePresence>
                {dressSaved && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                    <CheckCircle size={14} style={{ color: "#00C853" }} />
                    <p style={{ fontSize: 12, color: "#059669", fontWeight: 600, margin: 0 }}>Dress code saved successfully</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => saveDressMutation.mutate()} disabled={saveDressMutation.isPending}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: saveDressMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: saveDressMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {saveDressMutation.isPending
                  ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                  : <><CheckCircle size={16} />Save Dress Code</>}
              </button>
            </motion.div>
          )}

          {/* PICTURE POLICY */}
          {activeSection === "picture" && (
            <motion.div key="picture" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#3D0066", margin: "0 0 3px" }}>Photo & Video Policy</p>
                <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5 }}>
                  Let guests know your rules around taking photos or videos at your venue.
                </p>
              </div>

              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                  Policy Statement
                </p>
                <textarea
                  placeholder="e.g. Photography is welcome for personal use. Flash photography and professional cameras are not permitted. Videos may not be recorded on the dance floor."
                  value={picturePolicy}
                  onChange={(e) => setPicturePolicy(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} />

                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
                  Quick Presets
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {PICTURE_PRESETS.map((preset) => (
                    <button key={preset} onClick={() => setPicturePolicy(preset)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid", borderColor: picturePolicy === preset ? "#5B0EA6" : "#E4DCF0", backgroundColor: picturePolicy === preset ? "#EDE0F7" : "#F7F5FA", color: picturePolicy === preset ? "#5B0EA6" : "#6B6B6B", fontSize: 11, fontWeight: picturePolicy === preset ? 700 : 400, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {pictureSaved && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                    <CheckCircle size={14} style={{ color: "#00C853" }} />
                    <p style={{ fontSize: 12, color: "#059669", fontWeight: 600, margin: 0 }}>Photo policy saved successfully</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => savePictureMutation.mutate()} disabled={savePictureMutation.isPending}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: savePictureMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: savePictureMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {savePictureMutation.isPending
                  ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                  : <><CheckCircle size={16} />Save Policy</>}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}