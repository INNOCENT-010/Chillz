/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, TrendingUp, CheckCircle,
  ChevronDown, ChevronUp, Wallet, Clock,
  Search, X, AlertTriangle, Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPayoutsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"pending" | "available" | "all">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data: vendors } = await (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type, bank_name, bank_account_number, bank_account_name, payout_schedule, users(full_name, email)")
        .eq("kyc_status", "approved");

      const { data: ledger } = await supabase
        .from("ledger_entries")
        .select("*")
        .in("account_type", ["VENDOR_PENDING", "VENDOR_AVAILABLE"])
        .order("created_at", { ascending: false });

      // Get bookings with receipt source of truth
      const { data: bookings } = await (supabase.from("bookings") as any)
        .select("id, vendor_id, reserved_amount, final_amount, status, created_at, users(full_name), venues(name), receipts(subtotal, total, platform_fee)")
        .in("status", ["completed", "confirmed", "receipt_sent", "disputed"])
        .order("created_at", { ascending: false });

      const vendorMap: Record<string, any> = {};
      ((vendors || []) as any[]).forEach((v: any) => {
        vendorMap[v.id] = { ...v, pending: 0, available: 0, entries: [], bookings: [] };
      });

      ((ledger || []) as any[]).forEach((row: any) => {
        if (!vendorMap[row.account_id]) return;
        const val = row.direction === "CREDIT" ? row.amount : -row.amount;
        if (row.account_type === "VENDOR_PENDING") vendorMap[row.account_id].pending += val;
        else vendorMap[row.account_id].available += val;
        vendorMap[row.account_id].entries.push(row);
      });

      ((bookings || []) as any[]).forEach((b: any) => {
        if (vendorMap[b.vendor_id]) vendorMap[b.vendor_id].bookings.push(b);
      });

      const result = Object.values(vendorMap)
        .filter((v: any) => v.pending > 0 || v.available > 0)
        .sort((a: any, b: any) => b.pending - a.pending);

      return {
        vendors: result,
        totalPending: result.reduce((s: number, v: any) => s + Math.max(0, v.pending), 0),
        totalAvailable: result.reduce((s: number, v: any) => s + Math.max(0, v.available), 0),
        vendorsWithPending: result.filter((v: any) => v.pending > 0).length,
      };
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ vendorId, amount }: { vendorId: string; amount: number }) => {
      setProcessingId(vendorId);
      const txId = crypto.randomUUID();

      // Debit VENDOR_PENDING
      const { error: debitErr } = await (supabase.from("ledger_entries") as any).insert({
        transaction_id: txId,
        account_type: "VENDOR_PENDING",
        account_id: vendorId,
        direction: "DEBIT",
        amount,
        note: `Admin released pending balance on ${format(new Date(), "dd MMM yyyy")}`,
        reference_type: "admin_release",
      });
      if (debitErr) throw debitErr;

      // Credit VENDOR_AVAILABLE — vendor can now withdraw
      const { error: creditErr } = await (supabase.from("ledger_entries") as any).insert({
        transaction_id: txId,
        account_type: "VENDOR_AVAILABLE",
        account_id: vendorId,
        direction: "CREDIT",
        amount,
        note: `Balance released — available for withdrawal`,
        reference_type: "admin_release",
      });
      if (creditErr) throw creditErr;

      // Notify vendor
      const vendor = data?.vendors.find((v: any) => v.id === vendorId);
      if (vendor) {
        // Get vendor's user_id
        const { data: vendorRow } = await (supabase.from("vendors") as any)
          .select("user_id")
          .eq("id", vendorId)
          .single() as { data: { user_id: string } | null };
        if (vendorRow?.user_id) {
          await (supabase.from("notifications") as any).insert({
            user_id: vendorRow.user_id,
            title: "Earnings available 💰",
            body: `${formatCurrency(amount)} has been released to your available balance. You can now withdraw from your dashboard.`,
            type: "booking",
            is_read: false,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setProcessingId(null);
    },
    onError: () => setProcessingId(null),
  });

  const filtered = (data?.vendors || []).filter((v: any) => {
    const matchesSearch = !searchQuery ||
      v.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "pending" && v.pending > 0) ||
      (filterStatus === "available" && v.available > 0);
    return matchesSearch && matchesFilter;
  });

  const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    completed:    { bg: "#E0F7EA", color: "#00C853" },
    confirmed:    { bg: "#EDE0F7", color: "#5B0EA6" },
    receipt_sent: { bg: "#FFF8E1", color: "#F59E0B" },
    disputed:     { bg: "#FEF3C7", color: "#D97706" },
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #065F46 0%, #00C853 100%)", padding: "44px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Admin</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 26, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Vendor Payouts
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "0 0 16px" }}>
          Release pending balances so vendors can withdraw
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Pending Release", value: formatCurrency(data?.totalPending || 0), sub: `${data?.vendorsWithPending || 0} vendors` },
            { label: "Available",       value: formatCurrency(data?.totalAvailable || 0), sub: "Vendor can withdraw" },
            { label: "Total Vendors",   value: String(data?.vendors?.length || 0), sub: "with balance" },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 10px" }}>
              <p style={{ fontSize: 15, fontWeight: 900, color: "#FFFFFF", margin: "0 0 1px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", margin: 0, fontWeight: 700 }}>{label}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: 0 }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Info banner */}
        <div style={{ backgroundColor: "#EDE0F7", border: "1px solid #C4A0E8", borderRadius: 14, padding: "11px 14px", display: "flex", gap: 10 }}>
          <AlertTriangle size={15} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
            Releasing a balance moves it from <strong>Pending</strong> → <strong>Available</strong>. The vendor then initiates withdrawal from their own dashboard.
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 4, boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          {(["pending", "available", "all"] as const).map((f) => {
            const counts = {
              pending:   (data?.vendors || []).filter((v: any) => v.pending > 0).length,
              available: (data?.vendors || []).filter((v: any) => v.available > 0).length,
              all:       (data?.vendors || []).length,
            };
            return (
              <button key={f} onClick={() => setFilterStatus(f)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "none", backgroundColor: filterStatus === f ? "#5B0EA6" : "transparent", color: filterStatus === f ? "#FFFFFF" : "#9E9E9E", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                {f}
                {counts[f] > 0 && (
                  <span style={{ backgroundColor: filterStatus === f ? "rgba(255,255,255,0.25)" : "#F2EEF9", color: filterStatus === f ? "#FFFFFF" : "#9E9E9E", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>
                    {counts[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 14px", boxShadow: "0 1px 6px rgba(91,14,166,0.05)" }}>
          <Search size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
          <input type="text" placeholder="Search vendor..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <X size={14} style={{ color: "#9E9E9E" }} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 100, borderRadius: 20, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <TrendingUp size={40} style={{ color: "#E4DCF0", marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 4px" }}>
              {filterStatus === "pending" ? "No pending balances" : "No vendors found"}
            </p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
              {filterStatus === "pending" ? "All balances have been released" : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((vendor: any, i: number) => (
              <motion.div key={vendor.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.07)", border: vendor.pending > 0 ? "1.5px solid #FDE68A" : "1px solid #F2EEF9" }}>

                {/* Vendor header */}
                <div style={{ padding: "16px 16px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Building2 size={15} style={{ color: "#5B0EA6" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 900, fontSize: 14, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {vendor.business_name}
                          </p>
                          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {vendor.users?.full_name} · {vendor.users?.email}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, marginLeft: 40 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                          {vendor.vendor_type?.replace(/_/g, " ")}
                        </span>
                        {vendor.payout_schedule && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#6B6B6B", backgroundColor: "#F2EEF9", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                            {vendor.payout_schedule} payout
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Balance grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div style={{ backgroundColor: vendor.pending > 0 ? "#FFF8E1" : "#F7F5FA", borderRadius: 12, padding: "10px 12px", border: vendor.pending > 0 ? "1px solid #FDE68A" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <Clock size={11} style={{ color: vendor.pending > 0 ? "#D97706" : "#9E9E9E" }} />
                        <p style={{ fontSize: 10, color: vendor.pending > 0 ? "#B45309" : "#9E9E9E", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Pending
                        </p>
                      </div>
                      <p style={{ fontSize: 17, fontWeight: 900, color: vendor.pending > 0 ? "#F59E0B" : "#9E9E9E", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                        {formatCurrency(Math.max(0, vendor.pending))}
                      </p>
                      {vendor.pending > 0 && (
                        <p style={{ fontSize: 10, color: "#D97706", margin: "2px 0 0" }}>Awaiting release</p>
                      )}
                    </div>
                    <div style={{ backgroundColor: vendor.available > 0 ? "#E0F7EA" : "#F7F5FA", borderRadius: 12, padding: "10px 12px", border: vendor.available > 0 ? "1px solid #A7F3D0" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <Wallet size={11} style={{ color: vendor.available > 0 ? "#00C853" : "#9E9E9E" }} />
                        <p style={{ fontSize: 10, color: vendor.available > 0 ? "#065F46" : "#9E9E9E", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Available
                        </p>
                      </div>
                      <p style={{ fontSize: 17, fontWeight: 900, color: vendor.available > 0 ? "#00C853" : "#9E9E9E", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                        {formatCurrency(Math.max(0, vendor.available))}
                      </p>
                      {vendor.available > 0 && (
                        <p style={{ fontSize: 10, color: "#059669", margin: "2px 0 0" }}>Vendor can withdraw</p>
                      )}
                    </div>
                  </div>

                  {/* Bank details */}
                  {vendor.bank_name ? (
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <Wallet size={13} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {vendor.bank_name}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                          {vendor.bank_account_name || "—"} · ****{vendor.bank_account_number?.slice(-4)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: "#FEF2F2", borderRadius: 12, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 6 }}>
                      <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#EF4444", margin: 0, fontWeight: 600 }}>
                        No bank account linked — vendor must add before withdrawing
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setExpandedVendor(expandedVendor === vendor.id ? null : vendor.id)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {expandedVendor === vendor.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Bookings ({vendor.bookings.length})
                    </button>

                    {vendor.pending > 0 && (
                      <button
                        onClick={() => releaseMutation.mutate({ vendorId: vendor.id, amount: vendor.pending })}
                        disabled={processingId === vendor.id}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", backgroundColor: processingId === vendor.id ? "#9E9E9E" : "#00C853", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: processingId === vendor.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: processingId === vendor.id ? "none" : "0 4px 10px rgba(0,200,83,0.25)" }}>
                        {processingId === vendor.id ? (
                          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                        ) : (
                          <><CheckCircle size={14} />Release {formatCurrency(vendor.pending)}</>
                        )}
                      </button>
                    )}

                    {vendor.pending <= 0 && vendor.available > 0 && (
                      <div style={{ flex: 1, padding: "10px 0", borderRadius: 12, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <CheckCircle size={13} style={{ color: "#00C853" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Released</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded bookings */}
                <AnimatePresence>
                  {expandedVendor === vendor.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ borderTop: "1px solid #F2EEF9", padding: "12px 16px 16px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                          Booking History
                        </p>
                        {vendor.bookings.length === 0 ? (
                          <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", padding: "12px 0" }}>No bookings yet</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {vendor.bookings.slice(0, 10).map((b: any) => {
                              // Source of truth: receipt.subtotal → final_amount → reserved_amount
                              const receipt = b.receipts?.[0];
                              const vendorAmount = receipt
                                ? (receipt.subtotal ?? receipt.total) - (receipt.platform_fee ?? Math.round((receipt.subtotal ?? receipt.total) * 0.05))
                                : (b.final_amount ?? b.reserved_amount) * 0.95;
                              const statusStyle = STATUS_COLOR[b.status] || { bg: "#F2EEF9", color: "#9E9E9E" };
                              const venueName = b.venues?.name || "Booking";
                              return (
                                <div key={b.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                      {b.users?.full_name}
                                    </p>
                                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                                      {venueName} · {format(new Date(b.created_at), "dd MMM yyyy")}
                                    </p>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                                      {formatCurrency(vendorAmount)}
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: statusStyle.color, backgroundColor: statusStyle.bg, padding: "2px 6px", borderRadius: 999 }}>
                                      {b.status.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {vendor.bookings.length > 10 && (
                              <p style={{ fontSize: 11, color: "#9E9E9E", textAlign: "center", margin: "4px 0 0" }}>
                                +{vendor.bookings.length - 10} more bookings
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}