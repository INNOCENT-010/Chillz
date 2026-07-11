/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { LocationHeader, LocationConfirmBanner } from "@/components/home/location-header";
import { VenueCard } from "@/components/home/venue-card";
import { EventCard } from "@/components/home/event-card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Zap, Clock, Star } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────
const NIGERIAN_AREAS = [
  "lekki","victoria island","ikeja","surulere","yaba","ikoyi",
  "ajah","festac","apapa","maryland","ojodu","ogba","gbagada",
  "magodo","ketu","berger","abuja","port harcourt","ibadan",
  "kano","enugu","benin","warri","calabar","owerri","uyo",
  "abeokuta","lagos","nigeria","rivers","ogun","oyo",
];
function isNigerianLocation(loc: string) {
  return NIGERIAN_AREAS.some((a) => loc.toLowerCase().includes(a));
}
function hashName(name: string): string {
  if (!name) return "Someone";
  const first = name.trim().split(" ")[0];
  if (first.length <= 2) return first + "**";
  return first.slice(0, 2) + "**";
}
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
function getTimeSignal(): {
  label: string; sub: string;
  period: "tonight"|"weekend"|"week"|"day"
} {
  const hour = new Date().getHours();
  const day  = new Date().getDay();
  const isWeekend = day === 0 || day === 5 || day === 6;
  const isNight   = hour >= 18 || hour < 4;
  const isMorning = hour >= 6 && hour < 12;
  if (isNight)              return { label:"Happening Tonight",  sub:"Spots open and popping right now",    period:"tonight" };
  if (isWeekend && isMorning) return { label:"Weekend Vibes",    sub:"Best spots for your weekend",         period:"weekend" };
  if (isWeekend)            return { label:"This Afternoon",     sub:"Where everyone's headed",             period:"weekend" };
  if (isMorning)            return { label:"Start Your Day",     sub:"Top spots open this morning",         period:"day"     };
  return                           { label:"This Week",          sub:"Best upcoming experiences",           period:"week"    };
}

const CATEGORIES = [
  { key:"event",      label:"Events",              href:"/events",       emoji:"🎉", bg:"#EDE0F7", dbKey:"category_events"     },
  { key:"bar-lounge", label:"Bar & Lounge",        href:"/bar-lounge",   emoji:"🍸", bg:"#FFE4E6", dbKey:"category_bar_lounge"  },
  { key:"club",       label:"Club",                href:"/club",         emoji:"🎵", bg:"#E0E7FF", dbKey:"category_club"        },
  { key:"restaurant", label:"Restaurant\n& Café",  href:"/restaurant",   emoji:"🍽️", bg:"#D1FAE5", dbKey:"category_restaurant"  },
  { key:"apartment",  label:"Apartments\n& Stays", href:"/apartments",   emoji:"🏠", bg:"#DBEAFE", dbKey:"category_apartment"   },
  { key:"hotel",      label:"Hotels\n& Resorts",   href:"/hotel",        emoji:"🏨", bg:"#FEF3C7", dbKey:"category_hotel"       },
  { key:"car_rental", label:"Car Rentals",         href:"/car-rentals",  emoji:"🚗", bg:"#CCFBF1", dbKey:"category_car_rental"  },
  { key:"flight",     label:"Flight\nBooking",     href:"/flights",      emoji:"✈️", bg:"#E0E7FF", dbKey:"category_flight"      },
];

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ title, href, subtitle, icon }: {
  title: string; href: string; subtitle?: string; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      display:"flex", alignItems:"flex-end",
      justifyContent:"space-between",
      padding:"0 16px", marginBottom:14,
    }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          {icon}
          <h2 style={{
            fontSize:18, fontWeight:900, color:"#0A0A0A",
            margin:0, fontFamily:"var(--font-display,Syne,sans-serif)",
          }}>
            {title}
          </h2>
        </div>
        {subtitle && (
          <p style={{ fontSize:11, color:"#9E9E9E", margin:0 }}>{subtitle}</p>
        )}
      </div>
      <Link href={href} style={{
        display:"flex", alignItems:"center", gap:2,
        color:"#5B0EA6", fontSize:12, fontWeight:700,
        textDecoration:"none", flexShrink:0,
      }}>
        See all <ChevronRight size={14} />
      </Link>
    </div>
  );
}

