/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ArrowLeft, Plus, CheckCircle, AlertTriangle,
  Trash2, Ticket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_TAGS } from "@/lib/constants";

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}

export default function AddEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    tags: [] as string[],
    images: [] as string[],
    startDate: "",
    endDate: "",
    isOutdoor: false,
    isFeatured: false,
  });

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    { id: "regular", name: "Regular", price: 0, quantity: 100, sold: 0 },
  ]);

  const [newTicket, setNewTicket] = useState({
    name: "", price: "", quantity: "",
  });

  const addTicketType = () => {
    if (!newTicket.name.trim()) return;
    if (!newTicket.price || Number(newTicket.price) < 0) return;
    if (!newTicket.quantity || Number(newTicket.quantity) <= 0) return;

    setTicketTypes([
      ...ticketTypes,
      {
        id: newTicket.name.toLowerCase().replace(/\s+/g, "_"),
        name: newTicket.name.trim(),
        price: Number(newTicket.price),
        quantity: Number(newTicket.quantity),
        sold: 0,
      },
    ]);
    setNewTicket({ name: "", price: "", quantity: "" });
  };

  const removeTicketType = (id: string) => {
    setTicketTypes(ticketTypes.filter((t) => t.id !== id));
  };

  const updateTicketType = (id: string, field: keyof TicketType, value: any) => {
    setTicketTypes(ticketTypes.map((t) =>
      t.id === id ? { ...t, [field]: field === "name" ? value : Number(value) } : t
    ));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const minPrice = ticketTypes.length > 0
    ? Math.min(...ticketTypes.map((t) => t.price))
    : 0;

  const totalCapacity = ticketTypes.reduce((s, t) => s + t.quantity, 0);

  const handleSubmit = async () => {
    setError("");
    if (!form.title.trim()) { setError("Event title is required"); return; }
    if (!form.address.trim()) { setError("Location is required"); return; }
    if (!form.startDate) { setError("Start date is required"); return; }
    if (!form.endDate) { setError("End date is required"); return; }
    if (ticketTypes.length === 0) { setError("Add at least one ticket type"); return; }

    setLoading(true);
    try {
      const { error: insertError } = await (supabase.from("events") as any).insert({
        title: form.title.trim(),
        description: form.description.trim() || "",
        category: form.isOutdoor ? "outdoorsy" : "events",
        event_tags: form.tags,
        is_outdoor: form.isOutdoor,
        google_place_id: "manual",
        address: form.address.trim(),
        lat: 6.5244,
        lng: 3.3792,
        images: form.images,
        start_date: new Date(form.startDate).toISOString(),
        end_date: new Date(form.endDate).toISOString(),
        ticket_price: minPrice,
        ticket_types: ticketTypes,
        total_capacity: totalCapacity,
        is_featured: form.isFeatured,
        is_active: true,
        created_by_admin: true,
        vendor_id: null,
        venue_id: null,
      });

      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => router.push("/admin/events"), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#F7F5FA",
    border: "1.5px solid #E4DCF0",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0A0A0A",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const ToggleRow = ({ label, subtitle, value, onChange }: {
    label: string; subtitle: string; value: boolean; onChange: (v: boolean) => void;
  }) => (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
      <div>
        <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>{subtitle}</p>
      </div>
      <button onClick={() => onChange(!value)}
        style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: value ? "#5B0EA6" : "#E4DCF0", position: "relative", transition: "background-color 0.2s ease", flexShrink: 0 }}>
        <motion.div animate={{ x: value ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#FFFFFF", position: "absolute", top: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
      </button>
    </div>
  );

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </motion.div>
        <p style={{ fontWeight: 900, fontSize: 20, color: "#0A0A0A", margin: 0 }}>Event Created</p>
        <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Redirecting...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Add Event</h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Title */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>EVENT TITLE</p>
          <input type="text" placeholder="e.g. Lagos After Dark" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>DESCRIPTION</p>
          <textarea placeholder="Describe the event..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Location */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>LOCATION</p>
          <input type="text" placeholder="Full venue address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
        </div>

        {/* Dates */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>START</p>
            <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>END</p>
            <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} />
          </div>
        </div>

        {/* Ticket types */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>TICKET CLASSES</p>
              {ticketTypes.length > 0 && (
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
                  {totalCapacity} total capacity · Starts from ₦{minPrice.toLocaleString()}
                </p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "3px 10px" }}>
              <Ticket size={11} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{ticketTypes.length} class{ticketTypes.length !== 1 ? "es" : ""}</span>
            </div>
          </div>

          {/* Existing ticket types */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {ticketTypes.map((ticket) => (
              <div key={ticket.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", border: "1.5px solid #EDE0F7", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => updateTicketType(ticket.id, "name", e.target.value)}
                      placeholder="Class name (e.g. VIP)"
                      style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                  <button onClick={() => removeTicketType(ticket.id)}
                    style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={14} style={{ color: "#EF4444" }} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Price (₦)</p>
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => updateTicketType(ticket.id, "price", e.target.value)}
                      placeholder="0 = Free"
                      style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Quantity</p>
                    <input
                      type="number"
                      value={ticket.quantity}
                      onChange={(e) => updateTicketType(ticket.id, "quantity", e.target.value)}
                      placeholder="100"
                      style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "6px 0 0", borderTop: "1px solid #F2EEF9" }}>
                  <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                    {ticket.price === 0 ? "Free entry" : `₦${ticket.price.toLocaleString()} per ticket`}
                  </span>
                  <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>
                    {ticket.quantity} available
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add new ticket type */}
          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", border: "1.5px dashed #E4DCF0" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Add Ticket Class</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="text" placeholder="Class name (e.g. VVIP)" value={newTicket.name} onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
                style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="number" placeholder="Price (₦)" value={newTicket.price} onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })}
                style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 13 }} />
              <input type="number" placeholder="Qty" value={newTicket.quantity} onChange={(e) => setNewTicket({ ...newTicket, quantity: e.target.value })}
                style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 13 }} />
            </div>
            <button onClick={addTicketType}
              disabled={!newTicket.name.trim()}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: !newTicket.name.trim() ? "#F2EEF9" : "#5B0EA6", color: !newTicket.name.trim() ? "#9E9E9E" : "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: !newTicket.name.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={15} /> Add Class
            </button>
          </div>
        </div>

        {/* Tags */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>EVENT TAGS</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {EVENT_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleTag(tag)}
                style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid", borderColor: form.tags.includes(tag) ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.tags.includes(tag) ? "#EDE0F7" : "#FFFFFF", color: form.tags.includes(tag) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Images */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>IMAGES</p>
          <ImageUpload images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} maxImages={5} folder="events" />
        </div>

        <ToggleRow label="Outdoor Event" subtitle="Appears in Outdoorsy category" value={form.isOutdoor} onChange={(v) => setForm({ ...form, isOutdoor: v })} />
        <ToggleRow label="Featured Event" subtitle="Show on home page trending section" value={form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: loading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {loading ? (
            <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Creating...</>
          ) : (
            <><Plus size={18} />Create Event</>
          )}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}