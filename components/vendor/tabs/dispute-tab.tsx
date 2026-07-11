/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle, ArrowLeft, Send, MessageCircle, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Props {
  vendor: any;
  user: any;
  disputedBookings: any[];
}

type ActiveThread =
  | { kind: "dispute"; bookingId: string }
  | { kind: "ticket"; ticket: any };

export function DisputeTab({ vendor, user, disputedBookings }: Props) {
  const qc = useQueryClient();
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Attachment state for vendor ticket replies
  const [vendorAttachments, setVendorAttachments] = useState<string[]>([]);
  const [vendorUploading, setVendorUploading] = useState(false);
  const vendorFileInputRef = useRef<HTMLInputElement>(null);

  // ── Vendor support tickets ────────────────────────────────────────────
  const { data: vendorTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["vendor-support-tickets", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data, error } = await (supabase.from("support_tickets") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("vendor_id", vendor.id)
        .eq("type", "vendor")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  // ── Dispute messages (3-way) ──────────────────────────────────────────
  const disputeBookingId = active?.kind === "dispute" ? active.bookingId : null;
  const { data: disputeMessages, refetch: refetchDispute } = useQuery({
    queryKey: ["dispute-messages-vendor", disputeBookingId],
    queryFn: async () => {
      if (!disputeBookingId) return [];
      const { data } = await (supabase.from("dispute_messages") as any)
        .select("*, users(full_name)")
        .eq("booking_id", disputeBookingId)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!disputeBookingId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // ── Support ticket messages ───────────────────────────────────────────
  const ticketId = active?.kind === "ticket" ? active.ticket.id : null;
  const { data: ticketMessages, refetch: refetchTicket } = useQuery({
    queryKey: ["vendor-ticket-messages", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await (supabase.from("support_messages") as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ticketId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // ── Realtime ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!disputeBookingId) return;
    const ch = supabase
      .channel(`dispute-vendor-${disputeBookingId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "dispute_messages",
        filter: `booking_id=eq.${disputeBookingId}`,
      }, () => refetchDispute())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [disputeBookingId]);

  useEffect(() => {
    if (!ticketId) return;
    const ch = supabase
      .channel(`vendor-ticket-${ticketId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${ticketId}`,
      }, () => refetchTicket())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketId]);

  // Scroll to bottom
  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [disputeMessages, ticketMessages]);

  // ── Resolve ticket mutation ───────────────────────────────────────────
  const resolveMutation = useMutation({
    mutationFn: async (tid: string) => {
      await (supabase.from("support_tickets") as any)
        .update({ status: "resolved" })
        .eq("id", tid);
      const ticket = active?.kind === "ticket" ? active.ticket : null;
      if (ticket?.user_id) {
        await (supabase.from("notifications") as any).insert({
          user_id: ticket.user_id,
          title: "Issue resolved ✓",
          body: `Your ticket "${ticket.subject}" has been marked as resolved by the venue.`,
          type: "booking",
          is_read: false,
        });
      }
    },
    onSuccess: () => {
      refetchTickets();
      qc.invalidateQueries({ queryKey: ["vendor-support-tickets"] });
      if (active?.kind === "ticket") {
        setActive({ kind: "ticket", ticket: { ...active.ticket, status: "resolved" } });
      }
    },
  });

  // ── File upload handler ───────────────────────────────────────────────
  const handleVendorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !ticketId) return;
    setVendorUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `support/${ticketId}/${Date.now()}-vendor.${ext}`;
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
      setVendorAttachments((prev) => [...prev, ...uploaded]);
    } catch {}
    finally {
      setVendorUploading(false);
      if (vendorFileInputRef.current) vendorFileInputRef.current.value = "";
    }
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  // ── Send handlers ─────────────────────────────────────────────────────
  const sendDispute = async () => {
    if (!message.trim() || !disputeBookingId || !user?.id) return;
    const text = message.trim();
    setMessage("");
    const { error } = await (supabase.from("dispute_messages") as any).insert({
      booking_id: disputeBookingId,
      sender_id: user.id,
      sender_role: "vendor",
      message: text,
      attachments: [],
    });
    if (error) { setMessage(text); return; }
    refetchDispute();
  };

  const sendTicketReply = async () => {
    if ((!message.trim() && vendorAttachments.length === 0) || !ticketId || !user?.id) return;
    const text = message.trim();
    setMessage("");
    const attachmentsCopy = [...vendorAttachments];
    setVendorAttachments([]);

    const { error } = await (supabase.from("support_messages") as any).insert({
      ticket_id: ticketId,
      sender_role: "vendor",
      sender_id: user.id,
      message: text || "(attachment)",
      attachments: attachmentsCopy,
    });

    if (error) {
      console.error("Send failed:", error);
      setMessage(text);
      setVendorAttachments(attachmentsCopy);
      return;
    }

    await (supabase.from("support_tickets") as any)
      .update({ last_message_at: new Date().toISOString(), user_read: false })
      .eq("id", ticketId);

    refetchTicket();
    qc.invalidateQueries({ queryKey: ["vendor-support-tickets"] });
  };

  // ── Thread view ───────────────────────────────────────────────────────
  if (active) {
    const isDispute = active.kind === "dispute";
    const ticket = active.kind === "ticket" ? active.ticket : null;
    const messages = isDispute ? (disputeMessages || []) : (ticketMessages || []);
    const send = isDispute ? sendDispute : sendTicketReply;
    const isResolved = ticket?.status === "resolved";
    const canResolve = !isDispute && !isResolved;
    const canSend = isDispute ? message.trim().length > 0 : (message.trim().length > 0 || vendorAttachments.length > 0);

    return (
      <motion.div
        key="thread"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, backgroundColor: "#FFFFFF",
          zIndex: 60, maxWidth: 480, margin: "0 auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "44px 16px 12px", borderBottom: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button
              onClick={() => { setActive(null); setMessage(""); setVendorAttachments([]); }}
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: isDispute ? "#FEF3C7" : "#EDE0F7",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <ArrowLeft size={14} style={{ color: isDispute ? "#D97706" : "#5B0EA6" }} />
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {isDispute ? "Dispute Thread" : (ticket?.subject || "Guest Message")}
              </p>
              <p style={{ fontSize: 11, color: isDispute ? "#D97706" : "#5B0EA6", margin: 0, fontWeight: 600 }}>
                {isDispute
                  ? "3-way · You · Guest · Chillz Support"
                  : `From: ${ticket?.users?.full_name || "Guest"}`}
              </p>
            </div>

            {canResolve && (
              <button
                onClick={() => resolveMutation.mutate(ticket.id)}
                disabled={resolveMutation.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "6px 12px", borderRadius: 10, border: "none",
                  backgroundColor: "#E0F7EA", color: "#059669",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                <CheckCircle size={12} />
                {resolveMutation.isPending ? "..." : "Resolve"}
              </button>
            )}

            <div style={{
              backgroundColor: isDispute ? "#FEF3C7" : isResolved ? "#E0F7EA" : "#EDE0F7",
              border: `1px solid ${isDispute ? "#FDE68A" : isResolved ? "#A7F3D0" : "#C4BAD8"}`,
              borderRadius: 8, padding: "3px 10px", flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDispute ? "#D97706" : isResolved ? "#059669" : "#5B0EA6" }}>
                {isDispute ? "DISPUTED" : (ticket?.status?.toUpperCase() || "OPEN")}
              </span>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          backgroundColor: isDispute ? "#FFF8E1" : "#F7F5FA",
          borderBottom: `1px solid ${isDispute ? "#FDE68A" : "#E4DCF0"}`,
          padding: "10px 16px", flexShrink: 0,
        }}>
          <p style={{ fontSize: 12, color: isDispute ? "#92400E" : "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
            {isDispute
              ? "Post your side. Chillz support and the guest can see all messages. Resolution within 8 hours."
              : isResolved
              ? "This ticket has been resolved."
              : "Reply directly to the guest's message. They will be notified of your response."}
          </p>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 10,
          backgroundColor: "#F7F5FA",
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <MessageCircle size={28} style={{ color: "#E4DCF0", marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No messages yet. Send your update below.</p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe = msg.sender_role === "vendor";
              const isAdmin = msg.sender_role === "admin";
              const isUser = msg.sender_role === "user";
              const label = isAdmin ? "Chillz Support" : isUser
                ? (ticket?.users?.full_name || "Guest")
                : "You";
              const bubbleBg = isMe ? "#5B0EA6" : isAdmin ? "#0A0A0A" : "#FFFFFF";
              const textColor = isMe || isAdmin ? "#FFFFFF" : "#0A0A0A";
              const bubbleRadius = isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}
                >
                  <div style={{ maxWidth: "78%" }}>
                    {!isMe && (
                      <p style={{ fontSize: 10, fontWeight: 700, color: isAdmin ? "#0A0A0A" : "#D97706", margin: "0 0 3px 4px" }}>
                        {label}
                      </p>
                    )}
                    <div style={{
                      backgroundColor: bubbleBg,
                      borderRadius: bubbleRadius,
                      padding: "10px 14px",
                      boxShadow: isMe ? "0 2px 10px rgba(91,14,166,0.25)" : "0 1px 6px rgba(0,0,0,0.06)",
                      border: !isMe && !isAdmin ? "1px solid #F2EEF9" : "none",
                    }}>
                      {msg.message && msg.message !== "(attachment)" && (
                        <p style={{ fontSize: 13, color: textColor, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {msg.message}
                        </p>
                      )}
                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{ marginTop: msg.message && msg.message !== "(attachment)" ? 8 : 0, display: "flex", flexDirection: "column", gap: 6 }}>
                          {msg.attachments.map((url: string, i: number) => {
                            const isImg = isImageUrl(url);
                            return isImg ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "block", borderRadius: 10, overflow: "hidden", maxWidth: 200 }}>
                                <img src={url} alt="" style={{ width: "100%", display: "block", borderRadius: 10 }} />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: isMe ? "rgba(255,255,255,0.15)" : "#F7F5FA", borderRadius: 10, padding: "8px 12px", textDecoration: "none" }}>
                                <span style={{ fontSize: 12, color: isMe ? "#FFFFFF" : "#5B0EA6", fontWeight: 600 }}>
                                  📎 {url.split("/").pop()}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: "3px 0 0", textAlign: isMe ? "right" : "left" }}>
                      {format(new Date(msg.created_at), "HH:mm · dd MMM")}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        {!isResolved ? (
          <div style={{ padding: "10px 16px 36px", borderTop: "1px solid #F2EEF9", flexShrink: 0, backgroundColor: "#FFFFFF" }}>

            {/* Attachment previews */}
            {!isDispute && vendorAttachments.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {vendorAttachments.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {isImageUrl(url) ? (
                      <img src={url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1.5px solid #E4DCF0" }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 20 }}>📎</span>
                      </div>
                    )}
                    <button
                      onClick={() => setVendorAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#EF4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={9} style={{ color: "#FFFFFF" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file input — only for ticket replies, not disputes */}
            {!isDispute && (
              <input
                type="file"
                ref={vendorFileInputRef}
                onChange={handleVendorFileUpload}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                style={{ display: "none" }}
              />
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {/* Attachment button — only for ticket replies */}
              {!isDispute && (
                <button
                  onClick={() => vendorFileInputRef.current?.click()}
                  disabled={vendorUploading}
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {vendorUploading
                    ? <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                    : <span style={{ fontSize: 16 }}>📎</span>}
                </button>
              )}

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) send();
                  }
                }}
                placeholder={isDispute
                  ? "Send your update to Chillz support and guest..."
                  : "Reply to guest..."}
                rows={2}
                style={{
                  flex: 1, backgroundColor: "#F7F5FA",
                  border: "1.5px solid #E4DCF0", borderRadius: 14,
                  padding: "10px 12px", fontSize: 13, color: "#0A0A0A",
                  outline: "none", fontFamily: "inherit",
                  resize: "none", lineHeight: 1.5,
                }}
              />

              <button
                onClick={() => { if (canSend) send(); }}
                disabled={!canSend}
                style={{
                  width: 42, height: 42, borderRadius: 12, border: "none",
                  backgroundColor: canSend
                    ? (isDispute ? "#D97706" : "#5B0EA6")
                    : "#E4DCF0",
                  cursor: canSend ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <Send size={16} style={{ color: canSend ? "#FFFFFF" : "#9E9E9E" }} />
              </button>
            </div>

            <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>
              Enter to send · Shift+Enter for new line
              {!isDispute && " · 📎 attach images or files"}
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px", borderTop: "1px solid #F2EEF9", textAlign: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#9E9E9E" }}>This ticket has been resolved.</span>
          </div>
        )}
      </motion.div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  const openTickets = (vendorTickets || []).filter((t: any) => t.status === "open").length;

  return (
    <motion.div
      key="disputes-list"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >

      {/* ── Section 1: Guest messages ─────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Messages from Guests
          </p>
          {openTickets > 0 && (
            <span style={{ backgroundColor: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
              {openTickets} open
            </span>
          )}
        </div>

        {!vendorTickets || vendorTickets.length === 0 ? (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "24px 20px", textAlign: "center" }}>
            <MessageCircle size={28} style={{ color: "#E4DCF0", marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No messages from guests yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vendorTickets.map((ticket: any) => {
              const isOpen = ticket.status === "open";
              return (
                <button
                  key={ticket.id}
                  onClick={() => { setActive({ kind: "ticket", ticket }); setMessage(""); setVendorAttachments([]); }}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16,
                    padding: "13px 14px", display: "flex", alignItems: "center", gap: 12,
                    border: `1.5px solid ${isOpen ? "#C4A0E8" : "#F2EEF9"}`,
                    cursor: "pointer", textAlign: "left",
                    boxShadow: isOpen ? "0 2px 10px rgba(91,14,166,0.08)" : "0 1px 4px rgba(91,14,166,0.04)",
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    backgroundColor: isOpen ? "#EDE0F7" : "#F7F5FA",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", flexShrink: 0, position: "relative",
                  }}>
                    {ticket.users?.avatar_url
                      ? <img src={ticket.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 16, fontWeight: 800, color: isOpen ? "#5B0EA6" : "#9E9E9E" }}>
                          {ticket.users?.full_name?.[0] || "?"}
                        </span>}
                    {isOpen && (
                      <div style={{
                        position: "absolute", top: -2, right: -2,
                        width: 9, height: 9, borderRadius: "50%",
                        backgroundColor: "#EF4444", border: "2px solid #FFFFFF",
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: isOpen ? 800 : 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {ticket.subject || "No subject"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {ticket.users?.full_name || "Guest"}
                    </p>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: isOpen ? "#D97706" : "#059669",
                      backgroundColor: isOpen ? "#FFF8E1" : "#E0F7EA",
                      padding: "2px 8px", borderRadius: 999,
                    }}>
                      {ticket.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: "#9E9E9E", flexShrink: 0 }}>
                    {format(new Date(ticket.last_message_at || ticket.created_at), "dd MMM")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: 3-way disputes ─────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Active Disputes
          </p>
          {disputedBookings.length > 0 && (
            <span style={{ backgroundColor: "#FEF3C7", color: "#D97706", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
              {disputedBookings.length} open
            </span>
          )}
        </div>

        {disputedBookings.length === 0 ? (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "24px 20px", textAlign: "center" }}>
            <CheckCircle size={28} style={{ color: "#E4DCF0", marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>No active disputes. All clear.</p>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "10px 14px", display: "flex", gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={14} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                Post your side — Chillz support and the guest can see your messages.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {disputedBookings.map((booking: any) => (
                <button
                  key={booking.id}
                  onClick={() => { setActive({ kind: "dispute", bookingId: booking.id }); setMessage(""); }}
                  style={{
                    width: "100%", backgroundColor: "#FFFBEB", borderRadius: 16,
                    padding: "13px 14px", display: "flex", alignItems: "center", gap: 12,
                    border: "1.5px solid #FDE68A", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {booking.users?.avatar_url
                      ? <img src={booking.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 16, fontWeight: 800, color: "#D97706" }}>{booking.users?.full_name?.[0]}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#92400E", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {booking.users?.full_name}
                    </p>
                    <p style={{ fontSize: 11, color: "#D97706", margin: 0 }}>
                      {formatCurrency(booking.reserved_amount)} · {format(new Date(booking.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}