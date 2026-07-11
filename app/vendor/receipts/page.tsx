/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, Send,
  UtensilsCrossed, Search, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LineItem {
  name: string;
  qty: number;
  amount: number;
}

export default function SendReceiptPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [items, setItems] = useState<LineItem[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customItem, setCustomItem] = useState({ name: "", qty: "1", amount: "" });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: booking } = useQuery({
    queryKey: ["vendor-booking", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, users(full_name, avatar_url)")
        .eq("id", bookingId)
        .single();
      return data as any;
    },
  });

  const { data: menuItems } = useQuery({
    queryKey: ["vendor-menu", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await supabase
        .from("vendor_menu")
        .select("*")
        .eq("vendor_id", vendor.id)
        .eq("is_available", true)
        .order("category");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 60,
  });

  const subtotal = items.reduce((sum, item) => sum + item.amount * item.qty, 0);
  const platformFee = Math.round(subtotal * 0.05);
  const total = subtotal + platformFee;

  const addMenuItem = (menuItem: any) => {
    const existing = items.findIndex((i) => i.name === menuItem.name);
    if (existing >= 0) {
      const updated = [...items];
      updated[existing].qty += 1;
      setItems(updated);
    } else {
      setItems([...items, { name: menuItem.name, qty: 1, amount: menuItem.price }]);
    }
    setShowMenu(false);
    setMenuSearch("");
  };

  const addCustomItem = () => {
    if (!customItem.name.trim() || !customItem.amount || Number(customItem.amount) <= 0) return;
    setItems([...items, {
      name: customItem.name.trim(),
      qty: Number(customItem.qty) || 1,
      amount: Number(customItem.amount),
    }]);
    setCustomItem({ name: "", qty: "1", amount: "" });
    setShowCustom(false);
  };

  const updateQty = (i: number, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter((_, idx) => idx !== i));
      return;
    }
    const updated = [...items];
    updated[i].qty = qty;
    setItems(updated);
  };

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const filteredMenu = (menuItems || []).filter((item: any) =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Group filtered menu by category
  const menuByCategory: Record<string, any[]> = {};
  filteredMenu.forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  const sendReceiptMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Add at least one item to the receipt");

      const { error: receiptError } = await (supabase.from("receipts") as any).upsert({
        booking_id: bookingId,
        line_items: items,
        subtotal,
        platform_fee: platformFee,
        total,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      if (receiptError) throw receiptError;

      await (supabase.from("bookings") as any)
        .update({ status: "receipt_sent", receipt_sent_at: new Date().toISOString() })
        .eq("id", bookingId);

      await (supabase.from("notifications") as any).insert({
        user_id: booking?.user_id,
        title: "Receipt received",
        body: `Your receipt of ${formatCurrency(total)} is ready to review and confirm.`,
        type: "receipt",
        reference_id: bookingId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-pending-bookings"] });
      router.push("/vendor");
    },
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Send Receipt</h1>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>For {booking?.users?.full_name}</p>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Add from menu button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 16,
            border: "1.5px solid #EDE0F7", backgroundColor: "#FFFFFF",
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer", boxShadow: "0 2px 8px rgba(91,14,166,0.06)",
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UtensilsCrossed size={17} style={{ color: "#5B0EA6" }} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Add from Menu</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
              {menuItems?.length || 0} item{menuItems?.length !== 1 ? "s" : ""} in your menu
            </p>
          </div>
          {showMenu ? <ChevronUp size={16} style={{ color: "#9E9E9E" }} /> : <ChevronDown size={16} style={{ color: "#9E9E9E" }} />}
        </button>

        {/* Menu picker */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.08)" }}>
                {/* Search */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #F2EEF9" }}>
                  <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search menu..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }}
                  />
                  {menuSearch && <button onClick={() => setMenuSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#9E9E9E" }} /></button>}
                </div>

                {/* Menu items */}
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {Object.keys(menuByCategory).length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9E9E9E", fontSize: 12, padding: "20px 16px" }}>
                      {menuItems?.length === 0 ? "No menu items yet. Add items in the Menu tab." : "No results"}
                    </p>
                  ) : (
                    Object.entries(menuByCategory).map(([category, catItems]) => (
                      <div key={category}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, padding: "8px 14px 4px", backgroundColor: "#F7F5FA" }}>
                          {category}
                        </p>
                        {catItems.map((item: any) => (
                          <button
                            key={item.id}
                            onClick={() => addMenuItem(item)}
                            style={{
                              width: "100%", padding: "11px 14px", border: "none",
                              backgroundColor: "transparent", display: "flex",
                              alignItems: "center", justifyContent: "space-between",
                              cursor: "pointer", borderBottom: "1px solid #F7F5FA",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                              {item.description && <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.description}</p>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(item.price)}</span>
                              <div style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Plus size={13} style={{ color: "#5B0EA6" }} />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom item */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          style={{ width: "100%", padding: "11px 0", borderRadius: 14, border: "2px dashed #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Plus size={15} />
          Add Custom Item
        </button>

        <AnimatePresence>
          {showCustom && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Item name"
                  value={customItem.name}
                  onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={customItem.qty}
                    onChange={(e) => setCustomItem({ ...customItem, qty: e.target.value })}
                    style={{ width: 70, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit" }}
                  />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                    <input
                      type="number"
                      placeholder="Unit price"
                      value={customItem.amount}
                      onChange={(e) => setCustomItem({ ...customItem, amount: e.target.value })}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }}
                    />
                  </div>
                  <button
                    onClick={addCustomItem}
                    style={{ width: 44, height: 44, borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <Plus size={18} style={{ color: "#FFFFFF" }} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current items */}
        {items.length > 0 && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Receipt Items</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{formatCurrency(item.amount)} each</p>
                  </div>
                  {/* Qty controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => updateQty(i, item.qty - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#5B0EA6", fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => updateQty(i, item.qty + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#5B0EA6", fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6", flexShrink: 0, minWidth: 70, textAlign: "right", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {formatCurrency(item.amount * item.qty)}
                  </span>
                  <button onClick={() => removeItem(i)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={13} style={{ color: "#EF4444" }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ borderTop: "1px dashed #E4DCF0", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Subtotal</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Chillz fee (5%)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#5B0EA6" }}>{formatCurrency(platformFee)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #F2EEF9" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#9E9E9E" }}>You receive</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#00C853" }}>{formatCurrency(subtotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {sendReceiptMutation.isError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>
                {(sendReceiptMutation.error as any)?.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Send */}
        <button
          onClick={() => sendReceiptMutation.mutate()}
          disabled={items.length === 0 || sendReceiptMutation.isPending}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            backgroundColor: items.length === 0 || sendReceiptMutation.isPending ? "#9E9E9E" : "#5B0EA6",
            color: "#FFFFFF", fontSize: 15, fontWeight: 700,
            cursor: items.length === 0 || sendReceiptMutation.isPending ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: items.length === 0 ? "none" : "0 4px 16px rgba(91,14,166,0.3)",
          }}
        >
          {sendReceiptMutation.isPending ? (
            <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Sending...</>
          ) : (
            <><Send size={16} />Send Receipt to Guest</>
          )}
        </button>

        {items.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#9E9E9E", margin: 0 }}>
            Add items from your menu or add custom items above
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}