"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { MainLayout } from "@/components/layout/main-layout";
import { VenueCard } from "@/components/home/venue-card";
import { EventCard } from "@/components/home/event-card";
import { VenueCardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, SlidersHorizontal, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const category = CATEGORIES.find((c) => c.slug === slug);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  const isEventCategory = slug === "events" || slug === "outdoorsy";

  const { data, isLoading } = useQuery({
    queryKey: ["category", slug, activeFilters, radiusKm],
    queryFn: async () => {
      if (isEventCategory) {
        let query = supabase
          .from("events")
          .select("*")
          .eq("is_active", true);
        if (slug === "outdoorsy") query = query.eq("is_outdoor", true);
        if (activeFilters.length > 0) {
          query = query.contains("event_tags", activeFilters);
        }
        const { data } = await query.limit(20);
        return data || [];
      } else {
        let query = supabase
          .from("venues")
          .select("*")
          .eq("category", slug)
          .eq("is_active", true);
        if (activeFilters.length > 0) {
          query = query.contains("filters", activeFilters);
        }
        const { data } = await query.limit(20);
        return data || [];
      }
    },
    enabled: !!slug,
    staleTime: 1000 * 30,
  });

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  const availableFilters = isEventCategory
    ? category?.eventTags || []
    : category?.filters || [];

  if (category?.comingSoon) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-chillz-card flex items-center justify-center">
            <span className="text-3xl">soon</span>
          </div>
          <h2 className="text-2xl font-black text-chillz-text" style={{ fontFamily: "var(--font-display)" }}>
            Coming Soon
          </h2>
          <p className="text-chillz-muted text-sm">
            {category.label} is launching shortly. Stay tuned.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 sticky top-0 z-40 border-b border-chillz-border">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="tap-effect p-2 -ml-2">
            <ArrowLeft size={22} className="text-chillz-text" />
          </button>
          <h1
            className="text-lg font-bold text-chillz-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {category?.label}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold tap-effect transition-colors",
              showFilters || activeFilters.length > 0
                ? "bg-brand-purple text-white"
                : "bg-chillz-card text-chillz-text"
            )}
          >
            <SlidersHorizontal size={15} />
            {activeFilters.length > 0 && (
              <span className="bg-white text-brand-purple rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pb-3">
                {/* Distance */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-chillz-text flex items-center gap-1">
                      <MapPin size={12} /> Distance
                    </span>
                    <span className="text-xs font-bold text-brand-purple">{radiusKm}km</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-brand-purple"
                  />
                </div>
                {/* Tag filters */}
                {availableFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableFilters.map((filter) => (
                      <button
                        key={filter}
                        onClick={() => toggleFilter(filter)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-semibold tap-effect transition-all",
                          activeFilters.includes(filter)
                            ? "bg-brand-purple text-white"
                            : "bg-chillz-card text-chillz-muted"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div className="px-4 py-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <VenueCardSkeleton key={i} />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {data.map((item: any, i: number) =>
              isEventCategory ? (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="col-span-2"
                >
                  <EventCard
                    id={item.id}
                    title={item.title}
                    address={item.address}
                    image={item.images?.[0] || ""}
                    startDate={item.start_date}
                    ticketPrice={item.ticket_price}
                    tags={item.event_tags}
                    isFeatured={item.is_featured}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <VenueCard
                    id={item.id}
                    name={item.name}
                    category={item.category}
                    address={item.address}
                    image={item.images?.[0] || ""}
                    rating={item.rating}
                    reviewCount={item.review_count}
                    tags={item.filters}
                    size="sm"
                  />
                </motion.div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-chillz-card flex items-center justify-center">
              <SlidersHorizontal size={28} className="text-chillz-subtle" />
            </div>
            <p className="text-chillz-muted text-sm text-center">
              No results found.
              <br />Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
