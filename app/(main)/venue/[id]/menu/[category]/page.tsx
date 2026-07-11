/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { formatCurrency } from "@/lib/utils";
import { useVenueCart } from "@/store/venue-cart";
import { ArrowLeft, UtensilsCrossed, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export default function MenuCategoryPage() {
  const { id, category } = useParams<{ id: string; category: string }>();
  const router = useRouter();
  const decodedCategory = decodeURIComponent(category);

  const { items, increment, decrement, clear, setVenueId, selectedTotal, selectedCount } = useVenueCart();

  const { data: venue } = useQuery({
    queryKey: ["venue-basic", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("venues")
        .select("name, vendor_id, minimum_spend")
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["venue-menu-category", id, decodedCategory],
    queryFn: async () => {
      if (!venue?.vendor_id) return [];
      const { data } = await supabase
        .from("vendor_menu")
        .select("*")
        .eq("vendor_id", venue.vendor_id)
        .eq("category", decodedCategory)
        .eq("is_available", true)
        .order("name");
      return (data || []) as any[];
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  // Register venue in cart store
  useEffect(() => {
    if (id) setVenueId(id);
  }, [id]);

  const minimumSpend = venue?.minimum_spend || 0;
  const total = selectedTotal();
  const count = selectedCount();
  const belowMin = minimumSpend > 0 && total < minimumSpend && count > 0;

  const handleBookNow = () => {
    // Go back to venue page — cart state is shared via store
    // venue page will detect items in cart and open booking sheet
    router.push(`/venue/${id}?book=1`);
  };

  return (
    <MainLayout>
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 120 }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 16px 20px", position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "0 0 1px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {venue?.name}
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)", textTransform: "capitalize" }}>
                {decodedCategory}
              </h1>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "4px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{menuItems.length} items</span>
            </div>
          </div>
        </div>

        {/* Sticky cart bar */}
        <AnimatePresence>
          {count > 0 && (
            <motion.div
              initial={{ y: -56, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -56, opacity: 0 }}
              style={{ backgroundColor: "#5B0EA6", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 92, zIndex: 39, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 1px" }}>
                  {count} item{count !== 1 ? "s" : ""}
                  {minimumSpend > 0 && belowMin && (
                    <span style={{ color: "#FDE68A" }}> · need {formatCurrency(minimumSpend - total)} more</span>
                  )}
                </p>
                <p style={{ fontSize: 16, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(total)}
                  {minimumSpend > 0 && !belowMin && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginLeft: 6 }}>✓ min met</span>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={clear}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", backgroundColor: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Clear
                </button>
                <button
                  onClick={handleBookNow}
                  disabled={belowMin}
                  style={{ padding: "7px 16px", borderRadius: 10, border: "none", backgroundColor: belowMin ? "rgba(255,255,255,0.3)" : "#FFFFFF", color: belowMin ? "rgba(255,255,255,0.5)" : "#5B0EA6", fontSize: 12, fontWeight: 800, cursor: belowMin ? "not-allowed" : "pointer" }}>
                  Book Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Min spend info banner */}
        {minimumSpend > 0 && count === 0 && (
          <div style={{ backgroundColor: "#FFF8E1", padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid #FDE68A" }}>
            <AlertCircle size={13} style={{ color: "#D97706", flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: "#92400E", margin: 0 }}>
              Min. spend {formatCurrency(minimumSpend)} — add items to your order
            </p>
          </div>
        )}

        {/* Grid */}
        <div style={{ padding: "16px" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : menuItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <UtensilsCrossed size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No items in this category</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {menuItems.map((item: any, idx: number) => {
                const qty = items[item.id]?.qty || 0;
                const isSelected = qty > 0;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFFFF", border: `1.5px solid ${isSelected ? "#C4A0E8" : "#F2EEF9"}`, boxShadow: isSelected ? "0 2px 12px rgba(91,14,166,0.15)" : "0 1px 6px rgba(91,14,166,0.05)", display: "flex", flexDirection: "column", transition: "all 0.15s" }}>

                    {/* Image */}
                    <div style={{ width: "100%", aspectRatio: "1/1", backgroundColor: "#EDE0F7", position: "relative", flexShrink: 0 }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? "#C4A0E8" : "#EDE0F7" }}>
                          <UtensilsCrossed size={22} style={{ color: isSelected ? "#FFFFFF" : "#5B0EA6", opacity: 0.6 }} />
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <CheckCircle size={12} style={{ color: "#FFFFFF" }} />
                        </div>
                      )}
                      {qty > 1 && (
                        <div style={{ position: "absolute", top: 5, left: 5, backgroundColor: "#5B0EA6", borderRadius: 999, padding: "1px 6px" }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF" }}>×{qty}</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: "8px 8px 4px", flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 11, color: "#0A0A0A", margin: "0 0 2px", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                        {item.name}
                      </p>
                      {item.description && (
                        <p style={{ fontSize: 9, color: "#9E9E9E", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                          {item.description}
                        </p>
                      )}
                      <p style={{ fontSize: 12, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                        {formatCurrency(item.price)}
                      </p>
                    </div>

                    {/* Controls */}
                    <div style={{ padding: "0 8px 8px" }}>
                      {isSelected ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EDE0F7", borderRadius: 8, padding: "3px 5px" }}>
                          <button onClick={() => decrement(item.id)}
                            style={{ width: 22, height: 22, borderRadius: 6, border: "none", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 14, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            −
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6" }}>{qty}</span>
                          <button onClick={() => increment({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, category: item.category })}
                            style={{ width: 22, height: 22, borderRadius: 6, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            +
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => increment({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, category: item.category })}
                          style={{ width: "100%", padding: "6px 0", borderRadius: 8, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          + Add
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}