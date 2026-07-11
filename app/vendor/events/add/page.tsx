/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, CheckCircle, AlertTriangle,
  Plus, Trash2, MapPin, Lock, Search, X,
  ImageIcon, Users, Clock, Ticket, ChevronRight,
  Music, Zap, Compass,
} from "lucide-react";

// Step 1 — single-select card pill category
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

// Step 2 — full original multi-select tag list (filtering only, never shown on cards)
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

interface TicketType {
  name: string;
  price: string;
  slots: string;
  description: string;
  classification: string;
}

const CLASSIFICATIONS = ["regular", "vip", "vvip", "early_bird", "table", "student"];

export default function AddEventPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const imageRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    crowd_type: "Mixed",
    event_type: "",          // single-select — drives card pill
    event_tags: [] as string[], // multi-select — filtering only
    is_outdoor: false,
    is_active: true,
    capacity: "",
    age_restriction: "",
    dress_code: "",
    images: [] as string[],
  });

  const [djLineupInput, setDjLineupInput] = useState("");
  const [djLineup, setDjLineup] = useState<string[]>([]);

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketType>({
    name: "", price: "", slots: "", description: "", classification: "regular",
  });

  const [venueSearch, setVenueSearch] = useState("");
  const [showVenueSearch, setShowVenueSearch] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [customAddress, setCustomAddress] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("*, venues(id, name, address, images)")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const isEventOrganizer = vendor?.vendor_type === "event_organizer";
  const venue = vendor?.venues;

  const { data: venueResults } = useQuery({
    queryKey: ["venue-search", venueSearch],
    queryFn: async () => {
      if (!venueSearch.trim() || venueSearch.length < 2) return [];
      const { data } = await supabase
        .from("venues")
        .select("id, name, address, images")
        .ilike("name", `%${venueSearch}%`)
        .eq("is_active", true)
        .limit(8);
      return (data || []) as any[];
    },
    enabled: venueSearch.length >= 2,
    staleTime: 1000 * 30,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendor?.id) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `event-covers/${vendor.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("vendor-media")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("vendor-media").getPublicUrl(path);
      setForm((p) => ({ ...p, images: [...p.images, urlData.publicUrl] }));
    } catch (err: any) {
      setError("Image upload failed: " + err.message);
    } finally {
      setUploadingImage(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  };

  const addDj = () => {
    const val = djLineupInput.trim();
    if (!val) return;
    setDjLineup((prev) => [...prev, val]);
    setDjLineupInput("");
  };

  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendor not found");
      if (!form.title.trim()) throw new Error("Event title is required");
      if (!form.start_date) throw new Error("Start date is required");
      if (!form.event_type) throw new Error("Please select an event category");

      if (!isEventOrganizer && !vendor.venue_id)
        throw new Error("No venue assigned to your account");

      if (isEventOrganizer && !selectedVenue && !customAddress.trim())
        throw new Error("Please tag a venue or enter a custom address");

      const payload: any = {
        vendor_id: vendor.id,
        organizer_vendor_id: isEventOrganizer ? vendor.id : null,
        venue_id: isEventOrganizer
          ? (selectedVenue?.id || null)
          : (vendor.venue_id || null),
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        event_tags: form.event_tags,
        start_date: new Date(form.start_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        crowd_type: form.crowd_type,
        is_outdoor: form.is_outdoor,
        is_active: form.is_active,
        capacity: form.capacity ? Number(form.capacity) : null,
        age_restriction: form.age_restriction.trim() || null,
        dress_code: form.dress_code.trim() || null,
        dj_lineup: djLineup.length > 0 ? djLineup : null,
        custom_venue_address: isEventOrganizer && useCustomAddress
          ? customAddress.trim()
          : null,
        ticket_types: ticketTypes.length > 0
          ? ticketTypes.map((t) => ({
              name: t.name,
              price: Number(t.price) || 0,
              slots: Number(t.slots) || null,
              description: t.description || null,
              classification: t.classification || "regular",
              available: Number(t.slots) || null,
              sold: 0,
            }))
          : null,
        images: form.images,
        tickets_sold: 0,
        is_featured: false,
      };

      const { data: event, error: err } = await (supabase.from("events") as any)
        .insert(payload)
        .select()
        .single();
      if (err) throw err;
      return event;
    },
    onSuccess: (event) => {
      setSuccess("Event created successfully!");
      setTimeout(() => {
        router.push(isEventOrganizer
          ? `/vendor/events/${event.id}`
          : "/vendor/venue");
      }, 1200);
    },
    onError: (e: any) => setError(e.message),
  });

  const addTicket = () => {
    if (!ticketForm.name.trim() || !ticketForm.price) return;
    setTicketTypes((prev) => [...prev, { ...ticketForm }]);
    setTicketForm({ name: "", price: "", slots: "", description: "", classification: "regular" });
    setShowTicketForm(false);
  };

  const toggleTag = (tag: string) => {
    setForm((p) => ({
      ...p,
      event_tags: p.event_tags.includes(tag)
        ? p.event_tags.filter((t) => t !== tag)
        : [...p.event_tags, tag],
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#6B6B6B",
    textTransform: "uppercase", letterSpacing: "0.06em",
    margin: "0 0 6px", display: "block",
  };

  if (!vendor) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 60 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 24px" }}>
        <button onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          {isEventOrganizer ? "Create Event" : "Add Event"}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>
          {isEventOrganizer ? "Host an event at any CHILLZ venue" : "Create a new event at your venue"}
        </p>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={15} style={{ color: "#00C853" }} />
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

        {/* Cover image */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          {form.images.length > 0 ? (
            <div style={{ position: "relative", height: 180 }}>
              <img src={form.images[0]} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => setForm((p) => ({ ...p, images: [] }))}
                style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} style={{ color: "#FFFFFF" }} />
              </button>
            </div>
          ) : (
            <button onClick={() => imageRef.current?.click()} disabled={uploadingImage}
              style={{ width: "100%", height: 130, border: "none", backgroundColor: "#F7F5FA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {uploadingImage
                ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                : <>
                    <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ImageIcon size={20} style={{ color: "#5B0EA6" }} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6", margin: 0 }}>Upload Cover Image</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Recommended: 1200 × 630px</p>
                  </>}
            </button>
          )}
          <input ref={imageRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
        </div>

        {/* Venue */}
        {!isEventOrganizer && venue && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #EDE0F7" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
              {venue.images?.[0]
                ? <img src={venue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={18} style={{ color: "#5B0EA6" }} /></div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{venue.name}</p>
              {venue.address && <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{venue.address}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#EDE0F7", borderRadius: 8, padding: "4px 8px", flexShrink: 0 }}>
              <Lock size={11} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6" }}>Locked</span>
            </div>
          </div>
        )}

        {isEventOrganizer && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={labelStyle}>Venue *</p>
            {!useCustomAddress ? (
              <>
                {selectedVenue ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "#EDE0F7", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, backgroundColor: "#C4A0E8" }}>
                      {selectedVenue.images?.[0]
                        ? <img src={selectedVenue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={18} style={{ color: "#5B0EA6" }} /></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#3D0066", margin: "0 0 2px" }}>{selectedVenue.name}</p>
                      <p style={{ fontSize: 11, color: "#7B2FBE", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{selectedVenue.address}</p>
                    </div>
                    <button onClick={() => setSelectedVenue(null)}
                      style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(91,14,166,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={13} style={{ color: "#5B0EA6" }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "12px 14px" }}>
                      <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="text" placeholder="Search venues on CHILLZ..."
                        value={venueSearch}
                        onChange={(e) => { setVenueSearch(e.target.value); setShowVenueSearch(true); }}
                        onFocus={() => setShowVenueSearch(true)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                      {venueSearch && (
                        <button onClick={() => { setVenueSearch(""); setShowVenueSearch(false); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          <X size={13} style={{ color: "#9E9E9E" }} />
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {showVenueSearch && venueResults && venueResults.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, backgroundColor: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", marginTop: 4, overflow: "hidden", border: "1px solid #F2EEF9" }}>
                          {venueResults.map((v: any) => (
                            <button key={v.id}
                              onClick={() => { setSelectedVenue(v); setVenueSearch(""); setShowVenueSearch(false); }}
                              style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "none", backgroundColor: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F7F5FA" }}>
                              <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                                {v.images?.[0]
                                  ? <img src={v.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={14} style={{ color: "#5B0EA6" }} /></div>}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px" }}>{v.name}</p>
                                <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v.address}</p>
                              </div>
                              <ChevronRight size={14} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <button onClick={() => { setUseCustomAddress(true); setSelectedVenue(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9E9E9E", fontSize: 12, padding: 0, textAlign: "left", textDecoration: "underline" }}>
                  Venue not on CHILLZ? Enter address manually
                </button>
              </>
            ) : (
              <>
                <input type="text" placeholder="e.g. 15 Bode Thomas, Surulere, Lagos"
                  value={customAddress} onChange={(e) => setCustomAddress(e.target.value)}
                  style={inputStyle} />
                <button onClick={() => { setUseCustomAddress(false); setCustomAddress(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, padding: 0, textAlign: "left", textDecoration: "underline" }}>
                  Search CHILLZ venues instead
                </button>
              </>
            )}
          </div>
        )}

        {/* Main form */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>

          <div>
            <label style={labelStyle}>Event Title *</label>
            <input type="text" placeholder="e.g. Saturday Night Party"
              value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea placeholder="Describe the event..." value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
          </div>

          <div>
            <label style={labelStyle}>Crowd Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {CROWD_TYPES.map((type) => (
                <button key={type} onClick={() => setForm((p) => ({ ...p, crowd_type: type }))}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: form.crowd_type === type ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.crowd_type === type ? "#EDE0F7" : "#FFFFFF", color: form.crowd_type === type ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── STEP 1: Event Category — single-select, drives card pill ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Zap size={14} style={{ color: "#5B0EA6" }} />
            <label style={{ ...labelStyle, margin: 0 }}>Event Category *</label>
          </div>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 12px" }}>
            Pick ONE — this shows as the badge users see on your event card
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EVENT_TYPES.map(({ id, emoji, color, bg }) => {
              const active = form.event_type === id;
              return (
                <button key={id} onClick={() => setForm((p) => ({ ...p, event_type: id }))}
                  style={{ padding: "9px 14px", borderRadius: 999, border: "1.5px solid", borderColor: active ? color : "#E4DCF0", backgroundColor: active ? bg : "#FFFFFF", color: active ? color : "#3A3A3A", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{emoji}</span>{id}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── STEP 2: Additional Tags — multi-select, filtering only ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Compass size={14} style={{ color: "#5B0EA6" }} />
            <label style={{ ...labelStyle, margin: 0 }}>Additional Tags <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span></label>
          </div>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 12px" }}>
            Pick any that apply — these help users find your event through search filters, not shown on the card
          </p>
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

        {/* Dates */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Start Date & Time *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "12px 14px" }}>
              <Calendar size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
              <input type="datetime-local" value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>End Date & Time <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "12px 14px" }}>
              <Clock size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
              <input type="datetime-local" value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
            </div>
          </div>
        </div>

        {/* DJ Lineup */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Music size={14} style={{ color: "#5B0EA6" }} />
            <label style={{ ...labelStyle, margin: 0 }}>DJ / Performer Lineup <span style={{ fontWeight: 400, color: "#C4BAD8", textTransform: "none" }}>(optional)</span></label>
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

        {/* Settings */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "Outdoor", key: "is_outdoor" as const },
              { label: "Published", key: "is_active" as const },
            ].map(({ label, key }) => (
              <div key={key} style={{ flex: 1, backgroundColor: "#F7F5FA", borderRadius: 12, padding: "11px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>{label}</span>
                <button onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))}
                  style={{ width: 38, height: 20, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: form[key] ? "#5B0EA6" : "#E4DCF0", position: "relative", flexShrink: 0 }}>
                  <motion.div animate={{ x: form[key] ? 18 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Capacity</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "11px 12px" }}>
                <Users size={14} style={{ color: "#9E9E9E" }} />
                <input type="number" placeholder="Max" value={form.capacity}
                  onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Age Limit</label>
              <input type="text" placeholder="e.g. 18+"
                value={form.age_restriction}
                onChange={(e) => setForm((p) => ({ ...p, age_restriction: e.target.value }))}
                style={{ ...inputStyle, padding: "11px 12px" }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Dress Code</label>
            <input type="text" placeholder="e.g. Smart Casual"
              value={form.dress_code}
              onChange={(e) => setForm((p) => ({ ...p, dress_code: e.target.value }))}
              style={inputStyle} />
          </div>
        </div>

        {/* Ticket types */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Ticket Types</label>
            <button onClick={() => setShowTicketForm(!showTicketForm)}
              style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
              <Plus size={13} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>Add Ticket</span>
            </button>
          </div>

          {ticketTypes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {ticketTypes.map((ticket, i) => (
                <div key={i} style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{ticket.name}</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                      {ticket.price === "0" || !ticket.price ? "Free" : formatCurrency(Number(ticket.price))} · {ticket.slots || "Unlimited"} slots · {ticket.classification}
                    </p>
                  </div>
                  <button onClick={() => setTicketTypes((p) => p.filter((_, idx) => idx !== i))}
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
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, border: "1px solid #EDE0F7", marginBottom: 8 }}>
                  <input type="text" placeholder="Ticket name (e.g. VIP, Regular)"
                    value={ticketForm.name}
                    onChange={(e) => setTicketForm((p) => ({ ...p, name: e.target.value }))}
                    style={inputStyle} />

                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                      <input type="number" placeholder="Price (0 = Free)"
                        value={ticketForm.price}
                        onChange={(e) => setTicketForm((p) => ({ ...p, price: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 12, padding: "10px 12px" }}>
                      <Ticket size={13} style={{ color: "#9E9E9E" }} />
                      <input type="number" placeholder="Slots"
                        value={ticketForm.slots}
                        onChange={(e) => setTicketForm((p) => ({ ...p, slots: e.target.value }))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Classification</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CLASSIFICATIONS.map((cls) => (
                        <button key={cls} onClick={() => setTicketForm((p) => ({ ...p, classification: cls }))}
                          style={{ padding: "5px 10px", borderRadius: 999, border: "1.5px solid", borderColor: ticketForm.classification === cls ? "#5B0EA6" : "#E4DCF0", backgroundColor: ticketForm.classification === cls ? "#EDE0F7" : "#FFFFFF", color: ticketForm.classification === cls ? "#5B0EA6" : "#6B6B6B", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                          {cls.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input type="text" placeholder="Description (optional)"
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
                    style={inputStyle} />

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowTicketForm(false)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button onClick={addTicket}
                      style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Add Ticket Type
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {ticketTypes.length === 0 && !showTicketForm && (
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, textAlign: "center", padding: "8px 0" }}>
              No ticket types added. Add at least one, or leave empty for free entry.
            </p>
          )}
        </div>

        <button
          onClick={() => { setError(""); addEventMutation.mutate(); }}
          disabled={addEventMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: addEventMutation.isPending ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: addEventMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)", marginTop: 4 }}>
          {addEventMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Creating...</>
            : <><Calendar size={17} />Publish Event</>}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}