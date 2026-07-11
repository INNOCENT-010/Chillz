/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { Search, X, MapPin, Star, Calendar, Car, Home, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

// ── Mini cards ────────────────────────────────────────────────────────────────

function VenueMiniCard({ venue }: { venue: any }) {
  return (
    <Link href={`/venue/${venue.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(91,14,166,0.07)",
          border: "1px solid #F2EEF9",
          display: "flex",
        }}
      >
        {/* Image */}
        <div
          style={{
            width: 88,
            flexShrink: 0,
            backgroundColor: "#EDE0F7",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {venue.images?.[0] ? (
            <img
              src={venue.images[0]}
              alt={venue.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 90 }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 90,
                background: "linear-gradient(135deg, #5B0EA6, #3D0066)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 40%, rgba(61,0,102,0.6) 100%)",
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              fontSize: 8,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {venue.category?.replace(/-/g, " ")}
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "11px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div>
            <p
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "#0A0A0A",
                margin: "0 0 4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              {venue.name}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} strokeWidth={1.8} />
              <span
                style={{
                  fontSize: 11,
                  color: "#9E9E9E",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {venue.address}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={11} style={{ color: "#FBBF24", fill: "#FBBF24" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>
                {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
              </span>
              {venue.review_count > 0 && (
                <span style={{ fontSize: 10, color: "#9E9E9E" }}>({venue.review_count})</span>
              )}
            </div>
            {venue.filters?.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                style={{
                  backgroundColor: "#EDE0F7",
                  color: "#5B0EA6",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function EventMiniCard({ event }: { event: any }) {
  const minPrice = event.ticket_types?.length > 0
    ? Math.min(...event.ticket_types.map((t: any) => t.price))
    : event.ticket_price || 0;

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(91,14,166,0.07)",
          border: "1px solid #F2EEF9",
          display: "flex",
        }}
      >
        {/* Image */}
        <div
          style={{
            width: 88,
            flexShrink: 0,
            backgroundColor: "#EDE0F7",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {event.images?.[0] ? (
            <img
              src={event.images[0]}
              alt={event.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 90 }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 90,
                background: "linear-gradient(135deg, #7B2FBE, #3D0066)",
              }}
            />
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "11px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div>
            <p
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "#0A0A0A",
                margin: "0 0 4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              {event.title}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} style={{ color: "#5B0EA6", flexShrink: 0 }} strokeWidth={1.8} />
              <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>
                {format(new Date(event.start_date), "dd MMM yyyy")}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: "#5B0EA6",
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              {minPrice === 0 ? "Free" : `From ${formatCurrency(minPrice)}`}
            </span>
            {event.event_tags?.slice(0, 1).map((tag: string) => (
              <span
                key={tag}
                style={{
                  backgroundColor: "#EDE0F7",
                  color: "#5B0EA6",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ListingMiniCard({ listing, type }: { listing: any; type: "apartment" | "car_rental" }) {
  return (
    <Link href={`/listings/${listing.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(91,14,166,0.07)",
          border: "1px solid #F2EEF9",
          display: "flex",
        }}
      >
        <div
          style={{
            width: 88,
            flexShrink: 0,
            backgroundColor: "#EDE0F7",
            overflow: "hidden",
          }}
        >
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 90 }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 90,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#EDE0F7",
              }}
            >
              {type === "car_rental"
                ? <Car size={24} style={{ color: "#7B2FBE" }} />
                : <Home size={24} style={{ color: "#7B2FBE" }} />}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            padding: "11px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <p
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: "#0A0A0A",
              margin: "0 0 4px",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              fontFamily: "var(--font-display, Syne, sans-serif)",
            }}
          >
            {listing.title}
          </p>
          {listing.address && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <MapPin size={10} style={{ color: "#9E9E9E", flexShrink: 0 }} strokeWidth={1.8} />
              <span style={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {listing.address}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: "#5B0EA6",
                fontFamily: "var(--font-display, Syne, sans-serif)",
              }}
            >
              {formatCurrency(listing.price_per_unit)}
              <span style={{ fontSize: 10, fontWeight: 400, color: "#9E9E9E" }}>
                /{listing.unit_label}
              </span>
            </span>
            {listing.filters?.slice(0, 1).map((f: string) => (
              <span
                key={f}
                style={{
                  backgroundColor: "#EDE0F7",
                  color: "#5B0EA6",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  title, count, href,
}: {
  title: string; count?: number; href?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#0A0A0A",
            margin: 0,
            fontFamily: "var(--font-display, Syne, sans-serif)",
          }}
        >
          {title}
        </h3>
        {count !== undefined && (
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>
            {count} available
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            color: "#5B0EA6",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          See all <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

// ── Category filter chips ─────────────────────────────────────────────────────
const CATEGORY_FILTERS = [
  { id: "all",         label: "All" },
  { id: "events",      label: "Events" },
  { id: "bar-lounge",  label: "Bar & Lounge" },
  { id: "restaurant",  label: "Restaurant" },
  { id: "club",        label: "Club" },
  { id: "hotel",       label: "Hotel" },
  { id: "car_rental",  label: "Cars" },
  { id: "apartment",   label: "Apartments" },
  { id: "outdoorsy",   label: "Outdoorsy" },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DiscoverPage() {
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const debouncedQuery = useDebounce(query, 350);

  // Track recently viewed to power recommendations
  // (stored in localStorage for session persistence)
  const [recentCategories] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("chillz_recent_cats") || "[]");
    } catch {
      return [];
    }
  });

  // ── Discover data ───────────────────────────────────────────────────────────
  const { data: discover } = useQuery({
    queryKey: ["discover", user?.id, activeFilter],
    queryFn: async () => {
      const [venuesRes, eventsRes, listingsRes, bookingsRes] = await Promise.all([
        supabase
          .from("venues")
          .select("*")
          .eq("is_active", true)
          .order("rating", { ascending: false })
          .limit(20),
        supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .gte("start_date", new Date().toISOString())
          .order("start_date", { ascending: true })
          .limit(20),
        supabase
          .from("vendor_listings")
          .select("*, vendors(vendor_type)")
          .eq("is_active", true)
          .limit(20),
        // Get user's booking history for personalization
        user?.id
          ? supabase
              .from("bookings")
              .select("venues(category), events(event_tags)")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
      ]);

      const allVenues = (venuesRes.data || []) as any[];
      const allEvents = (eventsRes.data || []) as any[];
      const allListings = (listingsRes.data || []) as any[];
      const bookings = (bookingsRes.data || []) as any[];

      // Build preference signals from booking history
      const likedCategories: Record<string, number> = {};
      bookings.forEach((b: any) => {
        const cat = b.venues?.category;
        if (cat) likedCategories[cat] = (likedCategories[cat] || 0) + 1;
      });
      recentCategories.forEach((cat) => {
        likedCategories[cat] = (likedCategories[cat] || 0) + 0.5;
      });

      // Sort venues by affinity
      const scoredVenues = allVenues
        .map((v: any) => ({
          ...v,
          score: (likedCategories[v.category] || 0) + (v.rating || 0) * 0.3 + (v.is_featured ? 2 : 0),
        }))
        .sort((a: any, b: any) => b.score - a.score);

      // Filter by active category
      const filterVenues = activeFilter === "all" || activeFilter === "events" || activeFilter === "car_rental" || activeFilter === "apartment"
        ? scoredVenues
        : scoredVenues.filter((v: any) => v.category === activeFilter);

      const filterEvents = activeFilter === "all" || activeFilter === "events" || activeFilter === "outdoorsy"
        ? allEvents.filter((e: any) => activeFilter === "outdoorsy" ? e.is_outdoor : true)
        : [];

      const apartments = allListings.filter((l: any) => l.vendors?.vendor_type === "apartment" || l.vendor_type === "apartment");
      const cars = allListings.filter((l: any) => l.vendors?.vendor_type === "car_rental" || l.vendor_type === "car_rental");

      const filterApartments = activeFilter === "all" || activeFilter === "apartment" ? apartments : [];
      const filterCars = activeFilter === "all" || activeFilter === "car_rental" ? cars : [];

      // Recommended = top scored venues user hasn't booked
      const bookedIds = new Set(bookings.map((b: any) => b.venue_id));
      const recommended = scoredVenues.filter((v: any) => !bookedIds.has(v.id)).slice(0, 8);

      return {
        venues: filterVenues,
        events: filterEvents,
        apartments: filterApartments,
        cars: filterCars,
        recommended,
        hasPersonalization: Object.keys(likedCategories).length > 0,
      };
    },
    staleTime: 1000 * 60,
  });

  // ── Search query ────────────────────────────────────────────────────────────
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) return null;
      const [venuesRes, eventsRes] = await Promise.all([
        supabase
          .from("venues")
          .select("*")
          .eq("is_active", true)
          .or(`name.ilike.%${debouncedQuery}%,address.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%`)
          .limit(15),
        supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .or(`title.ilike.%${debouncedQuery}%,address.ilike.%${debouncedQuery}%`)
          .limit(15),
      ]);
      return {
        venues: (venuesRes.data || []) as any[],
        events: (eventsRes.data || []) as any[],
      };
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 30,
  });

  const isSearching = debouncedQuery.length >= 2;
  const searchTotal = (searchResults?.venues?.length || 0) + (searchResults?.events?.length || 0);

  return (
    <MainLayout>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E4DCF0",
        }}
      >
        {/* Title + search bar */}
        <div style={{ padding: "16px 16px 12px" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0A0A0A",
              margin: "0 0 12px",
              fontFamily: "var(--font-display, Syne, sans-serif)",
            }}
          >
            Discover
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#F2EEF9",
              border: "1.5px solid #E4DCF0",
              borderRadius: 16,
              padding: "10px 14px",
            }}
          >
            <Search size={17} style={{ color: "#6B6B6B", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search venues, events, areas..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: "#0A0A0A",
                fontFamily: "inherit",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={16} style={{ color: "#6B6B6B" }} />
              </button>
            )}
          </div>
        </div>

        {/* Category filters — only show when not searching */}
        {!isSearching && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "0 16px 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {CATEGORY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                style={{
                  flexShrink: 0,
                  padding: "7px 16px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: activeFilter === id ? "#5B0EA6" : "#E4DCF0",
                  backgroundColor: activeFilter === id ? "#5B0EA6" : "#FFFFFF",
                  color: activeFilter === id ? "#FFFFFF" : "#6B6B6B",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 28 }}>
        <AnimatePresence mode="wait">

          {/* ── SEARCH RESULTS ── */}
          {isSearching && (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 24 }}
            >
              {searchLoading && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}

              {!searchLoading && searchTotal === 0 && (
                <div style={{ textAlign: "center", paddingTop: 60 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: "#F2EEF9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <Search size={26} style={{ color: "#9E9E9E" }} />
                  </div>
                  <p style={{ color: "#6B6B6B", fontSize: 14 }}>
                    No results for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p style={{ color: "#9E9E9E", fontSize: 12, margin: "4px 0 0" }}>
                    Try a different search term
                  </p>
                </div>
              )}

              {!searchLoading && searchResults && (
                <>
                  {searchResults.venues.length > 0 && (
                    <div>
                      <SectionHeader title="Venues" count={searchResults.venues.length} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {searchResults.venues.map((venue: any) => (
                          <VenueMiniCard key={venue.id} venue={venue} />
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.events.length > 0 && (
                    <div>
                      <SectionHeader title="Events" count={searchResults.events.length} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {searchResults.events.map((event: any) => (
                          <EventMiniCard key={event.id} event={event} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── DISCOVER FEED ── */}
          {!isSearching && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 28 }}
            >

              {/* Personalized recommendations — only if user has history */}
              {discover?.hasPersonalization && discover.recommended.length > 0 && activeFilter === "all" && (
                <div>
                  <SectionHeader
                    title="Recommended For You"
                    count={discover.recommended.length}
                  />
                  <div
                    style={{
                      backgroundColor: "#EDE0F7",
                      borderRadius: 14,
                      padding: "8px 12px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>✨</span>
                    <p style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                      Based on your booking history and interests
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discover.recommended.map((venue: any) => (
                      <VenueMiniCard key={venue.id} venue={venue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {discover?.events && discover.events.length > 0 &&
                (activeFilter === "all" || activeFilter === "events" || activeFilter === "outdoorsy") && (
                <div>
                  <SectionHeader
                    title={activeFilter === "outdoorsy" ? "Outdoor Events" : "Upcoming Events"}
                    count={discover.events.length}
                    href="/category/events"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discover.events.map((event: any) => (
                      <EventMiniCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}

              {/* Venues */}
              {discover?.venues && discover.venues.length > 0 &&
                activeFilter !== "events" &&
                activeFilter !== "car_rental" &&
                activeFilter !== "apartment" && (
                <div>
                  <SectionHeader
                    title={
                      activeFilter === "all" ? "Top Spots" :
                      activeFilter === "bar-lounge" ? "Bar & Lounge" :
                      activeFilter === "restaurant" ? "Restaurants" :
                      activeFilter === "club" ? "Clubs" :
                      activeFilter === "hotel" ? "Hotels" :
                      "Venues"
                    }
                    count={discover.venues.length}
                    href={activeFilter === "all" ? "/category/bar-lounge" : `/category/${activeFilter}`}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discover.venues.map((venue: any) => (
                      <VenueMiniCard key={venue.id} venue={venue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Apartments */}
              {discover?.apartments && discover.apartments.length > 0 &&
                (activeFilter === "all" || activeFilter === "apartment") && (
                <div>
                  <SectionHeader
                    title="Apartments & Shortlets"
                    count={discover.apartments.length}
                    href="/category/apartments"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discover.apartments.map((listing: any) => (
                      <ListingMiniCard key={listing.id} listing={listing} type="apartment" />
                    ))}
                  </div>
                </div>
              )}

              {/* Cars */}
              {discover?.cars && discover.cars.length > 0 &&
                (activeFilter === "all" || activeFilter === "car_rental") && (
                <div>
                  <SectionHeader
                    title="Car Rentals"
                    count={discover.cars.length}
                    href="/category/car-rentals"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discover.cars.map((listing: any) => (
                      <ListingMiniCard key={listing.id} listing={listing} type="car_rental" />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {discover &&
                (discover.venues?.length || 0) === 0 &&
                (discover.events?.length || 0) === 0 &&
                (discover.apartments?.length || 0) === 0 &&
                (discover.cars?.length || 0) === 0 && (
                <div style={{ textAlign: "center", paddingTop: 60 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 6px" }}>
                    Nothing here yet
                  </p>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                    Check back soon — new spots are added regularly
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </MainLayout>
  );
}