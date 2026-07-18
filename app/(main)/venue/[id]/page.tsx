/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, generateQRHash } from "@/lib/utils";
import { getWATDayNameTitleCase } from "@/lib/time-utils";
import { reserveBookingAmount } from "@/lib/ledger";
import { useVenueCart } from "@/store/venue-cart";
import {
  ArrowLeft, Heart, Share2, Navigation,
  CheckCircle, X, Calendar, Phone, Users,
  PartyPopper, ChevronRight, UtensilsCrossed, Tag,
  Gift, Ticket, Play, Shield, AlertCircle,
  Wifi, Car, Waves, Dumbbell, Music, Utensils,
  Crown, Wind, Layers, Zap, Coffee, Star,
  MapPin, Mic2, Tv, Sofa, UtensilsCrossed as Fork,
  Cigarette, Sunset, Gamepad2, Baby, Dog,
  ShoppingBag, Bike, Bus, ParkingCircle,
  ExternalLink, Video, Flame, Snowflake,
  FileText, MonitorPlay, ShoppingCart, Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SOCIAL_VENUE_CATEGORIES = ["restaurant","bar-lounge","club","bar","lounge"];
const SPECIAL_OCCASIONS = [
  "None","Birthday","Anniversary","Proposal","Graduation",
  "Date Night","Corporate","Baby Shower","Bachelorette","Bachelor Party","Other",
];

const TAG_ICONS: Record<string, any> = {
  "wifi": Wifi, "wi-fi": Wifi,
  "parking": ParkingCircle, "car park": ParkingCircle,
  "pool": Waves, "swimming pool": Waves,
  "gym": Dumbbell, "fitness": Dumbbell,
  "breakfast": Coffee, "brunch": Coffee,
  "live music": Music, "live band": Music,
  "restaurant": Utensils, "food": Utensils, "dining": Utensils,
  "vip section": Crown, "vip": Crown, "vip lounge": Crown,
  "shisha": Wind, "hookah": Wind, "hookah lounge": Wind,
  "rooftop": Sunset, "rooftop bar": Sunset,
  "dance floor": Flame, "dancefloor": Flame,
  "bar": Gift, "open bar": Gift, "full bar": Gift,
  "lounge": Sofa, "relaxation": Sofa,
  "karaoke": Mic2, "karaoke room": Mic2,
  "sports": Tv, "sports bar": Tv, "big screen": Tv,
  "generator": Zap, "24hr power": Zap, "power": Zap,
  "ac": Snowflake, "air conditioning": Snowflake, "air-conditioned": Snowflake,
  "outdoor": Sunset, "outdoor seating": Sunset,
  "indoor": Sofa, "indoor seating": Sofa,
  "smoking": Cigarette, "smoking area": Cigarette,
  "no smoking": Cigarette,
  "game room": Gamepad2, "games": Gamepad2, "arcade": Gamepad2,
  "kids friendly": Baby, "family friendly": Baby, "kids": Baby,
  "pet friendly": Dog, "pets allowed": Dog,
  "shopping": ShoppingBag, "boutique": ShoppingBag,
  "cycling": Bike, "bicycle": Bike,
  "shuttle": Bus, "airport shuttle": Bus,
  "spa": Waves, "massage": Waves,
  "cocktails": Gift, "signature cocktails": Gift,
  "buffet": Utensils, "all-you-can-eat": Utensils,
  "fine dining": Fork, "gourmet": Fork,
  "delivery": ShoppingBag,
  "live dj": Music, "dj": Music,
  "security": Shield, "cctv": Shield, "24hr security": Shield,
  "layers": Layers, "multiple floors": Layers,
};

function getTagIcon(tag: string) {
  return TAG_ICONS[tag.toLowerCase().trim()] || CheckCircle;
}

function isValidNigerianPhone(p: string): boolean {
  const d = p.replace(/\D/g, "");
  return (d.length === 11 && d.startsWith("0")) ||
         (d.length === 13 && d.startsWith("234"));
}

function PlatformLogo({ platform, size = 20 }: { platform: string; size?: number }) {
  if (platform === "YouTube") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  if (platform === "TikTok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#010101">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/>
    </svg>
  );
  if (platform === "Instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="50%" stopColor="#DD2A7B"/>
          <stop offset="100%" stopColor="#8134AF"/>
        </linearGradient>
      </defs>
      <path fill="url(#igGrad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
  if (platform === "Facebook") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  return <MonitorPlay size={size} style={{ color: "#5B0EA6" }} />;
}

function detectPlatform(url: string): { name: string; color: string; bg: string; canEmbed: boolean; embedUrl: string | null } {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const embedUrl = ytMatch ? `https://www.youtube.com/embed/${ytMatch[1]}` : null;
    return { name: "YouTube", color: "#FF0000", bg: "#FEF2F2", canEmbed: !!embedUrl, embedUrl };
  }
  if (u.includes("tiktok.com")) return { name: "TikTok", color: "#010101", bg: "#F7F7F7", canEmbed: false, embedUrl: null };
  if (u.includes("instagram.com")) return { name: "Instagram", color: "#C13584", bg: "#FDF2F8", canEmbed: false, embedUrl: null };
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) return { name: "Facebook", color: "#1877F2", bg: "#EFF6FF", canEmbed: false, embedUrl: null };
  return { name: "Video", color: "#5B0EA6", bg: "#EDE0F7", canEmbed: false, embedUrl: null };
}

