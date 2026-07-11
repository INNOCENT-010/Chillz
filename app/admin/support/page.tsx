/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft, Send, MessageCircle, CheckCircle,
  X, Building2, User, Paperclip, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  open:     { color: "#D97706", bg: "#FFF8E1" },
  resolved: { color: "#059669", bg: "#E0F7EA" },
  closed:   { color: "#9E9E9E", bg: "#F2EEF9" },
};

export default function AdminSupportPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [typeFilter, setTypeFilter] = useState<"all" | "chillz" | "vendor">("all");
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, typeFilter],
    queryFn: async () => {
      let q = (supabase.from("support_tickets") as any)
        .select("*, users(full_name, email, avatar_url)")
        .order("last_message_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
    refetchInterval: 15000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const { data, error } = await (supabase.from("support_messages") as any)
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!selectedTicket?.id,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedTicket?.id) return;
    const channel = supabase
      .channel(`admin-support-${selectedTicket.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${selectedTicket.id}`,
      }, () => {
        refetchMessages();
        qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  // Mark admin_read when opening
  useEffect(() => {
    if (!selectedTicket?.id) return;
    (supabase.from("support_tickets") as any)
      .update({ admin_read: true })
      .eq("id", selectedTicket.id)
      .then(() => qc.invalidateQueries({ queryKey: ["admin-support-tickets"] }));
  }, [selectedTicket?.id]);

  // Scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `support/${selectedTicket.id}/${Date.now()}-admin.${ext}`;
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

  const replyMutation = useMutation({
    mutationFn: async () => {
      if ((!reply.trim() && attachments.length === 0) || !selectedTicket) return;

      await (supabase.from("support_messages") as any).insert({
        ticket_id: selectedTicket.id,
        sender_role: "admin",
        sender_id: null,
        message: reply.trim() || "(attachment)",
        attachments: attachments.length > 0 ? attachments : [],
      });

      await (supabase.from("support_tickets") as any)
        .update({
          last_message_at: new Date().toISOString(),
          user_read: false,
          reply_count: (selectedTicket.reply_count || 0) + 1,
        })
        .eq("id", selectedTicket.id);

      // Notify user
      if (selectedTicket.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: selectedTicket.user_id,
          title: "Support reply from Chillz",
          body: reply.trim().slice(0, 120) || "Attachment received",
          type: "booking",
          is_read: false,
        });
      }

      // Also notify vendor if this is a vendor ticket
      if (selectedTicket.type === "vendor" && selectedTicket.vendor_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: selectedTicket.vendor_id,
          title: "Chillz Support replied",
          body: reply.trim().slice(0, 120) || "Attachment received",
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      setReply("");
      setAttachments([]);
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      await (supabase.from("support_tickets") as any)
        .update({ status: "resolved" }).eq("id", ticketId);
      if (selectedTicket?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: selectedTicket.user_id,
          title: "Support ticket resolved ✓",
          body: `Your ticket "${selectedTicket.subject}" has been resolved.`,
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      setSelectedTicket((t: any) => t ? { ...t, status: "resolved" } : null);
    },
  });

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const unreadCount = (tickets || []).filter((t: any) => !t.admin_read && t.status === "open").length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 0" }}>
        <button onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Admin</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            Support Inbox
          </h1>
          {unreadCount > 0 && (
            <span style={{ backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: "0 0 14px" }}>
          {(tickets || []).filter((t: any) => t.status === "open").length} open tickets
        </p>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["open", "resolved", "all"] as const).map((s) => {
            const count = s === "all"
              ? (tickets || []).length
              : (tickets || []).filter((t: any) => t.status === s).length;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "10px 10px 0 0", border: "none", backgroundColor: statusFilter === s ? "#FFFFFF" : "rgba(255,255,255,0.15)", color: statusFilter === s ? "#5B0EA6" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 5 }}>
                {s}
                {count > 0 && (
                  <span style={{ backgroundColor: statusFilter === s ? "#EDE0F7" : "rgba(255,255,255,0.2)", color: statusFilter === s ? "#5B0EA6" : "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Type filter pills */}
        <div style={{ display: "flex", gap: 6, paddingBottom: 14 }}>
          {(["all", "chillz", "vendor"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: "4px 12px", borderRadius: 999, border: "1.5px solid", borderColor: typeFilter === t ? "#FFFFFF" : "rgba(255,255,255,0.3)", backgroundColor: typeFilter === t ? "rgba(255,255,255,0.2)" : "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {t === "chillz" ? "Chillz only" : t === "vendor" ? "Venue issues" : "All types"}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (tickets || []).length === 0 ? (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "48px 20px", textAlign: "center" }}>
            <MessageCircle size={36} style={{ color: "#E4DCF0", marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 4px" }}>No tickets</p>
            <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Support tickets from users will appear here</p>
          </div>
        ) : (
          (tickets || []).map((ticket: any) => {
            const s = STATUS_COLOR[ticket.status] || STATUS_COLOR.open;
            const isUnread = !ticket.admin_read && ticket.status === "open";
            const isVendorTicket = ticket.type === "vendor";
            return (
              <button key={ticket.id}
                onClick={() => { setSelectedTicket(ticket); setReply(""); setAttachments([]); }}
                style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px", display: "flex", alignItems: "flex-start", gap: 12, border: `1.5px solid ${isUnread ? "#C4A0E8" : "#F2EEF9"}`, cursor: "pointer", boxShadow: isUnread ? "0 2px 12px rgba(91,14,166,0.1)" : "0 1px 6px rgba(91,14,166,0.04)", textAlign: "left" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: isUnread ? "#EDE0F7" : "#F7F5FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                  <User size={18} style={{ color: isUnread ? "#5B0EA6" : "#9E9E9E" }} />
                  {isUnread && <div style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: "50%", backgroundColor: "#EF4444", border: "2px solid #FFFFFF" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                    <p style={{ fontWeight: isUnread ? 800 : 700, fontSize: 13, color: "#0A0A0A", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {ticket.subject || "No subject"}
                    </p>
                    <span style={{ fontSize: 10, color: "#9E9E9E", flexShrink: 0 }}>
                      {format(new Date(ticket.last_message_at || ticket.created_at), "dd MMM")}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 6px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {ticket.users?.full_name || "Unknown"} · {ticket.users?.email}
                  </p>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: "2px 8px", borderRadius: 999 }}>
                      {ticket.status}
                    </span>
                    {isVendorTicket && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#D97706", backgroundColor: "#FFF8E1", padding: "2px 8px", borderRadius: 999, display: "flex", alignItems: "center", gap: 3 }}>
                        <Building2 size={9} />venue issue
                      </span>
                    )}
                    {!isVendorTicket && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999 }}>
                        chillz
                      </span>
                    )}
                    {(ticket.reply_count || 0) > 0 && (
                      <span style={{ fontSize: 10, color: "#9E9E9E" }}>
                        {ticket.reply_count} repl{ticket.reply_count === 1 ? "y" : "ies"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Chat thread sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedTicket(null); setAttachments([]); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />

            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", height: "92vh", display: "flex", flexDirection: "column" }}>

              {/* Sheet header */}
              <div style={{ padding: "14px 20px 12px", flexShrink: 0, borderBottom: "1px solid #F2EEF9" }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 14px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {selectedTicket.subject || "Support Ticket"}
                    </h3>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 6px" }}>
                      {selectedTicket.users?.full_name} · {selectedTicket.users?.email}
                    </p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[selectedTicket.status]?.color, backgroundColor: STATUS_COLOR[selectedTicket.status]?.bg, padding: "2px 8px", borderRadius: 999 }}>
                        {selectedTicket.status}
                      </span>
                      {selectedTicket.type === "vendor" && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#D97706", backgroundColor: "#FFF8E1", padding: "2px 8px", borderRadius: 999, display: "flex", alignItems: "center", gap: 3 }}>
                          <Building2 size={9} />venue issue
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: "#9E9E9E" }}>
                        {format(new Date(selectedTicket.created_at), "dd MMM yyyy · HH:mm")}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {selectedTicket.status === "open" && (
                      <button onClick={() => resolveMutation.mutate(selectedTicket.id)}
                        disabled={resolveMutation.isPending}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 10, border: "none", backgroundColor: "#E0F7EA", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <CheckCircle size={12} />Resolve
                      </button>
                    )}
                    <button onClick={() => { setSelectedTicket(null); setAttachments([]); }}
                      style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={14} style={{ color: "#6B6B6B" }} />
                    </button>
                  </div>
                </div>

                {selectedTicket.booking_id && (
                  <div style={{ marginTop: 8, backgroundColor: "#EDE0F7", borderRadius: 10, padding: "6px 12px" }}>
                    <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                      📋 Booking: #{selectedTicket.booking_id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Participants info */}
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#6B6B6B", backgroundColor: "#F7F5FA", padding: "3px 8px", borderRadius: 999 }}>
                    👤 {selectedTicket.users?.full_name || "User"}
                  </span>
                  {selectedTicket.type === "vendor" && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#D97706", backgroundColor: "#FFF8E1", padding: "3px 8px", borderRadius: 999 }}>
                      🏢 Venue
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 8px", borderRadius: 999 }}>
                    ⚖️ Admin
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, backgroundColor: "#F7F5FA" }}>
                {!messages || messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 13, color: "#9E9E9E" }}>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isAdmin = msg.sender_role === "admin";
                    const isVendor = msg.sender_role === "vendor";
                    const isUser = msg.sender_role === "user";

                    // Admin = right (purple), vendor = left (amber), user = left (white)
                    const alignRight = isAdmin;
                    const bubbleBg = isAdmin ? "#5B0EA6" : isVendor ? "#FFF8E1" : "#FFFFFF";
                    const textColor = isAdmin ? "#FFFFFF" : "#0A0A0A";
                    const bubbleBorder = isAdmin ? "none" : isVendor ? "1px solid #FDE68A" : "1px solid #F2EEF9";
                    const bubbleRadius = alignRight ? "16px 16px 4px 16px" : "16px 16px 16px 4px";
                    const senderLabel = isAdmin ? null : isVendor ? "Venue" : (selectedTicket.users?.full_name || "User");

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", justifyContent: alignRight ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "78%" }}>
                          {!isAdmin && (
                            <p style={{ fontSize: 10, color: isVendor ? "#D97706" : "#9E9E9E", margin: "0 0 3px 4px", fontWeight: 700 }}>
                              {senderLabel}
                            </p>
                          )}
                          <div style={{
                            backgroundColor: bubbleBg,
                            borderRadius: bubbleRadius,
                            padding: msg.message && msg.message !== "(attachment)" ? "10px 14px" : "8px",
                            boxShadow: isAdmin ? "0 2px 10px rgba(91,14,166,0.25)" : "0 1px 6px rgba(0,0,0,0.06)",
                            border: bubbleBorder,
                          }}>
                            {msg.message && msg.message !== "(attachment)" && (
                              <p style={{ fontSize: 13, color: textColor, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {msg.message}
                              </p>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: msg.message && msg.message !== "(attachment)" ? 8 : 0 }}>
                                {msg.attachments.map((url: string, i: number) => (
                                  isImageUrl(url) ? (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "block", borderRadius: 10, overflow: "hidden", maxWidth: 200 }}>
                                      <img src={url} alt="attachment" style={{ width: "100%", display: "block", borderRadius: 10 }} />
                                    </a>
                                  ) : (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: isAdmin ? "rgba(255,255,255,0.15)" : "#F7F5FA", borderRadius: 10, padding: "8px 12px", textDecoration: "none" }}>
                                      <FileText size={14} style={{ color: isAdmin ? "#FFFFFF" : "#5B0EA6", flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: isAdmin ? "#FFFFFF" : "#5B0EA6", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                        {url.split("/").pop()}
                                      </span>
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0", textAlign: alignRight ? "right" : "left" }}>
                            {format(new Date(msg.created_at), "HH:mm")}
                            {isAdmin && " · Chillz Support"}
                            {isVendor && " · Venue"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              {selectedTicket.status === "open" ? (
                <div style={{ padding: "10px 16px 32px", borderTop: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>

                  {attachments.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      {attachments.map((url, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          {isImageUrl(url) ? (
                            <img src={url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1.5px solid #E4DCF0" }} />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #E4DCF0" }}>
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
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload}
                      multiple accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      style={{ width: 38, height: 38, borderRadius: 10, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      {uploading
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                        : <Paperclip size={16} style={{ color: "#9E9E9E" }} />}
                    </button>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (reply.trim() || attachments.length > 0) replyMutation.mutate();
                        }
                      }}
                      placeholder="Type your reply as Chillz Support..."
                      rows={2}
                      style={{ flex: 1, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "10px 12px", fontSize: 13, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }}
                    />
                    <button
                      onClick={() => { if (reply.trim() || attachments.length > 0) replyMutation.mutate(); }}
                      disabled={(!reply.trim() && attachments.length === 0) || replyMutation.isPending}
                      style={{ width: 42, height: 42, borderRadius: 12, border: "none", backgroundColor: (reply.trim() || attachments.length > 0) ? "#5B0EA6" : "#E4DCF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: (reply.trim() || attachments.length > 0) ? "pointer" : "not-allowed", flexShrink: 0, boxShadow: (reply.trim() || attachments.length > 0) ? "0 4px 12px rgba(91,14,166,0.3)" : "none" }}>
                      {replyMutation.isPending
                        ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                        : <Send size={16} style={{ color: (reply.trim() || attachments.length > 0) ? "#FFFFFF" : "#9E9E9E" }} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>
                    Sending as ⚖️ Chillz Support · Enter to send · Shift+Enter for new line
                  </p>
                </div>
              ) : (
                <div style={{ padding: "14px 16px 32px", borderTop: "1px solid #F2EEF9", flexShrink: 0, textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>This ticket is resolved.</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}