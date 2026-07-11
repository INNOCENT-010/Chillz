/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  ArrowLeft,
  Ticket,
  Wallet,
  CalendarCheck,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";

type NotifType = {
  icon: React.ElementType;
  bg: string;
  color: string;
};

const TYPE_CONFIG: Record<string, NotifType> = {
  booking:  { icon: CalendarCheck, bg: "#EDE0F7", color: "#5B0EA6" },
  receipt:  { icon: Ticket,        bg: "#EDE0F7", color: "#5B0EA6" },
  wallet:   { icon: Wallet,        bg: "#E0F7EA", color: "#00C853" },
  payout:   { icon: TrendingUp,    bg: "#E0F7EA", color: "#00C853" },
  dispute:  { icon: AlertTriangle, bg: "#FEF3C7", color: "#D97706" },
  default:  { icon: Bell,          bg: "#F2EEF9", color: "#6B6B6B" },
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await (supabase.from("notifications") as any)
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = async (id: string) => {
    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const unreadCount =
    notifications?.filter((n: any) => !n.is_read).length || 0;

  return (
    <MainLayout>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E4DCF0",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              marginLeft: -6,
              display: "flex",
            }}
          >
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#0A0A0A",
              margin: 0,
              fontFamily: "var(--font-display, Syne, sans-serif)",
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <div
              style={{
                backgroundColor: "#00C853",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 999,
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {unreadCount}
            </div>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              backgroundColor: "#F2EEF9",
              border: "none",
              borderRadius: 10,
              padding: "7px 12px",
              color: "#5B0EA6",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 68,
                  borderRadius: 16,
                  backgroundColor: "#F2EEF9",
                }}
              />
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence>
              {notifications.map((notif: any, i: number) => {
                const config =
                  TYPE_CONFIG[notif.type] || TYPE_CONFIG.default;
                const IconComp = config.icon;
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => !notif.is_read && markRead(notif.id)}
                    style={{
                      backgroundColor: notif.is_read
                        ? "#FFFFFF"
                        : "#F7F3FF",
                      borderRadius: 16,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      cursor: "pointer",
                      border: notif.is_read
                        ? "1px solid transparent"
                        : "1px solid #EDE0F7",
                      boxShadow: notif.is_read
                        ? "none"
                        : "0 2px 8px rgba(91,14,166,0.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: config.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconComp
                        size={17}
                        style={{ color: config.color }}
                        strokeWidth={2}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: notif.is_read ? 500 : 700,
                          fontSize: 13,
                          color: "#0A0A0A",
                          margin: "0 0 3px",
                          lineHeight: 1.3,
                        }}
                      >
                        {notif.title}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6B6B6B",
                          margin: "0 0 4px",
                          lineHeight: 1.4,
                        }}
                      >
                        {notif.body}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: "#9E9E9E",
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "#5B0EA6",
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 80,
              gap: 14,
              textAlign: "center",
            }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={28} style={{ color: "#5B0EA6" }} />
            </motion.div>
            <p
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: "#0A0A0A",
                margin: 0,
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              All caught up
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#6B6B6B",
                margin: 0,
                lineHeight: 1.5,
                maxWidth: 220,
              }}
            >
              Activity alerts, booking updates and receipts will appear here.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}