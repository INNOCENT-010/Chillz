/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft, CheckCircle, AlertTriangle, Plus, X, Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT    = "#7C3AED";
const ACCENT_BG = "#EDE0F7";

const TABS = ["Profile", "Contact", "Videos"];

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function getVideoType(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}
function isValidVideoUrl(url: string) {
  const t = getVideoType(url.trim());
  return t === "youtube" || t === "instagram" || t === "tiktok";
}

function VideoLinksInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!isValidVideoUrl(trimmed)) { setError("Please enter a valid YouTube, Instagram or TikTok URL"); return; }
    if (value.includes(trimmed)) { setError("Already added"); return; }
    onChange([...value, trimmed]);
    setInput("");
    setError("");
  };

  const remove = (url: string) => onChange(value.filter(v => v !== url));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="url" placeholder="Paste YouTube, Instagram or TikTok link..."
          value={input} onChange={e => { setInput(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          style={{ flex: 1, backgroundColor: "#F7F5FA", border: `1.5px solid ${error ? "#FECACA" : "#E4DCF0"}`, borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit" }} />
        <button onClick={handleAdd}
          style={{ width: 44, height: 44, borderRadius: 12, border: "none", backgroundColor: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Plus size={18} style={{ color: "#FFFFFF" }} />
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: "#EF4444", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>▶ YouTube</span>
        <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>📸 Instagram</span>
        <span style={{ fontSize: 11, color: "#9E9E9E", backgroundColor: "#F7F5FA", padding: "3px 10px", borderRadius: 999 }}>🎵 TikTok</span>
      </div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {value.map((url, i) => {
            const type  = getVideoType(url);
            const ytId  = type === "youtube" ? getYouTubeId(url) : null;
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{ backgroundColor: "#F7F5FA", borderRadius: 14, border: "1.5px solid #E4DCF0", overflow: "hidden" }}>
                {thumb && (
                  <div style={{ position: "relative", height: 120 }}>
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Play size={14} style={{ color: "#FF0000", fill: "#FF0000", marginLeft: 2 }} />
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{type === "youtube" ? "▶️" : type === "instagram" ? "📸" : "🎵"}</span>
                    <span style={{ fontSize: 11, color: "#6B6B6B", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{url}</span>
                  </div>
                  <button onClick={() => remove(url)}
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={13} style={{ color: "#EF4444" }} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EventOrganizerProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("Profile");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    description:   "",
    instagram:     "",
    cac_number:    "",
    avatar_url:    "",
    phone:         "",
    whatsapp:      "",
    contact_email: "",
    website:       "",
    videos:        [] as string[],
  });

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ["my-organizer-profile", user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendors") as any)
        .select("id,business_name,description,instagram,cac_number,avatar_url,phone,whatsapp,contact_email,website,videos")
        .eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!vendorData) return;
    setForm({
      business_name: vendorData.business_name || "",
      description:   vendorData.description   || "",
      instagram:     vendorData.instagram      || "",
      cac_number:    vendorData.cac_number     || "",
      avatar_url:    vendorData.avatar_url     || "",
      phone:         vendorData.phone          || "",
      whatsapp:      vendorData.whatsapp       || "",
      contact_email: vendorData.contact_email  || "",
      website:       vendorData.website        || "",
      videos:        vendorData.videos         || [],
    });
  }, [vendorData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vendorId = vendorData?.id;
      if (!vendorId) throw new Error("Vendor not found");
      const { error } = await (supabase.from("vendors") as any).update({
        business_name: form.business_name.trim(),
        description:   form.description.trim()   || null,
        instagram:     form.instagram.trim()      || null,
        cac_number:    form.cac_number.trim()     || null,
        avatar_url:    form.avatar_url            || null,
        phone:         form.phone.trim()          || null,
        whatsapp:      form.whatsapp.trim()       || null,
        contact_email: form.contact_email.trim()  || null,
        website:       form.website.trim()        || null,
        videos:        form.videos,
      }).eq("id", vendorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-organizer-profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#6B6B6B",
    textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", display: "block",
  };

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F2EEF9", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>Organizer Profile</h1>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>How attendees see you on Chillz</p>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ padding: "8px 18px", borderRadius: 12, border: "none", backgroundColor: saveMutation.isPending ? "#9E9E9E" : ACCENT, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer" }}>
          {saved ? "Saved ✓" : saveMutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: "#FFFFFF", display: "flex", borderBottom: "1px solid #F2EEF9" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "12px 0", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? ACCENT : "#9E9E9E", borderBottom: `2.5px solid ${activeTab === tab ? ACCENT : "transparent"}` }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── PROFILE TAB ── */}
        {activeTab === "Profile" && (
          <>
            {/* Avatar */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0 10px" }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 90, height: 90, borderRadius: "50%", backgroundColor: ACCENT_BG, overflow: "hidden", border: `3px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {form.avatar_url
                    ? <img src={form.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 36 }}>🎭</span>}
                </div>
                <label style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", backgroundColor: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid #FFFFFF" }}>
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext  = file.name.split(".").pop();
                      const path = `avatars/${user?.id}_${Date.now()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
                      if (!upErr) {
                        const { data } = supabase.storage.from("uploads").getPublicUrl(path);
                        setForm(p => ({ ...p, avatar_url: data.publicUrl }));
                      }
                    }} />
                  <span style={{ fontSize: 12, color: "#FFFFFF" }}>+</span>
                </label>
              </div>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Tap + to update your profile photo</p>
            </div>

            <div>
              <label style={labelStyle}>Organizer / Brand Name</label>
              <input type="text" value={form.business_name}
                onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))}
                placeholder="e.g. Lagos Vibes Events" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Tell attendees who you are, what kind of events you run..."
                rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
            </div>

            <div>
              <label style={labelStyle}>CAC Registration Number</label>
              <input type="text" value={form.cac_number}
                onChange={e => setForm(p => ({ ...p, cac_number: e.target.value }))}
                placeholder="e.g. RC-1234567" style={inputStyle} />
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0" }}>Required for verification. Not shown publicly.</p>
            </div>
          </>
        )}

        {/* ── CONTACT TAB ── */}
        {activeTab === "Contact" && (
          <>
            <div style={{ backgroundColor: "#F3EEFF", border: "1px solid #DDD6FE", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", margin: "0 0 3px" }}>Get discovered, get contacted</p>
              <p style={{ fontSize: 11, color: "#6D28D9", margin: 0, lineHeight: 1.5 }}>
                Attendees who see your events on Chillz may want to reach you for corporate bookings, collabs, or private events. Fill these in so they can.
              </p>
            </div>

            {[
              { key: "whatsapp",      emoji: "💬", label: "WhatsApp Number",  type: "tel",   placeholder: "+234 800 000 0000", hint: "Include country code e.g. +2348012345678" },
              { key: "phone",         emoji: "📞", label: "Phone Number",     type: "tel",   placeholder: "+234 800 000 0000" },
              { key: "contact_email", emoji: "✉️", label: "Email Address",    type: "email", placeholder: "you@example.com" },
              { key: "website",       emoji: "🌐", label: "Website / Linktree", type: "url", placeholder: "https://linktr.ee/yourname" },
            ].map(({ key, emoji, label, type, placeholder, hint }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
                  <input type={type} placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                </div>
                {hint && <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0" }}>{hint}</p>}
              </div>
            ))}

            <div>
              <label style={labelStyle}>Instagram Handle</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>📸</span>
                <span style={{ fontSize: 14, color: "#9E9E9E", flexShrink: 0 }}>@</span>
                <input type="text" placeholder="youraccount" value={form.instagram.replace(/^@/, "")}
                  onChange={e => setForm(p => ({ ...p, instagram: e.target.value.replace(/^@/, "") }))}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
              </div>
            </div>

            {(form.whatsapp || form.phone || form.contact_email || form.instagram || form.website) && (
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Contact Preview</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {form.whatsapp     && <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 10, padding: "7px 12px" }}><span>💬</span><span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span></div>}
                  {form.phone        && <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: ACCENT_BG, border: "1px solid #DDD6FE", borderRadius: 10, padding: "7px 12px" }}><span>📞</span><span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Call</span></div>}
                  {form.contact_email && <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "7px 12px" }}><span>✉️</span><span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Email</span></div>}
                  {form.instagram    && <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FDF2F8", border: "1px solid #F9A8D4", borderRadius: 10, padding: "7px 12px" }}><span>📸</span><span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>Instagram</span></div>}
                  {form.website      && <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 10, padding: "7px 12px" }}><span>🌐</span><span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Website</span></div>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── VIDEOS TAB ── */}
        {activeTab === "Videos" && (
          <>
            <div style={{ backgroundColor: "#F3EEFF", border: "1px solid #DDD6FE", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", margin: "0 0 3px" }}>Show Your Energy</p>
              <p style={{ fontSize: 11, color: "#6D28D9", margin: 0, lineHeight: 1.5 }}>
                Add links to your best event videos on YouTube, Instagram or TikTok. These show on your organizer profile so attendees know what to expect.
              </p>
            </div>
            <VideoLinksInput
              value={form.videos}
              onChange={vids => setForm(p => ({ ...p, videos: vids }))}
            />
          </>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saveMutation.isPending ? "#9E9E9E" : ACCENT, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 16px rgba(124,58,237,0.3)` }}>
          {saved
            ? <><CheckCircle size={17} />Saved!</>
            : saveMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : "Save Changes"}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}