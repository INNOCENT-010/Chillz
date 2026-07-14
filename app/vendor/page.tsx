/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, QrCode, Star, TrendingUp, Clock,
  AlertTriangle, Building2, Calendar, Tag, UtensilsCrossed,
  Car, Home, Plus, ChevronRight, X, Layers, Hotel,
  Shield, Camera, Ticket, Bell, Package, Edit2, Upload,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BillSheet } from "@/components/vendor/bill-sheet";
import { RejectedScreen } from "@/components/vendor/rejected-screen";
import { VendorHeader } from "@/components/vendor/vendor-header";
import { OverviewTab } from "@/components/vendor/tabs/overview-tab";
import { DisputeTab } from "@/components/vendor/tabs/dispute-tab";

type VendorTab = "overview" | "events" | "tickets" | "menu" | "offers" | "packages" | "listings" | "withdraw" | "my-place" | "disputes" | "posts" | "profile";

function getMyPlaceLabel(t: string) {
  if (t === "hotel") return "My Hotel";
  if (t === "car_rental") return "My Fleet";
  if (t === "apartment") return "My Property";
  return "My Venue";
}
function getMyPlaceIcon(t: string) {
  if (t === "hotel") return Hotel;
  if (t === "car_rental") return Car;
  if (t === "apartment") return Home;
  return Building2;
}
function getMyPlaceRoute(t: string) {
  if (t === "hotel") return "/vendor/hotel";
  if (t === "car_rental") return "/vendor/fleet";
  if (t === "apartment") return "/vendor/property";
  return "/vendor/venue";
}
function getListingsLabel(t: string) {
  if (t === "car_rental") return "Vehicles";
  if (t === "hotel") return "Rooms";
  return "Units";
}
function getListingsIcon(t: string) {
  return t === "car_rental" ? Car : Home;
}
function getAddListingLabel(t: string) {
  if (t === "car_rental") return "Add Vehicle";
  if (t === "hotel") return "Add Room / Suite";
  return "Add Unit";
}

function getTabs(type: string, hasVenue?: boolean) {
  const T: Record<string, any> = {
    overview:  { id: "overview",  label: "Overview",             icon: TrendingUp },
    myPlace:   { id: "my-place",  label: getMyPlaceLabel(type),  icon: getMyPlaceIcon(type) },
    events:    { id: "events",    label: "Events",               icon: Calendar },
    tickets:   { id: "tickets",   label: "Tickets",              icon: Ticket },
    menu:      { id: "menu",      label: "Menu",                 icon: UtensilsCrossed },
    offers:    { id: "offers",    label: "Offers",               icon: Tag },
    packages:  { id: "packages",  label: "Packages",             icon: Package },
    listings:  { id: "listings",  label: getListingsLabel(type), icon: getListingsIcon(type) },
    posts:     { id: "posts",     label: "Posts",                icon: Layers },
    disputes:  { id: "disputes",  label: "Disputes",             icon: AlertTriangle },
    withdraw:  { id: "withdraw",  label: "Withdraw",             icon: Wallet },
    profile:   { id: "profile",   label: "Profile",              icon: Edit2 },
  };
  switch (type) {
    case "venue":
      return hasVenue
        ? [T.overview, T.myPlace, T.events, T.tickets, T.menu, T.packages, T.posts, T.disputes, T.withdraw]
        : [T.overview, T.events, T.tickets, T.menu, T.packages, T.posts, T.disputes, T.withdraw];
    case "event_organizer":
      return [T.overview, T.profile, T.events, T.tickets, T.posts, T.disputes, T.withdraw];
    case "hotel":
    case "car_rental":
    case "apartment":
      return [T.overview, T.myPlace, T.listings, T.offers, T.posts, T.disputes, T.withdraw];
    default:
      return [T.overview, T.disputes, T.withdraw];
  }
}

