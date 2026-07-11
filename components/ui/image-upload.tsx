"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { X, Loader, Upload, AlertTriangle, Video, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  bucket?: string;
  folder?: string;
  videos?: string[];
  onVideosChange?: (videos: string[]) => void;
  maxVideos?: number;
}

const UPLOAD_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Check your connection and try again.`));
    }, ms);
    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export function ImageUpload({
  images,
  onChange,
  maxImages = 5,
  bucket = "chillz-images",
  folder = "venues",
  videos = [],
  onVideosChange,
  maxVideos = 2,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length >= maxImages) { setError(`Maximum ${maxImages} images allowed`); return; }

    setUploading(true);
    setError("");

    const remaining = maxImages - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    const uploaded: string[] = [];

    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is too large. Max size is 5MB`);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const uploadPromise = supabase.storage
          .from(bucket)
          .upload(filename, file, { upsert: false, contentType: file.type });

        const { data: uploadData, error: uploadError } = await withTimeout(
          uploadPromise,
          UPLOAD_TIMEOUT_MS,
          "Image upload"
        );

        if (uploadError) {
          if (uploadError.message.includes("row-level security") || uploadError.message.includes("policy")) {
            setError("Storage permission error. Please contact support or try again.");
          } else if (uploadError.message.includes("Bucket not found")) {
            setError(`Storage bucket not found. Make sure "${bucket}" bucket exists in Supabase.`);
          } else {
            setError(`Upload failed: ${uploadError.message}`);
          }
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
          return;
        }

        if (!uploadData?.path) {
          setError("Upload failed — no path returned. Try again.");
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
          return;
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
        if (!urlData?.publicUrl) {
          setError("Could not get image URL. Try again.");
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
          return;
        }

        uploaded.push(`${urlData.publicUrl}?t=${Date.now()}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown upload error";
        setError(msg);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    if (uploaded.length > 0) onChange([...images, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onVideosChange) return;
    if (videos.length >= maxVideos) { setError(`Maximum ${maxVideos} videos allowed`); return; }
    if (file.size > 50 * 1024 * 1024) { setError("Video must be under 50MB"); return; }

    setError("");
    setUploadingVideo(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const filename = `${folder}/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const uploadPromise = supabase.storage
        .from(bucket)
        .upload(filename, file, { upsert: false, contentType: file.type });

      const { data: uploadData, error: uploadError } = await withTimeout(
        uploadPromise,
        UPLOAD_TIMEOUT_MS * 3, // videos get more time — larger files
        "Video upload"
      );

      if (uploadError) {
        setError(`Video upload failed: ${uploadError.message}`);
        setUploadingVideo(false);
        if (videoRef.current) videoRef.current.value = "";
        return;
      }
      if (!uploadData?.path) {
        setError("Video upload failed — no path returned.");
        setUploadingVideo(false);
        if (videoRef.current) videoRef.current.value = "";
        return;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
      if (!urlData?.publicUrl) {
        setError("Could not get video URL.");
        setUploadingVideo(false);
        if (videoRef.current) videoRef.current.value = "";
        return;
      }

      onVideosChange([...videos, urlData.publicUrl]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setUploadingVideo(false);
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const removeImage = async (url: string, index: number) => {
    try {
      const cleanUrl = url.split("?")[0];
      const path = cleanUrl.split(`${bucket}/`)[1];
      if (path) await supabase.storage.from(bucket).remove([path]);
    } catch { /* ignore */ }
    onChange(images.filter((_, i) => i !== index));
  };

  const removeVideo = async (url: string, index: number) => {
    try {
      const path = url.split(`${bucket}/`)[1];
      if (path) await supabase.storage.from(bucket).remove([path]);
    } catch { /* ignore */ }
    onVideosChange?.(videos.filter((_, i) => i !== index));
  };

  const labelForIndex = (i: number, folder: string) => {
    if (folder === "kyc") return i === 0 ? "Front" : "Back";
    return i === 0 ? "Cover" : null;
  };

  const showVideoSection = !!onVideosChange;

  return (
    <div>
      {/* ── Image previews ── */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <AnimatePresence>
            {images.map((url, i) => {
              const label = labelForIndex(i, folder);
              return (
                <motion.div key={url} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  style={{ position: "relative", width: folder === "kyc" ? "calc(50% - 4px)" : 76, height: folder === "kyc" ? 100 : 76, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: "2px solid #E4DCF0" }}>
                  <img src={url} alt={label || `Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removeImage(url, i)}
                    style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={12} style={{ color: "#FFFFFF" }} />
                  </button>
                  {label && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(91,14,166,0.75)", padding: "3px 6px", textAlign: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Image upload button ── */}
      {images.length < maxImages && (
        <button onClick={() => { if (!uploading) inputRef.current?.click(); }} disabled={uploading}
          style={{ width: "100%", padding: "16px", borderRadius: 14, border: "2px dashed", borderColor: error ? "#FECACA" : uploading ? "#9E9E9E" : "#C4A0E8", backgroundColor: error ? "#FEF2F2" : uploading ? "#F7F5FA" : "#F9F5FF", cursor: uploading ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {uploading ? (
            <>
              <Loader size={22} style={{ color: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Uploading...</span>
              <span style={{ fontSize: 10, color: "#9E9E9E" }}>Will time out automatically if stuck</span>
            </>
          ) : (
            <>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: error ? "#FEE2E2" : "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={18} style={{ color: error ? "#EF4444" : "#5B0EA6" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: error ? "#EF4444" : "#5B0EA6" }}>
                {images.length === 0 ? (folder === "kyc" ? "Upload ID Document" : "Upload Images") : `Add More (${images.length}/${maxImages})`}
              </span>
              <span style={{ fontSize: 11, color: "#9E9E9E" }}>JPG, PNG, WEBP · Max 5MB each</span>
            </>
          )}
        </button>
      )}

      {/* Manual recovery button — shows if upload has been stuck visually */}
      {uploading && (
        <button
          onClick={() => {
            setUploading(false);
            setError("Upload cancelled. Please try again — if this keeps happening, try a smaller image or a different browser.");
            if (inputRef.current) inputRef.current.value = "";
          }}
          style={{ width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 10, border: "1px solid #FECACA", backgroundColor: "#FFFFFF", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          Stuck? Tap to cancel and retry
        </button>
      )}

      {/* ── Video section ── */}
      {showVideoSection && (
        <div style={{ marginTop: 12 }}>
          {videos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <AnimatePresence>
                {videos.map((url, i) => (
                  <motion.div key={url} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    style={{ position: "relative", width: 76, height: 76, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: "2px solid #E4DCF0", backgroundColor: "#0A0A0A" }}>
                    <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", pointerEvents: "none" }}>
                      <Play size={20} style={{ color: "#FFFFFF", fill: "#FFFFFF" }} />
                    </div>
                    <button onClick={() => removeVideo(url, i)}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={12} style={{ color: "#FFFFFF" }} />
                    </button>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(91,14,166,0.75)", padding: "3px 6px", textAlign: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Video {i + 1}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {videos.length < maxVideos && (
            <button onClick={() => { if (!uploadingVideo) videoRef.current?.click(); }} disabled={uploadingVideo}
              style={{ width: "100%", padding: "14px", borderRadius: 14, border: "2px dashed", borderColor: uploadingVideo ? "#9E9E9E" : "#C4A0E8", backgroundColor: uploadingVideo ? "#F7F5FA" : "#F9F5FF", cursor: uploadingVideo ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {uploadingVideo ? (
                <><Loader size={22} style={{ color: "#5B0EA6", animation: "spin 0.8s linear infinite" }} /><span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Uploading video...</span></>
              ) : (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Video size={18} style={{ color: "#5B0EA6" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>
                    {videos.length === 0 ? "Upload Video" : `Add More (${videos.length}/${maxVideos})`}
                  </span>
                  <span style={{ fontSize: 11, color: "#9E9E9E" }}>MP4, MOV, WEBM · Max 50MB</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={inputRef} type="file" accept="image/*" multiple={folder !== "kyc"} onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
      <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/mov" onChange={handleVideoFile} style={{ display: "none" }} />

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 8, backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 7 }}>
            <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: "#EF4444", margin: "0 0 4px", fontWeight: 600 }}>{error}</p>
              {(error.includes("permission") || error.includes("policy")) && (
                <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>
                  Run this in Supabase SQL Editor to fix:<br />
                  <code style={{ fontSize: 10, backgroundColor: "#F2EEF9", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 3, lineHeight: 1.6 }}>
                    {`CREATE POLICY "anon_upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = '${bucket}');`}
                  </code>
                </p>
              )}
            </div>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
              <X size={13} style={{ color: "#9E9E9E" }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}