function openDirections(lat: number, lng: number, name: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const encodedName = encodeURIComponent(name);
  if (isIOS) window.open(`maps://?daddr=${lat},${lng}&q=${encodedName}`, "_blank");
  else if (isAndroid) window.open(`geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`, "_blank");
  else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { items: cartItems, increment, decrement, clear, setVenueId, selectedTotal, selectedCount } = useVenueCart();

  const [activeImage, setActiveImage] = useState(0);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "menu" | "events" | "packages">("info");
  const [activeMediaTab, setActiveMediaTab] = useState<"photos" | "videos">("photos");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Booking form state
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [specialOccasion, setSpecialOccasion] = useState("None");
  const [manualAmount, setManualAmount] = useState("");
  // Package selection — replaces manual amount when set
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  const openHeroLightbox = (idx: number) => {
    if (!venue?.images?.length) return;
    setLightboxImages(venue.images);
    setLightboxIdx(idx);
    setLightboxImage(venue.images[idx]);
  };

  useEffect(() => {
    if (id) setVenueId(id);
  }, [id]);

  useEffect(() => {
    if (searchParams.get("book") === "true") {
      setShowBooking(true);
      router.replace(`/venue/${id}`);
    }
  }, [searchParams]);

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("*").eq("id", id).single();
      return data as any;
    },
    staleTime: 1000 * 60,
  });

  // Vendor config — for booking_requires_menu_selection toggle
  const { data: vendorConfig } = useQuery({
    queryKey: ["vendor-config", venue?.vendor_id],
    queryFn: async () => {
      if (!venue?.vendor_id) return null;
      const { data } = await supabase.from("vendors")
        .select("id, booking_requires_menu_selection")
        .eq("id", venue.vendor_id).maybeSingle();
      return data as any;
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  const { data: reviews } = useQuery({
    queryKey: ["venue-reviews", id],
    queryFn: async () => {
      const { data } = await (supabase.from("reviews") as any)
        .select("*, users(full_name, avatar_url)")
        .eq("venue_id", id).order("created_at", { ascending: false }).limit(5);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
  });

  const { data: userBooking } = useQuery({
    queryKey: ["user-venue-booking", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("bookings") as any)
        .select("id, status").eq("venue_id", id).eq("user_id", user.id)
        .eq("status", "completed").maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const { data: existingReview } = useQuery({
    queryKey: ["user-review", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("reviews") as any)
        .select("id").eq("venue_id", id).eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const { data: media } = useQuery({
    queryKey: ["venue-media", id],
    queryFn: async () => {
      const { data } = await supabase.from("venue_media").select("*").eq("venue_id", id)
        .eq("is_active", true).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
  });

  const { data: menuItems } = useQuery({
    queryKey: ["venue-menu", id],
    queryFn: async () => {
      if (!venue?.vendor_id) return [];
      const { data } = await supabase.from("vendor_menu").select("*")
        .eq("vendor_id", venue.vendor_id).eq("is_available", true).order("category");
      return (data || []) as any[];
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  const { data: menuUploads } = useQuery({
    queryKey: ["venue-menu-uploads", id],
    queryFn: async () => {
      if (!venue?.vendor_id) return [];
      const { data } = await (supabase.from("vendor_menu_uploads") as any)
        .select("*").eq("vendor_id", venue.vendor_id)
        .eq("is_active", true).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  const { data: events } = useQuery({
    queryKey: ["venue-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("venue_id", id)
        .eq("is_active", true).gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true }).limit(10);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60,
  });

  // Packages — replaces offers
  const { data: packages } = useQuery({
    queryKey: ["venue-packages", id],
    queryFn: async () => {
      if (!venue?.vendor_id) return [];
      const { data } = await (supabase.from("packages") as any)
        .select("*")
        .eq("vendor_id", venue.vendor_id)
        .eq("is_active", true)
        .order("price", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  const { data: vendorVideos } = useQuery({
    queryKey: ["vendor-videos", venue?.vendor_id],
    queryFn: async () => {
      if (!venue?.vendor_id) return [];
      const { data } = await (supabase.from("vendor_video_links") as any)
        .select("*").eq("vendor_id", venue.vendor_id)
        .eq("is_active", true).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!venue?.vendor_id,
    staleTime: 1000 * 60,
  });

  const { data: currentUserVendor } = useQuery({
    queryKey: ["is-vendor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase.from("vendors") as any).select("id, kyc_status")
        .eq("user_id", user.id).maybeSingle();
      return data as { id: string; kyc_status: string } | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.from("ledger_entries").select("direction, amount")
        .eq("account_id", user.id).eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce(
        (acc: number, row: any) => row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0
      );
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });
  const { data: isSaved, refetch: refetchSaved } = useQuery({
  queryKey: ["venue-saved", id, user?.id],
  queryFn: async () => {
    if (!user?.id) return false;
    const { data } = await (supabase.from("saved_venues") as any)
      .select("id")
      .eq("venue_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    return !!data;
  },
  enabled: !!user?.id,
  staleTime: 1000 * 60,
  });
  
  const toggleSaveMutation = useMutation({
  mutationFn: async () => {
    if (!user?.id) { router.push(`/login?redirect=/venue/${id}`); return; }
    if (isSaved) {
      await (supabase.from("saved_venues") as any)
        .delete()
        .eq("venue_id", id)
        .eq("user_id", user.id);
    } else {
      await (supabase.from("saved_venues") as any)
        .insert({ venue_id: id, user_id: user.id });
    }
  },
  onSuccess: () => refetchSaved(),
  });
  // ── Derived ───────────────────────────────────────────────────────────
  const isApprovedVendor      = currentUserVendor?.kyc_status === "approved";
  const isSocialVenue         = SOCIAL_VENUE_CATEGORIES.includes(venue?.category);
  const requiresMenuSelection = vendorConfig?.booking_requires_menu_selection !== false; // default true
  const minimumSpend          = venue?.minimum_spend || 0;
  const cheapestMenuItem      = menuItems?.length
    ? Math.min(...(menuItems as any[]).map((i: any) => i.price))
    : null;
  const startsFromPrice = minimumSpend > 0 ? minimumSpend : (cheapestMenuItem || null);
  const isMinSpend      = minimumSpend > 0;
  const hasMenu         = (menuItems?.length || 0) > 0;

  const openingHours: Record<string, any> = venue?.opening_hours || {};
  const todayKey    = getWATDayNameTitleCase();
  const todayHours  = openingHours[todayKey];
  const isOpenToday = todayHours && !todayHours.closed;
  const photos      = (media || []).filter((m: any) => m.type === "photo");
  const videos      = (media || []).filter((m: any) => m.type === "video");
  const menuImages  = (menuUploads || []).filter((u: any) => u.type === "image");
  const menuPdfs    = (menuUploads || []).filter((u: any) => u.type === "pdf");

  const menuByCategory: Record<string, any[]> = {};
  (menuItems || []).forEach((item: any) => {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  });

  const venueTags   = venue?.filters || venue?.tags || [];
  const visibleTags = showAllTags ? venueTags : venueTags.slice(0, 6);
  const avgRating   = venue?.rating || 0;
  const reviewCount = venue?.review_count || 0;

  // Cart derived
  const cartTotal     = selectedTotal();
  const cartCount     = selectedCount();
  const cartItemsList = Object.values(cartItems);
  const hasCartItems  = cartCount > 0;

  // ── Reserve amount logic ──────────────────────────────────────────────
  // Priority: package > cart > manual (only if allowed)
  let reserveAmount = 0;
  if (selectedPackage) {
    reserveAmount = selectedPackage.price;
  } else if (hasCartItems) {
    reserveAmount = Math.max(cartTotal, minimumSpend);
  } else if (!requiresMenuSelection) {
    reserveAmount = Number(manualAmount) || 0;
  }

  const belowMinimum = minimumSpend > 0 && reserveAmount < minimumSpend && reserveAmount > 0 && !selectedPackage;

  // Phone validation
  const phoneValid = !isSocialVenue || isValidNigerianPhone(bookingPhone);

  const canConfirm = reserveAmount > 0
    && !belowMinimum
    && !!bookingDate
    && phoneValid
    && (!isSocialVenue || bookingPhone.trim().length > 0);

  // Lightbox helpers (menu images — existing behaviour)
  const allMenuImages = menuImages;
  const lightboxIndex = lightboxImage && !lightboxImages.length
    ? allMenuImages.findIndex((u: any) => u.url === lightboxImage)
    : lightboxIdx;
  const lightboxPrev = () => {
    if (lightboxImages.length) {
      const ni = Math.max(0, lightboxIdx - 1);
      setLightboxIdx(ni); setLightboxImage(lightboxImages[ni]);
    } else if (lightboxIndex > 0) {
      setLightboxImage(allMenuImages[lightboxIndex - 1].url);
    }
  };
  const lightboxNext = () => {
    if (lightboxImages.length) {
      const ni = Math.min(lightboxImages.length - 1, lightboxIdx + 1);
      setLightboxIdx(ni); setLightboxImage(lightboxImages[ni]);
    } else if (lightboxIndex < allMenuImages.length - 1) {
      setLightboxImage(allMenuImages[lightboxIndex + 1].url);
    }
  };
  const lightboxTotal  = lightboxImages.length || allMenuImages.length;
  const lightboxCurIdx = lightboxImages.length ? lightboxIdx : lightboxIndex;

  // Tabs — packages replaces offers
  const TABS = [
    { id: "info",     label: "Info" },
    { id: "menu",     label: "Menu",     count: (menuItems?.length || 0) + (menuUploads?.length || 0) },
    { id: "events",   label: "Events",   count: events?.length },
    { id: "packages", label: "Packages", count: packages?.length },
  ];

  const handleShare = async () => {
    const url = `${window.location.origin}/venue/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: venue?.name, text: `Check out ${venue?.name} on Chillz`, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  // ── Book mutation ─────────────────────────────────────────────────────
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !venue) throw new Error("Not authenticated");
      if (isApprovedVendor) throw new Error("Vendor accounts cannot make bookings");
      if (!reserveAmount || reserveAmount <= 0) throw new Error(
        requiresMenuSelection && !selectedPackage
          ? "Please select items from the menu or choose a package"
          : "Enter a valid amount"
      );
      if (minimumSpend > 0 && reserveAmount < minimumSpend && !selectedPackage)
        throw new Error(`Minimum spend is ${formatCurrency(minimumSpend)}`);
      if (reserveAmount > (walletBalance || 0))
        throw new Error("Insufficient wallet balance. Fund your wallet first.");
      if (!bookingDate) throw new Error("Please select a date and time");
      if (isSocialVenue && !bookingPhone.trim())
        throw new Error("Please enter your WhatsApp number");
      if (isSocialVenue && !isValidNigerianPhone(bookingPhone))
        throw new Error("Please enter a valid Nigerian WhatsApp number (e.g. 08012345678)");

      const qrHash = generateQRHash();
      const notesParts: string[] = [];

      if (isSocialVenue) {
        notesParts.push(`Guests: ${guestCount}`);
        if (specialOccasion !== "None") notesParts.push(`Occasion: ${specialOccasion}`);
      }
      if (bookingNotes.trim()) notesParts.push(bookingNotes.trim());

      // Build order items — package items OR cart items
      let orderItems: any[] | null = null;
      if (selectedPackage) {
        const includedItems: any[] = selectedPackage.menu_items || [];
        if (includedItems.length > 0) {
          orderItems = includedItems.map((item: any) => ({
            id:       item.id,
            name:     item.name,
            price:    item.price,
            qty:      item.qty || 1,
            subtotal: (item.price || 0) * (item.qty || 1),
          }));
        }
      } else if (hasCartItems) {
        orderItems = cartItemsList.map((item) => ({
          id:       item.id,
          name:     item.name,
          price:    item.price,
          qty:      item.qty,
          subtotal: item.price * item.qty,
        }));
      }

      const { data: booking, error } = await (supabase.from("bookings") as any)
        .insert({
          user_id:          user.id,
          venue_id:         venue.id,
          vendor_id:        venue.vendor_id,
          status:           "confirmed",
          reserved_amount:  reserveAmount,
          qr_code_hash:     qrHash,
          booking_date:     new Date(bookingDate).toISOString(),
          notes:            notesParts.join(" · ") || null,
          phone:            isSocialVenue ? bookingPhone.trim() : null,
          guest_count:      isSocialVenue ? Number(guestCount) : null,
          special_occasion: specialOccasion !== "None" ? specialOccasion : null,
          order_items:      orderItems,
          package_name:     selectedPackage?.name || null,
          package_price:    selectedPackage?.price || null,
        }).select().single();
      if (error) throw error;
      await reserveBookingAmount(user.id, booking.id, reserveAmount);
      return booking;
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      clear();
      setSelectedPackage(null);
      router.push(`/bookings/${booking.id}`);
    },
  });

  if (isLoading) return (
    <MainLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </MainLayout>
  );

  if (!venue) return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <p style={{ color: "#6B6B6B", fontSize: 14 }}>Venue not found.</p>
        <button onClick={() => router.back()} style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Go Back</button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>

      {/* ── Hero — tap image to open lightbox ── */}
      <div style={{ position: "relative", height: 280, backgroundColor: "#EDE0F7", overflow: "hidden" }}>
        {venue.images?.length > 0
          ? <img
              src={venue.images[activeImage]}
              alt={venue.name}
              onClick={() => openHeroLightbox(activeImage)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3D0066, #5B0EA6)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
          <button onClick={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <ArrowLeft size={20} style={{ color: "#0A0A0A" }} />
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => toggleSaveMutation.mutate()}
              style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              <Heart size={18} style={{ color: isSaved ? "#FF4B6E" : "#0A0A0A", fill: isSaved ? "#FF4B6E" : "none" }} />
            </button>
            <button onClick={handleShare}
              style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              <Share2 size={18} style={{ color: "#0A0A0A" }} />
            </button>
          </div>
        </div>

        {venue.images?.length > 1 && (
          <>
            <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
              {venue.images.map((_: any, i: number) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  style={{ width: i === activeImage ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === activeImage ? "#FFFFFF" : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0 }} />
              ))}
            </div>
            <button onClick={() => openHeroLightbox(activeImage)}
              style={{ position: "absolute", bottom: 56, right: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "4px 10px", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{activeImage + 1}/{venue.images.length} · View all</span>
            </button>
          </>
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: "#FFFFFF", fontSize: 24, fontWeight: 900, margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)", textShadow: "0 1px 8px rgba(0,0,0,0.5)", lineHeight: 1.2 }}>
              {venue.name}
            </h1>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
              <MapPin size={12} style={{ color: "rgba(255,255,255,0.85)", flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>{venue.address}</span>
            </div>
          </div>
          {venue.lat && venue.lng && (
            <button onClick={() => openDirections(venue.lat, venue.lng, venue.name)}
              style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(91,14,166,0.4)", flexShrink: 0 }}>
              <Navigation size={14} />Directions
            </button>
          )}
        </div>
      </div>

      {/* White card */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "20px 20px 0 0", marginTop: -14, position: "relative", zIndex: 1 }}>

        {/* Rating row */}
        <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={16} style={{ color: s <= Math.round(avgRating) ? "#FBBF24" : "#E4DCF0", fill: s <= Math.round(avgRating) ? "#FBBF24" : "#E4DCF0" }} />
              ))}
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A" }}>{Number(avgRating).toFixed(1)}</span>
            {reviewCount > 0 && <span style={{ fontSize: 13, color: "#9E9E9E" }}>({reviewCount})</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "5px 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", textTransform: "capitalize" }}>
              {venue.category?.replace(/-/g, " ")}
            </span>
          </div>
        </div>

        {/* Min spend + open today */}
        {(startsFromPrice || Object.keys(openingHours).length > 0) && (
          <div style={{ padding: "0 16px 14px", display: "flex", gap: 10 }}>
            {startsFromPrice && (
              <div style={{ flex: 1, backgroundColor: "#FFF8E1", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #FDE68A" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Tag size={16} style={{ color: "#D97706" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#D97706", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {isMinSpend ? "Min. spend:" : "Starts from"}
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "#D97706", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {formatCurrency(startsFromPrice)}
                  </p>
                </div>
              </div>
            )}
            {Object.keys(openingHours).length > 0 && (
              <div style={{ flex: 1, backgroundColor: isOpenToday ? "#E0F7EA" : "#FEF2F2", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${isOpenToday ? "#A7F3D0" : "#FECACA"}` }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: isOpenToday ? "#00C853" : "#EF4444", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: isOpenToday ? "#059669" : "#EF4444", margin: "0 0 1px" }}>
                    {isOpenToday ? "Open today" : "Closed today"}
                  </p>
                  {isOpenToday && (
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#059669", margin: 0 }}>
                      {todayHours.open} – {todayHours.close}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature tags */}
        {venue.google_data && (
          <div style={{ padding: "0 16px 14px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(() => {
                const pl = venue.google_data.price_level;
                const n = typeof pl === "number" ? pl : ({ "PRICE_LEVEL_INEXPENSIVE":1,"PRICE_LEVEL_MODERATE":2,"PRICE_LEVEL_EXPENSIVE":3,"PRICE_LEVEL_VERY_EXPENSIVE":4 } as any)[pl] ?? null;
                return n ? (
                  <div style={{ backgroundColor: "#FFF8E1", borderRadius: 10, padding: "7px 12px", border: "1px solid #FDE68A" }}>
                    <span style={{ fontSize: 12, color: "#D97706", fontWeight: 700 }}>{"₦".repeat(n)} · Price range</span>
                  </div>
                ) : null;
              })()}
              {venue.google_data.serves_cocktails && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍸 Cocktails</span></div>}
              {venue.google_data.serves_beer      && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍺 Beer</span></div>}
              {venue.google_data.serves_wine      && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍷 Wine</span></div>}
              {venue.google_data.dine_in          && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍽️ Dine In</span></div>}
              {venue.google_data.delivery         && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🛵 Delivery</span></div>}
              {venue.google_data.takeout          && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🥡 Takeout</span></div>}
              {venue.google_data.reservable       && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>📅 Reservations</span></div>}
              {venue.google_data.wheelchair_accessible && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>♿ Accessible</span></div>}
              {venue.google_data.editorial_summary && (
                <div style={{ width: "100%", backgroundColor: "#EDE0F7", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{venue.google_data.editorial_summary}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {venue.google_data && (
          <div style={{ padding: "0 16px 14px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(() => {
                const pl = venue.google_data.price_level;
                const n = typeof pl === "number" ? pl : ({ "PRICE_LEVEL_INEXPENSIVE":1,"PRICE_LEVEL_MODERATE":2,"PRICE_LEVEL_EXPENSIVE":3,"PRICE_LEVEL_VERY_EXPENSIVE":4 } as any)[pl] ?? null;
                return n ? (
                  <div style={{ backgroundColor: "#FFF8E1", borderRadius: 10, padding: "7px 12px", border: "1px solid #FDE68A" }}>
                    <span style={{ fontSize: 12, color: "#D97706", fontWeight: 700 }}>{"₦".repeat(n)} · Price range</span>
                  </div>
                ) : null;
              })()}
              {venue.google_data.serves_cocktails && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍸 Cocktails</span></div>}
              {venue.google_data.serves_beer      && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍺 Beer</span></div>}
              {venue.google_data.serves_wine      && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍷 Wine</span></div>}
              {venue.google_data.dine_in          && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🍽️ Dine In</span></div>}
              {venue.google_data.delivery         && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🛵 Delivery</span></div>}
              {venue.google_data.takeout          && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>🥡 Takeout</span></div>}
              {venue.google_data.reservable       && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>📅 Reservations</span></div>}
              {venue.google_data.wheelchair_accessible && <div style={{ backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}><span style={{ fontSize: 12 }}>♿ Accessible</span></div>}
              {venue.google_data.editorial_summary && (
                <div style={{ width: "100%", backgroundColor: "#EDE0F7", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{venue.google_data.editorial_summary}"</p>
                </div>
              )}
            </div>
          </div>
        )}
        

        {venueTags.length > 0 && venue.source !== "google" && (
          <div style={{ padding: "0 16px 14px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {visibleTags.map((tag: string) => {
                const Icon = getTagIcon(tag);
                return (
                  <div key={tag} style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F7F5FA", borderRadius: 10, padding: "7px 12px", border: "1px solid #F2EEF9" }}>
                    <Icon size={13} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 500 }}>{tag}</span>
                  </div>
                );
              })}
            </div>
            {venueTags.length > 6 && (
              <button onClick={() => setShowAllTags(!showAllTags)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: "8px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                {showAllTags ? "Show less" : `+${venueTags.length - 6} more`}
                <ChevronRight size={13} style={{ transform: showAllTags ? "rotate(90deg)" : "none" }} />
              </button>
            )}
          </div>
        )}

        <div style={{ height: 1, backgroundColor: "#F2EEF9" }} />

        {/* Tabs */}
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", padding: "0 16px", borderBottom: "1px solid #F2EEF9" }}>
          {TABS.map(({ id: tabId, label, count }: any) => (
            <button key={tabId} onClick={() => setActiveTab(tabId as any)}
              style={{ flexShrink: 0, padding: "12px 16px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: activeTab === tabId ? "2.5px solid #5B0EA6" : "2.5px solid transparent", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: activeTab === tabId ? 700 : 500, color: activeTab === tabId ? "#5B0EA6" : "#9E9E9E", whiteSpace: "nowrap" }}>{label}</span>
              {count !== undefined && count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: activeTab === tabId ? "#5B0EA6" : "#9E9E9E", backgroundColor: activeTab === tabId ? "#EDE0F7" : "#F2EEF9", padding: "1px 6px", borderRadius: 999 }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px" }}>
          <AnimatePresence mode="wait">

            {/* ── INFO TAB — your original, untouched ── */}
            {activeTab === "info" && (
              <motion.div key="info" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {venue.description && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{venue.name}</p>
                    <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: 0 }}>{venue.description}</p>
                  </div>
                )}

                {vendorVideos && vendorVideos.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>Watch their videos here</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: "0 0 10px", lineHeight: 1.5 }}>Visit their video links for a more detailed look at this venue.</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {vendorVideos.map((v: any) => {
                        const platform = detectPlatform(v.url);
                        if (platform.canEmbed && platform.embedUrl) {
                          return (
                            <div key={v.id} style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #F2EEF9" }}>
                              <iframe src={platform.embedUrl} style={{ width: "100%", height: 190, border: "none", display: "block" }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                              <div style={{ padding: "8px 12px", backgroundColor: "#F7F5FA", display: "flex", alignItems: "center", gap: 6 }}>
                                <PlatformLogo platform={platform.name} size={14} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B" }}>{platform.name}</span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer"
                            style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12, backgroundColor: platform.bg, borderRadius: 14, padding: "12px 14px", border: `1px solid ${platform.color}22` }}>
                            <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: `${platform.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <PlatformLogo platform={platform.name} size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>Watch on {platform.name}</p>
                              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{v.url}</p>
                            </div>
                            <ExternalLink size={15} style={{ color: platform.color, flexShrink: 0 }} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {venue.dress_policy && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Dress Code</p>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, marginBottom: 6,
                        backgroundColor: venue.dress_policy_strictness === "strict" ? "#FEF2F2" : venue.dress_policy_strictness === "moderate" ? "#FFF8E1" : "#E0F7EA",
                        color: venue.dress_policy_strictness === "strict" ? "#EF4444" : venue.dress_policy_strictness === "moderate" ? "#D97706" : "#059669",
                      }}>
                        {venue.dress_policy_strictness === "strict" ? "🔴 Strictly Enforced" : venue.dress_policy_strictness === "moderate" ? "🟡 Moderate" : "🟢 Relaxed"}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: "0 0 3px" }}>{venue.dress_policy}</p>
                      {venue.dress_policy_description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>{venue.dress_policy_description}</p>}
                    </div>
                  </div>
                )}

                {venue.picture_policy && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Photo & Video Policy</p>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
                      <Shield size={16} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 13, color: "#0A0A0A", margin: 0, lineHeight: 1.5 }}>{venue.picture_policy}</p>
                    </div>
                  </div>
                )}

                {(venue.phone || venue.whatsapp || venue.contact_email || venue.instagram || venue.website) && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Contact & Support</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {venue.whatsapp && (
                        <a href={`https://wa.me/${venue.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px" }}>
                          <span style={{ fontSize: 16 }}>💬</span><span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>WhatsApp</span>
                        </a>
                      )}
                      {venue.phone && (
                        <a href={`tel:${venue.phone}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#EDE0F7", border: "1px solid #C4BAD8", borderRadius: 12, padding: "10px 14px" }}>
                          <Phone size={13} style={{ color: "#5B0EA6" }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>Call</span>
                        </a>
                      )}
                      {venue.contact_email && (
                        <a href={`mailto:${venue.contact_email}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "10px 14px" }}>
                          <span style={{ fontSize: 14 }}>✉️</span><span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Email</span>
                        </a>
                      )}
                      {venue.instagram && (
                        <a href={`https://instagram.com/${venue.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg, #FFF0E6, #FCE4EC)", border: "1px solid #FBBF24", borderRadius: 12, padding: "10px 14px" }}>
                          <span style={{ fontSize: 14 }}>📸</span><span style={{ fontSize: 12, fontWeight: 700, color: "#C13584" }}>Instagram</span>
                        </a>
                      )}
                      {venue.website && (
                        <a href={venue.website.startsWith("http") ? venue.website : `https://${venue.website}`} target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, backgroundColor: "#F7F5FA", border: "1px solid #E4DCF0", borderRadius: 12, padding: "10px 14px" }}>
                          <span style={{ fontSize: 14 }}>🌐</span><span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Website</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 20 }} />

                {Object.keys(openingHours).length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Opening Hours</p>
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, overflow: "hidden" }}>
                      {DAYS.map((day, i) => {
                        const hours = openingHours[day];
                        const isToday = day === todayKey;
                        return (
                          <div key={day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: isToday ? "#EDE0F7" : "transparent", borderBottom: i < DAYS.length - 1 ? "1px solid #F2EEF9" : "none" }}>
                            <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "#5B0EA6" : "#6B6B6B" }}>{day}</span>
                            <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: !hours || hours.closed ? "#EF4444" : isToday ? "#5B0EA6" : "#0A0A0A" }}>
                              {!hours || hours.closed ? "Closed" : `${hours.open} – ${hours.close}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 20 }} />

                {media && media.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Media</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["photos", "videos"] as const).filter((t) => t === "photos" ? photos.length > 0 : videos.length > 0).map((tab) => (
                          <button key={tab} onClick={() => setActiveMediaTab(tab)}
                            style={{ padding: "4px 12px", borderRadius: 999, border: "1.5px solid", borderColor: activeMediaTab === tab ? "#5B0EA6" : "#E4DCF0", backgroundColor: activeMediaTab === tab ? "#EDE0F7" : "#FFFFFF", color: activeMediaTab === tab ? "#5B0EA6" : "#9E9E9E", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {tab} ({tab === "photos" ? photos.length : videos.length})
                          </button>
                        ))}
                      </div>
                    </div>
                    {activeMediaTab === "photos" && photos.length > 0 && (
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                        {photos.map((item: any, i: number) => (
                          <button key={item.id} onClick={() => { setLightboxImages(photos.map((p: any) => p.url)); setLightboxIdx(i); setLightboxImage(item.url); }}
                            style={{ flexShrink: 0, width: 130, height: 90, borderRadius: 12, overflow: "hidden", border: "none", padding: 0, cursor: "pointer" }}>
                            <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </button>
                        ))}
                      </div>
                    )}
                    {activeMediaTab === "videos" && videos.length > 0 && (
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                        {videos.map((item: any) => (
                          <div key={item.id} style={{ flexShrink: 0, width: 110, height: 150, borderRadius: 12, overflow: "hidden", position: "relative", backgroundColor: "#0A0A0A" }}>
                            {item.thumbnail_url
                              ? <img src={item.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
                              : <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} muted playsInline />}
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <a href={item.url} target="_blank" rel="noopener noreferrer"
                                style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                <Play size={14} style={{ color: "#5B0EA6", fill: "#5B0EA6", marginLeft: 2 }} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 20 }} />

                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Booking Policies</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { icon: Shield, text: "Amount reserved until receipt confirmed" },
                      { icon: CheckCircle, text: "Instant booking confirmation via QR code" },
                      { icon: Phone, text: "Venue contacts you directly after booking" },
                      { icon: AlertCircle, text: "Unused balance returned to your wallet" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={13} style={{ color: "#5B0EA6" }} />
                        </div>
                        <span style={{ fontSize: 13, color: "#6B6B6B" }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: "#F2EEF9", marginBottom: 20 }} />

                <div style={{ marginBottom: 140 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>Reviews</p>
                  {user && userBooking && !existingReview && (
                    <button onClick={() => router.push(`/review/${userBooking.id}`)}
                      style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #FBBF24, #F59E0B)", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                      <Star size={14} style={{ fill: "#FFFFFF", color: "#FFFFFF" }} />Leave a Review
                    </button>
                  )}
                  {user && userBooking && existingReview && (
                    <button onClick={() => router.push(`/review/${userBooking.id}`)}
                      style={{ width: "100%", padding: "11px 16px", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#F7F5FA", color: "#6B6B6B", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                      <Star size={14} style={{ color: "#FBBF24", fill: "#FBBF24" }} />Edit Your Review
                    </button>
                  )}
                  {reviews && reviews.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {reviews.map((review: any) => (
                        <div key={review.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                {review.users?.avatar_url
                                  ? <img src={review.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{review.users?.full_name?.[0]}</span>}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A" }}>{review.users?.full_name || "Guest"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 2 }}>
                              {[1,2,3,4,5].map((s) => (
                                <Star key={s} size={11} style={{ color: s <= review.rating ? "#FBBF24" : "#E4DCF0", fill: s <= review.rating ? "#FBBF24" : "#E4DCF0" }} />
                              ))}
                            </div>
                          </div>
                          {review.comment && <p style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{review.comment}"</p>}
                          {review.vendor_reply && (
                            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: "2px solid #5B0EA6" }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6", margin: "0 0 2px" }}>Venue Reply</p>
                              <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0 }}>{review.vendor_reply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : venue.source === "google" && venue.google_data?.reviews?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px", fontStyle: "italic" }}>Reviews from Google</p>
                      {venue.google_data.reviews.map((review: any, i: number) => (
                        <div key={i} style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                {review.avatar
                                  ? <img src={review.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <span style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6" }}>{review.author?.[0]}</span>}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: 12, color: "#0A0A0A" }}>{review.author}</span>
                            </div>
                            <div style={{ display: "flex", gap: 2 }}>
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} size={11} style={{ color: s <= review.rating ? "#FBBF24" : "#E4DCF0", fill: s <= review.rating ? "#FBBF24" : "#E4DCF0" }} />
                              ))}
                            </div>
                          </div>
                          {review.text && <p style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.5, margin: "0 0 4px", fontStyle: "italic" }}>"{review.text}"</p>}
                          <p style={{ fontSize: 10, color: "#C4BAD8", margin: 0 }}>{review.time}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "28px 0", color: "#9E9E9E", fontSize: 13 }}>
                      No reviews yet. Be the first to review.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── MENU TAB — your original carousel UI, untouched ── */}
            {activeTab === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ paddingBottom: 160 }}>

                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ backgroundColor: "#5B0EA6", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 1px" }}>
                          {cartCount} item{cartCount !== 1 ? "s" : ""} in order
                        </p>
                        <p style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                          {formatCurrency(cartTotal)}
                          {minimumSpend > 0 && cartTotal >= minimumSpend && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginLeft: 8 }}>✓ min met</span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={clear}
                          style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", backgroundColor: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Clear
                        </button>
                        <button
                          onClick={() => {
                            if (!user) { router.push(`/login?redirect=/venue/${id}`); return; }
                            setShowBooking(true);
                          }}
                          disabled={minimumSpend > 0 && cartTotal < minimumSpend}
                          style={{ padding: "7px 14px", borderRadius: 10, border: "none", backgroundColor: minimumSpend > 0 && cartTotal < minimumSpend ? "rgba(255,255,255,0.3)" : "#FFFFFF", color: minimumSpend > 0 && cartTotal < minimumSpend ? "rgba(255,255,255,0.5)" : "#5B0EA6", fontSize: 12, fontWeight: 800, cursor: minimumSpend > 0 && cartTotal < minimumSpend ? "not-allowed" : "pointer" }}>
                          Book Now
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {minimumSpend > 0 && cartCount > 0 && cartTotal < minimumSpend && (
                  <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "8px 12px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    <AlertCircle size={13} style={{ color: "#D97706", flexShrink: 0 }} />
                    <p style={{ fontSize: 11, color: "#92400E", margin: 0 }}>
                      Add {formatCurrency(minimumSpend - cartTotal)} more to reach the min. spend of {formatCurrency(minimumSpend)}
                    </p>
                  </div>
                )}

                {minimumSpend > 0 && cartCount === 0 && (
                  <div style={{ backgroundColor: "#F7F5FA", border: "1px solid #F2EEF9", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                      Pick items below · Min. spend {formatCurrency(minimumSpend)}
                    </p>
                  </div>
                )}

                {Object.keys(menuByCategory).length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    {Object.entries(menuByCategory).map(([category, categoryItems]) => (
                      <div key={category} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                            {category}
                          </p>
                          <button
                            onClick={() => router.push(`/venue/${id}/menu/${encodeURIComponent(category)}`)}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0 }}>
                            See all <ChevronRight size={13} />
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4, WebkitOverflowScrolling: "touch" } as any}>
                          {categoryItems.map((item: any) => {
                            const qty = cartItems[item.id]?.qty || 0;
                            const isSelected = qty > 0;
                            return (
                              <div key={item.id} style={{ flexShrink: 0, width: 150, borderRadius: 16, overflow: "hidden", backgroundColor: isSelected ? "#EDE0F7" : "#F7F5FA", border: `1.5px solid ${isSelected ? "#C4A0E8" : "#F2EEF9"}`, transition: "all 0.15s", display: "flex", flexDirection: "column" }}>
                                <div style={{ width: "100%", height: 110, backgroundColor: "#EDE0F7", position: "relative", flexShrink: 0 }}>
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? "#C4A0E8" : "#EDE0F7" }}>
                                      <UtensilsCrossed size={28} style={{ color: isSelected ? "#FFFFFF" : "#5B0EA6" }} />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div style={{ position: "absolute", top: 6, right: 6, backgroundColor: "#5B0EA6", borderRadius: 999, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <CheckCircle size={13} style={{ color: "#FFFFFF" }} />
                                    </div>
                                  )}
                                  {qty > 1 && (
                                    <div style={{ position: "absolute", top: 6, left: 6, backgroundColor: "#5B0EA6", borderRadius: 999, padding: "1px 6px" }}>
                                      <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF" }}>×{qty}</span>
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: "10px 10px 8px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                                  <p style={{ fontWeight: 700, fontSize: 12, color: "#0A0A0A", margin: 0, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                                    {item.name}
                                  </p>
                                  {item.description && (
                                    <p style={{ fontSize: 10, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                      {item.description}
                                    </p>
                                  )}
                                  <p style={{ fontSize: 13, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                                    {formatCurrency(item.price)}
                                  </p>
                                </div>
                                <div style={{ padding: "0 10px 10px" }}>
                                  {isSelected ? (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 10, padding: "4px 6px", boxShadow: "0 1px 4px rgba(91,14,166,0.12)" }}>
                                      <button onClick={() => decrement(item.id)}
                                        style={{ width: 26, height: 26, borderRadius: 7, border: "none", backgroundColor: "#EDE0F7", color: "#5B0EA6", fontSize: 16, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        −
                                      </button>
                                      <span style={{ fontSize: 14, fontWeight: 800, color: "#5B0EA6" }}>{qty}</span>
                                      <button onClick={() => increment({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, category: item.category })}
                                        style={{ width: 26, height: 26, borderRadius: 7, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 16, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => increment({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, category: item.category })}
                                      style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                      + Add
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {menuImages.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Menu Gallery</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {menuImages.map((upload: any, idx: number) => (
                        <button key={upload.id} onClick={() => setLightboxImage(upload.url)}
                          style={{ borderRadius: 12, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", position: "relative", aspectRatio: "3/4", backgroundColor: "#EDE0F7", display: "block" }}>
                          <img src={upload.url} alt={upload.title || "Menu"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          {upload.title && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "20px 8px 8px" }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>{upload.title}</p>
                            </div>
                          )}
                          {idx === 0 && menuImages.length > 1 && (
                            <div style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "3px 8px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>1/{menuImages.length}</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {menuPdfs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Menu Files</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {menuPdfs.map((upload: any) => (
                        <a key={upload.id} href={upload.url} target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12, backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", border: "1.5px solid #F2EEF9" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FileText size={18} style={{ color: "#5B0EA6" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 1px" }}>{upload.title || "Menu PDF"}</p>
                            <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Tap to open PDF</p>
                          </div>
                          <ChevronRight size={15} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(menuByCategory).length === 0 && menuImages.length === 0 && menuPdfs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <UtensilsCrossed size={36} style={{ color: "#E4DCF0" }} />
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: 0 }}>No menu yet</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>The venue hasn't added their menu yet</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── EVENTS TAB — your original, untouched ── */}
            {activeTab === "events" && (
              <motion.div key="events" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ paddingBottom: 140 }}>
                {events && events.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {events.map((event: any) => (
                      <div key={event.id} style={{ backgroundColor: "#F7F5FA", borderRadius: 14, overflow: "hidden", display: "flex" }}>
                        <div style={{ width: 80, flexShrink: 0, backgroundColor: "#EDE0F7" }}>
                          {event.images?.[0]
                            ? <img src={event.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 90 }} />
                            : <div style={{ width: "100%", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Calendar size={22} style={{ color: "#7B2FBE" }} />
                              </div>}
                        </div>
                        <div style={{ flex: 1, padding: "12px" }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 4px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{event.title}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                            <Calendar size={10} style={{ color: "#5B0EA6" }} />
                            <span style={{ fontSize: 11, color: "#5B0EA6", fontWeight: 600 }}>
                              {format(new Date(event.start_date), "dd MMM yyyy · HH:mm")}
                            </span>
                          </div>
                          {event.ticket_price > 0 && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#EDE0F7", borderRadius: 999, padding: "3px 8px" }}>
                              <Ticket size={10} style={{ color: "#5B0EA6" }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#5B0EA6" }}>{formatCurrency(event.ticket_price)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Calendar size={36} style={{ color: "#E4DCF0" }} />
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: 0 }}>No upcoming events</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Check back soon</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── PACKAGES TAB — new, replaces offers ── */}
            {activeTab === "packages" && (
              <motion.div key="packages" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ paddingBottom: 140 }}>
                {packages && packages.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                      <Package size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                        Select a package to book. Package price replaces the manual amount.
                      </p>
                    </div>
                    {packages.map((pkg: any) => {
                      const isSelected = selectedPackage?.id === pkg.id;
                      const includedItems: any[] = pkg.menu_items || [];
                      return (
                        <div key={pkg.id}
                          style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", border: `2px solid ${isSelected ? "#5B0EA6" : "#F2EEF9"}`, boxShadow: isSelected ? "0 4px 20px rgba(91,14,166,0.15)" : "0 1px 8px rgba(91,14,166,0.05)", transition: "border-color 0.15s, box-shadow 0.15s" }}>
                          <div style={{ padding: "16px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 900, fontSize: 16, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>{pkg.name}</p>
                                {pkg.description && <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>{pkg.description}</p>}
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <p style={{ fontSize: 20, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display,Syne,sans-serif)" }}>{formatCurrency(pkg.price)}</p>
                                {pkg.guest_capacity && (
                                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "2px 0 0" }}>Up to {pkg.guest_capacity} guests</p>
                                )}
                              </div>
                            </div>
                            {includedItems.length > 0 && (
                              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Included</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {includedItems.map((item: any, i: number) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <CheckCircle size={11} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 600 }}>
                                          {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 700 }}>
                                        {formatCurrency((item.price || 0) * (item.qty || 1))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                if (!user) { router.push(`/login?redirect=/venue/${id}`); return; }
                                if (isSelected) {
                                  setSelectedPackage(null);
                                } else {
                                  setSelectedPackage(pkg);
                                  clear();
                                  setShowBooking(true);
                                }
                              }}
                              style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: isSelected ? "none" : "1.5px solid #5B0EA6", background: isSelected ? "linear-gradient(135deg,#3B0764,#5B0EA6)" : "#FFFFFF", color: isSelected ? "#FFFFFF" : "#5B0EA6", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: isSelected ? "0 3px 12px rgba(91,14,166,0.3)" : "none" }}>
                              {isSelected ? <><CheckCircle size={15} />Selected — Book Now</> : <><Package size={14} />Select Package</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Package size={36} style={{ color: "#E4DCF0" }} />
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: 0 }}>No packages available</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Check back later or book directly</p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Book CTA — your original, untouched ── */}
      <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, padding: "10px 16px", backgroundColor: "rgba(255,255,255,0.98)", backdropFilter: "blur(10px)", borderTop: "1px solid #F2EEF9", maxWidth: 480, margin: "0 auto", zIndex: 40 }}>
        {venue.bookings_enabled === false ? (
          <div style={{ width: "100%", padding: "10px 0", borderRadius: 12, backgroundColor: "#FEF2F2", textAlign: "center" }}>
            <p style={{ color: "#EF4444", fontSize: 11, fontWeight: 700, margin: 0 }}>
              {venue.source === "google"
                ? "⚠ Direct booking unavailable — visit venue directly"
                : "Bookings not available"}
            </p>
          </div>
        ) : isApprovedVendor ? (
          <div style={{ width: "100%", padding: "14px 0", borderRadius: 16, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", textAlign: "center" }}>
            <p style={{ color: "#9E9E9E", fontSize: 13, fontWeight: 600, margin: 0 }}>Vendor accounts cannot make bookings</p>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {selectedPackage ? (
              <div style={{ flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 1px", fontWeight: 600 }}>Package</p>
                <p style={{ fontSize: 15, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)", maxWidth: 160, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {selectedPackage.name} — {formatCurrency(selectedPackage.price)}
                </p>
              </div>
            ) : cartCount > 0 ? (
              <div style={{ flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 1px", fontWeight: 600 }}>
                  {cartCount} item{cartCount !== 1 ? "s" : ""}
                </p>
                <p style={{ fontSize: 17, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(cartTotal)}
                </p>
              </div>
            ) : startsFromPrice ? (
              <div style={{ flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: "#9E9E9E", margin: "0 0 1px", fontWeight: 600 }}>
                  {isMinSpend ? "Min. spend" : "Starts from"}
                </p>
                <p style={{ fontSize: 17, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(startsFromPrice)}
                </p>
              </div>
            ) : null}
            <button
              onClick={() => {
                if (!user) { router.push(`/login?redirect=/venue/${id}`); return; }
                setShowBooking(true);
              }}
              style={{ flex: 1, padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(91,14,166,0.35)" }}>
              {selectedPackage
                ? <><Package size={17} />Book Package</>
                : cartCount > 0
                ? <><ShoppingCart size={17} />Book Order</>
                : <><Calendar size={17} />Book This Spot</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Booking Sheet — your original with WhatsApp + package additions ── */}
      <AnimatePresence>
        {showBooking && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowBooking(false); bookMutation.reset(); }}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

              <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {selectedPackage ? "Book Package" : hasCartItems ? "Confirm Order" : `Book ${venue.name}`}
                    </h3>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>Amount held until receipt confirmed</p>
                  </div>
                  <button onClick={() => { setShowBooking(false); bookMutation.reset(); }}
                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2EEF9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} style={{ color: "#6B6B6B" }} />
                  </button>
                </div>
                <div style={{ backgroundColor: "#F2EEF9", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>Wallet balance</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: (walletBalance || 0) >= reserveAmount ? "#5B0EA6" : "#EF4444" }}>
                    {formatCurrency(walletBalance || 0)}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 }}>

                  {/* Package summary */}
                  {selectedPackage && (
                    <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Package size={16} style={{ color: "#5B0EA6" }} />
                          <span style={{ fontWeight: 800, fontSize: 14, color: "#5B0EA6" }}>{selectedPackage.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: "#5B0EA6" }}>{formatCurrency(selectedPackage.price)}</span>
                          <button onClick={() => setSelectedPackage(null)}
                            style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: "rgba(91,14,166,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} style={{ color: "#5B0EA6" }} />
                          </button>
                        </div>
                      </div>
                      {selectedPackage.guest_capacity && (
                        <p style={{ fontSize: 11, color: "#7B2FBE", margin: 0 }}>Up to {selectedPackage.guest_capacity} guests included</p>
                      )}
                    </div>
                  )}

                  {/* Cart summary — your original */}
                  {!selectedPackage && hasCartItems && (
                    <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, overflow: "hidden", border: "1.5px solid #EDE0F7" }}>
                      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #EDE0F7" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#5B0EA6", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Your Order</p>
                      </div>
                      <div style={{ padding: "8px 14px" }}>
                        {cartItemsList.map((item) => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                              {item.image_url && (
                                <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
                                  <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                              )}
                              <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 500, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                {item.name}
                              </span>
                              <span style={{ fontSize: 11, color: "#9E9E9E", flexShrink: 0 }}>× {item.qty}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", flexShrink: 0, marginLeft: 8 }}>
                              {formatCurrency(item.price * item.qty)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #EDE0F7", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#9E9E9E" }}>Items subtotal</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>{formatCurrency(cartTotal)}</span>
                        </div>
                        {minimumSpend > 0 && cartTotal < minimumSpend && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "#D97706" }}>Min. spend top-up</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>{formatCurrency(minimumSpend - cartTotal)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #EDE0F7", marginTop: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>Total to reserve</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                            {formatCurrency(reserveAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual amount — only if vendor allows AND no package/cart */}
                  {!selectedPackage && !hasCartItems && !requiresMenuSelection && (
                    <div>
                      {hasMenu && (
                        <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                          <UtensilsCrossed size={14} style={{ color: "#5B0EA6", flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: "#5B0EA6", margin: 0 }}>
                            No items selected. Go to{" "}
                            <button onClick={() => { setShowBooking(false); setActiveTab("menu"); }}
                              style={{ background: "none", border: "none", color: "#3D0066", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                              Menu tab
                            </button>{" "}
                            to pick items, or enter an amount below.
                          </p>
                        </div>
                      )}
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                        Amount to Reserve{minimumSpend > 0 ? ` (min. ${formatCurrency(minimumSpend)})` : ""}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${belowMinimum ? "#EF4444" : "#E4DCF0"}`, borderRadius: 14, padding: "13px 14px" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                        <input type="number"
                          placeholder={minimumSpend > 0 ? `Min. ${minimumSpend.toLocaleString()}` : "Enter amount"}
                          value={manualAmount} onChange={(e) => setManualAmount(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit" }} />
                      </div>
                      {belowMinimum && (
                        <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0", fontWeight: 600 }}>
                          Minimum spend is {formatCurrency(minimumSpend)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Must-select notice */}
                  {!selectedPackage && !hasCartItems && requiresMenuSelection && (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                      <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                        Please select items from the{" "}
                        <button onClick={() => { setShowBooking(false); setActiveTab("menu"); }}
                          style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                          Menu tab
                        </button>
                        {" "}or choose a{" "}
                        <button onClick={() => { setShowBooking(false); setActiveTab("packages"); }}
                          style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                          Package
                        </button>
                        {" "}before booking.
                      </p>
                    </div>
                  )}

                  {/* Date & time — your original */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Date & Time *</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${!bookingDate && bookMutation.isError ? "#EF4444" : "#E4DCF0"}`, borderRadius: 14, padding: "13px 14px" }}>
                      <Calendar size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                      <input type="datetime-local" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>

                  {/* Social venue fields — WhatsApp replaces Phone */}
                  {isSocialVenue && (
                    <>
                      {/* WhatsApp — validated Nigerian number */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                          WhatsApp Number <span style={{ color: "#EF4444" }}>*</span>
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${phoneErr ? "#EF4444" : "#E4DCF0"}`, borderRadius: 14, padding: "13px 14px" }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>💬</span>
                          <input type="tel" placeholder="08012345678 or 2348012345678"
                            value={bookingPhone}
                            onChange={(e) => { setBookingPhone(e.target.value); setPhoneErr(""); }}
                            onBlur={() => {
                              if (bookingPhone.trim() && !isValidNigerianPhone(bookingPhone)) {
                                setPhoneErr("Enter a valid Nigerian number e.g. 08012345678");
                              }
                            }}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                          {bookingPhone && isValidNigerianPhone(bookingPhone) && (
                            <CheckCircle size={16} style={{ color: "#059669", flexShrink: 0 }} />
                          )}
                        </div>
                        {phoneErr && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0", fontWeight: 600 }}>{phoneErr}</p>}
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                          Number of Guests <span style={{ color: "#EF4444" }}>*</span>
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "13px 14px" }}>
                          <Users size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                          <input type="number" min="1" placeholder="How many guests?" value={guestCount}
                            onChange={(e) => setGuestCount(e.target.value)}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Special Occasion</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {SPECIAL_OCCASIONS.map((occ) => (
                            <button key={occ} onClick={() => setSpecialOccasion(occ)}
                              style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid", borderColor: specialOccasion === occ ? "#5B0EA6" : "#E4DCF0", backgroundColor: specialOccasion === occ ? "#EDE0F7" : "#FFFFFF", color: specialOccasion === occ ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              {occ}
                            </button>
                          ))}
                        </div>
                        {specialOccasion !== "None" && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            style={{ marginTop: 8, backgroundColor: "#EDE0F7", borderRadius: 12, padding: "8px 12px", display: "flex", gap: 6 }}>
                            <PartyPopper size={13} style={{ color: "#5B0EA6", flexShrink:0, marginTop: 1 }} />
                            <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0 }}>
                              The venue will be notified about your {specialOccasion.toLowerCase()}.
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Notes — your original */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Additional Notes <span style={{ fontWeight: 400, color: "#C4BAD8" }}>(optional)</span>
                    </p>
                    <textarea placeholder="Any special requests..."
                      value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} rows={2}
                      style={{ width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
                  </div>

                  {/* Insufficient balance — your original */}
                  {reserveAmount > 0 && (walletBalance || 0) < reserveAmount && (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                      <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                        You need {formatCurrency(reserveAmount - (walletBalance || 0))} more.{" "}
                        <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                          style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
                          Fund wallet →
                        </button>
                      </p>
                    </div>
                  )}

                  {(walletBalance || 0) === 0 && (
                    <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                      <AlertCircle size={14} style={{ color: "#D97706", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                        Wallet empty.{" "}
                        <button onClick={() => { setShowBooking(false); router.push("/wallet"); }}
                          style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
                          Fund now →
                        </button>
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {bookMutation.isError && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                        <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{(bookMutation.error as Error).message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Confirm button — your original */}
              <div style={{ padding: "12px 20px 40px", borderTop: "1px solid #F2EEF9", flexShrink: 0 }}>
                {reserveAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                    <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                      {selectedPackage ? "Package price" : "Reservation amount"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0A0A0A" }}>{formatCurrency(reserveAmount)}</span>
                  </div>
                )}
                <button
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending || !canConfirm || (walletBalance || 0) < reserveAmount}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: bookMutation.isPending || !canConfirm || (walletBalance || 0) < reserveAmount ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: bookMutation.isPending || !canConfirm ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: canConfirm ? "0 4px 20px rgba(91,14,166,0.35)" : "none" }}>
                  {bookMutation.isPending
                    ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Confirming...</>
                    : <><CheckCircle size={18} />{hasCartItems ? `Reserve ${formatCurrency(reserveAmount)}` : selectedPackage ? `Book Package — ${formatCurrency(reserveAmount)}` : "Confirm Booking"}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Lightbox — handles both hero images and menu images ── */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setLightboxImage(null); setLightboxImages([]); setLightboxIdx(0); }}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={() => { setLightboxImage(null); setLightboxImages([]); setLightboxIdx(0); }}
              style={{ position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
              <X size={20} style={{ color: "#FFFFFF" }} />
            </button>
            {lightboxTotal > 1 && (
              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "4px 12px", zIndex: 102 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{lightboxCurIdx + 1} / {lightboxTotal}</span>
              </div>
            )}
            {lightboxCurIdx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                style={{ position: "absolute", left: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF", transform: "rotate(180deg)" }} />
              </button>
            )}
            {lightboxCurIdx < lightboxTotal - 1 && (
              <button onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                style={{ position: "absolute", right: 12, width: 42, height: 42, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 102 }}>
                <ChevronRight size={22} style={{ color: "#FFFFFF" }} />
              </button>
            )}
            <motion.img key={lightboxImage} src={lightboxImage}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }} />
            {lightboxTotal > 1 && (
              <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {Array.from({ length: lightboxTotal }).map((_, i) => (
                  <button key={i} onClick={(e) => {
                    e.stopPropagation();
                    if (lightboxImages.length) {
                      setLightboxIdx(i); setLightboxImage(lightboxImages[i]);
                    } else {
                      setLightboxImage(allMenuImages[i].url);
                    }
                  }}
                    style={{ width: i === lightboxCurIdx ? 20 : 6, height: 6, borderRadius: 999, backgroundColor: i === lightboxCurIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}