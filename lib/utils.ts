import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * 0.05);
}

export function calculateVendorPayout(amount: number): number {
  return Math.round(amount * 0.95);
}

export function generateQRHash(): string {
  return crypto.randomUUID();
}

export function generateTicketCode(): string {
  const CITIES = [
    "LAGOS", "ACCRA", "ABUJA", "NAIJA", "BENIN", "DELTA", "ASABA", "ENUGU",
    "KANO", "IBADAN", "OWERRI", "WARRI", "KADUNA", "BONNY", "CALABAR", "YOLA",
    "SOKOTO", "BAUCHI", "MINNA", "LOKOJA", "ABEOKUTA", "ILORIN", "AKURE", "ONDO",
  ];
  const ANIMALS = [
    "LION", "WOLF", "BEAR", "HAWK", "TIGER", "EAGLE", "SHARK", "PUMA",
    "COBRA", "RHINO", "HIPPO", "CRANE", "VIPER", "HYENA", "JAGUAR", "FALCON",
    "BISON", "RAVEN", "LYNX", "OTTER", "GECKO", "MOOSE", "STOAT", "DINGO",
  ];
  const city   = CITIES[Math.floor(Math.random()  * CITIES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num    = Math.floor(Math.random() * 900) + 100;
  return `${city}-${animal}-${num}`;
}

export function getDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
// ── Fun booking code generator ──────────────────────────────────────────
const CITIES = [
  "LAGOS", "ACCRA", "ABUJA", "NAIJA", "BENIN", "DELTA", "ASABA", "ENUGU",
  "KANO", "IBADAN", "OWERRI", "WARRI", "KADUNA", "BONNY", "CALABAR", "YOLA",
  "SOKOTO", "BAUCHI", "MINNA", "LOKOJA", "ABEOKUTA", "ILORIN", "AKURE", "ONDO",
];

const ANIMALS = [
  "LION", "WOLF", "BEAR", "HAWK", "TIGER", "EAGLE", "SHARK", "PUMA",
  "COBRA", "RHINO", "HIPPO", "CRANE", "VIPER", "HYENA", "JAGUAR", "FALCON",
  "BISON", "RAVEN", "LYNX", "OTTER", "GECKO", "MOOSE", "STOAT", "DINGO",
];

export function generateBookingCode(): string {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${city}-${animal}-${num}`;
}
