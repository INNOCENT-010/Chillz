/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COMMON_CATEGORIES = [
  "Food", "Drinks", "Cocktails", "Wine", "Spirits",
  "Mocktails", "Starters", "Main Course", "Desserts",
  "Shisha", "Bottles", "Services", "General",
];

export default function AddMenuItemPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Food",
    customCategoryName: "",
    price: "",
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Item name is required"); return; }
    if (!form.price || Number(form.price) <= 0) { setError("Price must be greater than 0"); return; }
    if (!vendor?.id) { setError("Vendor account not found"); return; }

    setLoading(true);
    setError("");
    try {
      const category = customCategory ? form.customCategoryName.trim() || "General" : form.category;
      const { error: insertError } = await (supabase.from("vendor_menu") as any).insert({
        vendor_id: vendor.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category,
        price: Number(form.price),
        is_available: true,
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Item Added</p>
        <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Available in receipt builder</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Add Menu Item</h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Info banner */}
        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 8 }}>
          <CheckCircle size={15} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
            Menu items auto-load into your receipt builder. When billing a customer, just tap the items they ordered.
          </p>
        </div>

        {/* Name */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>ITEM NAME</p>
          <input type="text" placeholder="e.g. Chicken Wings, Hennessy VS, Hookah" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION <span style={{ color: "#9E9E9E", fontWeight: 400 }}>(optional)</span></p>
          <input type="text" placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
        </div>

        {/* Price */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>PRICE</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
            <input
              type="number"
              placeholder="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>CATEGORY</p>
            <button
              onClick={() => setCustomCategory(!customCategory)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}
            >
              {customCategory ? "Use preset" : "Custom category"}
            </button>
          </div>
          {customCategory ? (
            <input type="text" placeholder="Enter category name..." value={form.customCategoryName} onChange={(e) => setForm({ ...form, customCategoryName: e.target.value })} style={inputStyle} />
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm({ ...form, category: cat })}
                  style={{
                    padding: "6px 14px", borderRadius: 999,
                    border: "1.5px solid",
                    borderColor: form.category === cat ? "#5B0EA6" : "#E4DCF0",
                    backgroundColor: form.category === cat ? "#EDE0F7" : "#FFFFFF",
                    color: form.category === cat ? "#5B0EA6" : "#6B6B6B",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

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

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: loading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}
        >
          {loading ? (
            <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Adding...</>
          ) : (
            <><Plus size={18} />Add to Menu</>
          )}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}