"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Play, MessageCircle, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

function ChillzNavIcon({ active }: { active: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/chillz-icon.png"
      alt="Home"
      width={28}
      height={28}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        objectFit: "cover",
        opacity: active ? 1 : 0.38,
        transform: active ? "scale(1.1)" : "scale(1)",
        transition: "all 0.18s ease",
        display: "block",
      }}
    />
  );
}

const NAV_ITEMS = [
  { href: "/home",     label: "Home",     isChillz: true,  icon: null          },
  { href: "/bookings", label: "Bookings", isChillz: false, icon: Calendar      },
  { href: "/feeds",    label: "Feeds",    isChillz: false, icon: Play          },
  { href: "/support",  label: "Support",  isChillz: false, icon: MessageCircle },
  { href: "/profile",  label: "Profile",  isChillz: false, icon: User          },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();

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

  return (
    <>
      {/* Spacer so content clears the nav */}
      <div style={{ height: 72 }} />

      <nav
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 50,
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E4DCF0",
          boxShadow: "0 -4px 20px rgba(91,14,166,0.07)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "10px 0 12px" }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, isChillz }) => {
            const active     = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
            const isProfile  = href === "/profile";
            const badgeCount = isProfile ? (unreadCount || 0) : 0;

            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                  flex: 1,
                }}
              >
                <div style={{ position: "relative" }}>

                  {/* Pill renders first — sits below icon */}
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      style={{
                        position: "absolute",
                        inset: -8,
                        backgroundColor: "#EDE0F7",
                        borderRadius: 12,
                        zIndex: 0,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* Icon sits on top of pill */}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                    }}
                  >
                    {isChillz ? (
                      <ChillzNavIcon active={active} />
                    ) : Icon ? (
                      <Icon
                        size={22}
                        style={{
                          color: active ? "#5B0EA6" : "#9E9E9E",
                          strokeWidth: active ? 2.5 : 1.8,
                          display: "block",
                        }}
                      />
                    ) : null}
                  </div>

                  {/* Badge */}
                  {badgeCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: -6, right: -8,
                        minWidth: 16, height: 16,
                        borderRadius: 999,
                        backgroundColor: "#EF4444",
                        border: "2px solid #FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 3,
                        padding: "0 3px",
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    </div>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#5B0EA6" : "#9E9E9E",
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}