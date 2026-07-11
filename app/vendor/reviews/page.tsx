/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { ArrowLeft, Star, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";

const ACCENT    = "#5B0EA6";
const ACCENT_BG = "#EDE0F7";

export default function VendorReviewsPage() {
  const router   = useRouter();
  const { user } = useAuthStore();

  // ── Get vendor record ─────────────────────────────────────────────────
  const { data: vendor } = useQuery({
    queryKey: ["vendor", user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("vendors") as any)
        .select("id, business_name, vendor_type")
        .eq("user_id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // ── Get vendor's venue ────────────────────────────────────────────────
  const { data: venue } = useQuery({
    queryKey: ["vendor-venue", vendor?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("venues") as any)
        .select("id, name, rating, review_count")
        .eq("vendor_id", vendor!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!vendor?.id,
    staleTime: 1000 * 60,
  });

  // ── Get all reviews for this venue ────────────────────────────────────
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["vendor-reviews", venue?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("reviews") as any)
        .select(`
          id, rating, comment, created_at,
          users(full_name, avatar_url)
        `)
        .eq("venue_id", venue!.id)
        .order("created_at", { ascending: false });
      if (error) { console.error("Reviews fetch error:", error); return []; }
      return (data || []) as any[];
    },
    enabled: !!venue?.id,
    staleTime: 1000 * 30,
  });

  const avgRating   = venue?.rating || 0;
  const reviewCount = venue?.review_count || reviews.length;

  const starCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter((r: any) => r.rating === star).length,
  }));

  return (
    <MainLayout>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", backgroundColor: "#F7F5FA", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,#3B0764,${ACCENT})`, padding: "16px 16px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6 }}>
              <ArrowLeft size={22} style={{ color: "#FFFFFF" }} />
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
              Reviews
            </h1>
          </div>

          {/* Rating summary */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 42, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)", lineHeight: 1 }}>
                  {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                </p>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", margin: "6px 0 4px" }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={12} style={{
                      color: s <= Math.round(avgRating) ? "#FBBF24" : "rgba(255,255,255,0.3)",
                      fill:  s <= Math.round(avgRating) ? "#FBBF24" : "rgba(255,255,255,0.3)",
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>
                  {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Star breakdown bars */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                {starCounts.map(({ star, count }) => (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", width: 8, textAlign: "right" }}>{star}</span>
                    <Star size={9} style={{ color: "#FBBF24", fill: "#FBBF24", flexShrink: 0 }} />
                    <div style={{ flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999 }}>
                      <div style={{
                        height: "100%", borderRadius: 999, backgroundColor: "#FBBF24",
                        width: reviewCount > 0 ? `${(count / reviewCount) * 100}%` : "0%",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", width: 14, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews list */}
        <div style={{ padding: "16px" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 120, borderRadius: 16, backgroundColor: "#FFFFFF", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <MessageSquare size={28} style={{ color: ACCENT }} />
              </div>
              <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 6px" }}>No reviews yet</p>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                Reviews from guests will appear here after their visits.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.map((review: any, i: number) => (
                <motion.div key={review.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)", border: "1px solid #F0EBF8" }}>

                  {/* Guest + date */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {review.users?.avatar_url
                          ? <img src={review.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>
                              {review.users?.full_name?.[0] || "?"}
                            </span>}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: 0 }}>
                          {review.users?.full_name || "Guest"}
                        </p>
                        <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                          {review.created_at
                            ? format(parseISO(review.created_at), "dd MMM yyyy")
                            : ""}
                        </p>
                      </div>
                    </div>

                    {/* Stars */}
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={13} style={{
                          color: s <= review.rating ? "#FBBF24" : "#E4DCF0",
                          fill:  s <= review.rating ? "#FBBF24" : "#E4DCF0",
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  {review.comment ? (
                    <p style={{ fontSize: 13, color: "#4B4B4B", margin: 0, lineHeight: 1.6 }}>
                      {review.comment}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: "#C4BAD8", margin: 0, fontStyle: "italic" }}>
                      No written comment
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </MainLayout>
  );
}