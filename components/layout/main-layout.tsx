"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Calendar, Compass, MessageCircle, User } from "lucide-react";

function ChillzNavIcon({ active }: { active: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/chillz-icon.png"
      alt="Home"
      style={{
        width: 26,
        height: 26,
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
  { href: "/discover", label: "Discover", isChillz: false, icon: Compass       },
  { href: "/bookings", label: "Bookings", isChillz: false, icon: Calendar      },
  { href: "/support",  label: "Support",  isChillz: false, icon: MessageCircle },
  { href: "/profile",  label: "Profile",  isChillz: false, icon: User          },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
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
    <div style={{
      maxWidth: 480,
      margin: "0 auto",
      minHeight: "100vh",
      backgroundColor: "#F7F5FA",
      position: "relative",
      paddingBottom: 80,
    }}>
      {children}

      <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #F2EEF9",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "10px 0 22px",
        zIndex: 40,
        boxShadow: "0 -4px 24px rgba(91,14,166,0.07)",
      }}>
        {NAV_ITEMS.map(({ href, label, isChillz, icon: Icon }) => {
          const active     = href === "/home"
            ? pathname === "/" || pathname === "/home"
            : pathname.startsWith(href);
          const isProfile  = href === "/profile";
          const badgeCount = isProfile ? (unreadCount || 0) : 0;

          return (
            <Link
              key={href}
              href={href}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                minWidth: 52,
              }}
            >
              <div style={{ position: "relative" }}>



                {/* Icon — sits on top of pill */}
                <div style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                }}>
                  {isChillz ? (
                    <ChillzNavIcon active={active} />
                  ) : Icon ? (
                    <Icon
                      size={22}
                      style={{
                        color: active ? "#5B0EA6" : "#C4B5D9",
                        strokeWidth: active ? 2.5 : 1.8,
                        display: "block",
                      }}
                    />
                  ) : null}
                </div>

                {/* Notification badge */}
                {badgeCount > 0 && (
                  <div style={{
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
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  </div>
                )}
              </div>

              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? "#5B0EA6" : "#C4B5D9",
              }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}