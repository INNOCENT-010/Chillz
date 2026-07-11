/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, CheckCircle, AlertTriangle,
  ArrowLeft, Eye, EyeOff, Calendar, X, ChevronRight,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { format } from "date-fns";

const POST_TYPES = [
  { id: "poster",   label: "Poster",  emoji: "🎨", desc: "Single event or promo image" },
  { id: "carousel", label: "Gallery", emoji: "🖼️", desc: "Multiple images in one post" },
  { id: "writeup",  label: "Writeup", emoji: "✍️", desc: "Text update or announcement" },
  { id: "offer",    label: "Offer",   emoji: "🏷️", desc: "Special deal for your audience" },
  { id: "lineup",   label: "Lineup",  emoji: "🎤", desc: "DJ or artist lineup poster" },
];

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  poster:   { color: "#5B0EA6", bg: "#EDE0F7" },
  carousel: { color: "#2563EB", bg: "#EFF6FF" },
  writeup:  { color: "#059669", bg: "#E0F7EA" },
  offer:    { color: "#D97706", bg: "#FEF3C7" },
  lineup:   { color: "#DB2777", bg: "#FCE7F3" },
};

export default function VendorPostsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [postType, setPostType] = useState("poster");
  const [form, setForm] = useState({
    caption: "",
    images: [] as string[],
    tags: [] as string[],
    tagInput: "",
    linkedEventId: "",
    offerTitle: "",
    offerDescription: "",
    offerExpiry: "",
    offerDiscount: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor-self", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors")
        .select("id, business_name, kyc_status, venue_id")
        .eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: myEvents } = useQuery({
    queryKey: ["vendor-events-posts", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await supabase.from("events")
        .select("id, title, start_date, images, ticket_price, tickets_sold, capacity, vendor_id")
        .eq("vendor_id", vendor.id)
        .order("start_date", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  const { data: myPosts, isLoading } = useQuery({
    queryKey: ["vendor-posts", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await (supabase.from("vendor_posts") as any)
        .select("*, events(title, start_date)")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 30,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendor not found");
      if (!form.caption.trim() && form.images.length === 0)
        throw new Error("Add a caption or at least one image");
      if (postType === "offer" && !form.offerTitle.trim())
        throw new Error("Offer title is required");

      const { error: err } = await (supabase.from("vendor_posts") as any).insert({
        vendor_id: vendor.id,
        post_type: postType,
        caption: form.caption.trim() || null,
        images: form.images,
        tags: form.tags,
        linked_event_id: form.linkedEventId || null,
        offer_title: postType === "offer" ? form.offerTitle.trim() : null,
        offer_description: postType === "offer" ? form.offerDescription.trim() : null,
        offer_expires_at: postType === "offer" && form.offerExpiry
          ? new Date(form.offerExpiry).toISOString()
          : null,
        offer_discount_pct: postType === "offer" && form.offerDiscount
          ? Number(form.offerDiscount)
          : null,
        is_active: true,
        hype_count: 0,
        view_count: 0,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-posts", vendor?.id] });
      qc.invalidateQueries({ queryKey: ["discover-posts"] });
      setSuccess(true);
      setShowCreate(false);
      setForm({ caption: "", images: [], tags: [], tagInput: "", linkedEventId: "", offerTitle: "", offerDescription: "", offerExpiry: "", offerDiscount: "" });
      setPostType("poster");
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (e: any) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      await (supabase.from("vendor_posts") as any).delete().eq("id", postId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-posts", vendor?.id] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ postId, isActive }: { postId: string; isActive: boolean }) => {
      await (supabase.from("vendor_posts") as any).update({ is_active: !isActive }).eq("id", postId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-posts", vendor?.id] }),
  });

  const addTag = () => {
    const tag = form.tagInput.trim().replace(/^#/, "");
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: "" });
    }
  };

  const linkedEvent = myEvents?.find((e: any) => e.id === form.linkedEventId);

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  if (!vendor) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "44px 16px 16px", borderBottom: "1px solid #F2EEF9", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
              <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                My Posts
              </h1>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{myPosts?.length || 0} posts published</p>
            </div>
          </div>
          <button onClick={() => { setShowCreate(true); setError(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(91,14,166,0.3)" }}>
            <Plus size={15} />New Post
          </button>
        </div>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", padding: "12px 16px", display: "flex", gap: 8, alignItems: "center" }}>
            <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "#065F46", margin: 0 }}>Post published to Discover feed!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts list */}
      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 100, borderRadius: 16, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : myPosts?.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>No posts yet</p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px" }}>Create your first post to appear in Discover</p>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: "10px 24px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Create First Post
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myPosts!.map((post: any) => {
              const tc = TYPE_COLORS[post.post_type] || TYPE_COLORS.poster;
              const typeInfo = POST_TYPES.find((t) => t.id === post.post_type);
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #F2EEF9", opacity: post.is_active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", gap: 12, padding: "14px" }}>

                    {/* Thumbnail */}
                    <div style={{ width: 72, height: 72, borderRadius: 12, flexShrink: 0, overflow: "hidden", backgroundColor: tc.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {post.images?.[0]
                        ? <img src={post.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 24 }}>{typeInfo?.emoji}</span>}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: tc.color, backgroundColor: tc.bg, padding: "2px 8px", borderRadius: 999 }}>
                          {typeInfo?.emoji} {typeInfo?.label}
                        </span>
                        {!post.is_active && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "2px 8px", borderRadius: 999 }}>Hidden</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600, margin: "0 0 4px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {post.offer_title || post.caption || `${typeInfo?.label} post`}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                          {format(new Date(post.created_at), "dd MMM")}
                        </span>
                        <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>
                          ❤️ {post.hype_count || 0}
                        </span>
                        <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                          👁 {post.view_count || 0}
                        </span>
                      </div>
                      {post.events?.title && (
                        <p style={{ fontSize: 10, color: "#5B0EA6", margin: "3px 0 0", fontWeight: 600 }}>
                          🎫 {post.events.title}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => router.push(`/vendor/posts/${post.id}`)}
                        style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#EDE0F7", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ChevronRight size={14} style={{ color: "#5B0EA6" }} />
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ postId: post.id, isActive: post.is_active })}
                        style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#F7F5FA", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {post.is_active
                          ? <Eye size={14} style={{ color: "#5B0EA6" }} />
                          : <EyeOff size={14} style={{ color: "#9E9E9E" }} />}
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this post?")) deleteMutation.mutate(post.id); }}
                        style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={14} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create post sheet */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", overflowY: "auto", paddingBottom: 48 }}>

              <div style={{ padding: "20px 20px 0" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>New Post</h3>
                  <button onClick={() => setShowCreate(false)}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>

                {/* Post type */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Post Type</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {POST_TYPES.map((type) => {
                      const isSelected = postType === type.id;
                      const tc = TYPE_COLORS[type.id];
                      return (
                        <button key={type.id} onClick={() => setPostType(type.id)}
                          style={{ padding: "10px 4px", borderRadius: 12, border: `2px solid ${isSelected ? tc.color : "#E4DCF0"}`, backgroundColor: isSelected ? tc.bg : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 20 }}>{type.emoji}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? tc.color : "#9E9E9E", textAlign: "center", lineHeight: 1.2 }}>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "8px 0 0" }}>
                    {POST_TYPES.find((t) => t.id === postType)?.desc}
                  </p>
                </div>

                {/* Images */}
                {postType !== "writeup" && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      {postType === "carousel" ? "Images (up to 8)" : "Image"}
                    </p>
                    <ImageUpload
                      images={form.images}
                      onChange={(imgs) => setForm({ ...form, images: postType === "carousel" ? imgs : imgs.slice(0, 1) })}
                      maxImages={postType === "carousel" ? 8 : 1}
                      folder="posts"
                    />
                  </div>
                )}

                {/* Caption */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    {postType === "writeup" ? "Your Update" : "Caption"}
                  </p>
                  <textarea
                    placeholder={postType === "writeup" ? "Share an update, announcement, or story..." : "Add a caption..."}
                    value={form.caption}
                    onChange={(e) => setForm({ ...form, caption: e.target.value })}
                    rows={postType === "writeup" ? 5 : 3}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                {/* Offer fields */}
                {postType === "offer" && (
                  <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Offer Title *</p>
                      <input type="text" placeholder="e.g. 50% Off Table Bookings This Weekend"
                        value={form.offerTitle} onChange={(e) => setForm({ ...form, offerTitle: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Offer Details</p>
                      <textarea placeholder="Describe the offer..." value={form.offerDescription}
                        onChange={(e) => setForm({ ...form, offerDescription: e.target.value })}
                        rows={2} style={{ ...inputStyle, resize: "none" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Discount %</p>
                        <input type="number" placeholder="e.g. 30" min="1" max="100"
                          value={form.offerDiscount} onChange={(e) => setForm({ ...form, offerDiscount: e.target.value })}
                          style={{ ...inputStyle, textAlign: "center" }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Expires</p>
                        <input type="datetime-local" value={form.offerExpiry}
                          onChange={(e) => setForm({ ...form, offerExpiry: e.target.value })}
                          style={{ ...inputStyle, fontSize: 12 }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Link to Event — tap to link ── */}
                {myEvents && myEvents.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                      Link to Event
                    </p>

                    {/* Currently linked */}
                    {linkedEvent && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0, backgroundColor: "#C4A0E8" }}>
                          {linkedEvent.images?.[0]
                            ? <img src={linkedEvent.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Calendar size={14} style={{ color: "#5B0EA6" }} />
                              </div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 12, color: "#3D0066", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {linkedEvent.title}
                          </p>
                          <p style={{ fontSize: 10, color: "#7B2FBE", margin: 0 }}>
                            {format(new Date(linkedEvent.start_date), "dd MMM · HH:mm")}
                          </p>
                        </div>
                        <button onClick={() => setForm({ ...form, linkedEventId: "" })}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                          <X size={13} style={{ color: "#7B2FBE" }} />
                        </button>
                      </div>
                    )}

                    {/* Event list — scrollable, tap to link */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 220, overflowY: "auto" }}>
                      {myEvents.map((event: any) => {
                        const isLinked = form.linkedEventId === event.id;
                        const isPast = new Date(event.start_date) < new Date();
                        return (
                          <button key={event.id}
                            onClick={() => setForm({ ...form, linkedEventId: isLinked ? "" : event.id })}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: `1.5px solid ${isLinked ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isLinked ? "#F9F5FF" : "#F7F5FA", cursor: "pointer", textAlign: "left", opacity: isPast ? 0.6 : 1 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                              {event.images?.[0]
                                ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Calendar size={14} style={{ color: "#5B0EA6" }} />
                                  </div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                {event.title}
                              </p>
                              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                <span style={{ fontSize: 10, color: isPast ? "#9E9E9E" : "#5B0EA6", fontWeight: 600 }}>
                                  {format(new Date(event.start_date), "dd MMM · HH:mm")}
                                </span>
                                {event.tickets_sold > 0 && (
                                  <span style={{ fontSize: 9, color: "#059669", backgroundColor: "#E0F7EA", padding: "1px 5px", borderRadius: 999, fontWeight: 700 }}>
                                    {event.tickets_sold} sold
                                  </span>
                                )}
                                {isPast && (
                                  <span style={{ fontSize: 9, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "1px 5px", borderRadius: 999, fontWeight: 700 }}>
                                    Past
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isLinked ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isLinked ? "#5B0EA6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {isLinked && <CheckCircle size={11} style={{ color: "#FFFFFF" }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Tags</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" placeholder="Add tag (e.g. afrobeats)"
                      value={form.tagInput}
                      onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={addTag}
                      style={{ padding: "11px 16px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      Add
                    </button>
                  </div>
                  {form.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {form.tags.map((tag) => (
                        <button key={tag}
                          onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                          style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#EDE0F7", border: "none", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#5B0EA6" }}>#{tag}</span>
                          <X size={11} style={{ color: "#9E9E9E" }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
                      <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                      <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  onClick={() => { setError(""); createMutation.mutate(); }}
                  disabled={createMutation.isPending}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: createMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: createMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: createMutation.isPending ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
                  {createMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Publishing...</>
                    : <><Plus size={17} />Publish to Discover</>}
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