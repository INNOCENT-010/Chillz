"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  MapPin,
  Shield,
  Trash2,
  ChevronRight,
  Moon,
  Globe,
  Phone,
  Mail,
  Lock,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        backgroundColor: value ? "#5B0EA6" : "#E4DCF0",
        position: "relative",
        transition: "background-color 0.2s ease",
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ x: value ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: "#FFFFFF",
          position: "absolute",
          top: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#9E9E9E",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "20px 0 8px",
        paddingLeft: 4,
      }}
    >
      {label}
    </p>
  );
}

function SettingRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  subtitle,
  right,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: "12px 14px",
        border: "none",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 6px rgba(91,14,166,0.05)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} style={{ color: iconColor }} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: danger ? "#EF4444" : "#0A0A0A",
            margin: "0 0 1px",
          }}
        >
          {label}
        </p>
        {subtitle && (
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      {right ?? (onClick && (
        <ChevronRight size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
      ))}
    </button>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();

  const [notifications, setNotifications] = useState({
    bookings: true,
    receipts: true,
    promotions: false,
    reminders: true,
  });
  const [locationAlways, setLocationAlways] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This cannot be undone."
      )
    ) {
      // TODO: implement account deletion
      alert("Please contact support to delete your account.");
    }
  };

  return (
    <MainLayout>
      {/* Header */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid #E4DCF0",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
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
          Settings
        </h1>
      </div>

      <div style={{ padding: "8px 16px 32px" }}>
        {/* Account info banner */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background:
                "linear-gradient(135deg, #3D0066 0%, #5B0EA6 100%)",
              borderRadius: 20,
              padding: "18px 18px",
              marginTop: 12,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#FFFFFF",
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
                  fontWeight: 800,
                  fontSize: 15,
                  color: "#FFFFFF",
                  margin: "0 0 2px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  fontFamily: "var(--font-display, Syne, sans-serif)",
                }}
              >
                {user.full_name}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.65)",
                  margin: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </p>
            </div>
          </motion.div>
        )}

        {/* Account */}
        <SectionLabel label="Account" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SettingRow
            icon={Mail}
            iconBg="#EDE0F7"
            iconColor="#5B0EA6"
            label="Email Address"
            subtitle={user?.email || "Not set"}
            onClick={() => {}}
          />
          <SettingRow
            icon={Phone}
            iconBg="#EDE0F7"
            iconColor="#5B0EA6"
            label="Phone Number"
            subtitle={user?.phone || "Not added"}
            onClick={() => {}}
          />
          <SettingRow
            icon={Lock}
            iconBg="#EDE0F7"
            iconColor="#5B0EA6"
            label="Change Password"
            subtitle="Update your login password"
            onClick={() => {}}
          />
        </div>

        {/* Notifications */}
        <SectionLabel label="Notifications" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            {
              key: "bookings" as keyof typeof notifications,
              label: "Booking Updates",
              subtitle: "Confirmations, QR codes, receipts",
            },
            {
              key: "receipts" as keyof typeof notifications,
              label: "Receipt Alerts",
              subtitle: "When a vendor sends your receipt",
            },
            {
              key: "reminders" as keyof typeof notifications,
              label: "Event Reminders",
              subtitle: "24hrs and 2hrs before your events",
            },
            {
              key: "promotions" as keyof typeof notifications,
              label: "Promotions",
              subtitle: "Deals, featured events, discounts",
            },
          ].map(({ key, label, subtitle }) => (
            <SettingRow
              key={key}
              icon={Bell}
              iconBg="#F2EEF9"
              iconColor="#6B6B6B"
              label={label}
              subtitle={subtitle}
              right={
                <Toggle
                  value={notifications[key]}
                  onChange={(v) =>
                    setNotifications((prev) => ({ ...prev, [key]: v }))
                  }
                />
              }
            />
          ))}
        </div>

        {/* Location & Privacy */}
        <SectionLabel label="Location & Privacy" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SettingRow
            icon={MapPin}
            iconBg="#E0F7EA"
            iconColor="#00C853"
            label="Location Access"
            subtitle="Used to show nearby venues and events"
            right={
              <Toggle
                value={locationAlways}
                onChange={setLocationAlways}
              />
            }
          />
          <SettingRow
            icon={Shield}
            iconBg="#E0F7EA"
            iconColor="#00C853"
            label="Privacy Policy"
            subtitle="How we handle your data"
            onClick={() => {}}
          />
        </div>

        {/* Appearance */}
        <SectionLabel label="Appearance" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SettingRow
            icon={Moon}
            iconBg="#F2EEF9"
            iconColor="#6B6B6B"
            label="Dark Mode"
            subtitle="Coming soon"
            right={
              <Toggle value={darkMode} onChange={setDarkMode} />
            }
          />
          <SettingRow
            icon={Globe}
            iconBg="#F2EEF9"
            iconColor="#6B6B6B"
            label="Language"
            subtitle="English"
            onClick={() => {}}
          />
        </div>

        {/* Danger zone */}
        <SectionLabel label="Account Actions" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SettingRow
            icon={LogOut}
            iconBg="#FEF2F2"
            iconColor="#EF4444"
            label="Sign Out"
            onClick={handleSignOut}
            danger
          />
          <SettingRow
            icon={Trash2}
            iconBg="#FEF2F2"
            iconColor="#EF4444"
            label="Delete Account"
            subtitle="Permanently remove your account and data"
            onClick={handleDeleteAccount}
            danger
          />
        </div>

        {/* App version */}
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#9E9E9E",
            marginTop: 28,
          }}
        >
          Chillz v1.0.0 · Lagos & Port Harcourt
        </p>
      </div>
    </MainLayout>
  );
}