/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Camera, MapPin, Save } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

const AMENITIES = [
  "WiFi", "AC", "Kitchen", "Washing Machine", "TV", "Netflix", "Generator",
  "Parking", "Security", "CCTV", "Swimming Pool", "Gym", "Balcony",
  "Water Heater", "Elevator", "Pet Friendly", "Workspace", "Self Check-in",
];

export default function VendorPropertyPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "amenities" | "pricing">("details");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors").select("*").eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: venue } = useQuery({
    queryKey: ["vendor-venue-edit", vendor?.id],
    queryFn: async () => {
      if (!vendor?.venue_id) return null;
      const { data } = await supabase.from("venues").select("*").eq("id", vendor.venue_id).maybeSingle();
      return data as any;
    },
    enabled: !!vendor?.venue_id,
  });

  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if ((vendor || venue) && !form) {
      setForm({
        name: venue?.name || vendor?.business_name || "",
        description: vendor?.description || "",
        address: venue?.address || vendor?.address || "",
        images: venue?.images || vendor?.images || [],
        amenities: venue?.filters || [],
        starting_price: vendor?.starting_price || "",
        bedrooms: vendor?.bedrooms || "",
        bathrooms: vendor?.bathrooms || "",
        max_guests: vendor?.max_guests || "",
        house_rules: vendor?.house_rules || "",
        phone: vendor?.phone || "",
        whatsapp: vendor?.whatsapp || "",
      });
    }
  }, [vendor, venue]);

  const f = form || {
    name: venue?.name || vendor?.business_name || "",
    description: vendor?.description || "",
    address: venue?.address || vendor?.address || "",
    images: venue?.images || vendor?.images || [],
    amenities: venue?.filters || [],
    starting_price: vendor?.starting_price || "",
    bedrooms: vendor?.bedrooms || "",
    bathrooms: vendor?.bathrooms || "",
    max_guests: vendor?.max_guests || "",
    house_rules: vendor?.house_rules || "",
    phone: vendor?.phone || "",
    whatsapp: vendor?.whatsapp || "",
  };

  const setField = (key: string, val: any) =>
    setForm((prev: any) => ({ ...(prev || f), [key]: val }));

  const toggleAmenity = (a: string) => {
    const current = f.amenities || [];
    setField("amenities", current.includes(a) ? current.filter((x: string) => x !== a) : [...current, a]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!vendor) throw new Error("Vendor not found");
      await (supabase.from("vendors") as any).update({
        description: f.description,
        starting_price: f.starting_price ? Number(f.starting_price) : null,
        images: f.images,
        phone: f.phone,
        whatsapp: f.whatsapp,
        address: f.address,
      } as any).eq("id", vendor.id);

      if (vendor.venue_id) {
        await (supabase.from("venues") as any).update({
          name: f.name,
          address: f.address,
          images: f.images,
          filters: f.amenities,
        }).eq("id", vendor.venue_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor"] });
      qc.invalidateQueries({ queryKey: ["vendor-venue-edit"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>

      <div style={{ background: "linear-gradient(135deg, #065F46, #059669)", padding: "44px 16px 20px", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>My Property</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>{vendor?.business_name}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["details", "amenities", "pricing"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "none", backgroundColor: activeTab === tab ? "#FFFFFF" : "rgba(255,255,255,0.15)", color: activeTab === tab ? "#059669" : "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 16px", display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <CheckCircle size={16} style={{ color: "#00C853" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "#065F46", margin: 0 }}>Property details saved</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {activeTab === "details" && (
            <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Camera size={16} style={{ color: "#059669" }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Property Photos</p>
                </div>
                <ImageUpload images={f.images} onChange={(imgs) => setField("images", imgs)} maxImages={12} folder="apartments" />
              </div>

              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Property Name</p>
                  <input type="text" value={f.name} onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. Lekki Phase 1 Executive Suite" style={inputStyle} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Description</p>
                  <textarea value={f.description} onChange={(e) => setField("description", e.target.value)}
                    placeholder="Describe your property for guests..." rows={4}
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Address</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "12px 14px" }}>
                    <MapPin size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                    <input type="text" value={f.address} onChange={(e) => setField("address", e.target.value)}
                      placeholder="Full property address"
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { key: "bedrooms", label: "Bedrooms", placeholder: "2" },
                    { key: "bathrooms", label: "Bathrooms", placeholder: "2" },
                    { key: "max_guests", label: "Max Guests", placeholder: "4" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{label}</p>
                      <input type="number" min="0" value={f[key]} onChange={(e) => setField(key, e.target.value)}
                        placeholder={placeholder} style={{ ...inputStyle, textAlign: "center" }} />
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>House Rules</p>
                  <textarea value={f.house_rules} onChange={(e) => setField("house_rules", e.target.value)}
                    placeholder="No smoking, no parties, check-out by 11am..." rows={3}
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Phone</p>
                    <input type="tel" value={f.phone} onChange={(e) => setField("phone", e.target.value)}
                      placeholder="08012345678" style={inputStyle} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>WhatsApp</p>
                    <input type="tel" value={f.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)}
                      placeholder="08012345678" style={inputStyle} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "amenities" && (
            <motion.div key="amenities" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>Property Amenities</p>
                <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px" }}>Select all amenities available</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {AMENITIES.map((a) => {
                    const active = (f.amenities || []).includes(a);
                    return (
                      <button key={a} onClick={() => toggleAmenity(a)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "1.5px solid", borderColor: active ? "#059669" : "#E4DCF0", backgroundColor: active ? "#E0F7EA" : "#F7F5FA", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: active ? "#059669" : "#E4DCF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {active && <CheckCircle size={13} style={{ color: "#FFFFFF" }} />}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#059669" : "#6B6B6B" }}>{a}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "pricing" && (
            <motion.div key="pricing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>Price Per Night</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 10px" }}>Shown to guests on your listing</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "13px 14px" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#059669" }}>₦</span>
                    <input type="number" value={f.starting_price} onChange={(e) => setField("starting_price", e.target.value)}
                      placeholder="e.g. 45000"
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                    <span style={{ fontSize: 12, color: "#9E9E9E" }}>/night</span>
                  </div>
                </div>
                <div style={{ backgroundColor: "#E0F7EA", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: 12, color: "#065F46", margin: 0, lineHeight: 1.6 }}>
                    Individual unit pricing can be set separately when adding units under Listings.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 32px", backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: saveMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #065F46, #059669)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}>
          {saveMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><Save size={16} />Save Changes</>}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}