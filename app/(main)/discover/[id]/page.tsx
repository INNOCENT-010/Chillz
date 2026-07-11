/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { TicketPurchaseSheet } from "@/components/events/ticket-purchase-sheet";
import {
  ArrowLeft, Star, MapPin, Calendar, Ticket,
  Tag, ChevronRight, ChevronLeft, Share2, Clock,
  Navigation, Building2, CheckCircle, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [ticketSheetOpen, setTicketSheetOpen] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post-detail", id],
    queryFn: async () => {
      // Step 1: fetch the post row only — no joins
      const { data: postData, error: postError } = await (supabase
        .from("vendor_posts") as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (postError) throw postError;
      if (!postData) return null;

      // Step 2: fetch vendor flat
      let vendor: any = null;
      if (postData.vendor_id) {
        const { data: vendorData } = await (supabase
          .from("vendors") as any)
          .select("id, business_name, vendor_type, description, phone, instagram, venue_id")
          .eq("id", postData.vendor_id)
          .maybeSingle();
        vendor = vendorData || null;
      }

      // Step 3: fetch venue flat using vendor.venue_id
      let venue: any = null;
      if (vendor?.venue_id) {
        const { data: venueData } = await (supabase
          .from("venues") as any)
          .select("id, name, address, images, rating, review_count, lat, lng, filters, category")
          .eq("id", vendor.venue_id)
          .maybeSingle();
        venue = venueData || null;
      }

      // Step 4: fetch linked event flat
      let event: any = null;
      if (postData.linked_event_id) {
        const { data: eventData } = await (supabase
          .from("events") as any)
          .select("id, title, description, start_date, end_date, address, custom_venue_address, ticket_price, ticket_types, images, capacity, tickets_sold, vendor_id")
          .eq("id", postData.linked_event_id)
          .maybeSingle();
        event = eventData || null;
      }

      return {
        ...postData,
        vendor: vendor,
        venue: venue,
        event: event,
      };
    },
    staleTime: 0,
    retry: 1,
  });

  const { data: reviews } = useQuery({
    queryKey: ["post-vendor-reviews", post?.venue?.id],
    queryFn: async () => {
      const venueId = post?.venue?.id;
      if (!venueId) return [];
      const { data } = await (supabase.from("reviews") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as any[];
    },
    enabled: !!post?.venue?.id,
    staleTime: 1000 * 60,
  });

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </MainLayout>
  );

  if (!post) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ fontSize: 14, color: "#6B6B6B" }}>Post not found</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </MainLayout>
  );

  // Use flat keys — not nested
  const vendor = post.vendor || {};
  const venue = post.venue || {};
  const event = post.event;
  const images = post.images?.length ? post.images : (venue.images || []);
  const hasReviews = reviews && reviews.length > 0;

  const ratingLabel =
    venue.rating >= 4.5 ? "Exceptional" :
    venue.rating >= 4   ? "Very Good" :
    venue.rating >= 3   ? "Good" : "Pleasant";

  const TYPE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    poster:   { color: "#5B0EA6", bg: "#EDE0F7", label: "Poster" },
    carousel: { color: "#2563EB", bg: "#EFF6FF", label: "Gallery" },
    writeup:  { color: "#059669", bg: "#E0F7EA", label: "Update" },
    offer:    { color: "#D97706", bg: "#FEF3C7", label: "Offer" },
    lineup:   { color: "#DB2777", bg: "#FCE7F3", label: "Lineup" },
  };
  const typeStyle = TYPE_COLORS[post.post_type] || TYPE_COLORS.poster;

  const hasTickets = event && (
    (event.ticket_types && event.ticket_types.length > 0) ||
    (event.ticket_price !== undefined && event.ticket_price !== null)
  );
  const lowestPrice = event?.ticket_types?.length
    ? Math.min(...event.ticket_types.map((t: any) => t.price ?? 0))
    : (event?.ticket_price ?? 0);
  const isSoldOut = event?.capacity && (event?.tickets_sold || 0) >= event.capacity;
  const capacityPct = event?.capacity
    ? Math.min(100, Math.round(((event.tickets_sold || 0) / event.capacity) * 100))
    : 0;

  const handleShare = async () => {
    const url = `${window.location.origin}/discover/${id}`;
    if (navigator.share) await navigator.share({ title: vendor.business_name || "Post", url });
    else await navigator.clipboard.writeText(url);
  };

  return (
    <MainLayout>

      {/* Image carousel */}
      {images.length > 0 && (
        <div style={{ position: "relative", height: 340, backgroundColor: "#0A0A0A", overflow: "hidden" }}>
          <img
            src={images[activeImage]}
            alt=""
            onClick={() => setLightboxOpen(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)", pointerEvents: "none" }} />

          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
            <button onClick={() => router.back()}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={20} style={{ color: "#FFFFFF" }} />
            </button>
            <button onClick={handleShare}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={18} style={{ color: "#FFFFFF" }} />
            </button>
          </div>

          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", backgroundColor: typeStyle.bg, borderRadius: 999, padding: "4px 14px", pointerEvents: "none" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: typeStyle.color }}>{typeStyle.label}</span>
          </div>

          {images.length > 1 && (
            <>
              {activeImage > 0 && (
                <button onClick={() => setActiveImage(activeImage - 1)}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronLeft size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}
              {activeImage < images.length - 1 && (
                <button onClick={() => setActiveImage(activeImage + 1)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}
              <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                {images.map((_: any, i: number) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
              <div style={{ position: "absolute", bottom: 30, right: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "3px 9px" }}>
                <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: 600 }}>{activeImage + 1}/{images.length}</span>
              </div>
            </>
          )}

          <div style={{ position: "absolute", bottom: images.length > 1 ? 46 : 14, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, padding: "3px 10px", pointerEvents: "none" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Tap image to zoom</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: images.length > 0 ? "24px 24px 0 0" : 0, marginTop: images.length > 0 ? -16 : 0, padding: "20px 16px 0", position: "relative", zIndex: 1 }}>

        {images.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
              <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A" }}>Post Detail</span>
          </div>
        )}

        {/* Vendor header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: "2px solid #F2EEF9" }}>
            {venue.images?.[0]
              ? <img src={venue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Building2 size={22} style={{ color: "#5B0EA6" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, fontSize: 17, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {vendor.business_name || venue.name || "Unknown Vendor"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {vendor.vendor_type && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize" }}>
                  {vendor.vendor_type.replace(/_/g, " ")}
                </span>
              )}
              {venue.address && (
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={10} style={{ color: "#9E9E9E" }} />
                  <span style={{ fontSize: 10, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 180 }}>
                    {venue.address}
                  </span>
                </div>
              )}
            </div>
          </div>
          {(venue.rating || 0) > 0 && (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, backgroundColor: "#5B0EA6", borderRadius: 999, padding: "4px 10px" }}>
              <Star size={11} style={{ color: "#FBBF24", fill: "#FBBF24" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>{Number(venue.rating).toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p style={{ fontSize: 14, color: "#0A0A0A", lineHeight: 1.75, margin: "0 0 14px" }}>{post.caption}</p>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {post.tags.map((tag: string) => (
              <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 9px", borderRadius: 999 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Offer block */}
        {post.post_type === "offer" && post.offer_title && (
          <div style={{ backgroundColor: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 16, padding: "14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Tag size={16} style={{ color: "#D97706" }} />
              <p style={{ fontWeight: 900, fontSize: 16, color: "#92400E", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)", flex: 1 }}>
                {post.offer_title}
              </p>
              {post.offer_discount_pct && (
                <span style={{ fontSize: 18, fontWeight: 900, color: "#059669", fontFamily: "var(--font-display, Syne, sans-serif)", flexShrink: 0 }}>
                  {post.offer_discount_pct}% OFF
                </span>
              )}
            </div>
            {post.offer_description && (
              <p style={{ fontSize: 13, color: "#92400E", margin: "0 0 8px", lineHeight: 1.6 }}>{post.offer_description}</p>
            )}
            {post.offer_expires_at && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={12} style={{ color: "#D97706" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#D97706" }}>
                  Expires {format(new Date(post.offer_expires_at), "dd MMM yyyy")}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />

        {/* Linked event */}
        {event && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              About this Event
            </h3>

            {event.images?.[0] && (
              <div style={{ height: 170, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                <img src={event.images[0]} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px", border: "1px solid #EDE0F7", marginBottom: 12 }}>
              <p style={{ fontWeight: 900, fontSize: 16, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {event.title}
              </p>
              {event.description && (
                <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6, margin: "0 0 12px" }}>{event.description}</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600 }}>
                    {format(new Date(event.start_date), "EEEE, dd MMMM yyyy · HH:mm")}
                  </span>
                </div>
                {(event.address || event.custom_venue_address) && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <MapPin size={14} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.4 }}>
                      {event.address || event.custom_venue_address}
                    </span>
                  </div>
                )}
                {event.capacity && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Building2 size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                        {event.tickets_sold || 0} / {event.capacity} attending
                      </span>
                      {isSoldOut && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 999 }}>
                          Sold Out
                        </span>
                      )}
                    </div>
                    <div style={{ height: 5, backgroundColor: "#E4DCF0", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 999, width: `${capacityPct}%`, backgroundColor: isSoldOut ? "#EF4444" : capacityPct > 80 ? "#F59E0B" : "#5B0EA6", transition: "width 0.4s" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket types */}
            {event.ticket_types && event.ticket_types.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                  Ticket Types
                </p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                  {event.ticket_types.map((t: any, i: number) => {
                    const soldOut = t.available !== undefined && t.available <= 0;
                    return (
                      <div key={i} style={{ flexShrink: 0, backgroundColor: soldOut ? "#F7F5FA" : "#FFFFFF", borderRadius: 14, padding: "12px 14px", border: `1.5px solid ${soldOut ? "#E4DCF0" : "#EDE0F7"}`, minWidth: 130, opacity: soldOut ? 0.6 : 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>{t.name}</p>
                        <p style={{ fontSize: 15, fontWeight: 900, color: soldOut ? "#9E9E9E" : "#5B0EA6", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                          {t.price === 0 ? "Free" : formatCurrency(t.price)}
                        </p>
                        <p style={{ fontSize: 9, fontWeight: 700, color: soldOut ? "#EF4444" : "#9E9E9E", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {soldOut ? "Sold out" : t.available !== undefined ? `${t.available} left` : "Available"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Get Tickets CTA */}
            {hasTickets && (
              <button
                onClick={() => setTicketSheetOpen(true)}
                disabled={!!isSoldOut}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: isSoldOut ? "#9E9E9E" : "#5B0EA6", borderRadius: 16, padding: "14px 18px", border: "none", cursor: isSoldOut ? "not-allowed" : "pointer", boxShadow: isSoldOut ? "none" : "0 4px 20px rgba(91,14,166,0.35)" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 1px" }}>
                    {isSoldOut ? "Event sold out" : "Starting from"}
                  </p>
                  <p style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {lowestPrice === 0 ? "Free" : formatCurrency(lowestPrice)}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "9px 16px" }}>
                  <Ticket size={15} style={{ color: "#FFFFFF" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
                    {isSoldOut ? "Sold Out" : "Get Tickets"}
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Host info */}
        {(venue.name || vendor.business_name) && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                About the Host
              </h3>

              {(venue.rating || 0) > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ backgroundColor: "#5B0EA6", borderRadius: 8, padding: "4px 10px" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>{Number(venue.rating).toFixed(1)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{ratingLabel}</span>
                  {(venue.review_count || 0) > 0 && (
                    <span style={{ fontSize: 12, color: "#9E9E9E" }}>· {venue.review_count} reviews</span>
                  )}
                </div>
              )}

              {vendor.description && (
                <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: "0 0 12px" }}>{vendor.description}</p>
              )}

              {venue.filters?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {venue.filters.map((f: string) => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 600, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "3px 9px", borderRadius: 999 }}>{f}</span>
                  ))}
                </div>
              )}

              {venue.address && (
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <MapPin size={15} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#6B6B6B", flex: 1, lineHeight: 1.4 }}>{venue.address}</span>
                  {venue.lat && venue.lng && venue.lat !== 0 && venue.lng !== 0 && (
                    <button
                      onClick={() => {
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        if (isIOS) window.open(`maps://?daddr=${venue.lat},${venue.lng}`, "_blank");
                        else window.open(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`, "_blank");
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      <Navigation size={11} />Go
                    </button>
                  )}
                </div>
              )}

              {vendor.instagram && (
                <a href={`https://instagram.com/${vendor.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FDF2F8", border: "1px solid #FBBF24", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 16 }}>📸</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>@{vendor.instagram.replace(/^@/, "")}</span>
                </a>
              )}
            </div>
          </>
        )}

        {/* Reviews */}
        {hasReviews && (
          <>
            <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 16 }} />
            <div style={{ marginBottom: 100 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                What people say
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews!.map((review: any, i: number) => (
                  <motion.div key={review.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#5B0EA6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {review.users?.avatar_url
                          ? <img src={review.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 12, fontWeight: 900, color: "#FFFFFF" }}>{review.users?.full_name?.[0]?.toUpperCase() || "U"}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: "0 0 2px" }}>{review.users?.full_name || "Guest"}</p>
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star key={si} size={10} style={{ color: si < review.rating ? "#FFD700" : "#E4DCF0", fill: si < review.rating ? "#FFD700" : "#E4DCF0" }} />
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: "#9E9E9E" }}>
                        {format(new Date(review.created_at), "dd MMM")}
                      </span>
                    </div>
                    {review.comment && (
                      <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>"{review.comment}"</p>
                    )}
                    {review.vendor_reply && (
                      <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: "2px solid #5B0EA6" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6", margin: "0 0 2px" }}>Venue Reply</p>
                        <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>{review.vendor_reply}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}

        {!hasReviews && <div style={{ height: 100 }} />}
      </div>

      {/* Bottom CTA */}
      {venue.id && (
        <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, padding: "10px 16px", backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
          <Link href={`/venue/${venue.id}`} style={{ textDecoration: "none", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#5B0EA6", borderRadius: 16, padding: "14px 18px", boxShadow: "0 4px 20px rgba(91,14,166,0.35)" }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 1px" }}>Visit venue page</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>{venue.name || vendor.business_name}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 14px" }}>
                <CheckCircle size={14} style={{ color: "#FFFFFF" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>View & Book</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Ticket sheet */}
      {ticketSheetOpen && event && (
        <TicketPurchaseSheet
          event={{ ...event, vendor_id: event.vendor_id || post.vendor_id }}
          isOpen={ticketSheetOpen}
          onClose={() => setTicketSheetOpen(false)}
          navigateOnSuccess={true}
          onSuccess={() => {
            setTicketSheetOpen(false);
            qc.invalidateQueries({ queryKey: ["post-detail", id] });
          }}
        />
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.96)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>

            <motion.img
              initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              src={images[activeImage]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }}
            />

            <button onClick={() => setLightboxOpen(false)}
              style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>

            {images.length > 1 && (
              <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px" }}>
                <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 600 }}>{activeImage + 1} / {images.length}</span>
              </div>
            )}

            {images.length > 1 && activeImage > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setActiveImage(activeImage - 1); }}
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}

            {images.length > 1 && activeImage < images.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); setActiveImage(activeImage + 1); }}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}

            {images.length > 1 && (
              <div style={{ position: "absolute", bottom: 32, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                {images.map((_: any, i: number) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setActiveImage(i); }}
                    style={{ width: i === activeImage ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>
            )}

            <p style={{ position: "absolute", bottom: 12, color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              Tap outside to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}