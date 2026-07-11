/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Package, UtensilsCrossed, CheckCircle, X, Edit3,
  Users, AlertCircle, ToggleLeft, ToggleRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

interface PackageItem {
  id:    string;
  name:  string;
  price: number;
  qty:   number;
}

interface PackageForm {
  name:           string;
  description:    string;
  price:          string;
  guest_capacity: string;
  menu_items:     PackageItem[];
}

const EMPTY_FORM: PackageForm = {
  name:           "",
  description:    "",
  price:          "",
  guest_capacity: "",
  menu_items:     [],
};

export default function VendorPackagesPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [showForm,      setShowForm]      = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState<PackageForm>(EMPTY_FORM);
  const [showPicker,    setShowPicker]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError,     setFormError]     = useState("");

  // ── Vendor query ──────────────────────────────────────────────────────
  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors")
        .select("id, vendor_type, business_name, booking_requires_menu_selection")
        .eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  // ── Menu items for picker ─────────────────────────────────────────────
  const { data: menuItems = [] } = useQuery({
    queryKey: ["vendor-menu", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_menu")
        .select("id, name, price, category")
        .eq("vendor_id", vendor!.id)
        .eq("is_available", true)
        .order("category");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 60,
  });

  // ── Packages query ────────────────────────────────────────────────────
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["vendor-packages-mgmt", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("packages") as any)
        .select("*")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
  });

  // ── Toggle booking_requires_menu_selection ────────────────────────────
  const toggleMenuRequirementMutation = useMutation({
    mutationFn: async (newVal: boolean) => {
      const { error } = await (supabase.from("vendors") as any)
        .update({ booking_requires_menu_selection: newVal })
        .eq("id", vendor!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", user?.id] });
      qc.invalidateQueries({ queryKey: ["vendor-config", vendor?.id] });
    },
  });

  // ── Save package (create or update) ──────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError("");
      if (!form.name.trim())         throw new Error("Package name is required");
      if (!form.price || Number(form.price) <= 0) throw new Error("Price must be greater than 0");

      const payload = {
        vendor_id:      vendor!.id,
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        price:          Number(form.price),
        guest_capacity: form.guest_capacity ? Number(form.guest_capacity) : null,
        menu_items:     form.menu_items,
        is_active:      true,
      };

      if (editingId) {
        const { error } = await (supabase.from("packages") as any)
          .update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("packages") as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-packages-mgmt"] });
      qc.invalidateQueries({ queryKey: ["venue-packages"] });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setShowPicker(false);
    },
    onError: (e: any) => setFormError(e.message || "Failed to save package"),
  });

  // ── Toggle active ─────────────────────────────────────────────────────
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("packages") as any)
        .update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-packages-mgmt"] });
      qc.invalidateQueries({ queryKey: ["venue-packages"] });
    },
  });

  // ── Delete package ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("packages") as any)
        .delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-packages-mgmt"] });
      qc.invalidateQueries({ queryKey: ["venue-packages"] });
      setDeleteConfirm(null);
    },
  });

  // ── Form helpers ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowPicker(false);
    setShowForm(true);
  };

  const openEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setForm({
      name:           pkg.name || "",
      description:    pkg.description || "",
      price:          String(pkg.price || ""),
      guest_capacity: pkg.guest_capacity ? String(pkg.guest_capacity) : "",
      menu_items:     pkg.menu_items || [],
    });
    setFormError("");
    setShowPicker(false);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowPicker(false);
    saveMutation.reset();
  };

  // Add menu item to package
  const addMenuItem = (item: any) => {
    const exists = form.menu_items.find(m => m.id === item.id);
    if (exists) {
      setForm(f => ({
        ...f,
        menu_items: f.menu_items.map(m =>
          m.id === item.id ? { ...m, qty: m.qty + 1 } : m
        ),
      }));
    } else {
      setForm(f => ({
        ...f,
        menu_items: [...f.menu_items, { id: item.id, name: item.name, price: item.price, qty: 1 }],
      }));
    }
  };

  const removeMenuItem = (id: string) => {
    setForm(f => ({ ...f, menu_items: f.menu_items.filter(m => m.id !== id) }));
  };

  const updateMenuItemQty = (id: string, delta: number) => {
    setForm(f => ({
      ...f,
      menu_items: f.menu_items.map(m =>
        m.id === id ? { ...m, qty: Math.max(1, m.qty + delta) } : m
      ),
    }));
  };

  // Computed price from included items
  const itemsTotal = form.menu_items.reduce((a, m) => a + m.price * m.qty, 0);

  // Menu grouped by category for picker
  const menuByCategory = (menuItems as any[]).reduce((acc: any, item: any) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const requiresMenuSelection = vendor?.booking_requires_menu_selection !== false;

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA",
    border: "1.5px solid #E4DCF0", borderRadius: 14,
    padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };

  if (isLoading && !vendor) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 48 }}>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, padding: "44px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.back()}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6 }}>
            <ArrowLeft size={22} style={{ color: "#FFFFFF" }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              Packages
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: 0 }}>
              {vendor?.business_name} · {packages.length} package{packages.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 12, padding: "8px 14px", cursor: "pointer", color: "#FFFFFF", fontSize: 13, fontWeight: 700 }}>
            <Plus size={15} />New
          </button>
        </div>

        {/* Booking mode toggle */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", margin: "0 0 2px" }}>
                Require menu selection to book
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.4 }}>
                {requiresMenuSelection
                  ? "Guests must pick items or a package before booking."
                  : "Guests can enter a manual reservation amount."}
              </p>
            </div>
            <button
              onClick={() => toggleMenuRequirementMutation.mutate(!requiresMenuSelection)}
              disabled={toggleMenuRequirementMutation.isPending}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
              {requiresMenuSelection
                ? <ToggleRight size={36} style={{ color: "#00C853" }} />
                : <ToggleLeft size={36} style={{ color: "rgba(255,255,255,0.4)" }} />}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* Info banner */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, border: "1px solid #F0EBF8" }}>
          <Package size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
            Packages let you sell pre-defined experiences — VIP tables, bottle service, curated menus. Customers can pick and book directly from your venue page.
          </p>
        </div>

        {/* ── Package list ── */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1,2].map(i => (
              <div key={i} style={{ height: 120, borderRadius: 16, backgroundColor: "#FFFFFF", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "48px 20px", textAlign: "center", border: "1px solid #F0EBF8" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Package size={28} style={{ color: ACCENT }} />
            </div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>No packages yet</p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px", lineHeight: 1.5 }}>
              Create your first package — VIP table, bottle service, or any curated experience.
            </p>
            <button onClick={openCreate}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 14, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
              <Plus size={16} />Create First Package
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {packages.map((pkg: any) => {
              const includedItems: PackageItem[] = pkg.menu_items || [];
              const isActive = pkg.is_active !== false;

              return (
                <motion.div key={pkg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: `1.5px solid ${isActive ? "#F0EBF8" : "#F2EEF9"}`, boxShadow: "0 2px 10px rgba(91,14,166,0.06)", opacity: isActive ? 1 : 0.65 }}>

                  <div style={{ padding: "14px 14px 10px" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                            {pkg.name}
                          </p>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#059669" : "#9E9E9E", backgroundColor: isActive ? "#E0F7EA" : "#F2EEF9", padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                            {isActive ? "Active" : "Hidden"}
                          </span>
                        </div>
                        {pkg.description && (
                          <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 20, fontWeight: 900, color: ACCENT, margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                          {formatCurrency(pkg.price)}
                        </p>
                        {pkg.guest_capacity && (
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
                            Up to {pkg.guest_capacity} guests
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Included items */}
                    {includedItems.length > 0 && (
                      <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                          Includes {includedItems.length} item{includedItems.length !== 1 ? "s" : ""}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {includedItems.slice(0, 4).map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <CheckCircle size={10} style={{ color: ACCENT, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#0A0A0A" }}>
                                  {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                                {formatCurrency(item.price * item.qty)}
                              </span>
                            </div>
                          ))}
                          {includedItems.length > 4 && (
                            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
                              +{includedItems.length - 4} more items
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(pkg)}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Edit3 size={12} />Edit
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: pkg.id, is_active: !isActive })}
                        disabled={toggleActiveMutation.isPending}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: `1.5px solid ${isActive ? "#FDE68A" : "#A7F3D0"}`, backgroundColor: isActive ? "#FFFBEB" : "#F0FDF4", color: isActive ? "#D97706" : "#059669", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        {isActive ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => setDeleteConfirm(pkg.id)}
                        style={{ width: 36, height: 36, borderRadius: 11, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Sheet ── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={cancelForm}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>

              {/* Sheet header */}
              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                      {editingId ? "Edit Package" : "New Package"}
                    </h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                      {editingId ? "Update package details" : "Create a new bookable experience"}
                    </p>
                  </div>
                  <button onClick={cancelForm}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>

              {/* Sheet body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>

                  {/* Package name */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Package Name <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <input
                      type="text"
                      placeholder="e.g. VIP Table for 4, Bottle Service, Birthday Setup"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Description <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    <textarea
                      placeholder="What does this package include? What's the experience like?"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
                    />
                  </div>

                  {/* Price + Guest capacity */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 2 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                        Price (₦) <span style={{ color: "#EF4444" }}>*</span>
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>₦</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={form.price}
                          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }}
                        />
                      </div>
                      {itemsTotal > 0 && (
                        <p style={{ fontSize: 10, color: "#9E9E9E", margin: "4px 0 0" }}>
                          Items total: {formatCurrency(itemsTotal)}
                        </p>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                        Max Guests
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                        <Users size={14} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                        <input
                          type="number"
                          placeholder="—"
                          min="1"
                          value={form.guest_capacity}
                          onChange={e => setForm(f => ({ ...f, guest_capacity: e.target.value }))}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Included menu items */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                        Included Items
                      </p>
                      {form.menu_items.length > 0 && (
                        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>
                          {form.menu_items.length} item{form.menu_items.length !== 1 ? "s" : ""} · {formatCurrency(itemsTotal)}
                        </span>
                      )}
                    </div>

                    {/* Selected items */}
                    {form.menu_items.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {form.menu_items.map(item => (
                          <div key={item.id} style={{ backgroundColor: ACCENT_BG, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                {item.name}
                              </p>
                              <p style={{ fontSize: 11, color: ACCENT, margin: 0, fontWeight: 600 }}>
                                {formatCurrency(item.price)} × {item.qty} = {formatCurrency(item.price * item.qty)}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                              <button onClick={() => updateMenuItemQty(item.id, -1)}
                                style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: "rgba(91,14,166,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>−</span>
                              </button>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                              <button onClick={() => updateMenuItemQty(item.id, 1)}
                                style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: ACCENT, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>+</span>
                              </button>
                              <button onClick={() => removeMenuItem(item.id)}
                                style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <X size={12} style={{ color: "#EF4444" }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add item button */}
                    <button onClick={() => setShowPicker(!showPicker)}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px dashed #C4BAD8", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <UtensilsCrossed size={14} style={{ color: ACCENT }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>Add from menu</span>
                      </div>
                      {showPicker
                        ? <ChevronUp size={14} style={{ color: ACCENT }} />
                        : <ChevronDown size={14} style={{ color: ACCENT }} />}
                    </button>

                    <AnimatePresence>
                      {showPicker && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: "hidden" }}>
                          <div style={{ marginTop: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                            {menuItems.length === 0 ? (
                              <div style={{ padding: "20px", textAlign: "center" }}>
                                <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                                  No menu items yet. Add items in Menu Manager first.
                                </p>
                              </div>
                            ) : (
                              Object.entries(menuByCategory).map(([category, items]: [string, any]) => (
                                <div key={category}>
                                  <div style={{ padding: "8px 14px", backgroundColor: "#F7F5FA", borderBottom: "1px solid #F2EEF9" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em" }}>{category}</span>
                                  </div>
                                  {items.map((item: any) => {
                                    const alreadyIn = form.menu_items.find(m => m.id === item.id);
                                    return (
                                      <button key={item.id} onClick={() => addMenuItem(item)}
                                        style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #F2EEF9", backgroundColor: alreadyIn ? "#F7F5FA" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                                          {alreadyIn && (
                                            <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>×{alreadyIn.qty} added</span>
                                          )}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{formatCurrency(item.price)}</span>
                                          <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: alreadyIn ? ACCENT : ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Plus size={12} style={{ color: alreadyIn ? "#FFFFFF" : ACCENT }} />
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {formError && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                        <AlertCircle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                        <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{formError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Save button */}
              <div style={{ padding: "12px 20px 40px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                {form.price && Number(form.price) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>Package price</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>{formatCurrency(Number(form.price))}</span>
                  </div>
                )}
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.name.trim() || !form.price || Number(form.price) <= 0}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: saveMutation.isPending || !form.name.trim() || !form.price ? "#9E9E9E" : `linear-gradient(135deg,#3B0764,${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saveMutation.isPending || !form.name.trim() || !form.price ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: form.name.trim() && form.price ? "0 4px 20px rgba(91,14,166,0.35)" : "none" }}>
                  {saveMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                    : <><CheckCircle size={18} />{editingId ? "Save Changes" : "Create Package"}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete confirm sheet ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 60 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "20px 20px 48px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Trash2 size={24} style={{ color: "#EF4444" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px" }}>Delete Package?</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                  This package will be permanently removed and will no longer appear on your venue page.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteConfirm(null)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate(deleteConfirm!)}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: deleteMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {deleteMutation.isPending ? "Deleting..." : <><Trash2 size={14} />Delete</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
}