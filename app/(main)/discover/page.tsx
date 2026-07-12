/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, ChevronRight, Ticket, MapPin,
  Calendar, Tag, Sparkles, ChevronLeft, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { TicketPurchaseSheet } from "@/components/events/ticket-purchase-sheet";

function scorePost(post: any, userCategoryWeights: Record<string, number>) {
  const now = Date.now();
  const created = new Date(post.created_at).getTime();
  const ageHours = (now - created) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 100 - ageHours * 0.5);
  const hypeScore = (post.hype_count || 0) * 3;
  const viewScore = (post.view_count || 0) * 0.5;
  const vendorType = post.vendors?.vendor_type || "";
  const relevanceBonus = (userCategoryWeights[vendorType] || 0) * 5;
  return hypeScore + viewScore + recencyScore + relevanceBonus;
}

function OfferStrip({ offers }: { offers: any[] }) {
  const router = useRouter();
  if (!offers.length) return null;
  return (
    <div style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #F2EEF9" }}>
      <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <Tag size={13} style={{ color: "#5B0EA6" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Live Offers
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "8px 16px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
        {offers.map((offer) => (
          <button key={offer.id} onClick={() => router.push(`/discover/${offer.id}`)}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #EDE0F7", borderRadius: 14, padding: "8px 12px", cursor: "pointer", maxWidth: 220 }}>
            {offer.images?.[0] && (
              <img src={offer.images[0]} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {offer.offer_title || offer.caption}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {offer.offer_discount_pct && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#00C853", backgroundColor: "#E0F7EA", padding: "1px 6px", borderRadius: 999 }}>
                    {offer.offer_discount_pct}% OFF
                  </span>
                )}
                <span style={{ fontSize: 10, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {offer.vendors?.business_name}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, isHyped, onHype, onView, onBuyTicket }: {
  post: any;
  isHyped: boolean;
  onHype: () => void;
  onView: () => void;
  onBuyTicket: (event: any) => void;
}) {
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  const [showHypeAnimation, setShowHypeAnimation] = useState(false);
  const [ticketConfirmed, setTicketConfirmed] = useState(false);
  const lastTap = useRef(0);
  const viewedRef = useRef(false);

  // Track view once on mount
  if (!viewedRef.current) { viewedRef.current = true; onView(); }

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!isHyped) {
        onHype();
        setShowHypeAnimation(true);
        setTimeout(() => setShowHypeAnimation(false), 900);
      }
    }
    lastTap.current = now;
  };

  const images = post.images || [];
  const hasImages = images.length > 0;
  const isCarousel = images.length > 1;
  const vendorName = post.vendors?.business_name || "Vendor";
  const vendorType = post.vendors?.vendor_type?.replace(/_/g, " ") || "";
  const event = post.events;
  const hasTickets = event && (
    (event.ticket_types && event.ticket_types.length > 0) ||
    (event.ticket_price !== undefined && event.ticket_price !== null)
  );
  const isSoldOut = event?.capacity && (event?.tickets_sold || 0) >= event.capacity;
  const lowestPrice = event?.ticket_types?.length
    ? Math.min(...event.ticket_types.map((t: any) => t.price || 0))
    : event?.ticket_price || 0;

  const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    poster:   { label: "Poster",  color: "#5B0EA6", bg: "#EDE0F7" },
    carousel: { label: "Gallery", color: "#2563EB", bg: "#EFF6FF" },
    writeup:  { label: "Update",  color: "#059669", bg: "#E0F7EA" },
    offer:    { label: "Offer",   color: "#D97706", bg: "#FEF3C7" },
    lineup:   { label: "Lineup",  color: "#DB2777", bg: "#FCE7F3" },
  };
  const typeStyle = TYPE_LABELS[post.post_type] || TYPE_LABELS.poster;

  return (
    <div onClick={handleTap}
      style={{ backgroundColor: "#FFFFFF", borderRadius: 24, overflow: "hidden", marginBottom: 14, boxShadow: "0 2px 16px rgba(91,14,166,0.08)", border: "1.5px solid #F2EEF9", position: "relative", cursor: "pointer" }}>

      {/* Image area */}
      {hasImages && (
        <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", backgroundColor: "#0A0A0A" }}>
          <img src={images[activeImage]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 30%, rgba(0,0,0,0.5) 100%)" }} />
          <div style={{ position: "absolute", top: 12, left: 12, backgroundColor: typeStyle.bg, borderRadius: 999, padding: "3px 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: typeStyle.color }}>{typeStyle.label}</span>
          </div>

          {isCarousel && (
            <>
              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                {images.map((_: any, i: number) => (
                  <div key={i} style={{ width: i === activeImage ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }} />
                ))}
              </div>
              {activeImage > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setActiveImage(activeImage - 1); }}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.4)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={16} style={{ color: "#FFFFFF" }} />
                </button>
              )}
              {activeImage < images.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); setActiveImage(activeImage + 1); }}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.4)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={16} style={{ color: "#FFFFFF" }} />
                </button>
              )}
            </>
          )}

          {/* Double-tap hype animation */}
          <AnimatePresence>
            {showHypeAnimation && (
              <motion.div initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
                style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Heart size={80} style={{ color: "#FF4B6E", fill: "#FF4B6E", filter: "drop-shadow(0 0 20px rgba(255,75,110,0.6))" }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "14px" }}>

        {/* Vendor row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (!post.vendors?.id) return;
              if (post.vendors.vendor_type === "event_organizer") {
                router.push(`/organizer/${post.vendors.id}`);
              } else if (post.vendors.venue_id) {
                router.push(`/venue/${post.vendors.venue_id}`);
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {post.vendors?.venues?.images?.[0]
                ? <img src={post.vendors.venues.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 14, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {vendorName[0]?.toUpperCase()}
                  </span>}
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{vendorName}</p>
              <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, textTransform: "capitalize" }}>{vendorType}</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onHype(); }}
            style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: isHyped ? "#FEF2F2" : "#F7F5FA", border: `1.5px solid ${isHyped ? "#FECACA" : "#E4DCF0"}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>
            <Heart size={14} style={{ color: isHyped ? "#EF4444" : "#9E9E9E", fill: isHyped ? "#EF4444" : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: isHyped ? "#EF4444" : "#9E9E9E" }}>{post.hype_count || 0}</span>
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <p style={{ fontSize: 13, color: "#0A0A0A", lineHeight: 1.6, margin: "0 0 10px" }}>{post.caption}</p>
        )}

        {/* ── Event ticket strip ── */}
        {event && hasTickets && (
          <div onClick={(e) => { e.stopPropagation(); router.push(`/discover/${post.id}`); }}
            style={{ backgroundColor: isSoldOut ? "#F7F5FA" : "#F9F5FF", borderRadius: 16, padding: "12px 14px", marginBottom: 10, border: `1.5px solid ${isSoldOut ? "#E4DCF0" : "#EDE0F7"}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>

            {/* Event thumbnail */}
            <div style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
              {event.images?.[0]
                ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Calendar size={18} style={{ color: "#5B0EA6" }} />
                  </div>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {event.title}
              </p>
              <p style={{ fontSize: 10, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                {format(new Date(event.start_date), "dd MMM · HH:mm")}
              </p>
            </div>

            {/* Ticket CTA */}
            {isSoldOut ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>
                Sold Out
              </span>
            ) : ticketConfirmed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#E0F7EA", borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}>
                <CheckCircle size={13} style={{ color: "#00C853" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#00C853" }}>Got it!</span>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onBuyTicket(event); }}
                style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(91,14,166,0.3)" }}>
                <Ticket size={12} />
                {lowestPrice === 0 ? "Free" : formatCurrency(lowestPrice)}
              </button>
            )}
          </div>
        )}

        {/* Offer block */}
        {post.post_type === "offer" && post.offer_title && (
          <Link href={`/discover/${post.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#FEF3C7", borderRadius: 14, padding: "10px 14px", marginBottom: 10, border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#92400E", margin: "0 0 2px" }}>{post.offer_title}</p>
                {post.offer_expires_at && (
                  <p style={{ fontSize: 10, color: "#D97706", margin: 0 }}>Expires {format(new Date(post.offer_expires_at), "dd MMM")}</p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {post.offer_discount_pct && (
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#059669" }}>{post.offer_discount_pct}% OFF</span>
                )}
                <ChevronRight size={14} style={{ color: "#D97706" }} />
              </div>
            </div>
          </Link>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {post.tags.slice(0, 4).map((tag: string) => (
              <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 9px", borderRadius: 999 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* View post CTA */}
        <button onClick={(e) => { e.stopPropagation(); router.push(`/discover/${post.id}`); }}
          style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1.5px solid #EDE0F7", backgroundColor: "#F7F5FA", color: "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
          View Post <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [hypedIds, setHypedIds] = useState<Set<string>>(new Set());
  const [ticketSheetEvent, setTicketSheetEvent] = useState<any>(null);

  const { data: userBehaviour } = useQuery({
    queryKey: ["user-behaviour", user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      const { data } = await (supabase.from("bookings") as any)
        .select("venues(category), vendors(vendor_type)")
        .eq("user_id", user.id).limit(30);
      const weights: Record<string, number> = {};
      ((data || []) as any[]).forEach((b: any) => {
        const type = b.vendors?.vendor_type || b.venues?.category;
        if (type) weights[type] = (weights[type] || 0) + 1;
      });
      const { data: views } = await supabase.from("post_views").select("vendor_type").eq("user_id", user.id).limit(50);
      ((views || []) as any[]).forEach((v: any) => {
        if (v.vendor_type) weights[v.vendor_type] = (weights[v.vendor_type] || 0) + 0.3;
      });
      return weights;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useQuery({
    queryKey: ["user-hypes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("post_hypes").select("post_id").eq("user_id", user.id);
      const ids = new Set((data || []).map((h: any) => h.post_id));
      setHypedIds(ids);
      return ids;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const { data: rawPosts, isLoading } = useQuery({
    queryKey: ["discover-posts"],
    queryFn: async () => {
      const { data: posts } = await (supabase.from("vendor_posts") as any)
        .select("*").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(100);
      if (!posts?.length) return [];

      const vendorIds = [...new Set(posts.map((p: any) => p.vendor_id).filter(Boolean))];
      const { data: vendors } = await (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type, venue_id").in("id", vendorIds);

      const venueIds = (vendors || []).map((v: any) => v.venue_id).filter(Boolean);
      const { data: venueImages } = venueIds.length
        ? await (supabase.from("venues") as any).select("id, images").in("id", venueIds)
        : { data: [] };

      const eventIds = [...new Set(posts.map((p: any) => p.linked_event_id).filter(Boolean))];
      const { data: events } = eventIds.length
        ? await (supabase.from("events") as any)
            .select("id, title, start_date, end_date, ticket_price, ticket_types, address, custom_venue_address, capacity, tickets_sold, vendor_id, images")
            .in("id", eventIds)
        : { data: [] };

      const vendorMap: Record<string, any> = {};
      (vendors || []).forEach((v: any) => { vendorMap[v.id] = v; });
      const venueImageMap: Record<string, string[]> = {};
      (venueImages || []).forEach((ve: any) => { venueImageMap[ve.id] = ve.images || []; });
      const eventMap: Record<string, any> = {};
      (events || []).forEach((e: any) => { eventMap[e.id] = e; });

      return posts.map((post: any) => {
        const vendor = vendorMap[post.vendor_id] || null;
        const venueImgs = vendor?.venue_id ? venueImageMap[vendor.venue_id] : [];
        return {
          ...post,
          vendors: vendor ? { ...vendor, venues: { images: venueImgs } } : null,
          events: post.linked_event_id ? eventMap[post.linked_event_id] || null : null,
        };
      });
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const { data: offers } = useQuery({
    queryKey: ["discover-offers"],
    queryFn: async () => {
      const { data: posts } = await (supabase.from("vendor_posts") as any)
        .select("*").eq("is_active", true).eq("post_type", "offer")
        .gt("offer_expires_at", new Date().toISOString())
        .order("hype_count", { ascending: false }).limit(10);
      if (!posts?.length) return [];

      const vendorIds = [...new Set(posts.map((p: any) => p.vendor_id).filter(Boolean))];
      const { data: vendors } = await (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type").in("id", vendorIds);
      const vendorMap: Record<string, any> = {};
      (vendors || []).forEach((v: any) => { vendorMap[v.id] = v; });
      return posts.map((post: any) => ({ ...post, vendors: vendorMap[post.vendor_id] || null }));
    },
    staleTime: 1000 * 60,
  });

  const posts = rawPosts
    ? [...rawPosts].sort((a, b) => scorePost(b, userBehaviour || {}) - scorePost(a, userBehaviour || {}))
    : [];

  const hypeMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      const { data, error } = await (supabase as any).rpc("toggle_post_hype", {
        p_post_id: postId,
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = (data as any)?.[0];
      setHypedIds((prev) => {
        const next = new Set(prev);
        if (result?.hyped) next.add(postId); else next.delete(postId);
        return next;
      });
      // Optimistically update the count in the cache without waiting for refetch
      qc.setQueryData(["discover-posts"], (old: any) => {
        if (!old) return old;
        return old.map((p: any) =>
          p.id === postId
            ? { ...p, hype_count: result?.new_hype_count ?? p.hype_count }
            : p
        );
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discover-posts"] }); },
  });

  const trackView = useCallback(async (post: any) => {
    await (supabase.from("post_views") as any).insert({
      post_id: post.id, user_id: user?.id || null,
      vendor_type: post.vendors?.vendor_type || null, post_type: post.post_type,
    });
    await (supabase.from("vendor_posts") as any)
      .update({ view_count: (post.view_count || 0) + 1 }).eq("id", post.id);
  }, [user?.id]);

  return (
    <MainLayout>
      <div style={{ backgroundColor: "#FFFFFF" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #F2EEF9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Discover</h1>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>What's hyped right now</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "5px 12px" }}>
              <Sparkles size={12} style={{ color: "#5B0EA6" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{posts.length} posts</span>
            </div>
          </div>
        </div>
        {offers && offers.length > 0 && <OfferStrip offers={offers} />}
      </div>

      <div style={{ padding: "14px 16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <div style={{ height: 240, backgroundColor: "#F2EEF9" }} />
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 16, backgroundColor: "#F2EEF9", borderRadius: 8, width: "60%" }} />
                  <div style={{ height: 12, backgroundColor: "#F2EEF9", borderRadius: 8, width: "90%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Nothing posted yet</p>
            <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Vendors will start posting events and offers here</p>
          </div>
        ) : (
          posts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              isHyped={hypedIds.has(post.id)}
              onHype={() => { if (!user) return; hypeMutation.mutate(post.id); }}
              onView={() => trackView(post)}
              onBuyTicket={(event) => setTicketSheetEvent(event)}
            />
          ))
        )}
      </div>

      {/* Global ticket purchase sheet */}
      {ticketSheetEvent && (
        <TicketPurchaseSheet
          event={ticketSheetEvent}
          isOpen={!!ticketSheetEvent}
          onClose={() => setTicketSheetEvent(null)}
          onSuccess={() => {
            setTicketSheetEvent(null);
            qc.invalidateQueries({ queryKey: ["discover-posts"] });
          }}
          navigateOnSuccess={false}
        />
      )}
    </MainLayout>
  );
}