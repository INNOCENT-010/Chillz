/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Minus, Send, RefreshCw,
  CheckCircle, Clock, ShoppingBag, Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

interface TabItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export default function RunningTabPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [items, setItems] = useState<TabItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewSent, setPreviewSent] = useState(false);
  const [done, setDone] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load vendor + booking
  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id, venue_id").eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: booking } = useQuery({
    queryKey: ["booking-tab", bookingId],
    queryFn: async () => {
      const { data } = await supabase.from("bookings")
        .select("*, users(full_name, avatar_url, email)")
        .eq("id", bookingId)
        .single();
      return data as any;
    },
    enabled: !!bookingId,
  });

  const { data: menuItems } = useQuery({
    queryKey: ["vendor-menu", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_menu")
        .select("*")
        .eq("vendor_id", vendor!.id)
        .eq("is_available", true)
        .order("category");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  // Load existing tab from DB on mount
  useEffect(() => {
    if (!bookingId) return;
    supabase.from("running_tabs" as any)
      .select("items, subtotal")
      .eq("booking_id", bookingId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
      });
  }, [bookingId]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Auto-save to DB with debounce
  const saveTab = useCallback(async (currentItems: TabItem[]) => {
    if (!bookingId || !vendor?.id) return;
    setSaving(true);
    try {
      const sub = currentItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      await (supabase.from("running_tabs") as any)
        .upsert({
          booking_id: bookingId,
          vendor_id: vendor.id,
          items: currentItems,
          subtotal: sub,
          updated_at: new Date().toISOString(),
        }, { onConflict: "booking_id" });
      setLastSaved(new Date());
    } catch (e) {
      console.error("Tab save error:", e);
    } finally {
      setSaving(false);
    }
  }, [bookingId, vendor?.id]);

  // Debounced save on items change
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (items.length > 0 || lastSaved) saveTab(items);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [items]);

  // Add from menu or increment existing
  const addMenuItem = (menuItem: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === menuItem.id);
      if (existing) {
        return prev.map(i => i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        category: menuItem.category,
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0);
      return updated;
    });
  };

  // Send preview notification to user
  const sendPreview = async () => {
    if (!booking?.user_id || subtotal === 0) return;
    setSendingPreview(true);
    try {
      await (supabase.from("notifications") as any).insert({
        user_id: booking.user_id,
        title: "Your current bill 🧾",
        body: `Running total so far: ${formatCurrency(subtotal)}. This is not your final receipt.`,
        type: "booking",
        reference_id: bookingId,
        is_read: false,
      });
      setPreviewSent(true);
      setTimeout(() => setPreviewSent(false), 3000);
    } catch (e) {
      console.error("Preview error:", e);
    } finally {
      setSendingPreview(false);
    }
  };

  // Finalize and send receipt
  const sendReceipt = async () => {
    if (!booking || !vendor || subtotal === 0) return;
    setSendingReceipt(true);
    try {
      // Save final tab first
      await saveTab(items);

      // Build receipt
      const txId = crypto.randomUUID();
      const chillzFee = Math.round(subtotal * 0.05);
      const vendorAmount = subtotal - chillzFee;

      const { data: receipt } = await (supabase.from("receipts") as any)
        .insert({
          booking_id: bookingId,
          vendor_id: vendor.id,
          user_id: booking.user_id,
          items,
          subtotal,
          chillz_fee: chillzFee,
          vendor_amount: vendorAmount,
          status: "pending_confirmation",
        })
        .select()
        .single();

      // Ledger splits
      await (supabase.from("ledger_entries") as any).insert([
        {
          transaction_id: txId,
          account_type: "USER_RESERVED",
          account_id: booking.user_id,
          direction: "DEBIT",
          amount: subtotal,
          note: `Tab settlement — ${booking.users?.full_name}`,
          reference_id: bookingId,
          reference_type: "tab_settlement",
        },
        {
          transaction_id: txId,
          account_type: "VENDOR_PENDING",
          account_id: vendor.id,
          direction: "CREDIT",
          amount: vendorAmount,
          note: `Tab settlement (95%)`,
          reference_id: bookingId,
          reference_type: "tab_settlement",
        },
        {
          transaction_id: txId,
          account_type: "CHILLZ_REVENUE",
          account_id: vendor.id,
          direction: "CREDIT",
          amount: chillzFee,
          note: `Platform fee (5%)`,
          reference_id: bookingId,
          reference_type: "tab_settlement",
        },
      ]);

      // Notify user
      await (supabase.from("notifications") as any).insert({
        user_id: booking.user_id,
        title: "Your receipt is ready 🧾",
        body: `Total: ${formatCurrency(subtotal)}. Tap to review and confirm.`,
        type: "booking",
        reference_id: receipt?.id || bookingId,
        is_read: false,
      });

      // Update booking status
      await (supabase.from("bookings") as any).update({ status: "completed" }).eq("id", bookingId);

      setDone(true);
    } catch (e: any) {
      console.error("Send receipt error:", e);
    } finally {
      setSendingReceipt(false);
    }
  };

  // Group menu by category
  const menuByCategory: Record<string, any[]> = {};
  (menuItems || []).forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  const tabItemIds = new Set(items.map(i => i.id));

  if (done) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 24px" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={40} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 20, color: "#0A0A0A", margin: 0, textAlign: "center", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Receipt Sent
        </p>
        <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
          {booking?.users?.full_name} has been notified to review and confirm.
        </p>
        <p style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", margin: 0 }}>{formatCurrency(subtotal)}</p>
        <button onClick={() => router.push("/vendor/scan")}
          style={{ padding: "14px 32px", borderRadius: 16, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
          Back to Scanner
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 16px 20px", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex" }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 16, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Running Tab
            </p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: 0 }}>
              {booking?.users?.full_name || "Customer"}
            </p>
          </div>
          {/* Save status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {saving
              ? <RefreshCw size={13} style={{ color: "rgba(255,255,255,0.6)", animation: "spin 0.8s linear infinite" }} />
              : lastSaved
                ? <CheckCircle size={13} style={{ color: "rgba(255,255,255,0.6)" }} />
                : null}
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
              {saving ? "Saving..." : lastSaved ? "Saved" : ""}
            </span>
          </div>
        </div>

        {/* Live total */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Running Total</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {formatCurrency(subtotal)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Preview button */}
            <button
              onClick={sendPreview}
              disabled={sendingPreview || subtotal === 0}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, backgroundColor: previewSent ? "rgba(0,200,83,0.3)" : "rgba(255,255,255,0.15)", border: `1px solid ${previewSent ? "rgba(0,200,83,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 12, padding: "8px 12px", cursor: subtotal === 0 ? "not-allowed" : "pointer", opacity: subtotal === 0 ? 0.5 : 1 }}>
              <Bell size={16} style={{ color: previewSent ? "#00C853" : "#FFFFFF" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: previewSent ? "#00C853" : "rgba(255,255,255,0.8)" }}>
                {sendingPreview ? "Sending..." : previewSent ? "Sent!" : "Preview"}
              </span>
            </button>
          </div>
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "6px 0 0", textAlign: "right" }}>
          Preview notifies customer of current total
        </p>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Current tab items */}
        {items.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
              On the Tab · {items.reduce((s, i) => s + i.quantity, 0)} items
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.18 }}>
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.06)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                          {formatCurrency(item.price)} × {item.quantity} = <span style={{ color: "#5B0EA6", fontWeight: 700 }}>{formatCurrency(item.price * item.quantity)}</span>
                        </p>
                      </div>
                      {/* Qty control */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", borderRadius: 12, padding: "6px 10px" }}>
                        <button onClick={() => updateQty(item.id, -1)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Minus size={13} style={{ color: "#EF4444" }} />
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 900, color: "#0A0A0A", minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Plus size={13} style={{ color: "#5B0EA6" }} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Subtotal row */}
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>Subtotal</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(subtotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Menu to add from */}
        {Object.keys(menuByCategory).length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
              Add from Menu
            </p>
            {Object.entries(menuByCategory).map(([category, catItems]) => (
              <div key={category} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#C4BAD8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>{category}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {catItems.map((menuItem: any) => {
                    const inTab = items.find(i => i.id === menuItem.id);
                    return (
                      <div key={menuItem.id}
                        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.04)", border: inTab ? "1.5px solid #EDE0F7" : "1.5px solid transparent" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{menuItem.name}</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", margin: 0 }}>{formatCurrency(menuItem.price)}</p>
                        </div>
                        <button onClick={() => addMenuItem(menuItem)}
                          style={{ width: 34, height: 34, borderRadius: 10, border: "none", backgroundColor: inTab ? "#EDE0F7" : "#5B0EA6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {inTab
                            ? <span style={{ fontSize: 12, fontWeight: 900, color: "#5B0EA6" }}>+{inTab.quantity}</span>
                            : <Plus size={16} style={{ color: "#FFFFFF" }} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && Object.keys(menuByCategory).length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <ShoppingBag size={40} style={{ color: "#E4DCF0", marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 6px" }}>No menu items yet</p>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Add items to your menu first from the venue dashboard</p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 28px", backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={sendPreview}
            disabled={sendingPreview || subtotal === 0}
            style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: subtotal === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: subtotal === 0 ? 0.5 : 1 }}>
            <Bell size={15} />
            {sendingPreview ? "Sending..." : previewSent ? "Preview Sent ✓" : "Send Preview"}
          </button>
          <button
            onClick={sendReceipt}
            disabled={sendingReceipt || subtotal === 0}
            style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", background: subtotal === 0 ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: subtotal === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: subtotal === 0 ? "none" : "0 4px 14px rgba(91,14,166,0.3)" }}>
            {sendingReceipt
              ? <><div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Finalizing...</>
              : <><Send size={15} />Send Receipt · {formatCurrency(subtotal)}</>}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}