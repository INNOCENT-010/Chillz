/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { ImageUpload } from "@/components/ui/image-upload";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, AlertTriangle,
  Trash2, Eye, EyeOff, Calendar, X, Plus,
} from "lucide-react";
import { format } from "date-fns";

const POST_TYPES = [
  { id: "poster",   label: "Poster",  emoji: "🎨" },
  { id: "carousel", label: "Gallery", emoji: "🖼️" },
  { id: "writeup",  label: "Writeup", emoji: "✍️" },
  { id: "offer",    label: "Offer",   emoji: "🏷️" },
  { id: "lineup",   label: "Lineup",  emoji: "🎤" },
];

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  poster:   { color: "#5B0EA6", bg: "#EDE0F7" },
  carousel: { color: "#2563EB", bg: "#EFF6FF" },
  writeup:  { color: "#059669", bg: "#E0F7EA" },
  offer:    { color: "#D97706", bg: "#FEF3C7" },
  lineup:   { color: "#DB2777", bg: "#FCE7F3" },
};

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

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
    is_active: true,
  });
  const [postType, setPostType] = useState("poster");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ["vendor-self", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("vendors").select("id, business_name").eq("user_id", user.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: post, isLoading } = useQuery({
    queryKey: ["post-edit", id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendor_posts") as any).select("*").eq("id", id).single();
      return data as any;
    },
    staleTime: 0,
  });

  const { data: myEvents } = useQuery({
    queryKey: ["vendor-events", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data } = await supabase.from("events")
        .select("id, title, start_date, is_active, images, ticket_price, ticket_types, tickets_sold, capacity, vendor_id")
        .eq("vendor_id", vendor.id)
        .order("start_date", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
  });

  // Populate form when post loads
  useEffect(() => {
    if (post) {
      setPostType(post.post_type || "poster");
      setForm({
        caption: post.caption || "",
        images: post.images || [],
        tags: post.tags || [],
        tagInput: "",
        linkedEventId: post.linked_event_id || "",
        offerTitle: post.offer_title || "",
        offerDescription: post.offer_description || "",
        offerExpiry: post.offer_expires_at
          ? new Date(post.offer_expires_at).toISOString().slice(0, 16)
          : "",
        offerDiscount: post.offer_discount_pct ? String(post.offer_discount_pct) : "",
        is_active: post.is_active !== false,
      });
    }
  }, [post]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!form.caption.trim() && form.images.length === 0)
        throw new Error("Add a caption or at least one image");
      if (postType === "offer" && !form.offerTitle.trim())
        throw new Error("Offer title is required");

      const { error: err } = await (supabase.from("vendor_posts") as any).update({
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
        is_active: form.is_active,
      }).eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-posts"] });
      qc.invalidateQueries({ queryKey: ["post-detail", id] });
      qc.invalidateQueries({ queryKey: ["discover-posts"] });
      setSuccess("Post updated!");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await (supabase.from("vendor_posts") as any).update({ is_active: !form.is_active }).eq("id", id);
    },
    onSuccess: () => {
      setForm((p) => ({ ...p, is_active: !p.is_active }));
      qc.invalidateQueries({ queryKey: ["vendor-posts"] });
      qc.invalidateQueries({ queryKey: ["discover-posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await (supabase.from("vendor_posts") as any).delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-posts"] });
      qc.invalidateQueries({ queryKey: ["discover-posts"] });
      router.replace("/vendor/posts");
    },
  });

  const addTag = () => {
    const tag = form.tagInput.trim().replace(/^#/, "");
    if (tag && !form.tags.includes(tag)) {
      setForm((p) => ({ ...p, tags: [...p.tags, tag], tagInput: "" }));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const linkedEvent = myEvents?.find((e: any) => e.id === form.linkedEventId);
  const tc = TYPE_COLORS[postType] || TYPE_COLORS.poster;
  const typeInfo = POST_TYPES.find((t) => t.id === postType);

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!post) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#6B6B6B" }}>Post not found.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "44px 16px 16px", borderBottom: "1px solid #F2EEF9", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
              <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Edit Post</h1>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                {typeInfo?.emoji} {typeInfo?.label} · {format(new Date(post.created_at), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => toggleMutation.mutate()}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {form.is_active
                ? <Eye size={16} style={{ color: "#5B0EA6" }} />
                : <EyeOff size={16} style={{ color: "#9E9E9E" }} />}
            </button>
            <button onClick={() => setShowDelete(true)}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={16} style={{ color: "#EF4444" }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Status banner */}
        <div style={{ backgroundColor: form.is_active ? "#E0F7EA" : "#F7F5FA", border: `1px solid ${form.is_active ? "#A7F3D0" : "#E4DCF0"}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: form.is_active ? "#00C853" : "#9E9E9E", flexShrink: 0 }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: form.is_active ? "#059669" : "#9E9E9E", margin: 0 }}>
            {form.is_active ? "Visible in Discover feed" : "Hidden from Discover feed"}
          </p>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <CheckCircle size={14} style={{ color: "#00C853", flexShrink: 0 }} />
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

        {/* Post type */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Post Type</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {POST_TYPES.map((type) => {
              const isSelected = postType === type.id;
              const c = TYPE_COLORS[type.id];
              return (
                <button key={type.id} onClick={() => setPostType(type.id)}
                  style={{ padding: "10px 4px", borderRadius: 12, border: `2px solid ${isSelected ? c.color : "#E4DCF0"}`, backgroundColor: isSelected ? c.bg : "#FFFFFF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 18 }}>{type.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? c.color : "#9E9E9E", textAlign: "center" }}>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Images */}
        {postType !== "writeup" && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              {postType === "carousel" ? "Images (up to 8)" : "Image"}
            </p>
            <ImageUpload
              images={form.images}
              onChange={(imgs) => setForm((p) => ({ ...p, images: postType === "carousel" ? imgs : imgs.slice(0, 1) }))}
              maxImages={postType === "carousel" ? 8 : 1}
              folder="posts"
            />
          </div>
        )}

        {/* Caption */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            {postType === "writeup" ? "Your Update" : "Caption"}
          </p>
          <textarea
            placeholder={postType === "writeup" ? "Share an update..." : "Add a caption..."}
            value={form.caption}
            onChange={(e) => setForm((p) => ({ ...p, caption: e.target.value }))}
            rows={postType === "writeup" ? 5 : 3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {/* Offer fields */}
        {postType === "offer" && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Offer Details</p>
            <input type="text" placeholder="Offer title *" value={form.offerTitle}
              onChange={(e) => setForm((p) => ({ ...p, offerTitle: e.target.value }))} style={inputStyle} />
            <textarea placeholder="Offer description" value={form.offerDescription}
              onChange={(e) => setForm((p) => ({ ...p, offerDescription: e.target.value }))}
              rows={2} style={{ ...inputStyle, resize: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Discount %</p>
                <input type="number" placeholder="e.g. 30" value={form.offerDiscount}
                  onChange={(e) => setForm((p) => ({ ...p, offerDiscount: e.target.value }))}
                  style={{ ...inputStyle, textAlign: "center" }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>Expires</p>
                <input type="datetime-local" value={form.offerExpiry}
                  onChange={(e) => setForm((p) => ({ ...p, offerExpiry: e.target.value }))}
                  style={{ ...inputStyle, fontSize: 12 }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Linked Event — tap to link ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
            Linked Event
          </p>

          {/* Currently linked event card */}
          {linkedEvent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 11, overflow: "hidden", flexShrink: 0, backgroundColor: "#C4A0E8" }}>
                {linkedEvent.images?.[0]
                  ? <img src={linkedEvent.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Calendar size={20} style={{ color: "#5B0EA6" }} />
                    </div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#3D0066", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {linkedEvent.title}
                </p>
                <p style={{ fontSize: 11, color: "#7B2FBE", margin: 0 }}>
                  {format(new Date(linkedEvent.start_date), "dd MMM · HH:mm")}
                </p>
              </div>
              <button onClick={() => setForm((p) => ({ ...p, linkedEventId: "" }))}
                style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(91,14,166,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={13} style={{ color: "#5B0EA6" }} />
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 10px" }}>No event linked. Tap an event below to link it.</p>
          )}

          {/* Event list — tap to link */}
          {myEvents && myEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myEvents.map((event: any) => {
                const isLinked = form.linkedEventId === event.id;
                const isPast = new Date(event.start_date) < new Date();
                return (
                  <button key={event.id}
                    onClick={() => setForm((p) => ({ ...p, linkedEventId: isLinked ? "" : event.id }))}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${isLinked ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isLinked ? "#F9F5FF" : "#F7F5FA", cursor: "pointer", textAlign: "left", opacity: isPast ? 0.6 : 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                      {event.images?.[0]
                        ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Calendar size={16} style={{ color: "#5B0EA6" }} />
                          </div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {event.title}
                      </p>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: isPast ? "#9E9E9E" : "#5B0EA6", fontWeight: 600 }}>
                          {format(new Date(event.start_date), "dd MMM · HH:mm")}
                        </span>
                        {event.tickets_sold > 0 && (
                          <span style={{ fontSize: 9, color: "#059669", backgroundColor: "#E0F7EA", padding: "1px 6px", borderRadius: 999, fontWeight: 700 }}>
                            {event.tickets_sold} sold
                          </span>
                        )}
                        {isPast && (
                          <span style={{ fontSize: 9, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "1px 6px", borderRadius: 999, fontWeight: 700 }}>
                            Past
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isLinked ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: isLinked ? "#5B0EA6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isLinked && <CheckCircle size={13} style={{ color: "#FFFFFF" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "14px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 10px" }}>You have no events yet.</p>
              <button onClick={() => router.push("/vendor/events/add")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={13} />Create Event
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Tags</p>
          <div style={{ display: "flex", gap: 8, marginBottom: form.tags.length > 0 ? 10 : 0 }}>
            <input type="text" placeholder="Add tag (e.g. afrobeats)"
              value={form.tagInput}
              onChange={(e) => setForm((p) => ({ ...p, tagInput: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addTag}
              style={{ padding: "11px 16px", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Add
            </button>
          </div>
          {form.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {form.tags.map((tag) => (
                <button key={tag}
                  onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }))}
                  style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#EDE0F7", border: "none", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#5B0EA6" }}>#{tag}</span>
                  <X size={11} style={{ color: "#9E9E9E" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Hypes", value: post.hype_count || 0, color: "#EF4444", emoji: "❤️" },
            { label: "Views", value: post.view_count || 0, color: "#5B0EA6", emoji: "👁" },
          ].map(({ label, value, emoji }) => (
            <div key={label} style={{ textAlign: "center", backgroundColor: "#F7F5FA", borderRadius: 12, padding: "12px 8px" }}>
              <p style={{ fontSize: 22, margin: "0 0 4px" }}>{emoji}</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Save */}
        <button onClick={() => { setError(""); updateMutation.mutate(); }} disabled={updateMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: updateMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: updateMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          {updateMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><CheckCircle size={17} />Save Changes</>}
        </button>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDelete(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 44px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Trash2 size={24} style={{ color: "#EF4444" }} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 6px" }}>Delete Post?</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>This will remove it from the Discover feed permanently.</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDelete(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: deleteMutation.isPending ? "#9E9E9E" : "#EF4444", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {deleteMutation.isPending
                    ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                    : <><Trash2 size={14} />Delete</>}
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