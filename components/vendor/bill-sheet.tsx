/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import {
  X, Plus, Minus, Trash2, ChevronDown, ChevronUp,
  CheckCircle, Building2, UtensilsCrossed, Save, Car,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

const LISTING_VENDORS = ["hotel", "apartment", "car_rental"];

interface BillItem {
  id:       string;
  name:     string;
  price:    number;
  quantity: number;
}

interface BillSheetProps {
  booking:    any;
  vendorType: string;
  vendorId:   string;
  onClose:    () => void;
  onSent:     () => void;
}

export function BillSheet({ booking, vendorType, vendorId, onClose, onSent }: BillSheetProps) {
  const qc = useQueryClient();
  const isListingVendor = LISTING_VENDORS.includes(vendorType);
  const isCarRental     = vendorType === "car_rental";

  // ── Seed bill from booking.order_items ────────────────────────────────
  // order_items uses: { id, name, price, qty, subtotal }
  // BillSheet uses internally: { id, name, price, quantity }
  const buildDefaultItems = (): BillItem[] => {
    if (booking?.order_items?.length) {
      return booking.order_items.map((item: any) => ({
        id:       item.id || `item_${Math.random()}`,
        name:     item.name,
        price:    item.price || 0,
        quantity: item.qty || item.quantity || 1,  // ← support both field names
      }));
    }
    if (booking?.package_name) {
      const nights = booking.num_nights || 1;
      const rooms  = booking.num_rooms  || 1;
      const units  = isCarRental ? nights : nights * rooms;
      const perUnitPrice = booking.package_price
        ?? (booking.reserved_amount ? Math.round(booking.reserved_amount / units) : 0);
      if (perUnitPrice > 0) {
        return [{
          id:       `package_${booking.id}`,
          name:     booking.package_name,
          price:    perUnitPrice,
          quantity: units,
        }];
      }
    }
    return [];
  };

  const [billItems, setBillItems] = useState<BillItem[]>(buildDefaultItems);
  const [notes,       setNotes]       = useState("");
  const [showPicker,  setShowPicker]  = useState(false);
  const [showCustom,  setShowCustom]  = useState(false);
  const [customName,  setCustomName]  = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty,   setCustomQty]   = useState("1");
  const [autoSaving,  setAutoSaving]  = useState(false);
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null);
  const [hydrated,    setHydrated]    = useState(false);

  // ── Load existing draft ───────────────────────────────────────────────
  const { data: existingReceipt, isSuccess: receiptFetched } = useQuery({
    queryKey: ["bill-sheet-receipt", booking?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("receipts") as any)
        .select("*").eq("booking_id", booking.id).maybeSingle();
      return data as any;
    },
    enabled: !!booking?.id,
    staleTime: 0,
  });

  // ── Hydrate from saved draft once ────────────────────────────────────
  useEffect(() => {
    if (hydrated || !receiptFetched) return;
    if (existingReceipt?.items?.length) {
      // Draft items stored as { id, name, price, quantity }
      setBillItems(existingReceipt.items.map((item: any) => ({
        id:       item.id,
        name:     item.name,
        price:    item.price || 0,
        quantity: item.quantity || item.qty || 1,
      })));
      setNotes(existingReceipt.notes || "");
    }
    setHydrated(true);
  }, [receiptFetched, existingReceipt, hydrated]);

  // ── Auto-save draft ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !booking?.id || billItems.length === 0) return;
    const sub      = billItems.reduce((a, i) => a + i.price * i.quantity, 0);
    const platform = Math.round(sub * 0.05);

    const timer = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const { error } = await (supabase.from("receipts") as any).upsert({
          booking_id:   booking.id,
          subtotal:     sub,
          platform_fee: platform,
          total:        sub,
          items:        billItems,
          notes:        notes.trim() || null,
          status:       "draft",
        }, { onConflict: "booking_id" });
        if (!error) setLastSaved(new Date());
        else console.error("Auto-save error:", error.message);
      } catch (e) {
        console.error("Auto-save failed:", e);
      } finally {
        setAutoSaving(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [billItems, notes, hydrated, booking?.id]);

  // ── Available items query ─────────────────────────────────────────────
  const { data: availableItems = [] } = useQuery({
    queryKey: ["bill-items", vendorId, vendorType],
    queryFn: async () => {
      if (isListingVendor) {
        const { data } = await (supabase.from("vendor_listings") as any)
          .select("id,title,price_per_unit,unit_label,room_type")
          .eq("vendor_id", vendorId).eq("is_active", true)
          .order("price_per_unit", { ascending: true });
        return (data || []).map((l: any) => ({
          id:         l.id,
          name:       l.title + (l.room_type ? ` (${l.room_type})` : ""),
          price:      l.price_per_unit,
          unit_label: l.unit_label || (isCarRental ? "day" : "night"),
        }));
      } else {
        // venue vendors — query vendor_menu directly by vendor_id
        const { data } = await (supabase.from("vendor_menu") as any)
          .select("id,name,price,category")
          .eq("vendor_id", vendorId)
          .eq("is_available", true)
          .order("category", { ascending: true });
        return (data || []).map((m: any) => ({
          id:       m.id,
          name:     m.name,
          price:    m.price,
          category: m.category,
        }));
      }
    },
    enabled: !!vendorId,
    staleTime: 1000 * 60,
  });

  const subtotal = billItems.reduce((a, i) => a + i.price * i.quantity, 0);
  const platform = Math.round(subtotal * 0.05);
  const total    = subtotal;

  const addItem = (item: any) => {
    const existing = billItems.find(b => b.id === item.id);
    if (existing) {
      setBillItems(prev => prev.map(b => b.id === item.id ? { ...b, quantity: b.quantity + 1 } : b));
    } else {
      const defaultQty = isListingVendor
        ? (booking.num_nights || 1) * (booking.num_rooms || 1)
        : 1;
      setBillItems(prev => [...prev, { id: item.id, name: item.name, price: item.price, quantity: defaultQty }]);
    }
    setShowPicker(false);
  };

  const addCustomItem = () => {
    if (!customName.trim() || !customPrice || Number(customPrice) <= 0) return;
    setBillItems(prev => [...prev, {
      id:       `custom_${Date.now()}`,
      name:     customName.trim(),
      price:    Number(customPrice),
      quantity: Number(customQty) || 1,
    }]);
    setCustomName(""); setCustomPrice(""); setCustomQty("1");
    setShowCustom(false);
  };

  const updateQty  = (id: string, delta: number) =>
    setBillItems(prev => prev.map(b => b.id === id ? { ...b, quantity: Math.max(1, b.quantity + delta) } : b));
  const removeItem = (id: string) =>
    setBillItems(prev => prev.filter(b => b.id !== id));

  const groupedItems = !isListingVendor
    ? availableItems.reduce((acc: any, item: any) => {
        const cat = item.category || "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {})
    : null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!billItems.length) throw new Error("Add at least one item");

      const { data: receipt, error: rErr } = await (supabase.from("receipts") as any)
        .upsert({
          booking_id:   booking.id,
          subtotal,
          platform_fee: platform,
          total,
          items:        billItems,
          notes:        notes.trim() || null,
          status:       "sent",
          confirmed_at: new Date().toISOString(),
        }, { onConflict: "booking_id" })
        .select().single();
      if (rErr) throw rErr;

      await (supabase.from("bookings") as any)
        .update({ status: "receipt_sent", final_amount: total })
        .eq("id", booking.id);

      await (supabase.from("notifications") as any).insert({
        user_id: booking.users?.id || booking.user_id,
        type:    "receipt_sent",
        title:   "Your receipt is ready 🧾",
        message: `Your bill is ready — ${formatCurrency(total)}. Please review and confirm to release payment.`,
        data:    { booking_id: booking.id, receipt_id: receipt?.id },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-bookings"] });
      onSent();
    },
  });

  const inputStyle: React.CSSProperties = {
    backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 12, padding: "10px 14px", fontSize: 14,
    color: "#0A0A0A", outline: "none", fontFamily: "inherit",
  };

  const addItemLabel = isCarRental ? "Vehicle / Service" : isListingVendor ? "Room / Service" : "Menu Item";
  const pickerEmptyMsg = isListingVendor
    ? `No ${isCarRental ? "vehicles" : "listings"} found.`
    : "No menu items found.";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isCarRental
                ? <Car size={18} style={{ color: ACCENT }} />
                : isListingVendor
                ? <Building2 size={18} style={{ color: ACCENT }} />
                : <UtensilsCrossed size={18} style={{ color: ACCENT }} />}
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>Bill Guest</h3>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                {booking.users?.full_name || "Guest"} · #{(booking.qr_code_hash || booking.id || "").slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {autoSaving && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 10, color: "#9E9E9E" }}>Saving...</span>
              </div>
            )}
            {lastSaved && !autoSaving && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Save size={11} style={{ color: "#059669" }} />
                <span style={{ fontSize: 10, color: "#059669" }}>Saved</span>
              </div>
            )}
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} style={{ color: "#6B6B6B" }} />
            </button>
          </div>
        </div>

        {/* Booking context pill */}
        {booking.package_name && (
          <div style={{ backgroundColor: ACCENT_BG, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            {isCarRental ? <Car size={12} style={{ color: ACCENT }} /> : <Building2 size={12} style={{ color: ACCENT }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>
              {booking.package_name}
              {isCarRental
                ? booking.num_nights ? ` · ${booking.num_nights} day${booking.num_nights !== 1 ? "s" : ""}` : ""
                : booking.num_nights ? ` · ${booking.num_nights} night${booking.num_nights !== 1 ? "s" : ""}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>

          {/* Bill items */}
          {billItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {billItems.map(item => (
                <motion.div key={item.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                    <p style={{ fontSize: 12, color: ACCENT, fontWeight: 700, margin: 0 }}>
                      {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => updateQty(item.id, -1)}
                      style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_BG, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={12} style={{ color: ACCENT }} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)}
                      style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_BG, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={12} style={{ color: ACCENT }} />
                    </button>
                    <button onClick={() => removeItem(item.id)}
                      style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Trash2 size={12} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add from listings / menu */}
          <div>
            <button onClick={() => { setShowPicker(!showPicker); setShowCustom(false); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px dashed #C4BAD8", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>+ Add {addItemLabel}</span>
              {showPicker ? <ChevronUp size={14} style={{ color: ACCENT }} /> : <ChevronDown size={14} style={{ color: ACCENT }} />}
            </button>

            <AnimatePresence>
              {showPicker && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ marginTop: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, overflow: "hidden" }}>
                    {availableItems.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center" }}>
                        <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>{pickerEmptyMsg}</p>
                      </div>
                    ) : isListingVendor ? (
                      <div>
                        {availableItems.map((item: any, i: number) => (
                          <button key={item.id} onClick={() => addItem(item)}
                            style={{ width: "100%", padding: "12px 14px", border: "none", borderBottom: i < availableItems.length - 1 ? "1px solid #F2EEF9" : "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>per {item.unit_label}</p>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT, flexShrink: 0, marginLeft: 10 }}>{formatCurrency(item.price)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {Object.entries(groupedItems || {}).map(([category, items]: [string, any]) => (
                          <div key={category}>
                            <div style={{ padding: "8px 14px", backgroundColor: "#F7F5FA", borderBottom: "1px solid #F2EEF9" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em" }}>{category}</span>
                            </div>
                            {items.map((item: any) => (
                              <button key={item.id} onClick={() => addItem(item)}
                                style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #F2EEF9", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0, marginLeft: 10 }}>{formatCurrency(item.price)}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Custom charge */}
          <div>
            <button onClick={() => { setShowCustom(!showCustom); setShowPicker(false); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px dashed #C4BAD8", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#6B6B6B" }}>+ Add Custom Charge</span>
              {showCustom ? <ChevronUp size={14} style={{ color: "#9E9E9E" }} /> : <ChevronDown size={14} style={{ color: "#9E9E9E" }} />}
            </button>

            <AnimatePresence>
              {showCustom && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ marginTop: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <input type="text"
                      placeholder={isCarRental ? "e.g. Extra day, Fuel surcharge, Damage charge" : "e.g. Extra night, Service charge, Damage fee"}
                      value={customName} onChange={e => setCustomName(e.target.value)}
                      style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 14px" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>₦</span>
                        <input type="number" placeholder="Price" value={customPrice}
                          onChange={e => setCustomPrice(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 14px" }}>
                        <span style={{ fontSize: 13, color: "#9E9E9E" }}>×</span>
                        <input type="number" placeholder="1" min="1" value={customQty}
                          onChange={e => setCustomQty(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowCustom(false); setCustomName(""); setCustomPrice(""); setCustomQty("1"); }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button onClick={addCustomItem}
                        style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: ACCENT, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Add Item
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
              Notes <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
            </p>
            <textarea placeholder="Any notes for the guest..." value={notes}
              onChange={e => setNotes(e.target.value)} rows={2}
              style={{ ...inputStyle, width: "100%", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
          </div>

          {/* Totals */}
          {billItems.length > 0 && (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>Subtotal</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>Platform fee (5%)</span>
                <span style={{ fontSize: 12, color: "#9E9E9E" }}>{formatCurrency(platform)}</span>
              </div>
              <div style={{ height: 1, backgroundColor: "#E4DCF0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A" }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: ACCENT, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <AnimatePresence>
            {sendMutation.isError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{(sendMutation.error as Error).message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Send button */}
      <div style={{ padding: "12px 20px 32px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
        <button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || billItems.length === 0}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: sendMutation.isPending || !billItems.length ? "#9E9E9E" : `linear-gradient(135deg,#3B0764,${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: sendMutation.isPending || !billItems.length ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: billItems.length ? "0 4px 16px rgba(91,14,166,0.3)" : "none" }}>
          {sendMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Sending...</>
            : <><CheckCircle size={18} />Send Receipt — {formatCurrency(total)}</>}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}