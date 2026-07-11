/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  Wallet, Settings, LogOut, ChevronRight,
  Bell, User, Edit2, Building2,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export default function ProfilePage() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount")
        .eq("account_id", user.id)
        .eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce((acc: number, row: any) =>
        row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("vendors")
        .select("id, kyc_status, business_name, vendor_type")
        .eq("user_id", user.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  // ── Unread notification count ──────────────────────────────────────────────
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <MainLayout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
            gap: 16,
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={32} style={{ color: "#5B0EA6" }} />
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#0A0A0A",
              margin: 0,
              fontFamily: "var(--font-display, Syne, sans-serif)",
            }}
          >
            You are not signed in
          </h2>
          <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>
            Sign in to access your profile, wallet and bookings.
          </p>
          <button
            onClick={() => router.push("/login")}
            style={{
              background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 16,
              padding: "13px 36px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(91,14,166,0.3)",
            }}
          >
            Sign In
          </button>
        </div>
      </MainLayout>
    );
  }

  const menuItems = [
    {
      href: "/wallet",
      icon: Wallet,
      label: "My Wallet",
      subtitle: "Fund and manage balance",
      iconBg: "#EDE0F7",
      iconColor: "#5B0EA6",
      badge: 0,
    },
    {
      href: "/notifications",
      icon: Bell,
      label: "Notifications",
      subtitle: "Alerts and updates",
      iconBg: "#EDE0F7",
      iconColor: "#5B0EA6",
      badge: unreadCount || 0,
    },
    {
      href: "/settings",
      icon: Settings,
      label: "Settings",
      subtitle: "Account preferences",
      iconBg: "#EDE0F7",
      iconColor: "#5B0EA6",
      badge: 0,
    },
  ];

  return (
    <MainLayout>
      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Avatar card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 2px 16px rgba(91,14,166,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "#EDE0F7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                border: "2px solid #EDE0F7",
              }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#5B0EA6",
                    fontFamily: "var(--font-display, Syne, sans-serif)",
                  }}
                >
                  {user.full_name?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontWeight: 900,
                  fontSize: 17,
                  color: "#0A0A0A",
                  margin: "0 0 3px",
                  fontFamily: "var(--font-display, Syne, sans-serif)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {user.full_name}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#6B6B6B",
                  margin: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </p>
            </div>
            <Link
              href="/profile/edit"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#EDE0F7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                textDecoration: "none",
              }}
            >
              <Edit2 size={16} style={{ color: "#5B0EA6" }} />
            </Link>
          </div>

          {/* Wallet strip */}
          <Link href="/wallet" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #3D0066, #5B0EA6)",
                borderRadius: 16,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Wallet Balance
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#FFFFFF",
                    fontFamily: "var(--font-display, Syne, sans-serif)",
                  }}
                >
                  {formatCurrency(walletBalance || 0)}
                </span>
                <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Vendor status */}
        {vendor ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Link href="/vendor" style={{ textDecoration: "none" }}>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: "13px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 2px 12px rgba(91,14,166,0.06)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "#E0F7EA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} style={{ color: "#00C853" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#0A0A0A",
                      margin: "0 0 2px",
                    }}
                  >
                    {vendor.business_name}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor:
                          vendor.kyc_status === "approved" ? "#00C853" :
                          vendor.kyc_status === "pending" ? "#F59E0B" : "#EF4444",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          vendor.kyc_status === "approved" ? "#00C853" :
                          vendor.kyc_status === "pending" ? "#F59E0B" : "#EF4444",
                        textTransform: "capitalize",
                      }}
                    >
                      {vendor.kyc_status}
                    </span>
                    <span style={{ fontSize: 11, color: "#9E9E9E" }}>
                      · {vendor.vendor_type?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
              </div>
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Link href="/vendor/register" style={{ textDecoration: "none" }}>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: "13px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 2px 12px rgba(91,14,166,0.06)",
                  border: "1.5px dashed #E4DCF0",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "#F2EEF9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} style={{ color: "#9E9E9E" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#0A0A0A",
                      margin: "0 0 2px",
                    }}
                  >
                    Become a Vendor
                  </p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                    List your business on Chillz
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Menu items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {menuItems.map(({ href, icon: Icon, label, subtitle, iconBg, iconColor, badge }, i) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 + 0.1 }}
            >
              <Link href={href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 18,
                    padding: "13px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 2px 8px rgba(91,14,166,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} style={{ color: iconColor }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#0A0A0A",
                        margin: "0 0 2px",
                      }}
                    >
                      {label}
                    </p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                      {subtitle}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {badge > 0 && (
                      <div
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 999,
                          backgroundColor: "#EF4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 5px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "#FFFFFF",
                            lineHeight: 1,
                          }}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      </div>
                    )}
                    <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Sign out */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          onClick={handleSignOut}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 18,
            padding: "13px 14px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <LogOut size={18} style={{ color: "#EF4444" }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#EF4444" }}>
            Sign Out
          </span>
        </motion.button>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#9E9E9E",
            marginTop: 4,
          }}
        >
          Chillz v1.0 · Lagos & Port Harcourt
        </p>
      </div>
    </MainLayout>
  );
}