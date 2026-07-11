/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { format, subDays } from "date-fns";
import {
  ArrowLeft, Download, Search, X,
  Filter, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  completed:    { color: "#00C853", bg: "#E0F7EA" },
  confirmed:    { color: "#5B0EA6", bg: "#EDE0F7" },
  active:       { color: "#5B0EA6", bg: "#EDE0F7" },
  checked_in:   { color: "#00C853", bg: "#E0F7EA" },
  receipt_sent: { color: "#F59E0B", bg: "#FFF8E1" },
  disputed:     { color: "#D97706", bg: "#FEF3C7" },
  cancelled:    { color: "#EF4444", bg: "#FEF2F2" },
  pending:      { color: "#9E9E9E", bg: "#F2EEF9" },
};

const DATE_PRESETS = [
  { label: "Today",   days: 1 },
  { label: "7 days",  days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All",     days: 0 },
];

export default function AdminSplitsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dateDays, setDateDays] = useState(30);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "booking" | "ticket">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-splits", dateDays],
    queryFn: async () => {
      // ── Bookings ──────────────────────────────────────────────────────
      let bookingQuery = supabase
        .from("bookings")
        .select("*, users(full_name, email), venues(name, category), events(title), receipts(subtotal, total, platform_fee, status)")
        .not("status", "eq", "pending")
        .order("created_at", { ascending: false });
      if (dateDays > 0) {
        bookingQuery = bookingQuery.gte("created_at", subDays(new Date(), dateDays).toISOString());
      }
      const { data: bookings } = await bookingQuery;

      // ── Tickets ───────────────────────────────────────────────────────
      let ticketQuery = (supabase.from("tickets") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (dateDays > 0) {
        ticketQuery = ticketQuery.gte("created_at", subDays(new Date(), dateDays).toISOString());
      }
      const { data: rawTickets } = await ticketQuery;

      // Enrich tickets
      let enrichedTickets: any[] = [];
      if (rawTickets?.length) {
        const userIds = [...new Set(rawTickets.map((t: any) => t.user_id))];
        const eventIds = [...new Set(rawTickets.map((t: any) => t.event_id).filter(Boolean))];
        const { data: tUsers } = await supabase.from("users").select("id, full_name, email").in("id", userIds as string[]);
        const { data: tEvents } = await supabase.from("events").select("id, title").in("id", eventIds as string[]);
        const usersMap = Object.fromEntries((tUsers || []).map((u: any) => [u.id, u]));
        const eventsMap = Object.fromEntries((tEvents || []).map((e: any) => [e.id, e]));
        enrichedTickets = rawTickets.map((t: any) => ({
          ...t,
          users: usersMap[t.user_id] || null,
          events: eventsMap[t.event_id] || null,
        }));
      }

      // ── Normalise bookings ────────────────────────────────────────────
      const bookingSplits = (bookings || []).map((b: any) => {
        const receipt = b.receipts?.[0];
        const gross = receipt?.subtotal ?? b.final_amount ?? b.reserved_amount;
        const chillzFee = receipt?.platform_fee ?? Math.round(gross * 0.05);
        const vendorShare = gross - chillzFee;
        return {
          id: b.id,
          _type: "booking" as const,
          date: b.created_at,
          reference: b.id.slice(0, 8).toUpperCase(),
          venue: b.venues?.name || b.events?.title || "N/A",
          category: b.venues?.category || "event",
          user: b.users?.full_name || "Unknown",
          userEmail: b.users?.email || "",
          gross,
          chillzFee,
          vendorShare,
          reservedAmount: b.reserved_amount,
          status: b.status,
          hasReceipt: !!receipt?.subtotal,
          isEstimated: !receipt?.subtotal,
          ticketTypeName: null,
        };
      });

      // ── Normalise tickets ─────────────────────────────────────────────
      const ticketSplits = enrichedTickets.map((t: any) => {
        const gross = t.amount_paid || 0;
        const chillzFee = Math.round(gross * 0.05);
        const vendorShare = gross - chillzFee;
        const displayStatus = t.status === "checked_in" ? "checked_in" : t.status === "cancelled" ? "cancelled" : "active";
        return {
          id: t.id,
          _type: "ticket" as const,
          date: t.created_at,
          reference: t.id.slice(0, 8).toUpperCase(),
          venue: t.events?.title || "Event Ticket",
          category: "ticket",
          user: t.users?.full_name || "Unknown",
          userEmail: t.users?.email || "",
          gross,
          chillzFee,
          vendorShare,
          reservedAmount: gross,
          status: displayStatus,
          hasReceipt: true,
          isEstimated: false,
          ticketTypeName: t.ticket_type_name || null,
        };
      });

      // ── Merge & sort ──────────────────────────────────────────────────
      const splits = [...bookingSplits, ...ticketSplits].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const totals = splits.reduce(
        (acc, row) => {
          if (row.status !== "cancelled") {
            acc.gross += row.gross;
            acc.chillzFee += row.chillzFee;
            acc.vendorShare += row.vendorShare;
          }
          return acc;
        },
        { gross: 0, chillzFee: 0, vendorShare: 0 }
      );

      let running = 0;
      const withRunning = [...splits].reverse().map((row) => {
        if (row.status !== "cancelled") running += row.chillzFee;
        return { ...row, runningTotal: running };
      }).reverse();

      return { splits: withRunning, totals };
    },
    staleTime: 1000 * 60,
  });

  const filtered = (data?.splits || [])
    .filter((row: any) => {
      const matchSearch = !search ||
        row.venue.toLowerCase().includes(search.toLowerCase()) ||
        row.user.toLowerCase().includes(search.toLowerCase()) ||
        row.reference.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      const matchType = typeFilter === "all" || row._type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a: any, b: any) => {
      const mult = sortDir === "desc" ? -1 : 1;
      if (sortBy === "date") return mult * (new Date(a.date).getTime() - new Date(b.date).getTime());
      return mult * (a.gross - b.gross);
    });

  const handleExport = () => {
    const headers = ["Type", "Date", "Reference", "Venue/Event", "Category", "User", "Gross (₦)", "Chillz 5% (₦)", "Vendor 95% (₦)", "Status", "Ticket Type"];
    const rows = filtered.map((row: any) => [
      row._type,
      format(new Date(row.date), "dd/MM/yyyy HH:mm"),
      row.reference,
      `"${row.venue}"`,
      row.category,
      `"${row.user}"`,
      row.gross,
      row.chillzFee,
      row.vendorShare,
      row.status,
      row.ticketTypeName || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chillz-splits-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: "date" | "amount") => {
    if (sortBy === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  const bookingCount = (data?.splits || []).filter((r: any) => r._type === "booking").length;
  const ticketCount = (data?.splits || []).filter((r: any) => r._type === "ticket").length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #92400E, #D97706)", padding: "44px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Dashboard</span>
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 24, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Income Splits</h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "0 0 14px" }}>
              {bookingCount} bookings · {ticketCount} tickets
            </p>
          </div>
          <button onClick={handleExport}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "8px 14px", cursor: "pointer", color: "#FFFFFF", fontSize: 12, fontWeight: 700 }}>
            <Download size={14} />CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Gross", value: formatCurrency(data?.totals.gross || 0) },
            { label: "Chillz (5%)", value: formatCurrency(data?.totals.chillzFee || 0) },
            { label: "Vendors (95%)", value: formatCurrency(data?.totals.vendorShare || 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>{label}</p>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Date presets */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {DATE_PRESETS.map(({ label, days }) => (
            <button key={label} onClick={() => setDateDays(days)}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 999, border: "1.5px solid", borderColor: dateDays === days ? "#D97706" : "#E4DCF0", backgroundColor: dateDays === days ? "#FEF3C7" : "#FFFFFF", color: dateDays === days ? "#D97706" : "#6B6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Type filter pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "all",     label: "All" },
            { id: "booking", label: "🏛️ Bookings" },
            { id: "ticket",  label: "🎟️ Tickets" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTypeFilter(id as any)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid", borderColor: typeFilter === id ? "#5B0EA6" : "#E4DCF0", backgroundColor: typeFilter === id ? "#EDE0F7" : "#FFFFFF", color: typeFilter === id ? "#5B0EA6" : "#6B6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 12px" }}>
            <Search size={14} style={{ color: "#9E9E9E", flexShrink: 0 }} />
            <input type="text" placeholder="Search venue, user, ref..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0A0A", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#9E9E9E" }} /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ width: 44, height: 44, borderRadius: 12, border: "1.5px solid", borderColor: showFilters ? "#D97706" : "#E4DCF0", backgroundColor: showFilters ? "#FEF3C7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Filter size={16} style={{ color: showFilters ? "#D97706" : "#9E9E9E" }} />
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["all", "completed", "confirmed", "active", "checked_in", "receipt_sent", "disputed", "cancelled"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: "5px 12px", borderRadius: 999, border: "1.5px solid", borderColor: statusFilter === s ? "#D97706" : "#E4DCF0", backgroundColor: statusFilter === s ? "#FEF3C7" : "#FFFFFF", color: statusFilter === s ? "#D97706" : "#6B6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#9E9E9E" }}>Sort by:</span>
          {(["date", "amount"] as const).map((f) => (
            <button key={f} onClick={() => toggleSort(f)}
              style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 10px", borderRadius: 999, border: "1.5px solid", borderColor: sortBy === f ? "#5B0EA6" : "#E4DCF0", backgroundColor: sortBy === f ? "#EDE0F7" : "#FFFFFF", color: sortBy === f ? "#5B0EA6" : "#6B6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {f}
              {sortBy === f && (sortDir === "desc" ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#9E9E9E", marginLeft: "auto" }}>{filtered.length} rows</span>
        </div>

        {/* Chillz income card */}
        <div style={{ background: "linear-gradient(135deg, #92400E, #D97706)", borderRadius: 18, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
              Chillz Income ({dateDays === 0 ? "All Time" : `Last ${dateDays}d`})
            </p>
            <p style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)", letterSpacing: "-0.02em" }}>
              {formatCurrency(data?.totals.chillzFee || 0)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "4px 0 0" }}>
              Bookings + ticket sales combined
            </p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={24} style={{ color: "#FFFFFF" }} />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 70, borderRadius: 14, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No transactions found</p>
            <p style={{ fontSize: 12, color: "#9E9E9E" }}>Try adjusting the date range or filters</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 64px", gap: 6, padding: "6px 12px" }}>
              {["Transaction", "Gross", "Chillz", "Vendor", "Status"].map((h) => (
                <p key={h} style={{ fontSize: 9, fontWeight: 700, color: "#9E9E9E", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h !== "Transaction" ? "right" : "left" }}>{h}</p>
              ))}
            </div>

            {filtered.map((row: any, i: number) => {
              const s = STATUS_COLOR[row.status] || { color: "#9E9E9E", bg: "#F2EEF9" };
              const isExpanded = expandedRow === row.id;
              const isTicket = row._type === "ticket";
              return (
                <motion.div key={row.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(91,14,166,0.05)", border: `1px solid ${row.status === "cancelled" ? "#FECACA" : isTicket ? "#EDE0F7" : "#F2EEF9"}` }}>
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "11px 12px", display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 64px", gap: 6, alignItems: "center", textAlign: "left", opacity: row.status === "cancelled" ? 0.6 : 1 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                          {isTicket && (
                            <span style={{ fontSize: 9, flexShrink: 0 }}>🎟️</span>
                          )}
                          <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{row.venue}</p>
                          {row.isEstimated && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: "#D97706", backgroundColor: "#FEF3C7", padding: "1px 5px", borderRadius: 999, flexShrink: 0 }}>est</span>
                          )}
                        </div>
                        <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                          #{row.reference} · {format(new Date(row.date), "dd MMM")}
                          {row.ticketTypeName && <span style={{ color: "#7B2FBE" }}> · {row.ticketTypeName}</span>}
                        </p>
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A", margin: 0, textAlign: "right" }}>{formatCurrency(row.gross)}</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#D97706", margin: 0, textAlign: "right" }}>{formatCurrency(row.chillzFee)}</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6", margin: 0, textAlign: "right" }}>{formatCurrency(row.vendorShare)}</p>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                          {row.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: "hidden" }}>
                          <div style={{ borderTop: "1px solid #F2EEF9", padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                              { label: "Type",             value: isTicket ? "🎟️ Ticket Sale" : "🏛️ Venue Booking" },
                              { label: "ID",               value: row.id },
                              { label: "User",             value: `${row.user} (${row.userEmail})` },
                              { label: "Category",         value: row.category.replace(/-/g, " ") },
                              ...(row.ticketTypeName ? [{ label: "Ticket Type", value: row.ticketTypeName }] : []),
                              { label: "Date & Time",      value: format(new Date(row.date), "dd MMM yyyy · HH:mm") },
                              { label: "Gross Amount",     value: formatCurrency(row.gross) },
                              ...(!isTicket ? [{ label: "Originally Reserved", value: formatCurrency(row.reservedAmount) }] : []),
                              { label: "Chillz 5%",        value: formatCurrency(row.chillzFee) },
                              { label: "Vendor 95%",       value: formatCurrency(row.vendorShare) },
                              { label: "Running Chillz",   value: formatCurrency(row.runningTotal) },
                              { label: "Source",           value: isTicket ? "Direct ticket purchase" : row.hasReceipt ? "Confirmed receipt" : "Reserved amount (estimated)" },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                <span style={{ fontSize: 11, color: "#9E9E9E", flexShrink: 0 }}>{label}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: label === "Source" && row.isEstimated ? "#D97706" : "#0A0A0A", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}

            {/* Totals row */}
            <div style={{ backgroundColor: "#3D0066", borderRadius: 14, padding: "12px", display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 64px", gap: 6, alignItems: "center", marginTop: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                TOTALS ({filtered.filter((r: any) => r.status !== "cancelled").length} rows)
              </p>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF", margin: 0, textAlign: "right" }}>
                {formatCurrency(filtered.filter((r: any) => r.status !== "cancelled").reduce((s: number, r: any) => s + r.gross, 0))}
              </p>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#FCD34D", margin: 0, textAlign: "right" }}>
                {formatCurrency(filtered.filter((r: any) => r.status !== "cancelled").reduce((s: number, r: any) => s + r.chillzFee, 0))}
              </p>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#A78BFA", margin: 0, textAlign: "right" }}>
                {formatCurrency(filtered.filter((r: any) => r.status !== "cancelled").reduce((s: number, r: any) => s + r.vendorShare, 0))}
              </p>
              <div />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}