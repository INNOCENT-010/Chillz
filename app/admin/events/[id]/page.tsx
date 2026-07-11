/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, CheckCircle, AlertTriangle, Save,
  Trash2, Plus, Calendar, MapPin, Ticket,
  ToggleLeft, ToggleRight, Eye, EyeOff, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { EVENT_TAGS } from "@/lib/constants";

interface TicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTicket, setNewTicket] = useState({ name: "", price: "", quantity: "" });

  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    startDate: "",
    endDate: "",
    isOutdoor: false,
    isFeatured: false,
    isActive: true,
    tags: [] as string[],
    images: [] as string[],
    ticketTypes: [] as TicketType[],
  });

  const { data: event, isLoading } = useQuery({
    queryKey: ["admin-event-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
    staleTime: 0,
  });

  // Populate form when event loads
  useEffect(() => {
    if (!event) return;
    setForm({
      title: event.title || "",
      description: event.description || "",
      address: event.address || "",
      startDate: event.start_date ? format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm") : "",
      endDate: event.end_date ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm") : "",
      isOutdoor: event.is_outdoor || false,
      isFeatured: event.is_featured || false,
      isActive: event.is_active !== false,
      tags: event.event_tags || [],
      images: event.images || [],
      ticketTypes: event.ticket_types || [],
    });
  }, [event]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaving(true);
      setSaveError("");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.startDate) throw new Error("Start date is required");
      if (!form.endDate) throw new Error("End date is required");

      const minPrice = form.ticketTypes.length > 0
        ? Math.min(...form.ticketTypes.map((t) => t.price))
        : 0;
      const totalCapacity = form.ticketTypes.reduce((s, t) => s + t.quantity, 0);

      const { error } = await (supabase.from("events") as any)
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          address: form.address.trim(),
          start_date: new Date(form.startDate).toISOString(),
          end_date: new Date(form.endDate).toISOString(),
          is_outdoor: form.isOutdoor,
          is_featured: form.isFeatured,
          is_active: form.isActive,
          event_tags: form.tags,
          images: form.images,
          ticket_types: form.ticketTypes,
          ticket_price: minPrice,
          total_capacity: totalCapacity,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSaving(false);
      setSaveSuccess(true);
      qc.invalidateQueries({ queryKey: ["admin-event-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (e: any) => {
      setSaving(false);
      setSaveError(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      router.push("/admin/events");
    },
  });

  const addTicketType = () => {
    if (!newTicket.name.trim()) return;
    if (Number(newTicket.price) < 0) return;
    if (Number(newTicket.quantity) <= 0) return;

    const newType: TicketType = {
      id: newTicket.name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now(),
      name: newTicket.name.trim(),
      price: Number(newTicket.price),
      quantity: Number(newTicket.quantity),
      sold: 0,
    };
    setForm((prev) => ({ ...prev, ticketTypes: [...prev.ticketTypes, newType] }));
    setNewTicket({ name: "", price: "", quantity: "" });
  };

  const updateTicketType = (ticketId: string, field: keyof TicketType, value: any) => {
    setForm((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.map((t) =>
        t.id === ticketId ? { ...t, [field]: field === "name" ? value : Number(value) } : t
      ),
    }));
  };

  const removeTicketType = (ticketId: string) => {
    setForm((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((t) => t.id !== ticketId),
    }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#F7F5FA",
    border: "1.5px solid #E4DCF0",
    borderRadius: 12,
    padding: "11px 14px",
    fontSize: 14,
    color: "#0A0A0A",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const isExpired = event ? new Date(event.end_date) < new Date() : false;
  const totalSold = form.ticketTypes.reduce((s, t) => s + (t.sold || 0), 0);
  const totalCapacity = form.ticketTypes.reduce((s, t) => s + t.quantity, 0);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, maxWidth: 480, margin: "0 auto" }}>
        <AlertTriangle size={40} style={{ color: "#E4DCF0" }} />
        <p style={{ fontSize: 14, color: "#6B6B6B" }}>Event not found</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 200 }}>
              {form.title || "Edit Event"}
            </h1>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {isExpired ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "1px 7px", borderRadius: 999 }}>Expired</span>
              ) : form.isActive ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#00C853", backgroundColor: "#E0F7EA", padding: "1px 7px", borderRadius: 999 }}>Live</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", backgroundColor: "#F2EEF9", padding: "1px 7px", borderRadius: 999 }}>Hidden</span>
              )}
              {form.isFeatured && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", backgroundColor: "#FEF3C7", padding: "1px 7px", borderRadius: 999 }}>Featured</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: saving ? "#9E9E9E" : saveSuccess ? "#00C853" : "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 2px 8px rgba(91,14,166,0.3)" }}>
          {saving ? (
            <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
          ) : saveSuccess ? (
            <CheckCircle size={14} />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Status banner if expired */}
        {isExpired && (
          <div style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
            <AlertTriangle size={16} style={{ color: "#EF4444", flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#991B1B", margin: "0 0 2px" }}>This event has expired</p>
              <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>
                Ended {format(new Date(event.end_date), "dd MMM yyyy · HH:mm")}. It is hidden from users. Update the dates to reactivate.
              </p>
            </div>
          </div>
        )}

        {/* Ticket sales summary */}
        {form.ticketTypes.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Sold",      value: String(totalSold),               color: "#5B0EA6", bg: "#EDE0F7", icon: Ticket },
              { label: "Remaining", value: String(totalCapacity - totalSold), color: "#00C853", bg: "#E0F7EA", icon: Users },
              { label: "Revenue",   value: formatCurrency(form.ticketTypes.reduce((s, t) => s + t.price * (t.sold || 0), 0)), color: "#D97706", bg: "#FEF3C7", icon: Ticket },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 900, color, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Event is Live",  sub: "Visible to users on the app",    key: "isActive"   as const, activeColor: "#00C853" },
            { label: "Featured Event", sub: "Show in trending / home section", key: "isFeatured" as const, activeColor: "#D97706" },
            { label: "Outdoor Event",  sub: "Appears in Outdoorsy category",   key: "isOutdoor"  as const, activeColor: "#5B0EA6" },
          ].map(({ label, sub, key, activeColor }) => (
            <div key={key} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>{sub}</p>
              </div>
              <button onClick={() => setForm((prev) => ({ ...prev, [key]: !prev[key] }))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {form[key]
                  ? <ToggleRight size={32} style={{ color: activeColor }} />
                  : <ToggleLeft size={32} style={{ color: "#E4DCF0" }} />}
              </button>
            </div>
          ))}
        </div>

        {/* Title */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Event Title</p>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event title..." style={inputStyle} />
        </div>

        {/* Description */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Description</p>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the event..." rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        {/* Location */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            <MapPin size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />Location
          </p>
          <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full venue address..." style={inputStyle} />
        </div>

        {/* Dates */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
            <Calendar size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />Dates & Times
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 5px" }}>Start</p>
              <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 5px" }}>End</p>
              <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }} />
            </div>
          </div>
          {form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate) && (
            <p style={{ fontSize: 11, color: "#EF4444", margin: "6px 0 0" }}>⚠ End date is before start date</p>
          )}
        </div>

        {/* Ticket types */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              <Ticket size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />Ticket Classes
            </p>
            <span style={{ fontSize: 11, color: "#9E9E9E" }}>
              {totalSold}/{totalCapacity} sold
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {form.ticketTypes.map((ticket) => {
              const remaining = ticket.quantity - (ticket.sold || 0);
              const soldPct = ticket.quantity > 0 ? Math.round((ticket.sold || 0) / ticket.quantity * 100) : 0;
              return (
                <div key={ticket.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #EDE0F7" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input type="text" value={ticket.name} onChange={(e) => updateTicketType(ticket.id, "name", e.target.value)}
                      placeholder="Class name" style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 13, fontWeight: 700, backgroundColor: "#FFFFFF" }} />
                    <button onClick={() => removeTicketType(ticket.id)}
                      style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trash2 size={14} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>Price (₦)</p>
                      <input type="number" value={ticket.price} onChange={(e) => updateTicketType(ticket.id, "price", e.target.value)}
                        style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, backgroundColor: "#FFFFFF" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>Capacity</p>
                      <input type="number" value={ticket.quantity} onChange={(e) => updateTicketType(ticket.id, "quantity", e.target.value)}
                        style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, backgroundColor: "#FFFFFF" }} />
                    </div>
                  </div>

                  {/* Sales bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#9E9E9E" }}>{ticket.sold || 0} sold · {remaining} remaining</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: soldPct >= 90 ? "#EF4444" : soldPct >= 70 ? "#D97706" : "#5B0EA6" }}>
                      {soldPct}%
                    </span>
                  </div>
                  <div style={{ height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${soldPct}%`, backgroundColor: soldPct >= 90 ? "#EF4444" : soldPct >= 70 ? "#D97706" : "#5B0EA6", borderRadius: 999, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add ticket type */}
          <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "12px 14px", border: "1.5px dashed #E4DCF0" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px" }}>Add Ticket Class</p>
            <input type="text" placeholder="Class name (e.g. VIP)" value={newTicket.name}
              onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
              style={{ ...inputStyle, marginBottom: 8, backgroundColor: "#FFFFFF", padding: "8px 12px", fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="number" placeholder="Price (₦)" value={newTicket.price}
                onChange={(e) => setNewTicket({ ...newTicket, price: e.target.value })}
                style={{ ...inputStyle, flex: 1, backgroundColor: "#FFFFFF", padding: "8px 12px", fontSize: 13 }} />
              <input type="number" placeholder="Qty" value={newTicket.quantity}
                onChange={(e) => setNewTicket({ ...newTicket, quantity: e.target.value })}
                style={{ ...inputStyle, flex: 1, backgroundColor: "#FFFFFF", padding: "8px 12px", fontSize: 13 }} />
            </div>
            <button onClick={addTicketType} disabled={!newTicket.name.trim() || !newTicket.quantity}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", backgroundColor: !newTicket.name.trim() ? "#F2EEF9" : "#5B0EA6", color: !newTicket.name.trim() ? "#9E9E9E" : "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: !newTicket.name.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} />Add Class
            </button>
          </div>
        </div>

        {/* Tags */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Event Tags</p>
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
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Images</p>
          <ImageUpload images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} maxImages={5} folder="events" />
        </div>

        {/* Error */}
        <AnimatePresence>
          {saveError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{saveError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save button */}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saving}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: saving ? "#9E9E9E" : saveSuccess ? "#00C853" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saving ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {saving
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
            : saveSuccess
            ? <><CheckCircle size={16} />Saved!</>
            : <><Save size={16} />Save Changes</>}
        </button>

        {/* View on app */}
        <button
          onClick={() => router.push(`/events/${id}`)}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Eye size={14} />Preview Event Page
        </button>

        {/* Delete */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={14} />Delete Event
        </button>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", padding: "24px 20px 48px" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />
              <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Trash2 size={24} style={{ color: "#EF4444" }} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: "#0A0A0A", textAlign: "center", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                Delete this event?
              </h3>
              <p style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
                <strong>{form.title}</strong> will be permanently removed. This cannot be undone. Existing ticket bookings will remain in the system.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {deleteMutation.isPending
                    ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                    : <><Trash2 size={14} />Yes, Delete</>}
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