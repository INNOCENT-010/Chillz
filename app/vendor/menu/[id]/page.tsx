/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, AlertTriangle,
  Trash2, Eye, EyeOff, Save,
} from "lucide-react";

const COMMON_CATEGORIES = [
  "Food", "Drinks", "Cocktails", "Wine", "Spirits",
  "Mocktails", "Starters", "Main Course", "Desserts",
  "Shisha", "Bottles", "Services", "General",
];

export default function EditMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [customCategory, setCustomCategory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors").select("id")
        .eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: item, isLoading } = useQuery({
    queryKey: ["menu-item", id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendor_menu") as any)
        .select("*").eq("id", id).maybeSingle();
      return data as any;
    },
    staleTime: 0,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Food",
    customCategoryName: "",
    price: "",
    is_available: true,
  });

  // Populate form when item loads
  useEffect(() => {
    if (item) {
      const isPreset = COMMON_CATEGORIES.includes(item.category);
      setCustomCategory(!isPreset);
      setForm({
        name: item.name || "",
        description: item.description || "",
        category: isPreset ? item.category : "General",
        customCategoryName: !isPreset ? item.category : "",
        price: String(item.price || ""),
        is_available: item.is_available ?? true,
      });
    }
  }, [item]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Item name is required");
      if (!form.price || Number(form.price) <= 0) throw new Error("Price must be greater than 0");
      const category = customCategory
        ? (form.customCategoryName.trim() || "General")
        : form.category;
      const { error } = await (supabase.from("vendor_menu") as any)
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          category,
          price: Number(form.price),
          is_available: form.is_available,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-menu"] });
      qc.invalidateQueries({ queryKey: ["menu-item", id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("vendor_menu") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-menu"] });
      router.back();
    },
  });

  const toggleAvailability = async () => {
    const newVal = !form.is_available;
    setForm((prev) => ({ ...prev, is_available: newVal }));
    await (supabase.from("vendor_menu") as any)
      .update({ is_available: newVal }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["vendor-menu"] });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!item) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#6B6B6B" }}>Menu item not found</p>
      <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Edit Menu Item
            </h1>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{item.name}</p>
          </div>
        </div>
        {/* Availability toggle */}
        <button onClick={toggleAvailability}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.is_available ? "#A7F3D0" : "#E4DCF0", backgroundColor: form.is_available ? "#E0F7EA" : "#F2EEF9", cursor: "pointer" }}>
          {form.is_available
            ? <><Eye size={13} style={{ color: "#00C853" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Available</span></>
            : <><EyeOff size={13} style={{ color: "#9E9E9E" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E" }}>Hidden</span></>}
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Success banner */}
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle size={16} style={{ color: "#00C853" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "#065F46", margin: 0 }}>Changes saved</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Availability info */}
        {!form.is_available && (
          <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "10px 14px", display: "flex", gap: 8 }}>
            <AlertTriangle size={14} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
              This item is hidden from the receipt builder. Toggle Available to show it again.
            </p>
          </div>
        )}

        {/* Name */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 10px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Item Name</p>
            <input type="text" placeholder="e.g. Chicken Wings" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
              Description <span style={{ fontWeight: 400, color: "#C4BAD8" }}>(optional)</span>
            </p>
            <input type="text" placeholder="Brief description..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
          </div>

          {/* Price */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Price</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
              <input type="number" placeholder="0" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
            </div>
          </div>
        </div>

        {/* Category */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 10px rgba(91,14,166,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Category</p>
            <button onClick={() => setCustomCategory(!customCategory)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>
              {customCategory ? "Use preset" : "Custom"}
            </button>
          </div>
          {customCategory ? (
            <input type="text" placeholder="Enter category name..." value={form.customCategoryName}
              onChange={(e) => setForm({ ...form, customCategoryName: e.target.value })} style={inputStyle} />
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {COMMON_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                  style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid", borderColor: form.category === cat ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.category === cat ? "#EDE0F7" : "#FFFFFF", color: form.category === cat ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {saveMutation.isError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>
                {(saveMutation.error as Error).message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete */}
        <AnimatePresence>
          {showDeleteConfirm ? (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 16, padding: "16px" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#991B1B", margin: "0 0 6px" }}>Delete this item?</p>
              <p style={{ fontSize: 12, color: "#DC2626", margin: "0 0 14px", lineHeight: 1.5 }}>
                It will be removed from your menu and receipt builder immediately.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Trash2 size={15} />Delete Item
            </button>
          )}
        </AnimatePresence>
      </div>

      {/* Save button */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 32px", backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: saveMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saveMutation.isPending ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {saveMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><Save size={16} />Save Changes</>}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}