function SkeletonCard({ width, height }: { width: number; height: number }) {
  return (
    <div style={{
      width, height, flexShrink:0, borderRadius:20,
      background:"linear-gradient(90deg,#F2EEF9 25%,#EDE0F7 50%,#F2EEF9 75%)",
      backgroundSize:"200% 100%",
      animation:"shimmer 1.4s infinite",
    }} />
  );
}

function ScrollRow({
  children, loading,
  skeletonCount = 3, skeletonW = 240, skeletonH = 220,
}: {
  children: React.ReactNode; loading: boolean;
  skeletonCount?: number; skeletonW?: number; skeletonH?: number;
}) {
  return (
    <div style={{
      display:"flex", gap:14,
      padding:"4px 16px",
      overflowX:"auto", scrollbarWidth:"none",
    }}>
      {loading
        ? Array.from({ length: skeletonCount }).map((_,i) => (
            <SkeletonCard key={i} width={skeletonW} height={skeletonH} />
          ))
        : children}
    </div>
  );
}

// ── Social proof ticker ───────────────────────────────────────────────────
function SocialProofTicker({ items }: { items: any[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx((p) => (p + 1) % items.length),
      3500,
    );
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length]);

  if (!items.length) return null;
  const item = items[idx];

  return (
    <div style={{
      margin:"0 16px 6px",
      backgroundColor:"#F7F5FA",
      borderRadius:14,
      padding:"10px 14px",
      display:"flex", alignItems:"center", gap:10,
    }}>
      <div style={{
        width:8, height:8, borderRadius:"50%",
        backgroundColor:"#22C55E", flexShrink:0,
        boxShadow:"0 0 6px rgba(34,197,94,0.6)",
        animation:"pulse 1.5s ease-in-out infinite",
      }} />
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity:0, y:6 }}
          animate={{ opacity:1, y:0 }}
          exit={{ opacity:0, y:-6 }}
          transition={{ duration:0.3 }}
          style={{ fontSize:12, color:"#4B4B6B", margin:0, fontWeight:500 }}
        >
          <span style={{ fontWeight:700, color:"#5B0EA6" }}>
            {hashName(item.user_name)}
          </span>
          {" "}just booked{" "}
          <span style={{ fontWeight:700, color:"#0A0A0A" }}>
            {item.venue_name}
          </span>
          {" "}
          <span style={{ color:"#9E9E9E" }}>
            · {formatDistanceToNow(new Date(item.created_at), { addSuffix:true })}
          </span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ── Urgency strip ─────────────────────────────────────────────────────────
