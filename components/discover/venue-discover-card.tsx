/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { MapPin, Star, Heart } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { priceLevelLabel } from "@/lib/price-utils";


interface Props {
  venue: any;
  cheapestMenuPrice?: number;
  categoryEmoji?: string;
  accentColor?: string;
  accentBg?: string;
}

export function VenueDiscoverCard({
  venue, cheapestMenuPrice,
  categoryEmoji = "📍",
  accentColor = "#5B0EA6",
  accentBg = "#EDE0F7",
}: Props) {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  // Price: vendor minimum spend → cheapest menu item → Google price level estimate
  const price = venue.minimum_spend || cheapestMenuPrice || null;
  const googlePriceLabel = !price ? priceLevelLabel(venue.google_data?.price_level) : null;

  const { data: savedRecord } = useQuery({
    queryKey: ["saved-venue", venue.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("saved_venues") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("venue_id", venue.id)
        .maybeSingle();
      return data as { id: string } | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const saved = !!savedRecord;

  const saveMutation = useMutation({
    mutationFn: async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) { router.push("/login"); return; }
      if (saved) {
        await (supabase.from("saved_venues") as any)
          .delete()
          .eq("user_id", user.id)
          .eq("venue_id", venue.id);
      } else {
        await (supabase.from("saved_venues") as any)
          .insert({ user_id: user.id, venue_id: venue.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-venue", venue.id, user?.id] });
      qc.invalidateQueries({ queryKey: ["saved-venues"] });
    },
  });

  return (
    <Link href={`/venue/${venue.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div style={{
        backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(91,14,166,0.07)",
        border: "1.5px solid #F2EEF9", marginBottom: 14,
        position: "relative",
      }}>
        {/* Image */}
        <div style={{ height: 190, position: "relative", overflow: "hidden", backgroundColor: "#EDE0F7" }}>
          {venue.images?.[0]
            ? <img src={venue.images[0]} alt={venue.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a0038,#3D0066)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 44 }}>{categoryEmoji}</span>
              </div>}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 35%,rgba(0,0,0,0.65) 100%)" }} />

          {/* Featured badge */}
          {venue.is_featured && (
            <div style={{ position: "absolute", top: 10, left: 10, backgroundColor: "#00C853", borderRadius: 999, padding: "3px 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>Featured</span>
            </div>
          )}

          {/* Heart button */}
          <button
            onClick={(e) => saveMutation.mutate(e)}
            style={{
              position: "absolute", top: 10, right: 10,
              width: 34, height: 34, borderRadius: "50%",
              backgroundColor: saved ? "rgba(255,75,110,0.2)" : "rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
              border: saved ? "1.5px solid rgba(255,75,110,0.4)" : "1.5px solid rgba(255,255,255,0.2)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <Heart
              size={15}
              style={{ color: saved ? "#FF4B6E" : "#FFFFFF", fill: saved ? "#FF4B6E" : "none", transition: "all 0.15s ease" }}
            />
          </button>

          {/* Rating */}
          {venue.rating > 0 && (
            <div style={{ position: "absolute", bottom: 52, right: 10, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={10} style={{ color: "#FFD700", fill: "#FFD700" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{Number(venue.rating).toFixed(1)}</span>
            </div>
          )}

          {/* Name overlay */}
          <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
            <p style={{ fontWeight: 900, fontSize: 16, color: "#FFFFFF", margin: "0 0 3px", fontFamily: "var(--font-display,Syne,sans-serif)", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
              {venue.name}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} style={{ color: "rgba(255,255,255,0.8)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {venue.address}
              </span>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {(venue.filters || venue.tags || []).slice(0, 3).map((tag: string) => (
              <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: accentColor, backgroundColor: accentBg, padding: "3px 9px", borderRadius: 999 }}>
                {tag}
              </span>
            ))}
            {venue.source === "google" && (venue.filters || venue.tags || []).length === 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#4285F4", backgroundColor: "#EBF3FE", padding: "3px 9px", borderRadius: 999 }}>
                📍 Google
              </span>
            )}
            {venue.review_count > 0 && (
              <span style={{ fontSize: 10, color: "#9E9E9E", marginLeft: "auto", alignSelf: "center" }}>
                {venue.review_count} review{venue.review_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#9E9E9E", textTransform: "capitalize" }}>
              {venue.category?.replace(/-/g, " ")}
            </span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              {price ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1 }}>Starts from</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: accentColor, lineHeight: 1.2, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                    {formatCurrency(price)}
                  </span>
                </div>
              ) : googlePriceLabel ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1 }}>Price range</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: accentColor, lineHeight: 1.2, letterSpacing: 1 }}>
                    {googlePriceLabel}
                  </span>
                </div>
              ) : null}
              {venue.bookings_enabled === false ? (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/venue/${venue.id}`); }}
                  style={{ backgroundColor: "#F7F5FA", color: "#6B6B6B", border: "1.5px solid #E4DCF0", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  View
                </button>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/venue/${venue.id}?book=true`); }}
                  style={{ backgroundColor: accentColor, color: "#FFFFFF", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  Reserve
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}