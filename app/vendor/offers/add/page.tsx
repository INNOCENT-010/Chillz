/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { ImageUpload } from "@/components/ui/image-upload";
import { ArrowLeft, Plus, CheckCircle, AlertTriangle, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddOfferPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed" | "freebie",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    images: [] as string[],
    is_active: true,
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Offer title is required"); return; }
    if (form.discount_type !== "freebie" && (!form.discount_value || Number(form.discount_value) <= 0)) {
      setError("Discount value is required"); return;
    }
    if (!vendor?.id) { setError("Vendor account not found"); return; }

    setLoading(true);
    setError("");
    try {
      const { error: insertError } = await (supabase.from("offers") as any).insert({
        vendor_id: vendor.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: form.discount_type === "freebie" ? 0 : Number(form.discount_value),
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        images: form.images,
        is_active: form.is_active,
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
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Offer Created</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Add Offer</h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>OFFER TITLE</p>
          <input type="text" placeholder="e.g. Ladies Free Before 11pm, Happy Hour 5-8pm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
          <textarea placeholder="More details about the offer..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Discount type */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>DISCOUNT TYPE</p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["percentage", "fixed", "freebie"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, discount_type: type })}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid",
                  borderColor: form.discount_type === type ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: form.discount_type === type ? "#EDE0F7" : "#FFFFFF",
                  color: form.discount_type === type ? "#5B0EA6" : "#6B6B6B",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                }}
              >
                {type === "percentage" ? "% Off" : type === "fixed" ? "₦ Off" : "Freebie"}
              </button>
            ))}
          </div>
        </div>

        {/* Discount value */}
        {form.discount_type !== "freebie" && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
              {form.discount_type === "percentage" ? "PERCENTAGE OFF" : "AMOUNT OFF (₦)"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>
                {form.discount_type === "percentage" ? "%" : "₦"}
              </span>
              <input type="number" placeholder="0" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
            </div>
          </div>
        )}

        {/* Validity dates */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VALID FROM</p>
            <input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VALID UNTIL</p>
            <input type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} style={inputStyle} />
          </div>
        </div>

        {/* Images */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>IMAGES <span style={{ color: "#9E9E9E", fontWeight: 400 }}>(optional)</span></p>
          <ImageUpload images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} maxImages={3} folder="offers" />
        </div>

        {/* Active toggle */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Active Now</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Offer visible to users immediately</p>
          </div>
          <button
            onClick={() => setForm({ ...form, is_active: !form.is_active })}
            style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: form.is_active ? "#5B0EA6" : "#E4DCF0", position: "relative", transition: "background-color 0.2s ease", flexShrink: 0 }}
          >
            <motion.div animate={{ x: form.is_active ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
          </button>
        </div>

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
            <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Creating...</>
          ) : (
            <><Tag size={16} />Create Offer</>
          )}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}