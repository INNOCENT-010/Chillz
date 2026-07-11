/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Camera, CheckCircle, AlertTriangle, Loader } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    avatar_url: "",
  });

  // Initialize form once user is available
  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        avatar_url: user.avatar_url || "",
      });
    }
  }, [user]);

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F5FA",
        }}
      >
        <p style={{ color: "#9E9E9E", fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  const handleAvatarUpload = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("Only image files allowed");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be under 3MB");
      return;
    }

    setAvatarUploading(true);
    setError("");

    try {
      // Always use same path per user so it overwrites the old one
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chillz-images")
        .upload(path, file, {
          upsert: true,
          cacheControl: "0", // no cache so new image shows immediately
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chillz-images")
        .getPublicUrl(path);

      if (!urlData?.publicUrl) throw new Error("Failed to get image URL");

      // Add cache busting param so browser doesn't show old cached image
      const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      setForm((prev) => ({ ...prev, avatar_url: freshUrl }));
    } catch (e: any) {
      setError(e.message || "Upload failed. Try again.");
    } finally {
      setAvatarUploading(false);
      // Reset file input so same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate
    if (!form.full_name.trim()) {
      setError("Full name is required");
      return;
    }
    if (form.full_name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (form.phone && !/^\+?[\d\s\-]{10,14}$/.test(form.phone)) {
      setError("Enter a valid phone number");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updateData = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase.from("users") as any)
        .update(updateData)
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Update auth store immediately
      setUser({
        ...user,
        full_name: updateData.full_name,
        phone: updateData.phone,
        avatar_url: updateData.avatar_url,
      });

      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      setError(e.message || "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#F7F5FA",
    border: "1.5px solid #E4DCF0",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0A0A0A",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F5FA",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E4DCF0",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              marginLeft: -6,
              display: "flex",
            }}
          >
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#0A0A0A",
              margin: 0,
              fontFamily: "var(--font-display, Syne, sans-serif)",
            }}
          >
            Edit Profile
          </h1>
        </div>
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <CheckCircle size={16} style={{ color: "#00C853" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00C853" }}>
                Saved
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        style={{
          padding: "32px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center",
        }}
      >
        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              backgroundColor: "#EDE0F7",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "3px solid #FFFFFF",
              boxShadow: "0 4px 20px rgba(91,14,166,0.2)",
              position: "relative",
            }}
          >
            {form.avatar_url ? (
              <img
                src={form.avatar_url}
                alt="Avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#5B0EA6",
                  fontFamily: "var(--font-display, Syne, sans-serif)",
                }}
              >
                {form.full_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}

            {/* Upload overlay while uploading */}
            {avatarUploading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(91,14,166,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
              >
                <Loader
                  size={28}
                  style={{
                    color: "#FFFFFF",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              </div>
            )}
          </div>

          {/* Camera button */}
          <button
            onClick={() => !avatarUploading && fileRef.current?.click()}
            disabled={avatarUploading}
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: avatarUploading ? "#9E9E9E" : "#5B0EA6",
              border: "2.5px solid #FFFFFF",
              cursor: avatarUploading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(91,14,166,0.3)",
              transition: "background-color 0.2s ease",
            }}
          >
            <Camera size={15} style={{ color: "#FFFFFF" }} />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleAvatarUpload(e.target.files)}
            style={{ display: "none" }}
          />
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#9E9E9E",
            margin: "-12px 0 0",
            textAlign: "center",
          }}
        >
          {avatarUploading ? "Uploading photo..." : "Tap camera icon to change photo"}
        </p>

        {/* Form fields */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B6B6B",
                margin: "0 0 6px",
              }}
            >
              FULL NAME
            </p>
            <input
              type="text"
              placeholder="Your full name"
              value={form.full_name}
              onChange={(e) => {
                setForm({ ...form, full_name: e.target.value });
                setError("");
              }}
              style={inputStyle}
            />
          </div>

          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B6B6B",
                margin: "0 0 6px",
              }}
            >
              EMAIL
            </p>
            <input
              type="email"
              value={user.email || ""}
              disabled
              style={{
                ...inputStyle,
                backgroundColor: "#F2EEF9",
                color: "#9E9E9E",
                cursor: "not-allowed",
                border: "1.5px solid #F2EEF9",
              }}
            />
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0" }}>
              Email cannot be changed
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B6B6B",
                margin: "0 0 6px",
              }}
            >
              PHONE NUMBER
            </p>
            <input
              type="tel"
              placeholder="+234 800 000 0000"
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setError("");
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                width: "100%",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || avatarUploading}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 16,
            border: "none",
            background:
              saving || avatarUploading
                ? "#9E9E9E"
                : "linear-gradient(135deg, #5B0EA6, #7B2FBE)",
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            cursor: saving || avatarUploading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow:
              saving || avatarUploading
                ? "none"
                : "0 4px 16px rgba(91,14,166,0.3)",
            transition: "all 0.2s ease",
          }}
        >
          {saving ? (
            <>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Saving...
            </>
          ) : avatarUploading ? (
            <>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Wait for photo to finish uploading...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}