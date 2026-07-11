/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Upload, Camera, Video,
  X, CheckCircle, AlertTriangle, Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddMediaPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<{ url: string; type: "photo" | "video"; file: File } | null>(null);

  const { data: vendorData } = useQuery({
    queryKey: ["vendor-with-venue", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, venue_id:venues!venues_vendor_id_fkey(id, name)")
        .eq("user_id", user.id)
        .single();
      return vendor as any;
    },
    enabled: !!user?.id,
  });

  const { data: myVenue } = useQuery({
    queryKey: ["vendor-venue", vendorData?.id],
    queryFn: async () => {
      if (!vendorData?.id) return null;
      const { data } = await supabase
        .from("venues")
        .select("id, name")
        .eq("vendor_id", vendorData.id)
        .single();
      return data as any;
    },
    enabled: !!vendorData?.id,
  });

  const handleFileSelect = (file: File, type: "photo" | "video") => {
    if (type === "photo" && !file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (type === "video" && !file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }
    if (type === "video" && file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100MB");
      return;
    }
    if (type === "photo" && file.size > 10 * 1024 * 1024) {
      setError("Photo must be under 10MB");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview({ url: localUrl, type, file });
    setError("");
  };

  const handleUpload = async () => {
    if (!preview || !vendorData?.id || !myVenue?.id) {
      setError("No venue linked to your account. Contact admin to assign your venue.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const ext = preview.file.name.split(".").pop()?.toLowerCase() || (preview.type === "video" ? "mp4" : "jpg");
      const filename = `media/${vendorData.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chillz-images")
        .upload(filename, preview.file, {
          contentType: preview.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      if (!uploadData?.path) throw new Error("Upload failed");

      const { data: urlData } = supabase.storage
        .from("chillz-images")
        .getPublicUrl(uploadData.path);

      if (!urlData?.publicUrl) throw new Error("Could not get URL");

      const { error: insertError } = await (supabase.from("venue_media") as any).insert({
        venue_id: myVenue.id,
        vendor_id: vendorData.id,
        type: preview.type,
        url: urlData.publicUrl,
        caption: caption.trim() || null,
        is_active: true,
      });

      if (insertError) throw insertError;

      qc.invalidateQueries({ queryKey: ["venue-media", myVenue.id] });
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      setError(e.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          {preview?.type === "video" ? "Clip" : "Photo"} uploaded
        </p>
        <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Visible on your venue page</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Add Media</h1>
          {myVenue && <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{myVenue.name}</p>}
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Info banner */}
        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 8 }}>
          <Upload size={15} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
            Photos and video clips appear on your venue page and in the Discover feed.
            Show customers what your venue is really like.
          </p>
        </div>

        {/* No venue warning */}
        {vendorData && !myVenue && (
          <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, margin: "0 0 4px" }}>No venue assigned</p>
            <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0 }}>Admin needs to assign a venue to your account before you can upload media.</p>
          </div>
        )}

        {/* Upload options */}
        {!preview && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => photoRef.current?.click()}
              style={{ flex: 1, padding: "20px 10px", borderRadius: 16, border: "2px dashed #C4A0E8", backgroundColor: "#F9F5FF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Camera size={22} style={{ color: "#5B0EA6" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>Photo</span>
              <span style={{ fontSize: 10, color: "#9E9E9E" }}>JPG, PNG · Max 10MB</span>
            </button>

            <button onClick={() => videoRef.current?.click()}
              style={{ flex: 1, padding: "20px 10px", borderRadius: 16, border: "2px dashed #C4A0E8", backgroundColor: "#F9F5FF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Video size={22} style={{ color: "#5B0EA6" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>Video Clip</span>
              <span style={{ fontSize: 10, color: "#9E9E9E" }}>MP4, MOV · Max 100MB</span>
            </button>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", backgroundColor: "#0A0A0A", aspectRatio: preview.type === "video" ? "9/16" : "4/3", maxHeight: 340 }}>
              {preview.type === "photo" ? (
                <img src={preview.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <video src={preview.url} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline />
              )}
              <button onClick={() => setPreview(null)}
                style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} style={{ color: "#FFFFFF" }} />
              </button>
              <div style={{ position: "absolute", bottom: 10, left: 10 }}>
                <span style={{ backgroundColor: preview.type === "video" ? "#EF4444" : "#5B0EA6", color: "#FFFFFF", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>
                  {preview.type === "video" ? "VIDEO" : "PHOTO"}
                </span>
              </div>
            </div>

            {/* Caption */}
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>CAPTION <span style={{ color: "#9E9E9E", fontWeight: 400 }}>(optional)</span></p>
              <input type="text" placeholder="Describe what's happening..." value={caption} onChange={(e) => setCaption(e.target.value)}
                style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          </motion.div>
        )}

        {/* Hidden inputs */}
        <input ref={photoRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "photo")} style={{ display: "none" }} />
        <input ref={videoRef} type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], "video")} style={{ display: "none" }} />

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload button */}
        {preview && (
          <button onClick={handleUpload} disabled={uploading || !myVenue}
            style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: uploading || !myVenue ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: uploading || !myVenue ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: uploading || !myVenue ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
            {uploading ? (
              <><Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />Uploading...</>
            ) : (
              <><Upload size={18} />Post {preview.type === "video" ? "Clip" : "Photo"}</>
            )}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}