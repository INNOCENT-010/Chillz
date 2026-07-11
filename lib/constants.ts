import { CategorySlug } from "@/types/database";

export const CATEGORIES: {
  slug: CategorySlug;
  label: string;
  icon: string;
  comingSoon?: boolean;
  filters?: string[];
  eventTags?: string[];
}[] = [
  {
    slug: "events",
    label: "Events",
    icon: "Calendar",
    eventTags: ["Seminars", "Party", "Fashion Shows", "Festivals", "Polo", "Yacht Party", "Art Shows"],
  },
  {
    slug: "bar-lounge",
    label: "Bar & Lounge",
    icon: "Wine",
    filters: ["Sea View", "Rooftop", "Cozy", "Live Music", "Outdoor Seating", "VIP Section", "Shisha"],
  },
  {
    slug: "outdoorsy",
    label: "Outdoorsy",
    icon: "Sun",
    comingSoon: true,
  },
  {
    slug: "restaurant",
    label: "Restaurant",
    icon: "UtensilsCrossed",
    filters: ["Sea View", "Rooftop", "Cozy", "Private Dining", "Live Music", "Outdoor Seating"],
  },
  {
    slug: "club",
    label: "Club",
    icon: "Music",
    filters: ["Rooftop", "VIP Section", "Live Music", "Shisha"],
  },
  {
    slug: "hotel",
    label: "Hotel",
    icon: "Building2",
    filters: ["Sea View", "Rooftop", "Cozy", "Private Dining"],
  },
  {
    slug: "car-rentals",
    label: "Car Rentals",
    icon: "Car",
    filters: ["Airport Pickup", "Event Rental", "Standard Rental"],
  },
  {
    slug: "apartment-bookings",
    label: "Apartments",
    icon: "Home",
    filters: ["Shortlet", "Weekend Getaway", "Extended Stay"],
  },
  {
    slug: "lets-plan",
    label: "Let's Plan For You",
    icon: "Sparkles",
    comingSoon: true,
  },
  {
    slug: "flight-booking",
    label: "Flight Booking",
    icon: "Plane",
    comingSoon: true,
  },
];

export const CHILLZ_COMMISSION = 0.05;
export const CANCELLATION_FEE = 0.05;
export const DISPUTE_ESCROW_HOURS = 8;
export const VENDOR_MAX_RECEIPT_ATTEMPTS = 3;
export const WHATSAPP_ADMIN_NUMBER = "+2348100000000";

export const EVENT_TAGS = [
  "Seminars",
  "Party",
  "Fashion Shows",
  "Festivals",
  "Polo",
  "Yacht Party",
  "Art Shows",
];