/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, ExternalLink,
  Video, AlertTriangle, CheckCircle, MonitorPlay,
} from "lucide-react";

function detectPlatformName(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "Facebook";
  return "Video";
}

function getPlatformColor(name: string): string {
  if (name === "YouTube") return "#FF0000";
  if (name === "TikTok") return "#010101";
  if (name === "Instagram") return "#C13584";
  if (name === "Facebook") return "#1877F2";
  return "#5B0EA6";
}

function getPlatformBg(name: string): string {
  if (name === "YouTube") return "#FEF2F2";
  if (name === "TikTok") return "#F7F7F7";
  if (name === "Instagram") return "#FDF2F8";
  if (name === "Facebook") return "#EFF6FF";
  return "#EDE0F7";
}

function isValidVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ["youtube.com", "youtu.be", "tiktok.com", "instagram.com",
      "facebook.com", "fb.com", "fb.watch"].some((d) => u.hostname.includes(d));
  } catch { return false; }
}

export default function VendorVideosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState("");

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

  const { data: videoLinks, refetch } = useQuery({
    queryKey: ["vendor-video-links", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await (supabase.from("vendor_video_links") as any)
        .select("*").eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const url = videoUrl.trim();
      if (!url) throw new Error("Enter a video URL");
      if (!isValidVideoUrl(url)) throw new Error("Must be YouTube, TikTok, Instagram or Facebook URL");
      await (supabase.from("vendor_video_links") as any).insert({
        vendor_id: vendor.id, url, is_active: true,
      });
    },
    onSuccess: () => {
      setVideoUrl(""); setVideoError(""); setShowAdd(false); refetch();
    },
    onError: (e: any) => setVideoError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from("vendor_video_links") as any).delete().eq("id", id);
    },
    onSuccess: () => refetch(),
  });

  const platformName = videoUrl.trim() ? detectPlatformName(videoUrl.trim()) : "";
  const isValid = videoUrl.trim() ? isValidVideoUrl(videoUrl.trim()) : false;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Video Links
            </h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              {videoLinks?.length || 0} link{(videoLinks?.length || 0) !== 1 ? "s" : ""} added
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Info banner */}
        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#3D0066", margin: "0 0 3px" }}>
            Watch their videos here
          </p>
          <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5 }}>
            Add YouTube, TikTok, Instagram or Facebook video links. Users will see a "Watch their videos here" section under the Info tab on your venue page.
          </p>
        </div>

        {/* Add button */}
        <button onClick={() => setShowAdd(true)}
          style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "1.5px dashed #C4A0E8", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={16} />Add Video Link
        </button>

        {/* Links list */}
        {videoLinks && videoLinks.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {videoLinks.map((v: any) => {
              const name = detectPlatformName(v.url);
              const color = getPlatformColor(name);
              const bg = getPlatformBg(name);
              return (
                <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #F2EEF9" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MonitorPlay size={18} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>{name}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v.url}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                      style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                      <ExternalLink size={13} style={{ color: "#9E9E9E" }} />
                    </a>
                    <button onClick={() => deleteMutation.mutate(v.id)}
                      disabled={deleteMutation.isPending}
                      style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Trash2 size={13} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "40px 20px", textAlign: "center", border: "1.5px solid #F2EEF9" }}>
            <Video size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>No video links yet</p>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Add links so users can see your venue in action.</p>
          </div>
        )}
      </div>

      {/* Add link bottom sheet */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowAdd(false); setVideoUrl(""); setVideoError(""); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "20px 20px 44px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                Add Video Link
              </h3>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px" }}>
                Paste a YouTube, TikTok, Instagram or Facebook video URL.
              </p>

              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                Video URL
              </p>
              <input type="url" placeholder="https://youtube.com/watch?v=... or tiktok/instagram/facebook"
                value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setVideoError(""); }}
                autoFocus
                style={{ width: "100%", backgroundColor: "#F7F5FA", border: `1.5px solid ${videoError ? "#EF4444" : "#E4DCF0"}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 6 }} />

              {videoError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={12} style={{ color: "#EF4444" }} />
                  <p style={{ fontSize: 11, color: "#EF4444", margin: 0 }}>{videoError}</p>
                </div>
              )}
              {videoUrl.trim() && !videoError && isValid && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <CheckCircle size={12} style={{ color: "#059669" }} />
                  <p style={{ fontSize: 11, color: "#059669", fontWeight: 600, margin: 0 }}>
                    {platformName} video detected
                  </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => { setShowAdd(false); setVideoUrl(""); setVideoError(""); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending || !videoUrl.trim()}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: videoUrl.trim() && isValid ? "#5B0EA6" : "#E4DCF0", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: videoUrl.trim() && isValid ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {addMutation.isPending
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Adding...</>
                    : <><Plus size={15} />Add Link</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}