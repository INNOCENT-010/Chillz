/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, AlertTriangle, Trash2,
  ToggleLeft, ToggleRight, X, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function EditOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed" | "freebie",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
  });

  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => {
      const { data } = await (supabase.from("offers") as any)
        .select("*").eq("id", id).single();
      return data as any;
    },
  });

  useEffect(() => {
    if (offer) {
      setForm({
        title: offer.title || "",
        description: offer.description || "",
        discount_type: offer.discount_type || "percentage",
        discount_value: offer.discount_value ? String(offer.discount_value) : "",
        valid_from: offer.valid_from ? offer.valid_from.slice(0, 10) : "",
        valid_until: offer.valid_until ? offer.valid_until.slice(0, 10) : "",
        is_active: offer.is_active !== false,
      });
    }
  }, [offer]);

  const updateMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!f.title.trim()) throw new Error("Offer title required");
      if (f.discount_type !== "freebie" && (!f.discount_value || Number(f.discount_value) <= 0))
        throw new Error("Enter a valid discount value");

      const { error } = await (supabase.from("offers") as any).update({
        title: f.title.trim(),
        description: f.description.trim() || null,
        discount_type: f.discount_type,
        discount_value: f.discount_type !== "freebie" ? Number(f.discount_value) : 0,
        valid_from: f.valid_from || null,
        valid_until: f.valid_until || null,
        is_active: f.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      setSuccess("Offer updated");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("offers") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => router.push("/vendor/venue"),
    onError: (e: any) => setError(e.message),
  });

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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 24px" }}>
        <button onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Edit Offer</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>{offer?.title}</p>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} style={{ color: "#00C853" }} />
              <p style={{ color: "#059669", fontSize: 13, fontWeight: 600, margin: 0 }}>{success}</p>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active toggle */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Offer Active</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Visible to users on your venue page</p>
          </div>
          <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {form.is_active
              ? <ToggleRight size={28} style={{ color: "#5B0EA6" }} />
              : <ToggleLeft size={28} style={{ color: "#E4DCF0" }} />}
          </button>
        </div>

        {/* Title */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>OFFER TITLE *</p>
          <input type="text" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
          <textarea value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Discount type */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>DISCOUNT TYPE</p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["percentage", "fixed", "freebie"] as const).map((type) => (
              <button key={type} onClick={() => setForm({ ...form, discount_type: type })}
                style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: "1.5px solid", borderColor: form.discount_type === type ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.discount_type === type ? "#EDE0F7" : "#FFFFFF", color: form.discount_type === type ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {type === "percentage" ? "% Off" : type === "fixed" ? "₦ Off" : "Freebie"}
              </button>
            ))}
          </div>
        </div>

        {/* Discount value */}
        {form.discount_type !== "freebie" && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
              {form.discount_type === "percentage" ? "PERCENTAGE (%)" : "AMOUNT OFF (₦)"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#5B0EA6" }}>
                {form.discount_type === "percentage" ? "%" : "₦"}
              </span>
              <input type="number" placeholder="Value" value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
            </div>
          </div>
        )}

        {/* Validity dates */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VALID FROM</p>
            <input type="date" value={form.valid_from}
              onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
              style={{ ...inputStyle, padding: "11px 12px", fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>VALID UNTIL</p>
            <input type="date" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              style={{ ...inputStyle, padding: "11px 12px", fontSize: 13 }} />
          </div>
        </div>

        {/* Preview badge */}
        <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Tag size={16} style={{ color: "#5B0EA6" }} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 3px" }}>{form.title || "Offer title"}</p>
              {form.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "0 0 6px" }}>{form.description}</p>}
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00C853", backgroundColor: "#E0F7EA", padding: "3px 10px", borderRadius: 999 }}>
                {form.discount_type === "percentage"
                  ? `${form.discount_value || "0"}% off`
                  : form.discount_type === "fixed"
                  ? `₦${form.discount_value || "0"} off`
                  : "Free perk"}
              </span>
              {form.valid_until && (
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "6px 0 0" }}>
                  Until {format(new Date(form.valid_until), "dd MMM yyyy")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Save */}
        <button onClick={() => { setError(""); updateMutation.mutate(form); }} disabled={updateMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: updateMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: updateMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          {updateMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><CheckCircle size={17} />Save Changes</>}
        </button>

        {/* Delete */}
        <button onClick={() => setShowDeleteConfirm(true)}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={14} />Delete Offer
        </button>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Trash2 size={24} style={{ color: "#EF4444" }} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", margin: "0 0 6px" }}>Delete Offer?</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>This offer will be permanently removed from your venue page.</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: deleteMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {deleteMutation.isPending
                    ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                    : <><X size={14} />Delete</>}
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