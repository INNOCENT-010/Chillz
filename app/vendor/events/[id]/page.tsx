/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, AlertTriangle, Calendar,
  MapPin, Clock, Users, Ticket, Plus, Trash2,
  ToggleLeft, ToggleRight, X, Music, Zap, Compass,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const EVENT_TYPES = [
  { id: "Rave/Party",         emoji: "🎉", color: "#EF4444", bg: "#FEF2F2" },
  { id: "Concert",            emoji: "🎤", color: "#5B0EA6", bg: "#EDE0F7" },
  { id: "Comedy Show",        emoji: "😂", color: "#F59E0B", bg: "#FFF8E1" },
  { id: "Seminar/Conference", emoji: "💡", color: "#2563EB", bg: "#EFF6FF" },
  { id: "Networking",         emoji: "🤝", color: "#059669", bg: "#E0F7EA" },
  { id: "Festival",           emoji: "🎪", color: "#7B2FBE", bg: "#F3E8FF" },
  { id: "Sports Viewing",     emoji: "⚽", color: "#0D9488", bg: "#CCFBF1" },
  { id: "Pop-up/Market",      emoji: "🛍️", color: "#DB2777", bg: "#FDF2F8" },
  { id: "Other",              emoji: "✨", color: "#6B6B6B", bg: "#F2EEF9" },
];

const POPULAR_TAGS = [
  { id:"Party / Rave", emoji:"🎉" },
  { id:"Festival", emoji:"🎪" },
  { id:"Concert / Live Performance", emoji:"🎤" },
  { id:"Game Night / Movie Night", emoji:"🎮" },
  { id:"Dinner / Gala Night", emoji:"🍽️" },
  { id:"Networking Event", emoji:"🤝" },
];
const EXPLORE_TAGS = [
  { id:"Workshop / Training", emoji:"📚" },
  { id:"Community Meetup", emoji:"👥" },
  { id:"Seminar / Webinar", emoji:"💡" },
  { id:"Cultural Event", emoji:"🎭" },
  { id:"Product Launch", emoji:"🚀" },
  { id:"Conference / Summit", emoji:"🏆" },
  { id:"Panel Discussion / Fireside Chat", emoji:"🗣️" },
  { id:"Exhibition / Trade Fair", emoji:"🖼️" },
  { id:"Meet & Greet", emoji:"👋" },
  { id:"Others", emoji:"✨" },
];

const CROWD_TYPES = ["Mixed", "Ladies Night", "Couples", "18+", "All Ages", "VIP Only", "Corporate"];
const CLASSIFICATIONS = ["regular", "vip", "vvip", "early_bird", "table", "student"];

