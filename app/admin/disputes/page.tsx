/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, AlertTriangle, CheckCircle, Send,
  XCircle, MessageCircle, X, User, Building2,
  Shield, Paperclip, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RESOLUTION_LABELS = [
  { value: "user_wins",   label: "Refund User (Full)",   desc: "Full reserved amount returned to user",          color: "#00C853", bg: "#E0F7EA" },
  { value: "vendor_wins", label: "Release to Vendor",    desc: "95% released to vendor, 5% fee to Chillz",      color: "#5B0EA6", bg: "#EDE0F7" },
  { value: "split",       label: "Split 50/50",          desc: "Half to user, half to vendor (minus 5% fee)",   color: "#F59E0B", bg: "#FFF8E1" },
];

export default function AdminDisputesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeDispute, setActiveDispute] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [resolution, setResolution] = useState("");
  const [showResolution, setShowResolution] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, users(full_name, email, phone, id), venues(name, address), receipts(*)")
        .eq("status", "disputed")
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["dispute-messages", activeDispute?.id],
    queryFn: async () => {
      if (!activeDispute?.id) return [];
      const { data } = await (supabase.from("dispute_messages") as any)
        .select("*")
        .eq("booking_id", activeDispute.id)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!activeDispute?.id,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!activeDispute?.id) return;
    const channel = supabase
      .channel(`dispute-${activeDispute.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "dispute_messages",
        filter: `booking_id=eq.${activeDispute.id}`,
      }, () => refetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDispute?.id]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  // Post system message when dispute is opened for first time
  useEffect(() => {
    if (!activeDispute) return;
    const msgs = messages || [];
    if (msgs.length === 0) {
      // Post initial admin message
      (supabase.from("dispute_messages") as any).insert({
        booking_id: activeDispute.id,
        sender_id: null,
        sender_role: "admin",
        message: `⚖️ Chillz Support has opened this dispute thread.\n\nBooking: #${activeDispute.id.slice(0, 8).toUpperCase()}\nVenue: ${activeDispute.venues?.name || "N/A"}\nAmount in dispute: ${formatCurrency(activeDispute.reserved_amount)}\n\nBoth parties have been notified. Please provide your account of the issue. Admin will review and resolve within 8 hours.`,
      }).then(() => refetchMessages());

      // Notify user
      if (activeDispute.user_id) {
        (supabase.from("notifications") as any).insert({
          user_id: activeDispute.user_id,
          title: "Dispute thread opened",
          body: "Chillz support has opened a mediation thread for your dispute. Check your support inbox.",
          type: "dispute",
          reference_id: activeDispute.id,
          is_read: false,
        });
      }
      // Notify vendor
      if (activeDispute.vendor_id) {
        (supabase.from("notifications") as any).insert({
          user_id: activeDispute.vendor_id,
          title: "Dispute thread opened",
          body: "Chillz support has opened a mediation thread for your booking dispute.",
          type: "dispute",
          reference_id: activeDispute.id,
          is_read: false,
        });
      }
    }
  }, [activeDispute?.id, messages?.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `disputes/${activeDispute.id}/${Date.now()}-admin.${ext}`;
        const { error } = await supabase.storage
          .from("support-attachments")
          .upload(path, file, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage
            .from("support-attachments")
            .getPublicUrl(path);
          uploaded.push(urlData.publicUrl);
        }
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {}
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if ((!message.trim() && attachments.length === 0) || !activeDispute) return;
      await (supabase.from("dispute_messages") as any).insert({
        booking_id: activeDispute.id,
        sender_id: null,
        sender_role: "admin",
        message: message.trim() || "(attachment)",
        attachments,
      });
      // Notify both parties
      const notifyIds = [activeDispute.user_id, activeDispute.vendor_id].filter(Boolean);
      for (const uid of notifyIds) {
        await (supabase.from("notifications") as any).insert({
          user_id: uid,
          title: "Chillz Support replied in dispute",
          body: message.trim().slice(0, 100) || "Admin sent an attachment",
          type: "dispute",
          reference_id: activeDispute.id,
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      setMessage("");
      setAttachments([]);
      refetchMessages();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolution || !activeDispute) return;
      setResolving(true);

      const amount = activeDispute.reserved_amount;
      const txId = crypto.randomUUID();

      if (resolution === "user_wins") {
        await (supabase.from("ledger_entries") as any).insert([
          { transaction_id: txId, account_type: "USER_RESERVED", account_id: activeDispute.user_id, direction: "DEBIT", amount, note: "Dispute resolved: full refund", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "USER_WALLET", account_id: activeDispute.user_id, direction: "CREDIT", amount, note: "Dispute refund to user", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
        ]);
      } else if (resolution === "vendor_wins") {
        const fee = Math.round(amount * 0.05);
        await (supabase.from("ledger_entries") as any).insert([
          { transaction_id: txId, account_type: "USER_RESERVED", account_id: activeDispute.user_id, direction: "DEBIT", amount, note: "Dispute resolved: released to vendor", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "VENDOR_PENDING", account_id: activeDispute.vendor_id, direction: "CREDIT", amount: amount - fee, note: "Dispute resolved: vendor payout", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "CHILLZ_REVENUE", account_id: "chillz", direction: "CREDIT", amount: fee, note: "Dispute fee", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
        ]);
      } else if (resolution === "split") {
        const half = Math.round(amount / 2);
        const fee = Math.round(half * 0.05);
        await (supabase.from("ledger_entries") as any).insert([
          { transaction_id: txId, account_type: "USER_RESERVED", account_id: activeDispute.user_id, direction: "DEBIT", amount, note: "Dispute: 50/50 split", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "USER_WALLET", account_id: activeDispute.user_id, direction: "CREDIT", amount: half, note: "Dispute: 50% refund to user", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "VENDOR_PENDING", account_id: activeDispute.vendor_id, direction: "CREDIT", amount: half - fee, note: "Dispute: 50% to vendor", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
          { transaction_id: txId, account_type: "CHILLZ_REVENUE", account_id: "chillz", direction: "CREDIT", amount: fee, note: "Dispute fee", reference_id: activeDispute.id, reference_type: "dispute_resolution" },
        ]);
      }

      // Mark booking completed
      await (supabase.from("bookings") as any).update({ status: "completed" }).eq("id", activeDispute.id);

      // Post resolution message in thread
      const resLabel = RESOLUTION_LABELS.find((r) => r.value === resolution);
      await (supabase.from("dispute_messages") as any).insert({
        booking_id: activeDispute.id,
        sender_id: null,
        sender_role: "admin",
        message: `✅ DISPUTE RESOLVED\n\nResolution: ${resLabel?.label}\n${resLabel?.desc}\n\nThis dispute has been closed. The transaction has been processed. Thank you for your patience.`,
        attachments: [],
      });

      // Notify both parties
      const notifyIds = [activeDispute.user_id, activeDispute.vendor_id].filter(Boolean);
      for (const uid of notifyIds) {
        await (supabase.from("notifications") as any).insert({
          user_id: uid,
          title: "Dispute resolved ✓",
          body: `Resolution: ${resLabel?.label}. ${resLabel?.desc}.`,
          type: "dispute",
          reference_id: activeDispute.id,
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      setResolving(false);
      setActiveDispute(null);
      setResolution("");
      setShowResolution(false);
    },
    onError: () => setResolving(false),
  });

  const getHoursAgo = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  const getSenderLabel = (role: string) => {
    if (role === "admin") return "Chillz Support";
    if (role === "user") return activeDispute?.users?.full_name || "User";
    if (role === "vendor") return activeDispute?.venues?.name || "Vendor";
    return role;
  };

  const getSenderColor = (role: string) => {
    if (role === "admin") return { bg: "#5B0EA6", text: "#FFFFFF", bubble: "16px 16px 4px 16px" };
    if (role === "user") return { bg: "#FFFFFF", text: "#0A0A0A", bubble: "16px 16px 16px 4px" };
    if (role === "vendor") return { bg: "#FFF8E1", text: "#0A0A0A", bubble: "16px 16px 16px 4px" };
    return { bg: "#F2EEF9", text: "#0A0A0A", bubble: "16px" };
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #92400E 0%, #D97706 100%)", padding: "44px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Admin</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 26, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Disputes</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0 }}>
          {disputes?.length || 0} open · resolve within 8 hours
        </p>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 140, borderRadius: 20, backgroundColor: "#F2EEF9" }} />
            ))}
          </div>
        ) : !disputes || disputes.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <CheckCircle size={48} style={{ color: "#00C853", marginBottom: 12 }} />
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>No open disputes</p>
            <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>All disputes are resolved</p>
          </div>
        ) : (
          disputes.map((dispute: any, i: number) => {
            const hoursAgo = getHoursAgo(dispute.created_at);
            const urgent = hoursAgo >= 6;
            const receipt = dispute.receipts?.[0];
            const venueName = dispute.venues?.name || "Booking";

            return (
              <motion.div key={dispute.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", border: `1.5px solid ${urgent ? "#FCA5A5" : "#FDE68A"}` }}>

                {urgent && (
                  <div style={{ backgroundColor: "#EF4444", padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={13} style={{ color: "#FFFFFF" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>
                      URGENT — {hoursAgo}h elapsed · deadline in {Math.max(0, 8 - hoursAgo)}h
                    </span>
                  </div>
                )}

                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {venueName}
                      </p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                        #{dispute.id.slice(0, 8).toUpperCase()} · {format(new Date(dispute.created_at), "dd MMM yyyy · HH:mm")}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#D97706", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                        {formatCurrency(dispute.reserved_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Parties */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <User size={11} style={{ color: "#5B0EA6" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", textTransform: "uppercase", letterSpacing: "0.05em" }}>User</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {dispute.users?.full_name}
                      </p>
                      <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {dispute.users?.email}
                      </p>
                    </div>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <Building2 size={11} style={{ color: "#7B2FBE" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", textTransform: "uppercase", letterSpacing: "0.05em" }}>Venue</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {venueName}
                      </p>
                      <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0 }}>
                        {dispute.reject_count} receipt rejection{dispute.reject_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {receipt && (
                    <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "#92400E", margin: 0, fontWeight: 600 }}>
                        Receipt total: {formatCurrency(receipt.total)} · Reserved: {formatCurrency(dispute.reserved_amount)}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => { setActiveDispute(dispute); setMessage(""); setResolution(""); setShowResolution(false); setAttachments([]); }}
                    style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(91,14,166,0.3)" }}>
                    <MessageCircle size={15} />
                    Open Mediation Thread
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Mediation chat sheet */}
      <AnimatePresence>
        {activeDispute && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setActiveDispute(null); setShowResolution(false); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 50 }} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", height: "92vh", display: "flex", flexDirection: "column" }}>

              {/* Chat header */}
              <div style={{ padding: "14px 16px 12px", flexShrink: 0, borderBottom: "1px solid #F2EEF9", backgroundColor: "#FFFFFF" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 14px" }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Shield size={14} style={{ color: "#5B0EA6" }} />
                      <p style={{ fontWeight: 900, fontSize: 14, color: "#0A0A0A", margin: 0 }}>Mediation Thread</p>
                    </div>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>
                      #{activeDispute.id.slice(0, 8).toUpperCase()} · {activeDispute.venues?.name}
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>
                        👤 {activeDispute.users?.full_name}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#7B2FBE", backgroundColor: "#F3E8FF", padding: "2px 8px", borderRadius: 999 }}>
                        🏢 {activeDispute.venues?.name}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", backgroundColor: "#5B0EA6", padding: "2px 8px", borderRadius: 999 }}>
                        ⚖️ Admin
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setShowResolution(!showResolution)}
                      style={{ padding: "6px 12px", borderRadius: 10, border: "none", backgroundColor: showResolution ? "#5B0EA6" : "#EDE0F7", color: showResolution ? "#FFFFFF" : "#5B0EA6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Resolve
                    </button>
                    <button onClick={() => { setActiveDispute(null); setShowResolution(false); }}
                      style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={14} style={{ color: "#6B6B6B" }} />
                    </button>
                  </div>
                </div>

                {/* Amount in dispute */}
                <div style={{ backgroundColor: "#FFF8E1", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>Amount in dispute</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#D97706", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {formatCurrency(activeDispute.reserved_amount)}
                  </span>
                </div>
              </div>

              {/* Resolution panel */}
              <AnimatePresence>
                {showResolution && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EEF9", backgroundColor: "#F7F5FA" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Choose Resolution</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {RESOLUTION_LABELS.map(({ value, label, desc, color, bg }) => (
                          <button key={value} onClick={() => setResolution(value)}
                            style={{ padding: "11px 14px", borderRadius: 12, border: "2px solid", borderColor: resolution === value ? color : "#E4DCF0", backgroundColor: resolution === value ? bg : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{label}</p>
                              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{desc}</p>
                            </div>
                            {resolution === value && <CheckCircle size={16} style={{ color, flexShrink: 0 }} />}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => resolveMutation.mutate()}
                        disabled={!resolution || resolving}
                        style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", backgroundColor: !resolution || resolving ? "#9E9E9E" : "#D97706", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: !resolution || resolving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {resolving
                          ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                          : <><CheckCircle size={15} />Confirm & Close Dispute</>}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, backgroundColor: "#F7F5FA" }}>

                {/* Legend */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {[
                    { label: "User", color: "#0A0A0A", bg: "#FFFFFF" },
                    { label: "Vendor", color: "#92400E", bg: "#FFF8E1" },
                    { label: "Admin ⚖️", color: "#FFFFFF", bg: "#5B0EA6" },
                  ].map(({ label, color, bg }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: bg, border: "1px solid #E4DCF0" }} />
                      <span style={{ fontSize: 10, color: "#9E9E9E" }}>{label}</span>
                    </div>
                  ))}
                </div>

                {!messages || messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <MessageCircle size={28} style={{ color: "#E4DCF0", marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Opening thread...</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isAdmin = msg.sender_role === "admin";
                    const isVendor = msg.sender_role === "vendor";
                    const senderLabel = getSenderLabel(msg.sender_role);
                    const style = getSenderColor(msg.sender_role);

                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "82%" }}>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 3px", textAlign: isAdmin ? "right" : "left", fontWeight: 600 }}>
                            {senderLabel}
                          </p>
                          <div style={{ backgroundColor: style.bg, borderRadius: style.bubble, padding: "10px 14px", boxShadow: isAdmin ? "0 2px 10px rgba(91,14,166,0.2)" : "0 1px 6px rgba(0,0,0,0.06)", border: isAdmin ? "none" : isVendor ? "1px solid #FDE68A" : "1px solid #F2EEF9" }}>
                            {msg.message && msg.message !== "(attachment)" && (
                              <p style={{ fontSize: 13, color: style.text, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {msg.message}
                              </p>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: msg.message && msg.message !== "(attachment)" ? 8 : 0 }}>
                                {msg.attachments.map((url: string, i: number) => (
                                  isImageUrl(url) ? (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "block", borderRadius: 10, overflow: "hidden", maxWidth: 200 }}>
                                      <img src={url} alt="" style={{ width: "100%", display: "block", borderRadius: 10 }} />
                                    </a>
                                  ) : (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: isAdmin ? "rgba(255,255,255,0.15)" : "#F7F5FA", borderRadius: 10, padding: "8px 12px", textDecoration: "none" }}>
                                      <FileText size={14} style={{ color: isAdmin ? "#FFFFFF" : "#5B0EA6", flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: isAdmin ? "#FFFFFF" : "#5B0EA6", fontWeight: 600 }}>
                                        {url.split("/").pop()}
                                      </span>
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0", textAlign: isAdmin ? "right" : "left" }}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "10px 16px 32px", borderTop: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>
                {attachments.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {attachments.map((url, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        {isImageUrl(url) ? (
                          <img src={url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1.5px solid #E4DCF0" }} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FileText size={20} style={{ color: "#5B0EA6" }} />
                          </div>
                        )}
                        <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#EF4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                          <X size={9} style={{ color: "#FFFFFF" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*,.pdf"
                    style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    style={{ width: 38, height: 38, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    {uploading
                      ? <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                      : <Paperclip size={15} style={{ color: "#9E9E9E" }} />}
                  </button>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim() || attachments.length > 0) sendMessageMutation.mutate();
                      }
                    }}
                    placeholder="Type a message as Chillz Support..."
                    rows={2}
                    style={{ flex: 1, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }}
                  />
                  <button
                    onClick={() => { if (message.trim() || attachments.length > 0) sendMessageMutation.mutate(); }}
                    disabled={(!message.trim() && attachments.length === 0) || sendMessageMutation.isPending}
                    style={{ width: 42, height: 42, borderRadius: 12, border: "none", backgroundColor: (message.trim() || attachments.length > 0) ? "#5B0EA6" : "#E4DCF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: (message.trim() || attachments.length > 0) ? "0 4px 12px rgba(91,14,166,0.3)" : "none" }}>
                    {sendMessageMutation.isPending
                      ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                      : <Send size={16} style={{ color: (message.trim() || attachments.length > 0) ? "#FFFFFF" : "#9E9E9E" }} />}
                  </button>
                </div>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>
                  Sending as ⚖️ Chillz Support · Enter to send
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}