// ── Tickets Tab ───────────────────────────────────────────────────────────
function TicketsTab({ vendor }: { vendor: any }) {
  const router = useRouter();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["vendor-tickets-events", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, start_date, images, capacity, tickets_sold, ticket_price, ticket_types")
        .eq("vendor_id", vendor.id)
        .order("start_date", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: eventTickets = [] } = useQuery({
    queryKey: ["vendor-event-tickets", expandedEvent],
    queryFn: async () => {
      if (!expandedEvent) return [];
      const { data } = await (supabase.from("tickets") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("event_id", expandedEvent)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!expandedEvent,
    staleTime: 0,
  });

  const totalTicketsSold = events.reduce((acc: number, e: any) => acc + (e.tickets_sold || 0), 0);
  const totalRevenue = events.reduce((acc: number, e: any) => {
    const price = e.ticket_price ||
      (e.ticket_types?.length > 0
        ? Math.min(...e.ticket_types.map((t: any) => t.price || 0))
        : 0);
    return acc + ((e.tickets_sold || 0) * price);
  }, 0);

  if (isLoading) return (
    <motion.div key="tickets-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 16, backgroundColor: "#F2EEF9" }} />)}
    </motion.div>
  );

  return (
    <motion.div key="tickets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Total Sold</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{totalTicketsSold}</p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>across {events.length} event{events.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Gross Revenue</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: "#00C853", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(totalRevenue)}</p>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>before 5% fee</p>
        </div>
      </div>

      <Link href="/vendor/earnings?tab=tickets" style={{ textDecoration: "none" }}>
        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={15} style={{ color: "#5B0EA6" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#5B0EA6" }}>Full Ticket Earnings Report</span>
          </div>
          <ChevronRight size={14} style={{ color: "#7B2FBE" }} />
        </div>
      </Link>

      {events.length === 0 ? (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
          <Ticket size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
          <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No events yet</p>
          <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Create an event to start selling tickets.</p>
        </div>
      ) : events.map((event: any) => {
        const isExpanded = expandedEvent === event.id;
        const soldCount = event.tickets_sold || 0;
        const capacity = event.capacity;
        const price = event.ticket_price ||
          (event.ticket_types?.length > 0
            ? Math.min(...event.ticket_types.map((t: any) => t.price || 0))
            : 0);
        const revenue = soldCount * price;
        const fillPct = capacity ? Math.min(100, Math.round((soldCount / capacity) * 100)) : null;

        return (
          <div key={event.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 8px rgba(91,14,166,0.06)", border: "1.5px solid #F0EBF8" }}>
            <button onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", backgroundColor: "transparent", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: "#EDE0F7", overflow: "hidden", flexShrink: 0 }}>
                {event.images?.[0]
                  ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Ticket size={20} style={{ color: "#7B2FBE" }} /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.title}</p>
                <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: "0 0 4px" }}>{format(new Date(event.start_date), "dd MMM yyyy · HH:mm")}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>{soldCount} sold</span>
                  {capacity && <span style={{ fontSize: 11, color: "#9E9E9E" }}>of {capacity}</span>}
                  {revenue > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>· {formatCurrency(revenue)}</span>}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "#C4BAD8", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }} />
            </button>

            {fillPct !== null && (
              <div style={{ height: 3, backgroundColor: "#F2EEF9", margin: "0 14px" }}>
                <div style={{ height: "100%", width: `${fillPct}%`, backgroundColor: fillPct >= 90 ? "#EF4444" : fillPct >= 60 ? "#F59E0B" : "#00C853", borderRadius: 999, transition: "width 0.5s ease" }} />
              </div>
            )}

            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                  <div style={{ borderTop: "1px solid #F2EEF9", padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <button onClick={() => router.push(`/vendor/events/${event.id}`)}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #EDE0F7", backgroundColor: "#F7F5FA", color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Edit Event
                      </button>
                      <Link href="/vendor/earnings?tab=tickets" style={{ flex: 1, textDecoration: "none" }}>
                        <button style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          Full Report
                        </button>
                      </Link>
                    </div>
                    {eventTickets.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", padding: "12px 0", margin: 0 }}>No tickets sold yet</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Buyers ({eventTickets.length})</p>
                        {eventTickets.map((ticket: any) => (
                          <div key={ticket.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F7F5FA" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                              {ticket.users?.avatar_url
                                ? <img src={ticket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{ticket.users?.full_name?.[0]}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{ticket.users?.full_name || "Guest"}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {ticket.ticket_type_name && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#7B2FBE", backgroundColor: "#EDE0F7", padding: "1px 6px", borderRadius: 999 }}>{ticket.ticket_type_name}</span>
                                )}
                                <span style={{ fontSize: 10, color: "#9E9E9E" }}>{format(new Date(ticket.created_at), "dd MMM, HH:mm")}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6", margin: "0 0 2px" }}>{ticket.amount_paid > 0 ? formatCurrency(ticket.amount_paid) : "Free"}</p>
                              <span style={{ fontSize: 9, fontWeight: 700, color: ticket.status === "checked_in" ? "#00C853" : "#5B0EA6", backgroundColor: ticket.status === "checked_in" ? "#E0F7EA" : "#EDE0F7", padding: "1px 6px", borderRadius: 999 }}>
                                {ticket.status === "checked_in" ? "Admitted" : "Confirmed"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
}
// ── Organizer Profile Tab ─────────────────────────────────────────────────
function OrganizerProfileTab({ vendor, qc }: { vendor: any; qc: any }) {
  const [form, setForm] = useState({
    business_name: vendor.business_name || "",
    description:   vendor.description   || "",
    instagram:     vendor.instagram     || "",
    phone:         vendor.phone         || "",
    whatsapp:      vendor.whatsapp      || "",
    website:       vendor.website       || "",
    contact_email: vendor.contact_email || "",
  });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl,       setLogoUrl]       = useState<string | null>(vendor.avatar_url || null);
  const logoRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendor?.id) return;
    setUploadingLogo(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `organizer-logos/${vendor.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chillz-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("chillz-images").getPublicUrl(path);
      const url = urlData.publicUrl;
      await (supabase.from("vendors") as any).update({ avatar_url: url }).eq("id", vendor.id);
      setLogoUrl(url);
      qc.invalidateQueries({ queryKey: ["vendor"] });
    } catch (e: any) {
      console.error("Logo upload failed:", e.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!vendor?.id) return;
    setSaving(true);
    try {
      await (supabase.from("vendors") as any).update({
        business_name: form.business_name.trim() || null,
        description:   form.description.trim()   || null,
        instagram:     form.instagram.trim()      || null,
        phone:         form.phone.trim()          || null,
        whatsapp:      form.whatsapp.trim()       || null,
        website:       form.website.trim()        || null,
        contact_email: form.contact_email.trim()  || null,
      }).eq("id", vendor.id);
      qc.invalidateQueries({ queryKey: ["vendor"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      console.error("Save failed:", e.message);
    } finally {
      setSaving(false);
    }
  };

  const ACCENT = "#5B0EA6";

  const field = (label: string, key: keyof typeof form, placeholder: string, type = "text") => (
    <div key={key}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{label}</p>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Logo / Avatar */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, alignSelf: "flex-start" }}>Organizer Logo</p>

        <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
          style={{ position: "relative", width: 100, height: 100, borderRadius: 24, overflow: "hidden", border: `2.5px dashed ${uploadingLogo ? "#9E9E9E" : ACCENT}`, backgroundColor: "#F7F5FA", cursor: uploadingLogo ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Upload size={22} style={{ color: ACCENT }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>Upload</span>
            </div>
          )}
          {uploadingLogo && (
            <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
            </div>
          )}
        </button>

        {logoUrl && (
          <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
            style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: "4px 12px", backgroundColor: "#EDE0F7", borderRadius: 999 }}>
            Change Logo
          </button>
        )}
        <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
      </div>

      {/* Text fields */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Business Info</p>
        {field("Business Name",  "business_name", "e.g. LLD Events")}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>About / Bio</p>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Tell guests about your events and what makes you unique..."
            rows={4}
            style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }}
          />
        </div>
      </div>

      {/* Contact fields */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Contact & Socials</p>
        {field("Phone",         "phone",         "+234...")}
        {field("WhatsApp",      "whatsapp",      "+234...")}
        {field("Instagram",     "instagram",     "@yourhandle")}
        {field("Website",       "website",       "https://...")}
        {field("Contact Email", "contact_email", "hello@yourbrand.com", "email")}
      </div>

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: saved ? "#059669" : saving ? "#9E9E9E" : `linear-gradient(135deg, #3B0764, ${ACCENT})`, color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saved ? "0 4px 16px rgba(5,150,105,0.3)" : "0 4px 16px rgba(91,14,166,0.3)", transition: "background 0.3s" }}>
        {saving ? (
          <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Saving...</>
        ) : saved ? (
          "✓ Saved!"
        ) : (
          <><Edit2 size={16} />Save Profile</>
        )}
      </button>
    </div>
  );
}
export default function VendorDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<VendorTab>("overview");
  const [billingBooking, setBillingBooking] = useState<any>(null);
  const [expiredOffersBanner, setExpiredOffersBanner] = useState<string[]>([]);

  const bellAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bellToast, setBellToast] = useState<{ body: string; bookingRef: string } | null>(null);
  const bellDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: v } = await supabase.from("vendors").select("*").eq("user_id", user.id).maybeSingle();
      if (!v) return null;
      if ((v as any).venue_id) {
        const { data: venueData } = await (supabase.from("venues") as any)
          .select("id, images, name, dress_policy, dress_policy_strictness, dress_policy_description, picture_policy")
          .eq("id", (v as any).venue_id).maybeSingle();
        const business_name = (v as any).business_name || venueData?.name || null;
        return { ...(v as any), business_name, venues: venueData } as any;
      }
      return v as any;
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (!vendor?.user_id) return;
    bellAudioRef.current = new Audio("/sounds/bell.mp3");
    bellAudioRef.current.volume = 1.0;

    // Unlock audio on first user gesture — browsers block autoplay
    // until the audio element has been interacted with on this page
    const unlock = () => {
      if (!bellAudioRef.current) return;
      bellAudioRef.current.play().then(() => {
        bellAudioRef.current!.pause();
        bellAudioRef.current!.currentTime = 0;
      }).catch(() => {});
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);
    const channel = supabase
      .channel(`waiter-calls-${vendor.user_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "notifications",
        filter: `user_id=eq.${vendor.user_id}`,
      }, (payload: any) => {
        if (payload.new?.type !== "waiter_call") return;
        bellAudioRef.current?.play().catch(() => {});
        const bookingRef = payload.new.reference_id
          ? String(payload.new.reference_id).slice(0, 8).toUpperCase()
          : "";
        setBellToast({ body: payload.new.body || "A guest is calling for a waiter", bookingRef });
        if (bellDismissRef.current) clearTimeout(bellDismissRef.current);
        bellDismissRef.current = setTimeout(() => setBellToast(null), 10000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (bellDismissRef.current) clearTimeout(bellDismissRef.current);
    };
  }, [vendor?.user_id]);

  const heroImage: string | null = vendor?.venues?.images?.[0] || vendor?.images?.[0] || null;

  const { data: ledger } = useQuery({
    queryKey: ["vendor-balance", vendor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("direction, amount, account_type")
        .eq("account_id", vendor.id as unknown as string)
        .in("account_type", ["VENDOR_PENDING", "VENDOR_AVAILABLE"]);
      console.log("LEDGER DEBUG:", { vendorId: vendor.id, data, error });
      let pending = 0, available = 0;
      ((data || []) as any[]).forEach((r: any) => {
        const val = r.direction === "CREDIT" ? r.amount : -r.amount;
        if (r.account_type === "VENDOR_PENDING") pending += val;
        else if (r.account_type === "VENDOR_AVAILABLE") available += val;
      });
      return { pending, available };
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: checkedInBookings = [] } = useQuery({
    queryKey: ["vendor-checked-in", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, users(full_name, avatar_url, email, phone)")
        .eq("vendor_id", vendor.id).eq("status", "checked_in")
        .order("checked_in_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 8000,
  });

  const { data: receiptSentBookings = [] } = useQuery({
    queryKey: ["vendor-receipt-sent", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, users(full_name, avatar_url), receipts(total, subtotal, status)")
        .eq("vendor_id", vendor.id).eq("status", "receipt_sent")
        .order("receipt_sent_at", { ascending: false }).limit(10);
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const { data: recentBookings = [] } = useQuery({
    queryKey: ["vendor-recent-bookings", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select("*, users(full_name), receipts!receipts_booking_id_fkey(subtotal, total, platform_fee, status)")
        .eq("vendor_id", vendor.id)
        .in("status", ["completed", "confirmed", "disputed"])
        .order("created_at", { ascending: false }).limit(5);
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 30,
  });

  const { data: recentTickets = [] } = useQuery({
    queryKey: ["vendor-recent-tickets", vendor?.id],
    queryFn: async () => {
      const { data: tix } = await (supabase.from("tickets") as any)
        .select("*").eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false }).limit(5);
      if (!tix?.length) return [];
      const userIds = [...new Set(tix.map((t: any) => t.user_id))];
      const { data: users } = await supabase.from("users").select("id, full_name, avatar_url").in("id", userIds as string[]);
      const usersMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
      const eventIds = [...new Set(tix.map((t: any) => t.event_id).filter(Boolean))];
      const { data: evts } = await supabase.from("events").select("id, title").in("id", eventIds as string[]);
      const eventsMap = Object.fromEntries((evts || []).map((e: any) => [e.id, e]));
      return tix.map((t: any) => ({ ...t, users: usersMap[t.user_id] || null, events: eventsMap[t.event_id] || null }));
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const { data: disputedBookings = [] } = useQuery({
    queryKey: ["vendor-disputes", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("vendor_id", vendor.id).eq("status", "disputed")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["vendor-menu", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_menu").select("*")
        .eq("vendor_id", vendor.id).eq("is_available", true).order("category");
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 60,
  });

  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["vendor-offers", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("offers").select("*")
        .eq("vendor_id", vendor.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id && ["hotel", "car_rental", "apartment"].includes(vendor?.vendor_type),
    staleTime: 1000 * 60,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["vendor-events", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events").select("*")
        .eq("vendor_id", vendor.id).order("start_date", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id && ["venue", "event_organizer"].includes(vendor?.vendor_type),
    staleTime: 1000 * 60,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["vendor-listings", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_listings").select("*")
        .eq("vendor_id", vendor.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!vendor?.id && ["apartment", "car_rental", "hotel"].includes(vendor?.vendor_type),
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!offers.length || !vendor?.id) return;
    const now = new Date();
    const expired = offers.filter((o: any) => o.is_active && o.valid_until && new Date(o.valid_until) < now);
    if (!expired.length) return;
    (supabase.from("offers") as any).update({ is_active: false }).in("id", expired.map((o: any) => o.id)).then(() => {
      setExpiredOffersBanner(expired.map((o: any) => o.title));
      refetchOffers();
    });
  }, [offers]);

  if (!user) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 24px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <Building2 size={40} style={{ color: "#9E9E9E" }} />
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0 }}>Vendor Dashboard</h2>
      <button onClick={() => router.push("/login?redirect=/vendor")}
        style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Sign In
      </button>
    </div>
  );

  if (vendorLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!vendor) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <Building2 size={40} style={{ color: "#9E9E9E" }} />
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: 0 }}>Not a vendor yet</h2>
      <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Signed in as {user.email}</p>
      <button onClick={() => router.push("/vendor/register")}
        style={{ background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Apply as Vendor
      </button>
    </div>
  );

  if (vendor.kyc_status === "pending") return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 28px" }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: 0 }}>{vendor.business_name}</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "4px 0 0", textTransform: "capitalize" }}>{vendor.vendor_type?.replace(/_/g, " ")}</p>
      </div>
      <div style={{ padding: "24px 16px" }}>
        <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 20, padding: "24px", textAlign: "center" }}>
          <Clock size={32} style={{ color: "#D97706", marginBottom: 12 }} />
          <h3 style={{ fontWeight: 900, fontSize: 17, color: "#92400E", margin: "0 0 8px" }}>Application Under Review</h3>
          <p style={{ fontSize: 13, color: "#B45309", margin: 0 }}>Your application is being reviewed. This typically takes up to 24 hours.</p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (vendor.kyc_status === "rejected") return (
    <RejectedScreen vendor={vendor} router={router} qc={qc} user={user} />
  );

  const tabs         = getTabs(vendor.vendor_type, !!vendor.venue_id);
  const myPlaceRoute = getMyPlaceRoute(vendor.vendor_type);
  const myPlaceLabel = getMyPlaceLabel(vendor.vendor_type);
  const myPlaceIcon  = getMyPlaceIcon(vendor.vendor_type);
  const disputeCount = disputedBookings.length;

  const quickActions = [
    { href: "/vendor/scan",     icon: QrCode,      label: "Scan QR",    color: "#5B0EA6", bg: "#EDE0F7" },
    { href: "/vendor/reviews",  icon: Star,        label: "Reviews",    color: "#00C853", bg: "#E0F7EA" },
    { href: "/vendor/earnings", icon: TrendingUp,  label: "Earnings",   color: "#E07B00", bg: "#FFF3E0" },
    { href: myPlaceRoute,       icon: myPlaceIcon, label: myPlaceLabel, color: "#7B2FBE", bg: "#F3E8FF" },
    { href: "/vendor/posts",    icon: Layers,      label: "Posts",      color: "#2563EB", bg: "#EFF6FF" },
  ];

  const myPlaceLinks = () => {
    if (vendor.vendor_type === "venue") return [
      { label: "Details & Images", subtitle: "Name, description, features, photos",      href: "/vendor/venue",            icon: Building2,       color: "#5B0EA6", bg: "#EDE0F7" },
      { label: "Opening Hours",    subtitle: "Set daily open and close times",            href: "/vendor/venue?tab=hours",  icon: Clock,           color: "#F59E0B", bg: "#FFF8E1" },
      { label: "Menu Manager",     subtitle: "Type items, upload images & PDFs",          href: "/vendor/venue/menu-files", icon: UtensilsCrossed, color: "#00C853", bg: "#E0F7EA" },
      { label: "Packages",         subtitle: "VIP tables, bottle service, curated menus", href: "/vendor/packages",         icon: Package,         color: "#7B2FBE", bg: "#F3E8FF" },
      { label: "Events",           subtitle: "Manage events at your venue",               href: "/vendor/venue?tab=events", icon: Calendar,        color: "#E07B00", bg: "#FFF3E0" },
      { label: "Video Links",      subtitle: "YouTube, TikTok, Instagram, Facebook",     href: "/vendor/venue/videos",     icon: Layers,          color: "#2563EB", bg: "#EFF6FF" },
      { label: "Dress Code",       subtitle: "Set dress requirements for entry",          href: "/vendor/venue/dress-code", icon: Shield,          color: "#EF4444", bg: "#FEF2F2" },
      { label: "Photo Policy",     subtitle: "Rules around photography at your venue",    href: "/vendor/venue/dress-code", icon: Camera,          color: "#D97706", bg: "#FFF8E1" },
    ];
    if (vendor.vendor_type === "hotel") return [
      { label: "Hotel Details",  subtitle: "Images, description, facilities", href: "/vendor/hotel",        icon: Building2, color: "#5B0EA6", bg: "#EDE0F7" },
      { label: "Rooms & Suites", subtitle: "Add and manage room types",       href: "/vendor/listings/add", icon: Layers,    color: "#D97706", bg: "#FEF3C7" },
      { label: "Offers",         subtitle: "Create deals for guests",         href: "/vendor/offers/add",   icon: Tag,       color: "#7B2FBE", bg: "#F3E8FF" },
    ];
    if (vendor.vendor_type === "car_rental") return [
      { label: "Business Details", subtitle: "Images, description, location", href: "/vendor/fleet",        icon: Car,    color: "#2563EB", bg: "#EFF6FF" },
      { label: "Vehicles",         subtitle: "Add cars to your fleet",        href: "/vendor/listings/add", icon: Car,    color: "#D97706", bg: "#FEF3C7" },
      { label: "Offers",           subtitle: "Create rental deals",           href: "/vendor/offers/add",   icon: Tag,    color: "#7B2FBE", bg: "#F3E8FF" },
    ];
    if (vendor.vendor_type === "apartment") return [
      { label: "Property Details", subtitle: "Images, description, amenities", href: "/vendor/property",     icon: Home,   color: "#059669", bg: "#E0F7EA" },
      { label: "Units",            subtitle: "Add apartment units",            href: "/vendor/listings/add", icon: Layers, color: "#D97706", bg: "#FEF3C7" },
      { label: "Offers",           subtitle: "Create deals for guests",        href: "/vendor/offers/add",   icon: Tag,    color: "#7B2FBE", bg: "#F3E8FF" },
    ];
    return [];
  };

  const menuByCategory: Record<string, any[]> = {};
  menuItems.forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* ── Waiter Bell Toast ── */}
      <AnimatePresence>
        {bellToast && (
          <motion.div
            initial={{ opacity: 0, y: -70 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -70 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 200, backgroundColor: "#F59E0B", borderRadius: 18,
              padding: "14px 16px 14px 14px", display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 8px 32px rgba(245,158,11,0.45)",
              maxWidth: 420, width: "calc(100vw - 32px)",
            }}>
            <motion.div
              animate={{ rotate: [0, -20, 20, -15, 15, -8, 8, 0] }}
              transition={{ duration: 0.7, repeat: 2, repeatDelay: 1.5 }}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bell size={22} style={{ color: "#FFFFFF" }} />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                Waiter Requested 🔔
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {bellToast.body}
              </p>
              {bellToast.bookingRef && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", margin: "2px 0 0", fontFamily: "monospace", fontWeight: 700 }}>
                  Booking #{bellToast.bookingRef}
                </p>
              )}
            </div>
            <button
              onClick={() => { setBellToast(null); if (bellDismissRef.current) clearTimeout(bellDismissRef.current); }}
              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={14} style={{ color: "#FFFFFF" }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <VendorHeader
        vendor={vendor}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        disputeCount={disputeCount}
        heroImage={heroImage}
      />

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        <AnimatePresence>
          {expiredOffersBanner.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <AlertTriangle size={15} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: "0 0 2px" }}>
                  {expiredOffersBanner.length} offer{expiredOffersBanner.length > 1 ? "s" : ""} expired
                </p>
                <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>{expiredOffersBanner.join(", ")}</p>
              </div>
              <button onClick={() => setExpiredOffersBanner([])} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <X size={14} style={{ color: "#D97706" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {activeTab === "overview" && (
            <OverviewTab
              vendor={vendor}
              ledger={ledger}
              checkedInBookings={checkedInBookings}
              receiptSentBookings={receiptSentBookings}
              recentBookings={recentBookings}
              recentTickets={recentTickets}
              disputeCount={disputeCount}
              quickActions={quickActions}
              onSetTab={(t) => setActiveTab(t as VendorTab)}
              onBillGuest={setBillingBooking}
            />
          )}

          {activeTab === "my-place" && (
            <motion.div key="my-place" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {vendor.vendor_type === "venue" && !vendor.venue_id ? (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
                  <Building2 size={28} style={{ color: "#C4BAD8", marginBottom: 16 }} />
                  <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 8px" }}>No venue assigned yet</p>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Once admin approves and links your venue, it will appear here.</p>
                </div>
              ) : (
                <>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 16px rgba(91,14,166,0.07)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{myPlaceLabel}</p>
                    <p style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{vendor.business_name}</p>
                    {myPlaceLinks().map(({ label, subtitle, href, icon: Icon, color, bg }, i) => (
                      <Link key={label} href={href} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < myPlaceLinks().length - 1 ? "1px solid #F7F5FA" : "none" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={20} style={{ color }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{label}</p>
                            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{subtitle}</p>
                          </div>
                          <ChevronRight size={16} style={{ color: "#C4BAD8" }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link href={myPlaceRoute} style={{ textDecoration: "none" }}>
                    <button style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                      Open {myPlaceLabel} Editor
                    </button>
                  </Link>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "tickets" && <TicketsTab vendor={vendor} />}

          {activeTab === "disputes" && (
            <DisputeTab vendor={vendor} user={user} disputedBookings={disputedBookings} />
          )}

          {activeTab === "posts" && (
            <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Link href="/vendor/posts" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)", marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>Create New Post</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Posters, lineups, offers, writeups</p>
                  </div>
                </div>
              </Link>
              <Link href="/vendor/posts" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 3px" }}>Manage Posts</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>View hypes, views and your Discover content</p>
                  </div>
                  <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                </div>
              </Link>
            </motion.div>
          )}

          {activeTab === "events" && (
            <motion.div key="events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/vendor/events/add" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>Add New Event</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Create an event at your venue</p>
                  </div>
                </div>
              </Link>
              {events.length > 0 ? events.map((event: any) => (
                <Link key={event.id} href={`/vendor/events/${event.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", display: "flex", opacity: event.is_active ? 1 : 0.6 }}>
                    <div style={{ width: 72, flexShrink: 0, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
                      {event.images?.[0]
                        ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}><Calendar size={24} style={{ color: "#7B2FBE" }} /></div>}
                    </div>
                    <div style={{ flex: 1, padding: "11px 12px", minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.title}</p>
                      <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: "0 0 3px" }}>{format(new Date(event.start_date), "dd MMM yyyy · HH:mm")}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: event.is_active ? "#00C853" : "#9E9E9E", backgroundColor: event.is_active ? "#E0F7EA" : "#F2EEF9", padding: "2px 7px", borderRadius: 999 }}>
                        {event.is_active ? "Live" : "Hidden"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 12px 0 0" }}>
                      <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                    </div>
                  </div>
                </Link>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
                  <Calendar size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No events yet</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/vendor/venue/menu-files" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>Open Menu Manager</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Type items, upload images & PDFs</p>
                  </div>
                </div>
              </Link>
              {Object.keys(menuByCategory).length > 0 ? Object.entries(menuByCategory).map(([category, items]) => (
                <div key={category}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 4px" }}>{category}</p>
                  {items.map((item: any) => (
                    <Link key={item.id} href="/vendor/venue/menu-files" style={{ textDecoration: "none", display: "block", marginBottom: 6 }}>
                      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
                        {item.image_url
                          ? <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                          : <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UtensilsCrossed size={16} style={{ color: "#5B0EA6" }} /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.name}</p>
                          {item.description && <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.description}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#5B0EA6" }}>{formatCurrency(item.price)}</span>
                          <ChevronRight size={14} style={{ color: "#9E9E9E" }} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
                  <UtensilsCrossed size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No menu items yet</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Open the menu manager to add items.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PACKAGES TAB — replaces offers for venue vendors ── */}
          {activeTab === "packages" && (
            <motion.div key="packages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/vendor/packages" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>Manage Packages</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>VIP tables, bottle service, curated menus</p>
                  </div>
                </div>
              </Link>
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <Package size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5 }}>
                  Packages are bookable experiences customers can select directly from your venue page.
                </p>
              </div>
              <Link href="/vendor/packages" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid #EDE0F7" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 3px" }}>Open Package Manager</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Create, edit, and manage all packages</p>
                  </div>
                  <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                </div>
              </Link>
            </motion.div>
          )}

          {/* ── OFFERS TAB — kept for hotel/car_rental/apartment ── */}
          {activeTab === "offers" && (
            <motion.div key="offers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/vendor/offers/add" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>Add Offer</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Create a deal or promotion</p>
                  </div>
                </div>
              </Link>
              {offers.length > 0 ? offers.map((offer: any) => {
                const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
                return (
                  <Link key={offer.id} href={`/vendor/offers/${offer.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", border: offer.is_active ? "1.5px solid #EDE0F7" : "1.5px solid #F2EEF9", opacity: offer.is_active ? 1 : 0.6 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{offer.title}</p>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#00C853", backgroundColor: "#E0F7EA", padding: "2px 8px", borderRadius: 999 }}>
                              {offer.discount_type === "percentage" ? `${offer.discount_value}% off` : offer.discount_type === "fixed" ? `₦${offer.discount_value} off` : "Freebie"}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: isExpired ? "#EF4444" : offer.is_active ? "#00C853" : "#9E9E9E", backgroundColor: isExpired ? "#FEF2F2" : offer.is_active ? "#E0F7EA" : "#F2EEF9", padding: "2px 8px", borderRadius: 999 }}>
                              {isExpired ? "Expired" : offer.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      </div>
                    </div>
                  </Link>
                );
              }) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
                  <Tag size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No offers yet</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "listings" && (
            <motion.div key="listings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/vendor/listings/add" style={{ textDecoration: "none" }}>
                <div style={{ backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={20} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0 }}>{getAddListingLabel(vendor.vendor_type)}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                      {vendor.vendor_type === "car_rental" ? "List a car for rental" : vendor.vendor_type === "hotel" ? "Add a room or suite" : "List an apartment unit"}
                    </p>
                  </div>
                </div>
              </Link>
              {listings.length > 0 ? listings.map((listing: any) => (
                <Link key={listing.id} href={`/vendor/listings/${listing.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", display: "flex", opacity: listing.is_active ? 1 : 0.6 }}>
                    <div style={{ width: 80, flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                      {listing.images?.[0]
                        ? <img src={listing.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {vendor.vendor_type === "car_rental" ? <Car size={24} style={{ color: "#7B2FBE" }} /> : <Home size={24} style={{ color: "#7B2FBE" }} />}
                          </div>}
                    </div>
                    <div style={{ flex: 1, padding: "11px 12px", minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 3px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{listing.title}</p>
                      <p style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6", margin: "0 0 3px" }}>
                        {formatCurrency(listing.price_per_unit)}<span style={{ fontSize: 10, fontWeight: 400, color: "#9E9E9E" }}>/{listing.unit_label || "night"}</span>
                      </p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: listing.is_active ? "#00C853" : "#9E9E9E", backgroundColor: listing.is_active ? "#E0F7EA" : "#F2EEF9", padding: "2px 7px", borderRadius: 999 }}>
                        {listing.is_active ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
                      <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                    </div>
                  </div>
                </Link>
              )) : (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center" }}>
                  {vendor.vendor_type === "car_rental" ? <Car size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} /> : <Home size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />}
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>Nothing listed yet</p>
                </div>
              )}
            </motion.div>
          )}
          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <OrganizerProfileTab vendor={vendor} qc={qc} />
            </motion.div>
          )}
          {activeTab === "withdraw" && (
            <motion.div key="withdraw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "linear-gradient(135deg, #00C853, #065F46)", borderRadius: 20, padding: 20, boxShadow: "0 4px 20px rgba(0,200,83,0.25)" }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Available to Withdraw</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "#FFFFFF", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{formatCurrency(ledger?.available || 0)}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>Pending: {formatCurrency(ledger?.pending || 0)}</p>
              </div>
              {(ledger?.available || 0) === 0 ? (
                <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 16, padding: "16px 14px", display: "flex", gap: 10 }}>
                  <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: "0 0 2px" }}>No available balance</p>
                    <p style={{ fontSize: 12, color: "#B45309", margin: 0 }}>Complete bookings and send receipts to earn.</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => router.push("/vendor/withdraw")}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: "#00C853", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,200,83,0.3)" }}>
                  <Wallet size={18} />Withdraw {formatCurrency(ledger?.available || 0)}
                </button>
              )}
              {vendor.bank_name && (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", boxShadow: "0 1px 8px rgba(91,14,166,0.06)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Saved Bank Details</p>
                  {[
                    { label: "Bank",    value: vendor.bank_name },
                    { label: "Account", value: vendor.bank_account_number },
                    { label: "Name",    value: vendor.bank_account_name },
                  ].filter(({ value }) => !!value).map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F7F5FA" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.6 }}>Chillz deducts a 5% commission from completed bookings.</p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <AnimatePresence>
        {billingBooking && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBillingBooking(null)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 60 }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
            >
              <BillSheet
                booking={billingBooking}
                vendorType={vendor?.vendor_type || ""}
                vendorId={vendor?.id || ""}
                onClose={() => setBillingBooking(null)}
                onSent={() => {
                  setBillingBooking(null);
                  qc.invalidateQueries({ queryKey: ["vendor-checked-in"] });
                  qc.invalidateQueries({ queryKey: ["vendor-receipt-sent"] });
                  qc.invalidateQueries({ queryKey: ["vendor-overview"] });
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}