interface TicketType {
  name: string;
  price: string;
  capacity: string;
  description: string;
  classification: string;
}

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VendorEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const imageRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    crowd_type: "Mixed",
    event_type: "",
    event_tags: [] as string[],
    is_outdoor: false,
    is_active: true,
    images: [] as string[],
    capacity: "",
    dress_code: "",
    age_restriction: "",
  });

  const [djLineupInput, setDjLineupInput] = useState("");
  const [djLineup, setDjLineup] = useState<string[]>([]);

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketType>({
    name: "", price: "", capacity: "", description: "", classification: "regular",
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors")
        .select("*, venues(id, name, address, images)")
        .eq("user_id", user!.id).single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: event, isLoading } = useQuery({
    queryKey: ["vendor-event", id],
    queryFn: async () => {
      const { data } = await (supabase.from("events") as any)
        .select("*, venues(name, address, images), tickets(*)")
        .eq("id", id).single();
      return data as any;
    },
    staleTime: 0,
  });

  const { data: tickets } = useQuery({
    queryKey: ["event-tickets", id],
    queryFn: async () => {
      const { data } = await (supabase.from("tickets") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title || "",
        description: event.description || "",
        start_date: toLocalDatetime(event.start_date),
        end_date: toLocalDatetime(event.end_date),
        crowd_type: event.crowd_type || "Mixed",
        event_type: event.event_type || "",
        event_tags: event.event_tags || [],
        is_outdoor: event.is_outdoor || false,
        is_active: event.is_active !== false,
        images: event.images || [],
        capacity: event.capacity ? String(event.capacity) : "",
        dress_code: event.dress_code || "",
        age_restriction: event.age_restriction || "",
      });
      setDjLineup(event.dj_lineup || []);
      if (event.ticket_types?.length > 0) {
        setTicketTypes(event.ticket_types.map((t: any) => ({
          name: t.name || "",
          price: t.price !== undefined ? String(t.price) : "",
          capacity: t.slots || t.capacity ? String(t.slots || t.capacity) : "",
          description: t.description || "",
          classification: t.classification || "regular",
        })));
      }
    }
  }, [event]);

  const isEventOrganizer = vendor?.vendor_type === "event_organizer";
  const venue = event?.venues || vendor?.venues;

  const totalRevenue = (tickets || [])
    .filter((t: any) => t.status === "active" || t.status === "used")
    .reduce((acc: number, t: any) => acc + (t.amount_paid || 0), 0);
  const soldCount = (tickets || [])
    .filter((t: any) => t.status !== "cancelled" && t.status !== "refunded").length;

  const addDj = () => {
    const val = djLineupInput.trim();
    if (!val) return;
    setDjLineup((prev) => [...prev, val]);
    setDjLineupInput("");
  };

  const toggleTag = (tag: string) => {
    setForm((p) => ({
      ...p,
      event_tags: p.event_tags.includes(tag)
        ? p.event_tags.filter((t) => t !== tag)
        : [...p.event_tags, tag],
    }));
  };

  // ── Add-only image upload — appends, never removes ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !vendor?.id) return;
    setUploadingImage(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `event-covers/${vendor.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-media")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("vendor-media").getPublicUrl(path);
        uploaded.push(urlData.publicUrl);
      }
      const newImages = [...form.images, ...uploaded];
      setForm((p) => ({ ...p, images: newImages }));
      // Persist immediately so a refresh doesn't lose new photos
      await (supabase.from("events") as any).update({ images: newImages }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["vendor-event", id] });
    } catch (err: any) {
      setError("Image upload failed: " + err.message);
    } finally {
      setUploadingImage(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Event title required");
      if (!form.start_date) throw new Error("Start date required");
      if (!form.event_type) throw new Error("Please select an event category");
      const { error: err } = await (supabase.from("events") as any).update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_date: new Date(form.start_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        crowd_type: form.crowd_type,
        event_type: form.event_type,
        event_tags: form.event_tags,
        is_outdoor: form.is_outdoor,
        is_active: form.is_active,
        images: form.images,
        capacity: Number(form.capacity) || null,
        dress_code: form.dress_code.trim() || null,
        age_restriction: form.age_restriction.trim() || null,
        dj_lineup: djLineup.length > 0 ? djLineup : null,
        ticket_types: ticketTypes.length > 0
          ? ticketTypes.map((t) => ({
              name: t.name,
              price: Number(t.price) || 0,
              slots: Number(t.capacity) || null,
              capacity: Number(t.capacity) || null,
              description: t.description || null,
              classification: t.classification || "regular",
            }))
          : null,
      }).eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-event", id] });
      setSuccess("Saved!");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (e: any) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await (supabase.from("events") as any).update({ is_active: !event?.is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-event", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error: err } = await (supabase.from("events") as any).delete().eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => router.replace("/vendor"),
    onError: (e: any) => setError(e.message),
  });

  const addTicketType = () => {
    if (!ticketForm.name.trim()) return;
    setTicketTypes((prev) => [...prev, { ...ticketForm }]);
    setTicketForm({ name: "", price: "", capacity: "", description: "", classification: "regular" });
    setShowTicketForm(false);
  };

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

  if (!event) return null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      {/* Hero */}
      <div style={{ position: "relative", height: 200, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
        {form.images?.[0]
          ? <img src={form.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={44} style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />

        <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} style={{ color: "#0A0A0A" }} />
          </button>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", backgroundColor: event.is_active ? "rgba(0,200,83,0.8)" : "rgba(158,158,158,0.8)", padding: "4px 12px", borderRadius: 999 }}>
            {event.is_active ? "Live" : "Hidden"}
          </span>
        </div>

        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
          <h1 style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 900, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
            {event.title}
          </h1>
          {event.start_date && (
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, margin: 0 }}>
              {format(new Date(event.start_date), "dd MMM yyyy · HH:mm")}
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

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

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Sold", value: String(soldCount), sub: event.capacity ? `of ${event.capacity}` : "no limit", color: "#5B0EA6" },
            { label: "Revenue", value: formatCurrency(Math.round(totalRevenue * 0.95)), sub: "after 5% fee", color: "#059669" },
            { label: "Price", value: event.ticket_types?.[0] ? formatCurrency(event.ticket_types[0].price) : event.ticket_price > 0 ? formatCurrency(event.ticket_price) : "Free", sub: "per ticket", color: "#D97706" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 900, color, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
              <p style={{ fontSize: 9, color: "#9E9E9E", margin: 0 }}>{sub}</p>
            </div>
          ))}
        </div>

        {venue && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {venue.images?.[0]
                ? <img src={venue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <MapPin size={15} style={{ color: "#5B0EA6" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: "0 0 1px" }}>{venue.name || event.custom_venue_address}</p>
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>{venue.address || "Custom address"}</p>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 8px", borderRadius: 999 }}>Venue</span>
          </div>
        )}

        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>Published (Live)</p>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Visible to users on the app</p>
          </div>
          <button onClick={() => toggleMutation.mutate()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {event.is_active
              ? <ToggleRight size={28} style={{ color: "#5B0EA6" }} />
              : <ToggleLeft size={28} style={{ color: "#E4DCF0" }} />}
          </button>
        </div>

        {/* ── Photos — add, delete, set cover ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ImageIcon size={14} style={{ color: "#5B0EA6" }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Photos</p>
            </div>
            <span style={{ fontSize: 11, color: "#9E9E9E" }}>{form.images.length} photo{form.images.length !== 1 ? "s" : ""}</span>
          </div>

          {form.images.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {form.images.map((img, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: `2px solid ${i === 0 ? "#5B0EA6" : "#E4DCF0"}` }}>
                  <img src={img} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                  {/* Cover badge */}
                  {i === 0 && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(91,14,166,0.85)", padding: "3px 6px", textAlign: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cover</span>
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  <div style={{ position: "absolute", top: 4, right: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Delete */}
                    <button
                      onClick={async () => {
                        const newImages = form.images.filter((_, idx) => idx !== i);
                        setForm(p => ({ ...p, images: newImages }));
                        await (supabase.from("events") as any).update({ images: newImages }).eq("id", id);
                        qc.invalidateQueries({ queryKey: ["vendor-event", id] });
                      }}
                      style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={11} style={{ color: "#FFFFFF" }} />
                    </button>
                    {/* Set as cover — only show on non-cover images */}
                    {i !== 0 && (
                      <button
                        onClick={async () => {
                          const newImages = [img, ...form.images.filter((_, idx) => idx !== i)];
                          setForm(p => ({ ...p, images: newImages }));
                          await (supabase.from("events") as any).update({ images: newImages }).eq("id", id);
                          qc.invalidateQueries({ queryKey: ["vendor-event", id] });
                        }}
                        style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(91,14,166,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Set as cover"
                      >
                        <span style={{ fontSize: 10, color: "#FFFFFF", fontWeight: 800, lineHeight: 1 }}>★</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { if (!uploadingImage) imageRef.current?.click(); }} disabled={uploadingImage}
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "2px dashed", borderColor: uploadingImage ? "#9E9E9E" : "#C4A0E8", backgroundColor: uploadingImage ? "#F7F5FA" : "#F9F5FF", cursor: uploadingImage ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {uploadingImage ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 13, color: "#6B6B6B", fontWeight: 600 }}>Uploading...</span>
              </>
            ) : (
              <>
                <Plus size={16} style={{ color: "#5B0EA6" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>
                  {form.images.length === 0 ? "Upload Photos" : "Add More Photos"}
                </span>
              </>
            )}
          </button>
          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "8px 0 0", textAlign: "center" }}>
            Tap ✕ to remove a photo · Tap ★ to set as cover
          </p>
          <input ref={imageRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
        </div>

        {/* Edit form */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Title *</p>
            <input type="text" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</p>
            <textarea value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Start *</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 12px" }}>
                <Calendar size={13} style={{ color: "#9E9E9E" }} />
                <input type="datetime-local" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#0A0A0A", fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>End</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 12px" }}>
                <Clock size={13} style={{ color: "#9E9E9E" }} />
                <input type="datetime-local" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#0A0A0A", fontFamily: "inherit" }} />
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Crowd Type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CROWD_TYPES.map((type) => (
                <button key={type} onClick={() => setForm({ ...form, crowd_type: type })}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.crowd_type === type ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.crowd_type === type ? "#EDE0F7" : "#FFFFFF", color: form.crowd_type === type ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, backgroundColor: "#F7F5FA", borderRadius: 12, padding: "11px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>Outdoor</span>
              <button onClick={() => setForm({ ...form, is_outdoor: !form.is_outdoor })} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {form.is_outdoor ? <ToggleRight size={22} style={{ color: "#5B0EA6" }} /> : <ToggleLeft size={22} style={{ color: "#E4DCF0" }} />}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Capacity</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 12px" }}>
                <Users size={13} style={{ color: "#9E9E9E" }} />
                <input type="number" placeholder="Max" value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Age Limit</p>
              <input type="text" placeholder="e.g. 18+" value={form.age_restriction}
                onChange={(e) => setForm({ ...form, age_restriction: e.target.value })}
                style={{ ...inputStyle, padding: "11px 12px" }} />
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dress Code</p>
            <input type="text" placeholder="e.g. Smart Casual" value={form.dress_code}
              onChange={(e) => setForm({ ...form, dress_code: e.target.value })} style={inputStyle} />
          </div>
        </div>

        {/* Event Category */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Zap size={14} style={{ color: "#5B0EA6" }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Category *</p>
          </div>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 12px" }}>Pick ONE — this shows as the badge on your event card</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EVENT_TYPES.map(({ id, emoji, color, bg }) => {
              const active = form.event_type === id;
              return (
                <button key={id} onClick={() => setForm({ ...form, event_type: id })}
                  style={{ padding: "9px 14px", borderRadius: 999, border: "1.5px solid", borderColor: active ? color : "#E4DCF0", backgroundColor: active ? bg : "#FFFFFF", color: active ? color : "#3A3A3A", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{emoji}</span>{id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Tags */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Compass size={14} style={{ color: "#5B0EA6" }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Additional Tags</p>
          </div>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 12px" }}>For filtering only — not shown on the card</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={11} style={{ color: "#F59E0B" }} />Popular
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {POPULAR_TAGS.map(({ id, emoji }) => {
              const on = form.event_tags.includes(id);
              return (
                <button key={id} onClick={() => toggleTag(id)}
                  style={{ padding: "7px 12px", borderRadius: 999, border: "1.5px solid", borderColor: on ? "#5B0EA6" : "#E4DCF0", backgroundColor: on ? "#EDE0F7" : "#FFFFFF", color: on ? "#5B0EA6" : "#3A3A3A", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{emoji}</span>{id}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 5 }}>
            <Compass size={11} style={{ color: "#5B0EA6" }} />Explore
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {EXPLORE_TAGS.map(({ id, emoji }) => {
              const on = form.event_tags.includes(id);
              return (
                <button key={id} onClick={() => toggleTag(id)}
                  style={{ padding: "7px 12px", borderRadius: 999, border: "1.5px solid", borderColor: on ? "#5B0EA6" : "#E4DCF0", backgroundColor: on ? "#EDE0F7" : "#FFFFFF", color: on ? "#5B0EA6" : "#3A3A3A", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{emoji}</span>{id}
                </button>
              );
            })}
          </div>
        </div>

        {/* DJ Lineup */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Music size={14} style={{ color: "#5B0EA6" }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>DJ / Performer Lineup</p>
          </div>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 10px" }}>Add names one at a time</p>
          <div style={{ display: "flex", gap: 8, marginBottom: djLineup.length > 0 ? 10 : 0 }}>
            <input type="text" placeholder="e.g. DJ Spinall"
              value={djLineupInput}
              onChange={(e) => setDjLineupInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDj(); } }}
              style={{ ...inputStyle, padding: "10px 12px", fontSize: 13 }} />
            <button onClick={addDj}
              style={{ width: 44, height: 44, borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Plus size={16} style={{ color: "#FFFFFF" }} />
            </button>
          </div>
          {djLineup.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {djLineup.map((dj, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "5px 10px" }}>
                  <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600 }}>🎧 {dj}</span>
                  <button onClick={() => setDjLineup((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <span style={{ fontSize: 14, color: "#9E9E9E", lineHeight: 1 }}>×</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket types */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ticket Types</p>
            <button onClick={() => setShowTicketForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
              <Plus size={13} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>Add</span>
            </button>
          </div>

          {ticketTypes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {ticketTypes.map((t, i) => (
                <div key={i} style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                      {Number(t.price) === 0 ? "Free" : formatCurrency(Number(t.price))}
                      {t.capacity ? ` · ${t.capacity} slots` : ""} · {t.classification}
                    </p>
                  </div>
                  <button onClick={() => setTicketTypes((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={14} style={{ color: "#EF4444" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showTicketForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8, border: "1px solid #EDE0F7", marginBottom: 8 }}>
                  <input type="text" placeholder="Ticket name (e.g. VIP)" value={ticketForm.name}
                    onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })} style={inputStyle} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                      <input type="number" placeholder="Price" value={ticketForm.price}
                        onChange={(e) => setTicketForm({ ...ticketForm, price: e.target.value })}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px" }}>
                      <Ticket size={13} style={{ color: "#9E9E9E" }} />
                      <input type="number" placeholder="Slots" value={ticketForm.capacity}
                        onChange={(e) => setTicketForm({ ...ticketForm, capacity: e.target.value })}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CLASSIFICATIONS.map((cls) => (
                      <button key={cls} onClick={() => setTicketForm({ ...ticketForm, classification: cls })}
                        style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid", borderColor: ticketForm.classification === cls ? "#5B0EA6" : "#E4DCF0", backgroundColor: ticketForm.classification === cls ? "#EDE0F7" : "#FFFFFF", color: ticketForm.classification === cls ? "#5B0EA6" : "#6B6B6B", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                        {cls.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowTicketForm(false)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button onClick={addTicketType}
                      style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Add
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {ticketTypes.length === 0 && !showTicketForm && (
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, textAlign: "center", padding: "4px 0" }}>No ticket types — free entry</p>
          )}
        </div>

        {tickets && tickets.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Ticket Holders ({soldCount})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tickets.map((ticket: any) => (
                <div key={ticket.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {ticket.users?.avatar_url
                      ? <img src={ticket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>{ticket.users?.full_name?.[0]}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{ticket.users?.full_name || "Guest"}</p>
                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, fontFamily: "monospace" }}>
                      #{ticket.qr_code_hash?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6", margin: "0 0 2px" }}>
                      {ticket.amount_paid > 0 ? formatCurrency(ticket.amount_paid) : "Free"}
                    </p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ticket.status === "used" ? "#9E9E9E" : ticket.status === "active" ? "#059669" : "#EF4444", backgroundColor: ticket.status === "used" ? "#F2EEF9" : ticket.status === "active" ? "#E0F7EA" : "#FEF2F2", padding: "1px 7px", borderRadius: 999 }}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => { setError(""); updateMutation.mutate(); }} disabled={updateMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: updateMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: updateMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          {updateMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : <><CheckCircle size={17} />Save Changes</>}
        </button>

        <button onClick={() => setShowDeleteConfirm(true)}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #FECACA", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={14} />Delete Event
        </button>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 44px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Trash2 size={24} style={{ color: "#EF4444" }} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 6px" }}>Delete Event?</h3>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>This cannot be undone. Ticket sales data will be preserved.</p>
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