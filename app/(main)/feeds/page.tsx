/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Heart, MapPin, Play, Pause, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export default function FeedsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: async () => {
      const { data } = await (supabase.from("feed_posts") as any)
        .select("*, venues(id, name, address, images), vendors(business_name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    staleTime: 1000 * 30,
  });

  const { data: userLikes } = useQuery({
    queryKey: ["user-likes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase.from("feed_likes") as any)
        .select("post_id")
        .eq("user_id", user.id);
      return (data || []).map((l: any) => l.post_id) as string[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!user?.id) { router.push("/login"); return; }
      if (liked) {
        await (supabase.from("feed_likes") as any).delete().eq("post_id", postId).eq("user_id", user.id);
        await (supabase.from("feed_posts") as any).update({ likes: Math.max(0, (posts?.find((p: any) => p.id === postId)?.likes || 1) - 1) }).eq("id", postId);
      } else {
        await (supabase.from("feed_likes") as any).insert({ post_id: postId, user_id: user.id });
        await (supabase.from("feed_posts") as any).update({ likes: (posts?.find((p: any) => p.id === postId)?.likes || 0) + 1 }).eq("id", postId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
      qc.invalidateQueries({ queryKey: ["user-likes"] });
    },
  });

  // Auto-play/pause based on active index
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, video]) => {
      if (!video) return;
      if (Number(idx) === activeIndex) {
        if (playing) video.play().catch(() => {});
        else video.pause();
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex, playing]);

  // Scroll snap detection
  const handleScroll = () => {
    if (!containerRef.current || !posts?.length) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const idx = Math.round(scrollTop / height);
    if (idx !== activeIndex && idx >= 0 && idx < posts.length) {
      setActiveIndex(idx);
      setPlaying(true);
    }
  };

  const scrollTo = (idx: number) => {
    if (!containerRef.current || !posts?.length) return;
    const clamped = Math.max(0, Math.min(idx, posts.length - 1));
    containerRef.current.scrollTo({ top: clamped * containerRef.current.clientHeight, behavior: "smooth" });
    setActiveIndex(clamped);
    setPlaying(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </MainLayout>
    );
  }

  if (!posts?.length) {
    return (
      <MainLayout>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16, padding: "0 32px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={32} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 3 }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>No posts yet</h2>
          <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0, lineHeight: 1.6 }}>Venues haven't posted anything yet. Check back soon.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#000000", zIndex: 10, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "44px 16px 16px", background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)" }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Feeds</h1>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>

        {posts.map((post: any, i: number) => {
          const isActive = i === activeIndex;
          const isLiked = (userLikes || []).includes(post.id);

          return (
            <div key={post.id} style={{ height: "100vh", scrollSnapAlign: "start", position: "relative", backgroundColor: "#000000" }}>

              {/* Media */}
              {post.media_type === "video" ? (
                <video
                  ref={(el) => { videoRefs.current[i] = el; }}
                  src={post.media_url}
                  loop
                  muted={muted}
                  playsInline
                  autoPlay={isActive}
                  onClick={() => setPlaying(!playing)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <img
                  src={post.media_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}

              {/* Gradient overlay */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8) 100%)", pointerEvents: "none" }} />

              {/* Play/pause indicator */}
              <AnimatePresence>
                {!playing && isActive && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 64, height: 64, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <Pause size={28} style={{ color: "#FFFFFF" }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right side actions */}
              <div style={{ position: "absolute", right: 12, bottom: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 10 }}>

                {/* Like */}
                <button
                  onClick={() => likeMutation.mutate({ postId: post.id, liked: isLiked })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
                  <motion.div whileTap={{ scale: 1.3 }}>
                    <Heart size={28} style={{ color: isLiked ? "#FF4B6E" : "#FFFFFF", fill: isLiked ? "#FF4B6E" : "none", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }} />
                  </motion.div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{post.likes || 0}</span>
                </button>

                {/* Mute */}
                {post.media_type === "video" && (
                  <button onClick={() => setMuted(!muted)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
                    {muted
                      ? <VolumeX size={26} style={{ color: "#FFFFFF", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }} />
                      : <Volume2 size={26} style={{ color: "#FFFFFF", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }} />}
                  </button>
                )}
              </div>

              {/* Bottom info */}
              <div style={{ position: "absolute", bottom: 80, left: 12, right: 60, zIndex: 10 }}>
                {/* Venue */}
                <button
                  onClick={() => post.venues?.id && router.push(`/venue/${post.venues.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid #FFFFFF", flexShrink: 0, backgroundColor: "#5B0EA6" }}>
                    {post.venues?.images?.[0]
                      ? <img src={post.venues.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>{post.venues?.name?.charAt(0)}</span>
                        </div>}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#FFFFFF", margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{post.venues?.name}</p>
                    {post.venues?.address && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <MapPin size={10} style={{ color: "rgba(255,255,255,0.7)" }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>{post.venues.address}</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Caption */}
                {post.caption && (
                  <p style={{ fontSize: 13, color: "#FFFFFF", margin: 0, lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                    {post.caption}
                  </p>
                )}

                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "6px 0 0", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>

              {/* Nav arrows */}
              {i > 0 && (
                <button onClick={() => scrollTo(i - 1)}
                  style={{ position: "absolute", top: 100, right: 12, width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                  <ChevronUp size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}
              {i < posts.length - 1 && (
                <button onClick={() => scrollTo(i + 1)}
                  style={{ position: "absolute", bottom: 90, right: 12, width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                  <ChevronDown size={18} style={{ color: "#FFFFFF" }} />
                </button>
              )}

              {/* Progress dots */}
              <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 4, zIndex: 10 }}>
                {posts.slice(Math.max(0, i - 2), Math.min(posts.length, i + 3)).map((_: any, dotIdx: number) => {
                  const realIdx = Math.max(0, i - 2) + dotIdx;
                  return (
                    <div key={realIdx} style={{ width: 3, height: realIdx === activeIndex ? 20 : 6, borderRadius: 999, backgroundColor: realIdx === activeIndex ? "#FFFFFF" : "rgba(255,255,255,0.3)", transition: "all 0.2s ease" }} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } ::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}