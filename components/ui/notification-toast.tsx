"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  Bell, CalendarCheck, Ticket, Wallet,
  TrendingUp, AlertTriangle, CheckCircle,
  Receipt, X, ChevronRight,
} from "lucide-react";

type Toast = {
  id: string;
  type: string;
  title: string;
  body: string;
  reference_id?: string;
  created_at: string;
};

const TYPE_CONFIG: Record<string, {
  icon: any;
  gradient: string;
  iconBg: string;
  iconColor: string;
  label: string;
}> = {
  booking: {
    icon: CalendarCheck,
    gradient: "linear-gradient(135deg, #3D0066, #5B0EA6)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Booking",
  },
  booking_confirmed: {
    icon: CalendarCheck,
    gradient: "linear-gradient(135deg, #3D0066, #5B0EA6)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Booking",
  },
  receipt: {
    icon: Receipt,
    gradient: "linear-gradient(135deg, #5B0EA6, #7B2FBE)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Receipt",
  },
  receipt_sent: {
    icon: Receipt,
    gradient: "linear-gradient(135deg, #5B0EA6, #7B2FBE)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Receipt",
  },
  wallet: {
    icon: Wallet,
    gradient: "linear-gradient(135deg, #065F46, #00C853)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Wallet",
  },
  payout: {
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #065F46, #00C853)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Payout",
  },
  dispute: {
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #92400E, #D97706)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Dispute",
  },
  booking_disputed: {
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #92400E, #D97706)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Dispute",
  },
  ticket: {
    icon: Ticket,
    gradient: "linear-gradient(135deg, #1D4ED8, #2563EB)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Ticket",
  },
  ticket_purchased: {
    icon: Ticket,
    gradient: "linear-gradient(135deg, #1D4ED8, #2563EB)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Ticket",
  },
  vehicle_report_approved: {
    icon: CheckCircle,
    gradient: "linear-gradient(135deg, #065F46, #00C853)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Approved",
  },
  vehicle_report_rejected: {
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #92400E, #D97706)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Report",
  },
  waiter_call: {
    icon: Bell,
    gradient: "linear-gradient(135deg, #D97706, #F59E0B)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Waiter",
  },
  default: {
    icon: Bell,
    gradient: "linear-gradient(135deg, #3D0066, #5B0EA6)",
    iconBg: "rgba(255,255,255,0.2)",
    iconColor: "#FFFFFF",
    label: "Alert",
  },
};

function getRoute(toast: Toast): string | null {
  const ref = toast.reference_id;
  if (!ref) return null;
  switch (toast.type) {
    case "booking":
    case "booking_confirmed":
    case "receipt":
    case "receipt_sent":
    case "booking_disputed":
    case "vehicle_report_approved":
    case "vehicle_report_rejected":
      return `/bookings/${ref}`;
    case "dispute":
      return `/bookings/${ref}/dispute`;
    case "ticket":
    case "ticket_purchased":
      return `/my-events`;
    case "wallet":
    case "payout":
      return `/profile`;
    default:
      return null;
  }
}

export function NotificationToast() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const dismissToast = useCallback((id: string) => {
    clearTimeout(dismissTimers.current[id]);
    delete dismissTimers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => {
      const existing = prev[0];
      if (existing) {
        clearTimeout(dismissTimers.current[existing.id]);
        delete dismissTimers.current[existing.id];
      }
      return [toast];
    });
    dismissTimers.current[toast.id] = setTimeout(() => {
      dismissToast(toast.id);
    }, 6000);
  }, [dismissToast]);

  useEffect(() => {
    if (!user?.id) return;

    audioRef.current = new Audio("/sounds/user-bell.mp3");
    audioRef.current.volume = 0.6;

    const unlock = () => {
      if (!audioRef.current) return;
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);

    const channel = supabase
      .channel(`user-notifications-toast-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        const n = payload.new;
        // Skip waiter_call on customer side — that's vendor only
        if (n.type === "waiter_call") return;
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        addToast({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          reference_id: n.reference_id,
          created_at: n.created_at,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(dismissTimers.current).forEach(clearTimeout);
    };
  }, [user?.id]);

  return (
    <div style={{
      position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480, zIndex: 300,
      pointerEvents: "none", padding: "0 12px",
    }}>
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.default;
          const Icon = config.icon;
          const route = getRoute(toast);

          return (
            <motion.div
              key={toast.id}
              initial={{ y: -100, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -100, opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              style={{ pointerEvents: "auto", marginTop: 12 }}>

              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 6, ease: "linear" }}
                style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  height: 3, borderRadius: "12px 12px 0 0",
                  background: "rgba(255,255,255,0.4)",
                  transformOrigin: "left",
                  zIndex: 1,
                }} />

              <div style={{
                background: config.gradient,
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.15)",
                border: "1px solid rgba(255,255,255,0.15)",
                position: "relative",
              }}>
                {/* Glow orb */}
                <div style={{
                  position: "absolute", top: -30, right: -30,
                  width: 100, height: 100, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)",
                  pointerEvents: "none",
                }} />

                <div style={{
                  padding: "14px 14px 14px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  {/* Icon */}
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    style={{
                      width: 44, height: 44, borderRadius: 14,
                      backgroundColor: config.iconBg,
                      backdropFilter: "blur(8px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}>
                    <Icon size={20} style={{ color: config.iconColor }} strokeWidth={2} />
                  </motion.div>

                  {/* Text */}
                  <div
                    onClick={() => {
                      if (route) { router.push(route); dismissToast(toast.id); }
                    }}
                    role={route ? "button" : undefined}
                    style={{ flex: 1, minWidth: 0, cursor: route ? "pointer" : "default" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.65)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                        backgroundColor: "rgba(255,255,255,0.15)",
                        padding: "2px 7px", borderRadius: 999,
                      }}>
                        {config.label}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 13, fontWeight: 800, color: "#FFFFFF",
                      margin: "0 0 2px", lineHeight: 1.3,
                      fontFamily: "var(--font-display, Syne, sans-serif)",
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>
                      {toast.title}
                    </p>
                    <p style={{
                      fontSize: 11, color: "rgba(255,255,255,0.8)",
                      margin: 0, lineHeight: 1.4,
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>
                      {toast.body}
                    </p>
                  </div>

                  {/* Right side */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {route && (
                      <button
                        onClick={() => { router.push(route); dismissToast(toast.id); }}
                        style={{
                          width: 30, height: 30, borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.2)",
                          border: "1px solid rgba(255,255,255,0.25)",
                          cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}>
                        <ChevronRight size={16} style={{ color: "#FFFFFF" }} />
                      </button>
                    )}
                    <button
                      onClick={() => dismissToast(toast.id)}
                      style={{
                        width: 30, height: 30, borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.15)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                      <X size={14} style={{ color: "rgba(255,255,255,0.8)" }} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}