function UrgencyStrip({ events }: { events: any[] }) {
  if (!events.length) return null;
  return (
    <div style={{
      margin:"0 0 6px",
      backgroundColor:"#FFF7ED",
      borderTop:"1px solid #FED7AA",
      borderBottom:"1px solid #FED7AA",
      padding:"10px 16px",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <Zap size={13} style={{ color:"#EA580C" }} />
        <span style={{
          fontSize:11, fontWeight:700, color:"#EA580C",
          textTransform:"uppercase", letterSpacing:"0.08em",
        }}>
          Happening Soon
        </span>
      </div>
      <div style={{ display:"flex", gap:10, overflowX:"auto", scrollbarWidth:"none" }}>
        {events.map((ev) => {
          const hoursLeft = Math.max(
            0,
            Math.round((new Date(ev.start_date).getTime() - Date.now()) / 3600000),
          );
          return (
            <Link key={ev.id} href={`/events/${ev.id}`} style={{ textDecoration:"none", flexShrink:0 }}>
              <div style={{
                backgroundColor:"#FFFFFF", borderRadius:14,
                padding:"10px 14px", border:"1.5px solid #FED7AA",
                minWidth:200, maxWidth:240,
              }}>
                <p style={{
                  fontWeight:800, fontSize:13, color:"#0A0A0A",
                  margin:"0 0 4px",
                  overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
                  fontFamily:"var(--font-display,Syne,sans-serif)",
                }}>
                  {ev.title}
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Clock size={11} style={{ color:"#EA580C" }} />
                  <span style={{ fontSize:11, fontWeight:700, color:"#EA580C" }}>
                    {hoursLeft === 0
                      ? "Starting now"
                      : hoursLeft < 24
                      ? `In ${hoursLeft}h`
                      : "This week"}
                  </span>
                  {ev.ticket_price > 0 && (
                    <span style={{ fontSize:11, color:"#9E9E9E", marginLeft:"auto" }}>
                      from {formatCurrency(ev.ticket_price)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Editor's pick ─────────────────────────────────────────────────────────
function EditorPickCard({ content }: { content: any }) {
  if (!content?.title) return null;
  return (
    <div style={{ margin:"0 16px" }}>
      <Link href={content.link_href || "/discover"} style={{ textDecoration:"none" }}>
        <div style={{
          borderRadius:24, overflow:"hidden",
          position:"relative", height:190,
          background:"linear-gradient(135deg,#1a0038,#3D0066)",
        }}>
          {content.image_url && (
            <img
              src={content.image_url}
              alt={content.title}
              style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.72 }}
            />
          )}
          <div style={{
            position:"absolute", inset:0,
            background:"linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.08) 65%)",
            padding:"18px 20px",
            display:"flex", flexDirection:"column", justifyContent:"flex-end",
          }}>
            {content.badge_text && (
              <span style={{
                fontSize:9, fontWeight:700, color:"#FFFFFF",
                backgroundColor:"#5B0EA6", padding:"3px 10px",
                borderRadius:999, marginBottom:8,
                alignSelf:"flex-start",
                textTransform:"uppercase", letterSpacing:"0.1em",
              }}>
                ✦ {content.badge_text}
              </span>
            )}
            <h3 style={{
              fontWeight:900, fontSize:20, color:"#FFFFFF",
              margin:"0 0 4px",
              fontFamily:"var(--font-display,Syne,sans-serif)",
              lineHeight:1.2,
            }}>
              {content.title}
            </h3>
            {content.subtitle && (
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.75)", margin:0 }}>
                {content.subtitle}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuthStore();
  const router   = useRouter();

  const [userCity,      setUserCity]      = useState("Lagos");
  const [gateChecked,   setGateChecked]   = useState(false);
  const [confirmDisplay,setConfirmDisplay] = useState<string | null>(null);
  const [vibe,          setVibe]          = useState<string>("all");

  const now        = new Date().toISOString();
  const timeSignal = useMemo(() => getTimeSignal(), []);

  // ── Onboarding gate ───────────────────────────────────────────────────
  useEffect(() => {
    const onboarded = localStorage.getItem("chillz_onboarded");
    if (!onboarded) router.replace("/onboarding");
    else setGateChecked(true);
  }, []);

  // ── Vibe ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("chillz_vibe");
    if (stored) setVibe(stored);
    else if ((user as any)?.vibe) setVibe((user as any).vibe);
  }, [user]);

  const displayCity = useMemo(() => {
    const part = userCity.split(",")[0].trim();
    return isNigerianLocation(part) ? part : "Lagos";
  }, [userCity]);

  const firstName = useMemo(() => {
    if (!user?.full_name) return null;
    return user.full_name.split(" ")[0];
  }, [user]);

  // Location banner handlers
  const handleConfirm = () => {
    setConfirmDisplay(null);
    try {
      const saved = sessionStorage.getItem("chillz_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        sessionStorage.setItem(
          "chillz_location",
          JSON.stringify({ ...parsed, confirmed: true }),
        );
      }
    } catch { /* ignore */ }
  };

  const handleRetry = () => {
    setConfirmDisplay(null);
    try { sessionStorage.removeItem("chillz_location"); } catch { /* ignore */ }
    window.location.reload();
  };

  // ── Q0: All homepage content in ONE query ─────────────────────────────
  const { data: homepageContent } = useQuery({
    queryKey: ["homepage-content-all"],
    queryFn: async () => {
      const { data } = await (supabase.from("homepage_content") as any)
        .select("section_key,image_url,title,subtitle,badge_text,link_href,is_active")
        .eq("is_active", true);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 5,
    enabled: gateChecked,
  });

  // Editor's pick from homepage content
  const editorPick = useMemo(
    () => (homepageContent || []).find((s: any) => s.section_key === "editor_pick"),
    [homepageContent],
  );

  // ── Q1: Social proof ──────────────────────────────────────────────────
  const { data: socialProof } = useQuery({
    queryKey: ["social-proof"],
    queryFn: async () => {
      const since = new Date(Date.now() - 72 * 3600000).toISOString();
      const { data } = await (supabase.from("bookings") as any)
        .select("id,created_at,users(full_name),venues(name)")
        .gte("created_at", since)
        .not("status","eq","cancelled")
        .order("created_at", { ascending:false })
        .limit(8);
      return ((data || []) as any[]).map((b: any) => ({
        created_at: b.created_at,
        user_name:  b.users?.full_name || "Someone",
        venue_name: b.venues?.name     || "a venue",
      }));
    },
    staleTime:      1000 * 60 * 2,
    refetchInterval:1000 * 60 * 3,
    enabled: gateChecked,
  });

  // ── Q2: Urgency — events in next 48 hrs ───────────────────────────────
  const { data: urgentEvents } = useQuery({
    queryKey: ["urgent-events"],
    queryFn: async () => {
      const in48h = new Date(Date.now() + 48 * 3600000).toISOString();
      const { data } = await supabase
        .from("events")
        .select("id,title,start_date,ticket_price")
        .eq("is_active", true)
        .gt("start_date", now)
        .lt("start_date", in48h)
        .order("start_date", { ascending:true })
        .limit(5);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
    enabled:   gateChecked,
  });

  // ── Q3: Time-aware venues ─────────────────────────────────────────────
  const { data: timeAwareVenues, isLoading: timeLoading } = useQuery({
    queryKey: ["time-aware-venues", timeSignal.period, vibe],
    queryFn: async () => {
      const vibeCategories: Record<string,string[]> = {
        nightlife: ["club","bar-lounge"],
        dining:    ["restaurant","cafe"],
        events:    [],
        stays:     ["hotel","apartment"],
        all:       [],
      };
      const cats = vibeCategories[vibe] || [];

      let q = (supabase.from("venues") as any)
        .select("*")
        .eq("is_active", true)
        .not("category","in",'("car_rental","flight")')
        .order("bookings_count", { ascending:false })
        .order("rating",         { ascending:false });

      if (timeSignal.period === "tonight") {
        q = q.in("category", ["club","bar-lounge","restaurant"]);
      } else if (cats.length > 0) {
        q = q.in("category", cats);
      }

      const { data } = await q.limit(10);

      if (!data || data.length < 3) {
        const { data: fb } = await (supabase.from("venues") as any)
          .select("*")
          .eq("is_active", true)
          .not("category","in",'("car_rental","flight")')
          .order("bookings_count", { ascending:false })
          .limit(10);
        return (fb || []) as any[];
      }
      return data as any[];
    },
    staleTime: 1000 * 60 * 2,
    enabled:   gateChecked,
  });

  // ── Q4: Upcoming events ───────────────────────────────────────────────
  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gt("end_date", now)
        .order("is_featured",  { ascending:false })
        .order("start_date",   { ascending:true  })
        .limit(8);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
    enabled:   gateChecked,
  });

  // ── Q5: Most booked venues ────────────────────────────────────────────
  const { data: topVenues, isLoading: topLoading } = useQuery({
    queryKey: ["top-venues"],
    queryFn: async () => {
      const { data } = await (supabase.from("venues") as any)
        .select("*")
        .eq("is_active", true)
        .not("category","in",'("hotel","apartment","car_rental","flight")')
        .order("bookings_count", { ascending:false })
        .order("rating",         { ascending:false })
        .limit(10);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 5,
    enabled:   gateChecked,
  });

  // ── Q6: Hotels ────────────────────────────────────────────────────────
  const { data: hotels, isLoading: hotelsLoading } = useQuery({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const { data } = await (supabase.from("venues") as any)
        .select("id,name,address,images,rating,review_count,category,vendor_id")
        .eq("is_active", true)
        .eq("category", "hotel")
        .order("rating", { ascending:false })
        .limit(6);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 5,
    enabled:   gateChecked,
  });

  // ── Q7: Apartments ────────────────────────────────────────────────────
  const { data: apartments, isLoading: aptsLoading } = useQuery({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const { data } = await (supabase.from("venues") as any)
        .select("id,name,address,images,rating,review_count,category,vendor_id")
        .eq("is_active", true)
        .eq("category", "apartment")
        .order("rating", { ascending:false })
        .limit(6);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 5,
    enabled:   gateChecked,
  });

  if (!gateChecked) return null;

  return (
    <MainLayout>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50%       { opacity:0.5; transform:scale(0.85); }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ backgroundColor:"#FFFFFF", paddingTop:52 }}>

        {/* Single row: avatar + name LEFT | location pill RIGHT */}
        <div style={{
          display:"flex", alignItems:"center",
          justifyContent:"space-between",
          padding:"0 16px",
        }}>
          {/* LEFT */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:42, height:42, borderRadius:"50%",
              overflow:"hidden", flexShrink:0,
              border:"2.5px solid #EDE0F7",
            }}>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                />
              ) : (
                <div style={{
                  width:"100%", height:"100%",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  backgroundColor:"#5B0EA6",
                }}>
                  <span style={{ fontSize:17, fontWeight:800, color:"#FFFFFF" }}>
                    {firstName?.[0]?.toUpperCase() || "C"}
                  </span>
                </div>
              )}
            </div>
            <p style={{
              fontSize:16, fontWeight:800, color:"#0A0A0A",
              margin:0,
              fontFamily:"var(--font-display,Syne,sans-serif)",
            }}>
              Hi {firstName || "there"} 👋
            </p>
          </div>

          {/* RIGHT — location pill only */}
          <LocationHeader
            onLocationResolved={(city) => setUserCity(city)}
            onShowConfirm={(loc)  => setConfirmDisplay(loc)}
            onHideConfirm={() => setConfirmDisplay(null)}
          />
        </div>

        {/* Location confirm banner — full width, below row */}
        <AnimatePresence>
          {confirmDisplay && (
            <LocationConfirmBanner
              display={confirmDisplay}
              onConfirm={handleConfirm}
              onRetry={handleRetry}
            />
          )}
        </AnimatePresence>

        <div style={{ height:16 }} />
      </div>

      {/* ── HEADLINE ── */}
      <div style={{ backgroundColor:"#FFFFFF", padding:"0 16px 20px" }}>
        <motion.div
          initial={{ opacity:0, y:8 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.1 }}
        >
          <h1 style={{
            fontSize:26, fontWeight:900, color:"#0A0A0A",
            lineHeight:1.2, margin:0,
            fontFamily:"var(--font-display,Syne,sans-serif)",
          }}>
            What are you<br />
            <span style={{ color:"#5B0EA6" }}>exploring today?</span>
          </h1>
        </motion.div>
      </div>

      {/* ── CATEGORY GRID — 4 per row ── */}
      <div style={{ backgroundColor:"#FFFFFF", padding:"4px 16px 28px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {CATEGORIES.map((cat, i) => {
            const catContent = (homepageContent || []).find(
              (s: any) => s.section_key === cat.dbKey,
            );
            const catImage = catContent?.image_url;

            return (
              <motion.div
                key={cat.key}
                initial={{ opacity:0, scale:0.92 }}
                animate={{ opacity:1, scale:1 }}
                transition={{ delay:i * 0.04, type:"spring", stiffness:320, damping:26 }}
              >
                <Link href={cat.href} style={{ textDecoration:"none", display:"block" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                    {/* Tile */}
                    <div style={{
                      width:"100%", aspectRatio:"1",
                      backgroundColor: cat.bg,
                      borderRadius:18,
                      overflow:"hidden",
                      border:"1.5px solid rgba(0,0,0,0.04)",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      position:"relative",
                    }}>
                      {catImage ? (
                        <img
                          src={catImage}
                          alt={cat.label}
                          style={{ width:"100%", height:"100%", objectFit:"cover" }}
                        />
                      ) : (
                        <span style={{ fontSize:26 }}>{cat.emoji}</span>
                      )}
                    </div>
                    {/* Label below */}
                    <p style={{
                      fontSize:10, fontWeight:600, color:"#2D2D2D",
                      textAlign:"center", margin:0,
                      lineHeight:1.3, whiteSpace:"pre-wrap",
                    }}>
                      {cat.label}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── URGENCY STRIP ── */}
      {(urgentEvents?.length || 0) > 0 && (
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:0.2 }}
        >
          <UrgencyStrip events={urgentEvents || []} />
        </motion.div>
      )}

      {/* ── SOCIAL PROOF TICKER ── */}
      {(socialProof?.length || 0) > 0 && (
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:0.25 }}
        >
          <SocialProofTicker items={socialProof || []} />
        </motion.div>
      )}

      {/* ── TIME-AWARE VENUES ── */}
      <div style={{
        backgroundColor:"#FFFFFF",
        paddingTop:22, paddingBottom:24, marginTop:8,
      }}>
        <SectionHeader
          title={timeSignal.label}
          href="/discover"
          subtitle={timeSignal.sub}
          icon={<Zap size={16} style={{ color:"#5B0EA6" }} />}
        />
        <ScrollRow loading={timeLoading} skeletonCount={3} skeletonW={220} skeletonH={220}>
          {(timeAwareVenues || []).map((venue: any, i: number) => (
            <motion.div
              key={venue.id}
              initial={{ opacity:0, x:16 }}
              animate={{ opacity:1, x:0 }}
              transition={{ delay:i * 0.06 }}
            >
              <VenueCard
                id={venue.id}          name={venue.name}
                category={venue.category} address={venue.address}
                image={venue.images?.[0] || ""}
                rating={venue.rating}  reviewCount={venue.review_count}
                tags={venue.filters}   isFeatured={venue.is_featured}
              />
            </motion.div>
          ))}
        </ScrollRow>
      </div>

      {/* ── EDITOR'S PICK ── */}
      {editorPick?.title && (
        <motion.div
          initial={{ opacity:0, y:16 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.3 }}
          style={{
            paddingTop:22, paddingBottom:24,
            backgroundColor:"#FFFFFF", marginTop:8,
          }}
        >
          <div style={{ padding:"0 16px", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <Star size={15} style={{ color:"#F59E0B" }} />
              <h2 style={{
                fontSize:18, fontWeight:900, color:"#0A0A0A",
                margin:0,
                fontFamily:"var(--font-display,Syne,sans-serif)",
              }}>
                Editor's Pick
              </h2>
            </div>
            <p style={{ fontSize:11, color:"#9E9E9E", margin:"2px 0 0" }}>
              Handpicked for you this week
            </p>
          </div>
          <EditorPickCard content={editorPick} />
        </motion.div>
      )}

      {/* ── UPCOMING EVENTS ── */}
      {((upcomingEvents?.length || 0) > 0 || eventsLoading) && (
        <div style={{
          backgroundColor:"#FFFFFF",
          paddingTop:22, paddingBottom:24, marginTop:8,
        }}>
          <SectionHeader
            title="Upcoming Events"
            href="/events"
            subtitle="Don't miss these"
          />
          <ScrollRow loading={eventsLoading} skeletonCount={3} skeletonW={260} skeletonH={230}>
            {(upcomingEvents || []).map((event: any, i: number) => (
              <motion.div
                key={event.id}
                initial={{ opacity:0, x:16 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay:i * 0.06 }}
              >
                <EventCard
                  id={event.id}        title={event.title}
                  address={event.address}
                  image={event.images?.[0] || ""}
                  startDate={event.start_date}
                  ticketPrice={event.ticket_price}
                  tags={event.event_tags}
                  isFeatured={event.is_featured}
                />
              </motion.div>
            ))}
          </ScrollRow>
        </div>
      )}

      {/* ── MOST BOOKED ── */}
      <div style={{
        backgroundColor:"#FFFFFF",
        paddingTop:22, paddingBottom:24, marginTop:8,
      }}>
        <SectionHeader
          title={`Most Booked in ${displayCity}`}
          href="/discover"
          subtitle="Where people keep coming back"
        />
        <ScrollRow loading={topLoading} skeletonCount={3} skeletonW={220} skeletonH={220}>
          {(topVenues || []).map((venue: any, i: number) => (
            <motion.div
              key={venue.id}
              initial={{ opacity:0, x:16 }}
              animate={{ opacity:1, x:0 }}
              transition={{ delay:i * 0.06 }}
            >
              <VenueCard
                id={venue.id}          name={venue.name}
                category={venue.category} address={venue.address}
                image={venue.images?.[0] || ""}
                rating={venue.rating}  reviewCount={venue.review_count}
                tags={venue.filters}   isFeatured={venue.is_featured}
              />
            </motion.div>
          ))}
        </ScrollRow>
      </div>

      {/* ── HOTELS ── */}
      {((hotels?.length || 0) > 0 || hotelsLoading) && (
        <div style={{
          backgroundColor:"#FFFFFF",
          paddingTop:22, paddingBottom:24, marginTop:8,
        }}>
          <SectionHeader
            title="Hotels & Resorts"
            href="/hotel"
            subtitle="Book your stay"
          />
          <ScrollRow loading={hotelsLoading} skeletonCount={3} skeletonW={220} skeletonH={210}>
            {(hotels || []).map((venue: any, i: number) => (
              <motion.div
                key={venue.id}
                initial={{ opacity:0, x:16 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay:i * 0.06 }}
              >
                <VenueCard
                  id={venue.id}          name={venue.name}
                  category={venue.category} address={venue.address}
                  image={venue.images?.[0] || ""}
                  rating={venue.rating}  reviewCount={venue.review_count}
                  tags={[]}              isFeatured={false}
                />
              </motion.div>
            ))}
          </ScrollRow>
        </div>
      )}

      {/* ── APARTMENTS ── */}
      {((apartments?.length || 0) > 0 || aptsLoading) && (
        <div style={{
          backgroundColor:"#FFFFFF",
          paddingTop:22, paddingBottom:32, marginTop:8,
        }}>
          <SectionHeader
            title="Apartments & Shortlets"
            href="/apartments"
            subtitle="Stays near you"
          />
          <ScrollRow loading={aptsLoading} skeletonCount={3} skeletonW={220} skeletonH={210}>
            {(apartments || []).map((venue: any, i: number) => (
              <motion.div
                key={venue.id}
                initial={{ opacity:0, x:16 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay:i * 0.06 }}
              >
                <VenueCard
                  id={venue.id}          name={venue.name}
                  category={venue.category} address={venue.address}
                  image={venue.images?.[0] || ""}
                  rating={venue.rating}  reviewCount={venue.review_count}
                  tags={[]}              isFeatured={false}
                />
              </motion.div>
            ))}
          </ScrollRow>
        </div>
      )}

    </MainLayout>
  );
}