/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, CheckCircle,
  UtensilsCrossed, ImageIcon, FileText, X,
  ChevronRight, Camera, Upload, Tag,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = [
  "Food", "Drinks", "Cocktails", "Mocktails", "Wine",
  "Beer", "Spirits", "Shisha", "Desserts", "Specials", "Other",
];

export default function VendorMenuFilesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemImageRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"items" | "images" | "pdfs">("items");

  // ── Add item sheet state ────────────────────────────────────────────────
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("Food");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [uploadingItemImage, setUploadingItemImage] = useState(false);
  const [itemError, setItemError] = useState("");

  // ── Upload state ────────────────────────────────────────────────────────
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [uploadType, setUploadType] = useState<"image" | "pdf">("image");

  // ── Lightbox ────────────────────────────────────────────────────────────
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors").select("*")
        .eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: menuItems, refetch: refetchItems } = useQuery({
    queryKey: ["vendor-menu-all", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await supabase.from("vendor_menu").select("*")
        .eq("vendor_id", vendor.id).order("category").order("name");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
  });

  const { data: menuUploads, refetch: refetchUploads } = useQuery({
    queryKey: ["vendor-menu-uploads", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await (supabase.from("vendor_menu_uploads") as any)
        .select("*").eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
  });

  const menuImages = (menuUploads || []).filter((u: any) => u.type === "image");
  const menuPdfs = (menuUploads || []).filter((u: any) => u.type === "pdf");

  const menuByCategory: Record<string, any[]> = {};
  (menuItems || []).forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  // ── Open add/edit sheet ─────────────────────────────────────────────────
  const openAddSheet = () => {
    setEditingItem(null);
    setItemName(""); setItemCategory("Food"); setItemPrice("");
    setItemDescription(""); setItemImageUrl(""); setItemError("");
    setShowAddItem(true);
  };

  const openEditSheet = (item: any) => {
    setEditingItem(item);
    setItemName(item.name || "");
    setItemCategory(item.category || "Food");
    setItemPrice(String(item.price || ""));
    setItemDescription(item.description || "");
    setItemImageUrl(item.image_url || "");
    setItemError("");
    setShowAddItem(true);
  };

  const closeItemSheet = () => {
    setShowAddItem(false);
    setEditingItem(null);
    setItemName(""); setItemCategory("Food"); setItemPrice("");
    setItemDescription(""); setItemImageUrl(""); setItemError("");
  };

  // ── Upload item image ───────────────────────────────────────────────────
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendor?.id) return;
    setUploadingItemImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `menu-items/${vendor.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("vendor-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("vendor-media").getPublicUrl(path);
      setItemImageUrl(urlData.publicUrl);
    } catch (err: any) {
      setItemError("Image upload failed: " + err.message);
    } finally {
      setUploadingItemImage(false);
      if (itemImageRef.current) itemImageRef.current.value = "";
    }
  };

  // ── Save item ───────────────────────────────────────────────────────────
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (!itemName.trim()) throw new Error("Item name is required");
      const price = Number(itemPrice);
      if (!price || price <= 0) throw new Error("Enter a valid price");
      if (!vendor?.id) throw new Error("No vendor");

      const payload = {
        vendor_id: vendor.id,
        name: itemName.trim(),
        category: itemCategory,
        price,
        description: itemDescription.trim() || null,
        image_url: itemImageUrl || null,
        is_available: true,
      };

      if (editingItem) {
        const { error } = await (supabase.from("vendor_menu") as any)
          .update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("vendor_menu") as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchItems();
      qc.invalidateQueries({ queryKey: ["vendor-menu"] });
      closeItemSheet();
    },
    onError: (e: any) => setItemError(e.message),
  });

  // ── Delete item ─────────────────────────────────────────────────────────
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("vendor_menu").delete().eq("id", id);
    },
    onSuccess: () => {
      refetchItems();
      qc.invalidateQueries({ queryKey: ["vendor-menu"] });
      closeItemSheet();
    },
  });

  // ── Upload menu file ────────────────────────────────────────────────────
  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendor?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) throw new Error("Only images and PDFs supported");
      const path = `menu-uploads/${vendor.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("vendor-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("vendor-media").getPublicUrl(path);
      await (supabase.from("vendor_menu_uploads") as any).insert({
        vendor_id: vendor.id,
        url: urlData.publicUrl,
        type: isImage ? "image" : "pdf",
        title: uploadTitle.trim() || file.name,
        is_active: true,
      });
      setUploadTitle("");
      setShowUploadSheet(false);
      refetchUploads();
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Delete upload ───────────────────────────────────────────────────────
  const deleteUploadMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from("vendor_menu_uploads") as any).delete().eq("id", id);
    },
    onSuccess: () => refetchUploads(),
  });

  const tabs = [
    { id: "items",  label: "Menu Items", count: menuItems?.length || 0 },
    { id: "images", label: "Images",     count: menuImages.length },
    { id: "pdfs",   label: "PDFs",       count: menuPdfs.length },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Menu Manager
            </h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              Type items, upload images or PDFs
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          {tabs.map(({ id, label, count }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              style={{ flex: 1, padding: "10px 0 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === id ? "2.5px solid #FFFFFF" : "2.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: activeTab === id ? 700 : 500, color: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>{label}</span>
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: activeTab === id ? "#5B0EA6" : "rgba(255,255,255,0.5)", backgroundColor: activeTab === id ? "#FFFFFF" : "rgba(255,255,255,0.15)", padding: "1px 6px", borderRadius: 999 }}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence mode="wait">

          {/* ── MENU ITEMS TAB ───────────────────────────────────────────── */}
          {activeTab === "items" && (
            <motion.div key="items" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "11px 14px" }}>
                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                  Typed items power the <strong>receipt builder</strong> and let users pick items before booking.
                </p>
              </div>

              <button onClick={openAddSheet}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                <Plus size={16} />Add Menu Item
              </button>

              {Object.keys(menuByCategory).length > 0
                ? Object.entries(menuByCategory).map(([category, items]) => (
                    <div key={category}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 0 6px 2px" }}>{category}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.map((item: any) => (
                          <button key={item.id} onClick={() => openEditSheet(item)}
                            style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.05)", border: "1.5px solid #F2EEF9", cursor: "pointer", textAlign: "left" }}>
                            {item.image_url ? (
                              <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                                <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ) : (
                              <div style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <UtensilsCrossed size={18} style={{ color: "#5B0EA6" }} />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                              {item.description && (
                                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.description}</p>
                              )}
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#5B0EA6" }}>{formatCurrency(item.price)}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: item.is_available ? "#059669" : "#9E9E9E", backgroundColor: item.is_available ? "#E0F7EA" : "#F2EEF9", padding: "2px 7px", borderRadius: 999 }}>
                                {item.is_available ? "Available" : "Hidden"}
                              </span>
                              <ChevronRight size={14} style={{ color: "#9E9E9E" }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                : (
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "40px 20px", textAlign: "center", border: "1.5px solid #F2EEF9" }}>
                    <UtensilsCrossed size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>No menu items yet</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Add items — they auto-load into the receipt builder.</p>
                  </div>
                )}
            </motion.div>
          )}

          {/* ── IMAGES TAB ───────────────────────────────────────────────── */}
          {activeTab === "images" && (
            <motion.div key="images" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "11px 14px" }}>
                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                  Upload photos of your printed or designed menu. Users can tap to view them fullscreen.
                </p>
              </div>

              <button onClick={() => { setUploadType("image"); setShowUploadSheet(true); }}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "1.5px dashed #C4A0E8", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <ImageIcon size={16} />Upload Menu Image
              </button>

              {menuImages.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {menuImages.map((upload: any) => (
                    <div key={upload.id} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "3/4", backgroundColor: "#EDE0F7" }}>
                      <img src={upload.url} alt={upload.title || "Menu"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onClick={() => setLightboxImage(upload.url)} />
                      {upload.title && (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "20px 8px 8px" }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>{upload.title}</p>
                        </div>
                      )}
                      <button onClick={() => deleteUploadMutation.mutate(upload.id)}
                        style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={12} style={{ color: "#FFFFFF" }} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "40px 20px", textAlign: "center", border: "1.5px solid #F2EEF9" }}>
                  <Camera size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>No menu images yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Upload photos of your printed menu.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PDFS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "pdfs" && (
            <motion.div key="pdfs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "11px 14px" }}>
                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                  Upload PDF menus. Users can tap to open them in a new tab.
                </p>
              </div>

              <button onClick={() => { setUploadType("pdf"); setShowUploadSheet(true); }}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "1.5px dashed #C4A0E8", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <FileText size={16} />Upload Menu PDF
              </button>

              {menuPdfs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {menuPdfs.map((upload: any) => (
                    <div key={upload.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #F2EEF9", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText size={20} style={{ color: "#5B0EA6" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {upload.title || "Menu PDF"}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>PDF Document · tap to open</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <a href={upload.url} target="_blank" rel="noopener noreferrer"
                          style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                          <ChevronRight size={14} style={{ color: "#5B0EA6" }} />
                        </a>
                        <button onClick={() => deleteUploadMutation.mutate(upload.id)}
                          style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={13} style={{ color: "#EF4444" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "40px 20px", textAlign: "center", border: "1.5px solid #F2EEF9" }}>
                  <FileText size={32} style={{ color: "#E4DCF0", marginBottom: 10 }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>No PDF menus yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Upload PDF versions of your menu.</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Hidden file inputs ──────────────────────────────────────────── */}
      <input ref={fileInputRef} type="file"
        accept={uploadType === "image" ? "image/*" : ".pdf,application/pdf"}
        onChange={handleMenuUpload} style={{ display: "none" }} />
      <input ref={itemImageRef} type="file" accept="image/*"
        onChange={handleItemImageUpload} style={{ display: "none" }} />

      {/* ── Upload sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUploadSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowUploadSheet(false); setUploadTitle(""); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "20px 20px 44px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                Upload Menu {uploadType === "image" ? "Image" : "PDF"}
              </h3>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 16px" }}>
                {uploadType === "image"
                  ? "Upload a photo of your printed or designed menu."
                  : "Upload a PDF version of your menu."}
              </p>

              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                Title <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
              </p>
              <input type="text"
                placeholder={uploadType === "image" ? "e.g. Cocktail Menu, Food Menu..." : "e.g. Full Menu, Drinks Menu..."}
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1.5px dashed #C4A0E8", backgroundColor: "#F7F5FA", color: "#5B0EA6", fontSize: 14, fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                {uploading
                  ? <><div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />Uploading...</>
                  : <><Upload size={16} />{uploadType === "image" ? "Choose Image" : "Choose PDF"}</>}
              </button>

              <button onClick={() => { setShowUploadSheet(false); setUploadTitle(""); }}
                style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Add/Edit Item bottom sheet ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddItem && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeItemSheet}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              {/* Sheet header */}
              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {editingItem ? "Edit Item" : "Add Menu Item"}
                  </h3>
                  <button onClick={closeItemSheet}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
              </div>

              {/* Sheet body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>

                  {/* Item image */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      Item Photo <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    {itemImageUrl ? (
                      <div style={{ position: "relative", width: 100, height: 100, borderRadius: 14, overflow: "hidden" }}>
                        <img src={itemImageUrl} alt="Item" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => setItemImageUrl("")}
                          style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <X size={11} style={{ color: "#FFFFFF" }} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => itemImageRef.current?.click()}
                        disabled={uploadingItemImage}
                        style={{ width: 100, height: 100, borderRadius: 14, border: "1.5px dashed #C4A0E8", backgroundColor: "#F7F5FA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {uploadingItemImage
                          ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                          : <><Camera size={20} style={{ color: "#5B0EA6" }} /><span style={{ fontSize: 10, color: "#5B0EA6", fontWeight: 600 }}>Add Photo</span></>}
                      </button>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Item Name <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <input type="text" placeholder="e.g. Grilled Chicken, Martini, Shisha..."
                      value={itemName} onChange={(e) => setItemName(e.target.value)}
                      style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>

                  {/* Category */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      Category <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CATEGORIES.map((cat) => (
                        <button key={cat} onClick={() => setItemCategory(cat)}
                          style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: itemCategory === cat ? "#5B0EA6" : "#E4DCF0", backgroundColor: itemCategory === cat ? "#EDE0F7" : "#FFFFFF", color: itemCategory === cat ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: itemCategory === cat ? 700 : 400, cursor: "pointer" }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Price <span style={{ color: "#EF4444" }}>*</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                      <input type="number" placeholder="0"
                        value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Description <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span>
                    </p>
                    <textarea placeholder="Short description of this item..."
                      value={itemDescription} onChange={(e) => setItemDescription(e.target.value)}
                      rows={2}
                      style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
                  </div>

                  {/* Availability toggle when editing */}
                  {editingItem && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F7F5FA", borderRadius: 12, padding: "12px 14px" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>Available</p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Show this item to customers</p>
                      </div>
                      <button
                        onClick={async () => {
                          await (supabase.from("vendor_menu") as any)
                            .update({ is_available: !editingItem.is_available })
                            .eq("id", editingItem.id);
                          setEditingItem({ ...editingItem, is_available: !editingItem.is_available });
                          refetchItems();
                        }}
                        style={{ width: 44, height: 26, borderRadius: 999, border: "none", backgroundColor: editingItem.is_available ? "#5B0EA6" : "#E4DCF0", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 3, transition: "left 0.2s", left: editingItem.is_available ? 21 : 3, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {itemError && (
                    <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                      <p style={{ color: "#EF4444", fontSize: 12, margin: 0 }}>{itemError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sheet footer */}
              <div style={{ padding: "12px 20px 40px", borderTop: "1px solid #F2EEF9", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => saveItemMutation.mutate()} disabled={saveItemMutation.isPending}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: saveItemMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: saveItemMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  {saveItemMutation.isPending
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
                    : <><CheckCircle size={16} />{editingItem ? "Save Changes" : "Add Item"}</>}
                </button>
                {editingItem && (
                  <button onClick={() => deleteItemMutation.mutate(editingItem.id)}
                    disabled={deleteItemMutation.isPending}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Trash2 size={15} />
                    {deleteItemMutation.isPending ? "Deleting..." : "Delete Item"}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.93)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={() => setLightboxImage(null)}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 101 }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <motion.img src={lightboxImage}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "95vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 12 }} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}