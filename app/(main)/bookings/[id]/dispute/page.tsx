/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ArrowLeft, Send, MessageCircle, AlertCircle, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

export default function DisputeThreadPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [message,   setMessage]   = useState("");
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["dispute-booking", id],
    queryFn: async () => {
      const { data } = await (supabase.from("bookings") as any)
        .select(`
          id, status, reserved_amount, vendor_id,
          users(full_name, avatar_url),
          venues(id, name),
          vendors(business_name)
        `)
        .eq("id", id)
        .single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  const { data: messages, refetch } = useQuery({
    queryKey: ["dispute-messages-user", id],
    queryFn: async () => {
      const { data } = await (supabase.from("dispute_messages") as any)
        .select("*")
        .eq("booking_id", id)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // ── Realtime subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`dispute-user-${id}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "dispute_messages",
        filter: `booking_id=eq.${id}`,
      }, () => {
        refetch();
        qc.invalidateQueries({ queryKey: ["dispute-messages-user", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetch, qc]);

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  // Guard: only the booking owner can access this page
  useEffect(() => {
    if (!booking || !user) return;
    if (booking.users?.id && booking.users.id !== user.id) {
      // Not the booking owner — redirect
      router.replace("/bookings");
    }
  }, [booking, user, router]);

  const sendMessage = async () => {
    if (!message.trim() || !user?.id || !id) return;
    setSending(true);
    setSendError("");
    const text = message.trim();
    setMessage("");

    const { error } = await (supabase.from("dispute_messages") as any).insert({
      booking_id:  id,
      sender_id:   user.id,
      sender_role: "user",
      message:     text,
      attachments: [],
    });

    if (error) {
      setSendError("Failed to send. Please try again.");
      setMessage(text);
      setSending(false);
      return;
    }

    // Notify vendor
    if (booking?.vendor_id) {
      await (supabase.from("notifications") as any).insert({
        user_id: booking.vendor_id,
        type:    "dispute_message",
        title:   "New dispute message",
        body:    `${booking.users?.full_name || "Guest"}: ${text.slice(0, 80)}`,
        data:    { booking_id: id },
      });
    }

    refetch();
    setSending(false);
  };

  const isLoading = bookingLoading;
  const venueName = booking?.venues?.name || booking?.vendors?.business_name || "Booking";
  const ref       = (id || "").slice(0, 8).toUpperCase();

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </MainLayout>
  );

  if (!booking) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Booking not found.</p>
        <button onClick={() => router.back()}
          style={{ backgroundColor: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div style={{
        maxWidth: 480, margin: "0 auto", minHeight: "100vh",
        display: "flex", flexDirection: "column", backgroundColor: "#F7F5FA",
      }}>

        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(135deg,#92400E,#D97706)`, padding: "44px 16px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <button onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF", margin: "0 0 2px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                Dispute Thread
              </h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", margin: "0 0 1px", fontWeight: 600 }}>
                {venueName} · #{ref}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0 }}>
                3-way · You · Vendor · Chillz Support
              </p>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "3px 10px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>DISPUTED</span>
            </div>
          </div>

          {/* Info banner */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 14px" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", margin: 0, lineHeight: 1.5 }}>
              Post your side. The vendor and Chillz support can see all messages. Resolution within 8 hours.
            </p>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {!messages || messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <MessageCircle size={28} style={{ color: "#D97706" }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 6px" }}>No messages yet</p>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0, lineHeight: 1.5 }}>
                Start by describing your issue. The vendor and Chillz support will respond here.
              </p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe    = msg.sender_role === "user";
              const isAdmin = msg.sender_role === "admin";

              const bubbleBg    = isMe ? ACCENT : isAdmin ? "#0A0A0A" : "#FFFFFF";
              const textColor   = isMe || isAdmin ? "#FFFFFF" : "#0A0A0A";
              const borderRadius = isMe
                ? "16px 16px 4px 16px"
                : "16px 16px 16px 4px";

              const label = isAdmin
                ? "Chillz Support"
                : isMe
                ? "You"
                : "Vendor";

              const labelColor = isAdmin ? "#0A0A0A" : isMe ? ACCENT : "#D97706";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}
                >
                  <div style={{ maxWidth: "80%" }}>
                    {!isMe && (
                      <p style={{ fontSize: 10, fontWeight: 700, color: labelColor, margin: "0 0 3px 4px" }}>
                        {label}
                      </p>
                    )}
                    <div style={{
                      backgroundColor: bubbleBg,
                      borderRadius,
                      padding: "10px 14px",
                      boxShadow: isMe
                        ? "0 2px 10px rgba(91,14,166,0.25)"
                        : isAdmin
                        ? "0 2px 10px rgba(0,0,0,0.15)"
                        : "0 1px 6px rgba(0,0,0,0.06)",
                      border: !isMe && !isAdmin ? "1px solid #F2EEF9" : "none",
                    }}>
                      <p style={{
                        fontSize: 13, color: textColor,
                        margin: 0, lineHeight: 1.5,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {msg.message}
                      </p>
                    </div>
                    <p style={{
                      fontSize: 10, color: "#9E9E9E",
                      margin: "3px 0 0",
                      textAlign: isMe ? "right" : "left",
                    }}>
                      {format(new Date(msg.created_at), "HH:mm · dd MMM")}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* ── Error ── */}
        <AnimatePresence>
          {sendError && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: "0 16px 8px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={13} style={{ color: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{sendError}</p>
              </div>
              <button onClick={() => setSendError("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                <X size={13} style={{ color: "#EF4444" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input ── */}
        <div style={{
          padding: "10px 16px 36px",
          borderTop: "1px solid #F2EEF9",
          backgroundColor: "#FFFFFF",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (message.trim() && !sending) sendMessage();
                }
              }}
              placeholder="Describe your issue or update..."
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
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              style={{
                width: 44, height: 44, borderRadius: 13, border: "none",
                backgroundColor: message.trim() && !sending ? "#D97706" : "#E4DCF0",
                cursor: message.trim() && !sending ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background-color 0.15s",
              }}
            >
              {sending
                ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />
                : <Send size={16} style={{ color: message.trim() ? "#FFFFFF" : "#9E9E9E" }} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#9E9E9E", margin: "6px 0 0" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}