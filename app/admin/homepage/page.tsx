/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Check, Image as ImageIcon,
  ChevronDown, ChevronUp, Upload, AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const EDITORIAL_SECTIONS = [
  { key: "editor_pick", label: "Editor's Pick", sub: "Featured card on homepage", hasTitle: true, hasBadge: true },
];

const CATEGORY_SECTIONS = [
  { key: "category_events",     label: "Events",             emoji: "🎉" },
  { key: "category_bar_lounge", label: "Bar & Lounge",       emoji: "🍸" },
  { key: "category_club",       label: "Club",               emoji: "🎵" },
  { key: "category_restaurant", label: "Restaurant & Café",  emoji: "🍽️" },
  { key: "category_apartment",  label: "Apartments & Stays", emoji: "🏠" },
  { key: "category_hotel",      label: "Hotels & Resorts",   emoji: "🏨" },
  { key: "category_car_rental", label: "Car Rentals",        emoji: "🚗" },
  { key: "category_flight",     label: "Flight Booking",     emoji: "✈️" },
];

// ── Upload to storage and return public URL ───────────────────────────────
async function uploadToStorage(file: File, sectionKey: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `homepage/${sectionKey}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("chillz-images")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data } = supabase.storage.from("chillz-images").getPublicUrl(path);
  return data.publicUrl;
}

// ── Write a single field to DB directly ──────────────────────────────────
async function saveFieldToDB(sectionKey: string, updates: Record<string, any>): Promise<void> {
  const { data, error } = await (supabase.from("homepage_content") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("section_key", sectionKey)
    .select(); // SELECT forces PostgREST to return what was actually updated

  if (error) throw new Error(`DB update failed: ${error.message} (code: ${error.code})`);
  if (!data || data.length === 0) {
    throw new Error(`DB update matched 0 rows for section_key="${sectionKey}". Check RLS policies.`);
  }
}

// ── Category image tile — self-contained upload + save ───────────────────
function CategoryTile({
  sectionKey, label, emoji, dbImageUrl, onSaved,
}: {
  sectionKey: string; label: string; emoji: string;
  dbImageUrl: string | null; onSaved: () => void;
}) {
  const [preview, setPreview]     = useState<string | null>(dbImageUrl);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus]       = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync preview when DB value changes (after refetch)
  useEffect(() => {
    if (dbImageUrl) setPreview(dbImageUrl);
  }, [dbImageUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrorMsg("Images only"); return; }
    if (file.size > 5 * 1024 * 1024) { setErrorMsg("Max 5MB"); return; }

    setErrorMsg("");
    setUploading(true);
    setStatus("idle");

    // Immediate local preview
    setPreview(URL.createObjectURL(file));

    try {
      // Step 1: upload to storage
      const publicUrl = await uploadToStorage(file, sectionKey);
      setPreview(publicUrl);

      // Step 2: immediately write to DB
      setStatus("saving");
      await saveFieldToDB(sectionKey, { image_url: publicUrl });
      setStatus("saved");
      onSaved();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed");
      setStatus("error");
      setPreview(dbImageUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading || status === "saving"}
        style={{
          width: "100%", height: 100,
          borderRadius: 16,
          border: preview ? "none" : "2px dashed #C4A0E8",
          backgroundColor: preview ? "transparent" : "#F7F5FA",
          cursor: (uploading || status === "saving") ? "not-allowed" : "pointer",
          position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 5, padding: 0,
        }}
      >
        {preview ? (
          <>
            <img src={preview} alt={label}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{
              position: "absolute", inset: 0,
              backgroundColor: "rgba(0,0,0,0.48)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              {(uploading || status === "saving") ? (
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
              ) : status === "saved" ? (
                <>
                  <Check size={18} style={{ color: "#22C55E" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E" }}>Saved!</span>
                </>
              ) : (
                <>
                  <Upload size={16} style={{ color: "#FFFFFF" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>Change</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {(uploading || status === "saving") ? (
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid #C4A0E8", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <>
                <span style={{ fontSize: 24 }}>{emoji}</span>
                <span style={{ fontSize: 10, color: "#9E9E9E", fontWeight: 500 }}>Tap to upload</span>
              </>
            )}
          </>
        )}
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#2D2D2D", margin: 0 }}>{label}</p>
        {status === "error" && (
          <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 600 }}>Error</span>
        )}
        {status === "saved" && (
          <span style={{ fontSize: 9, color: "#22C55E", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
            <Check size={9} /> Saved
          </span>
        )}
      </div>
      {errorMsg && (
        <p style={{ fontSize: 10, color: "#EF4444", margin: "2px 0 0", lineHeight: 1.3 }}>{errorMsg}</p>
      )}
    </div>
  );
}

// ── Editorial section image upload tile ──────────────────────────────────
function EditorialImageTile({
  sectionKey, dbImageUrl, onUploaded,
}: {
  sectionKey: string; dbImageUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const [preview, setPreview]     = useState<string | null>(dbImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dbImageUrl) setPreview(dbImageUrl);
  }, [dbImageUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Images only"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Max 5MB"); return; }

    setError("");
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    try {
      const publicUrl = await uploadToStorage(file, sectionKey);
      setPreview(publicUrl);
      onUploaded(publicUrl);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setPreview(dbImageUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
        onChange={handleFile} style={{ display: "none" }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          width: "100%", height: 150,
          borderRadius: 20,
          border: preview ? "none" : "2px dashed #C4A0E8",
          backgroundColor: preview ? "transparent" : "#F7F5FA",
          cursor: uploading ? "not-allowed" : "pointer",
          position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6, padding: 0,
        }}
      >
        {preview ? (
          <>
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{
              position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {uploading
                ? <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                : <><Upload size={20} style={{ color: "#FFFFFF" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>Change Image</span></>
              }
            </div>
          </>
        ) : (
          uploading
            ? <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid #C4A0E8", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
            : <><Upload size={22} style={{ color: "#C4A0E8" }} /><span style={{ fontSize: 12, color: "#9E9E9E", fontWeight: 500 }}>Tap to upload</span><span style={{ fontSize: 10, color: "#BDBDBD" }}>JPEG · PNG · WEBP · max 5MB</span></>
        )}
      </button>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
          <AlertCircle size={12} style={{ color: "#EF4444" }} />
          <p style={{ fontSize: 11, color: "#EF4444", margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminHomepagePage() {
  const router = useRouter();
  const qc     = useQueryClient();

  const [expandedSection, setExpandedSection] = useState<string | null>("categories");
  const [drafts,  setDrafts]  = useState<Record<string, any>>({});
  const [saving,  setSaving]  = useState<string | null>(null);
  const [saved,   setSaved]   = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // ── Fetch all sections ────────────────────────────────────────────────
  const { data: sections, isLoading, refetch } = useQuery({
    queryKey: ["admin-homepage-content"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("homepage_content") as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0, // always fresh in admin
  });

  const getSection  = (key: string) => (sections || []).find((s: any) => s.section_key === key);
  const getDbValue  = (key: string, field: string) => getSection(key)?.[field] ?? "";
  const getDraft    = (key: string, field: string) => {
    if (drafts[key] && field in drafts[key]) return drafts[key][field];
    return getDbValue(key, field);
  };
  const setDraft    = (sectionKey: string, field: string, value: any) =>
    setDrafts((prev) => ({ ...prev, [sectionKey]: { ...(prev[sectionKey] || {}), [field]: value } }));
  const hasDraft    = (key: string) => !!drafts[key] && Object.keys(drafts[key]).length > 0;
  const clearDraft  = (key: string) => setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });

  // ── Save editorial section ────────────────────────────────────────────
  const handleSave = async (sectionKey: string) => {
    const updates = drafts[sectionKey];
    if (!updates || !Object.keys(updates).length) return;

    setSaving(sectionKey);
    setSaveErr(null);

    try {
      await saveFieldToDB(sectionKey, updates);
      clearDraft(sectionKey);
      setSaved(sectionKey);
      setTimeout(() => setSaved(null), 2500);
      // Refetch so UI shows DB values
      await refetch();
      qc.invalidateQueries({ queryKey: ["homepage-content-all"] });
    } catch (err: any) {
      setSaveErr(err.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    const keys = Object.keys(drafts).filter((k) => Object.keys(drafts[k] || {}).length > 0);
    if (!keys.length) return;
    setSaving("all");
    setSaveErr(null);
    try {
      for (const key of keys) {
        await saveFieldToDB(key, drafts[key]);
        clearDraft(key);
      }
      setSaved("all");
      setTimeout(() => setSaved(null), 2500);
      await refetch();
      qc.invalidateQueries({ queryKey: ["homepage-content-all"] });
    } catch (err: any) {
      setSaveErr(err.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const anyDrafts = Object.keys(drafts).some((k) => Object.keys(drafts[k] || {}).length > 0);

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#064E3B,#059669)", padding: "44px 16px 24px", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                Homepage
              </h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0 }}>
                Categories & editorial content
              </p>
            </div>
          </div>
          {anyDrafts && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSaveAll}
              disabled={!!saving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 12, border: "none",
                backgroundColor: "#FFFFFF", color: "#059669",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
              }}
            >
              {saving === "all"
                ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(5,150,105,0.3)", borderTopColor: "#059669", animation: "spin 0.8s linear infinite" }} />
                : <Check size={15} />}
              Save All
            </motion.button>
          )}
        </div>

        {/* Global save error */}
        {saveErr && (
          <div style={{ marginTop: 10, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertCircle size={14} style={{ color: "#FCA5A5", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: "#FCA5A5", margin: 0, lineHeight: 1.4 }}>{saveErr}</p>
          </div>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── CATEGORY IMAGES ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <button
            onClick={() => setExpandedSection(expandedSection === "categories" ? null : "categories")}
            style={{ width: "100%", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", backgroundColor: "transparent", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ImageIcon size={18} style={{ color: "#059669" }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: 0 }}>Category Images</p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                  {CATEGORY_SECTIONS.filter(c => getDbValue(c.key, "image_url")).length} / 8 uploaded
                </p>
              </div>
            </div>
            {expandedSection === "categories"
              ? <ChevronUp size={18} style={{ color: "#9E9E9E" }} />
              : <ChevronDown size={18} style={{ color: "#9E9E9E" }} />}
          </button>

          <AnimatePresence>
            {expandedSection === "categories" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ padding: "0 16px 20px", borderTop: "1px solid #F2EEF9" }}>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: "14px 0 14px", lineHeight: 1.5 }}>
                    Upload saves immediately — no extra Save button needed. Square images, min 400×400px, max 5MB.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {CATEGORY_SECTIONS.map((cat) => (
                      <CategoryTile
                        key={cat.key}
                        sectionKey={cat.key}
                        label={cat.label}
                        emoji={cat.emoji}
                        dbImageUrl={getDbValue(cat.key, "image_url") || null}
                        onSaved={() => {
                          refetch();
                          qc.invalidateQueries({ queryKey: ["homepage-content-all"] });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── EDITORIAL SECTIONS ── */}
        {EDITORIAL_SECTIONS.map((ed) => {
          const isExpanded  = expandedSection === ed.key;
          const isDirty     = hasDraft(ed.key);
          const isSavingNow = saving === ed.key;
          const isSavedNow  = saved === ed.key;

          const currentImage    = getDraft(ed.key, "image_url");
          const currentTitle    = getDraft(ed.key, "title");
          const currentSubtitle = getDraft(ed.key, "subtitle");
          const currentBadge    = getDraft(ed.key, "badge_text");
          const currentLink     = getDraft(ed.key, "link_href");
          const currentActive   = getDraft(ed.key, "is_active");

          return (
            <div key={ed.key} style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <button
                onClick={() => setExpandedSection(isExpanded ? null : ed.key)}
                style={{ width: "100%", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", backgroundColor: "transparent", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                    {currentImage
                      ? <img src={currentImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon size={18} style={{ color: "#C4A0E8" }} /></div>
                    }
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: 0 }}>{ed.label}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{ed.sub}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isDirty && <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>Unsaved</span>}
                  {isSavedNow && <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", backgroundColor: "#D1FAE5", padding: "2px 8px", borderRadius: 999, display: "flex", alignItems: "center", gap: 3 }}><Check size={10} /> Saved</span>}
                  {isExpanded ? <ChevronUp size={18} style={{ color: "#9E9E9E" }} /> : <ChevronDown size={18} style={{ color: "#9E9E9E" }} />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: "0 16px 20px", borderTop: "1px solid #F2EEF9", display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* Active toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Show on Homepage</p>
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Toggle visibility</p>
                        </div>
                        <button
                          onClick={() => setDraft(ed.key, "is_active", !currentActive)}
                          style={{ width: 48, height: 26, borderRadius: 999, border: "none", backgroundColor: currentActive ? "#5B0EA6" : "#E4DCF0", position: "relative", cursor: "pointer", transition: "background 0.2s" }}
                        >
                          <div style={{ position: "absolute", top: 3, left: currentActive ? 25 : 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                        </button>
                      </div>

                      {/* Image upload */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Cover Image</p>
                        <EditorialImageTile
                          sectionKey={ed.key}
                          dbImageUrl={getDbValue(ed.key, "image_url") || null}
                          onUploaded={(url) => setDraft(ed.key, "image_url", url)}
                        />
                        <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>Recommended: 1200×630px landscape</p>
                      </div>

                      {/* Title */}
                      {ed.hasTitle && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Title</p>
                          <input type="text" value={currentTitle}
                            onChange={(e) => setDraft(ed.key, "title", e.target.value)}
                            placeholder="e.g. Lagos Nights Await"
                            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                          />
                        </div>
                      )}

                      {/* Subtitle */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Subtitle</p>
                        <input type="text" value={currentSubtitle}
                          onChange={(e) => setDraft(ed.key, "subtitle", e.target.value)}
                          placeholder="e.g. The hottest spots are open tonight"
                          style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>

                      {/* Badge */}
                      {ed.hasBadge && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Badge Text</p>
                          <input type="text" value={currentBadge}
                            onChange={(e) => setDraft(ed.key, "badge_text", e.target.value)}
                            placeholder="e.g. Editor's Choice"
                            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                          />
                        </div>
                      )}

                      {/* Link */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Link</p>
                        <input type="text" value={currentLink}
                          onChange={(e) => setDraft(ed.key, "link_href", e.target.value)}
                          placeholder="/discover  or  /events/event-id"
                          style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>

                      {/* Live preview */}
                      {(currentImage || currentTitle) && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Preview</p>
                          <div style={{ borderRadius: 18, overflow: "hidden", position: "relative", height: 140, background: "linear-gradient(135deg,#1a0038,#3D0066)" }}>
                            {currentImage && <img src={currentImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }} />}
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.08) 65%)", padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                              {currentBadge && <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF", backgroundColor: "#5B0EA6", padding: "2px 8px", borderRadius: 999, marginBottom: 6, alignSelf: "flex-start", textTransform: "uppercase", letterSpacing: "0.1em" }}>✦ {currentBadge}</span>}
                              {currentTitle && <p style={{ fontWeight: 900, fontSize: 16, color: "#FFFFFF", margin: "0 0 3px", fontFamily: "var(--font-display,Syne,sans-serif)", lineHeight: 1.2 }}>{currentTitle}</p>}
                              {currentSubtitle && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: 0 }}>{currentSubtitle}</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Save button */}
                      {isDirty && (
                        <button
                          onClick={() => handleSave(ed.key)}
                          disabled={!!saving}
                          style={{
                            width: "100%", padding: "13px 0", borderRadius: 14, border: "none",
                            backgroundColor: isSavingNow ? "#9E9E9E" : "#5B0EA6",
                            color: "#FFFFFF", fontSize: 14, fontWeight: 700,
                            cursor: isSavingNow ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          }}
                        >
                          {isSavingNow
                            ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                            : <><Check size={15} />Save Changes</>}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Info */}
        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "14px 16px" }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: "#5B0EA6", margin: "0 0 4px" }}>💡 How it works</p>
          <p style={{ fontSize: 12, color: "#7B2FBE", margin: 0, lineHeight: 1.6 }}>
            Category images upload and save instantly — no extra button needed. Editor's Pick requires filling fields then tapping Save Changes. All updates go live on the homepage immediately.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}