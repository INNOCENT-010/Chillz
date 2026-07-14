/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowLeft, CheckCircle, Send } from "lucide-react";

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Exceptional"];

const QUICK_TAGS = [
  "Great vibes", "Excellent service", "Clean & tidy",
  "Value for money", "Would return", "Perfect location",
  "Friendly staff", "Amazing food", "Great music", "Top notch",
];

export default function ReviewPage() {
  const { id: bookingId } = useParams<{ id: string }>(); // ← fixed: was { bookingId }
  const router = useRouter();
  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["review-booking", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, user_id, vendor_id, venue_id, reserved_amount, status")
        .eq("id", bookingId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!bookingId,
    staleTime: 0,
  });

  const { data: venue } = useQuery({
    queryKey: ["review-venue", booking?.venue_id],
    queryFn: async () => {
      if (!booking?.venue_id) return null;
      const { data } = await supabase
        .from("venues")
        .select("id, name, address, images, category")
        .eq("id", booking.venue_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!booking?.venue_id,
  });

  const { data: vendor } = useQuery({
    queryKey: ["review-vendor", booking?.vendor_id],
    queryFn: async () => {
      if (!booking?.vendor_id) return null;
      const { data } = await (supabase.from("vendors") as any)
        .select("id, vendor_type")
        .eq("id", booking.vendor_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!booking?.vendor_id,
  });

  const { data: existingReview } = useQuery({
    queryKey: ["existing-review", bookingId],
    queryFn: async () => {
      const { data } = await (supabase.from("reviews") as any)
        .select("id, rating, comment")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!bookingId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !booking) throw new Error("Not authenticated");
      if (rating === 0) throw new Error("Please select a rating");

      const fullComment = [
        selectedTags.length > 0 ? selectedTags.join(" · ") : "",
        comment.trim(),
      ].filter(Boolean).join("\n\n") || null;

      const { error } = await (supabase.from("reviews") as any).insert({
        user_id:    user.id,
        venue_id:   booking.venue_id || null,
        booking_id: bookingId,
        rating,
        comment:    fullComment,
      });
      if (error) throw error;

      if (booking.venue_id) {
        const { data: allReviews } = await (supabase.from("reviews") as any)
          .select("rating")
          .eq("venue_id", booking.venue_id);
        const ratings = ((allReviews || []) as any[]).map((r: any) => r.rating);
        if (ratings.length > 0) {
          const avg = ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length;
          await (supabase.from("venues") as any)
            .update({ rating: Math.round(avg * 10) / 10, review_count: ratings.length })
            .eq("id", booking.venue_id);
        }
      }

      if (booking.vendor_id) {
        await (supabase.from("notifications") as any).insert({
          user_id:      booking.vendor_id,
          title:        `New ${rating}★ review`,
          body:         `Someone left a review for ${venue?.name || "your venue"}.`,
          type:         "booking",
          reference_id: bookingId,
          is_read:      false,
        });
      }
    },
    onSuccess: () => setSubmitted(true),
  });

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </MainLayout>
  );

  if (existingReview) return (
    <MainLayout>
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <CheckCircle size={36} style={{ color: "#00C853" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Already reviewed
        </h2>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={20} style={{ color: i < existingReview.rating ? "#FFD700" : "#E4DCF0", fill: i < existingReview.rating ? "#FFD700" : "#E4DCF0" }} />
          ))}
        </div>
        {existingReview.comment && (
          <p style={{ fontSize: 13, color: "#6B6B6B", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 280 }}>
            "{existingReview.comment}"
          </p>
        )}
        <button onClick={() => router.push("/bookings")}
          style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 14, padding: "12px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Back to Bookings
        </button>
      </div>
    </MainLayout>
  );

  if (submitted) return (
    <MainLayout>
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <CheckCircle size={40} style={{ color: "#00C853" }} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            Thank you!
          </h2>
          <p style={{ fontSize: 14, color: "#6B6B6B", margin: "0 0 6px" }}>
            Your {rating}★ review for <strong>{venue?.name || "the vendor"}</strong> has been submitted.
          </p>
          <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 6px" }}>
            Reviews help others make better decisions on Chillz.
          </p>
          <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 32px" }}>
            Reviews help others discover great spots on Chillz.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.push("/bookings")}
              style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              My Bookings
            </button>
            {(venue?.id || booking?.vendor_id) && (
              <button onClick={() => {
                const type = vendor?.vendor_type;
                if (type === "hotel") router.push(`/hotel/${booking.vendor_id}`);
                else if (type === "car_rental") router.push(`/car-rental/${booking.vendor_id}`);
                else if (type === "apartment") router.push(`/apartment/${booking.vendor_id}`);
                else if (venue?.id) router.push(`/venue/${venue.id}`);
              }}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {vendor?.vendor_type === "hotel" ? "View Hotel"
                  : vendor?.vendor_type === "car_rental" ? "View Cars"
                  : vendor?.vendor_type === "apartment" ? "View Property"
                  : "View Venue"}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #F2EEF9", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px" }}>
          <button onClick={() => router.push("/bookings")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
            <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              Leave a Review
            </h1>
            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{venue?.name || "Your booking"}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px 60px", display: "flex", flexDirection: "column", gap: 20 }}>

        {venue && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.07)", border: "1.5px solid #F2EEF9", display: "flex", alignItems: "center", gap: 14, padding: "14px" }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, overflow: "hidden", flexShrink: 0, backgroundColor: "#EDE0F7" }}>
              {venue.images?.[0]
                ? <img src={venue.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 3px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {venue.name}
              </p>
              <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {venue.address}
              </p>
              {venue.category && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6", backgroundColor: "#EDE0F7", padding: "2px 8px", borderRadius: 999, textTransform: "capitalize", display: "inline-block", marginTop: 4 }}>
                  {venue.category.replace(/-/g, " ")}
                </span>
              )}
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            How was your experience?
          </p>
          <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px" }}>Tap a star to rate</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button key={star} whileTap={{ scale: 0.85 }}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <Star size={40} style={{
                  color: star <= (hoveredRating || rating) ? "#FFD700" : "#E4DCF0",
                  fill:  star <= (hoveredRating || rating) ? "#FFD700" : "#E4DCF0",
                  transition: "all 0.15s ease",
                  filter: star <= (hoveredRating || rating) ? "drop-shadow(0 2px 6px rgba(255,215,0,0.4))" : "none",
                }} />
              </motion.button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {(rating > 0 || hoveredRating > 0) && (
              <motion.p key={hoveredRating || rating}
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 15, fontWeight: 700, color: "#5B0EA6", margin: 0 }}>
                {RATING_LABELS[hoveredRating || rating]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {rating > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 12px" }}>
                What did you love? <span style={{ fontWeight: 400, color: "#9E9E9E" }}>(optional)</span>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {QUICK_TAGS.map(tag => {
                  const active = selectedTags.includes(tag);
                  return (
                    <motion.button key={tag} whileTap={{ scale: 0.93 }} onClick={() => toggleTag(tag)}
                      style={{ padding: "7px 14px", borderRadius: 999, border: "1.5px solid", borderColor: active ? "#5B0EA6" : "#E4DCF0", backgroundColor: active ? "#EDE0F7" : "#F7F5FA", color: active ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                      {active ? "✓ " : ""}{tag}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {rating > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 10px" }}>
                Tell us more <span style={{ fontWeight: 400, color: "#9E9E9E" }}>(optional)</span>
              </p>
              <textarea
                placeholder={
                  rating >= 4 ? "Share what made it great..."
                  : rating === 3 ? "What could have been better?"
                  : "What went wrong? We'll look into it."
                }
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.6, boxSizing: "border-box" }}
              />
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "6px 0 0", textAlign: "right" }}>
                {comment.length}/500
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {submitMutation.isError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>
                {(submitMutation.error as any)?.message || "Failed to submit review"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => submitMutation.mutate()}
          disabled={rating === 0 || submitMutation.isPending}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: rating === 0 || submitMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: rating === 0 || submitMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: rating === 0 ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {submitMutation.isPending
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Submitting...</>
            : <><Send size={16} />Submit Review</>}
        </button>

        <button onClick={() => router.push("/bookings")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9E9E9E", fontSize: 13, fontWeight: 500, padding: "8px 0", textAlign: "center" }}>
          Skip for now
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}