/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { ImageUpload } from "@/components/ui/image-upload";
import { PlacesInput } from "@/components/ui/places-input";
import { PlaceDetail } from "@/hooks/use-places-autocomplete";
import {
  ArrowLeft, CheckCircle, AlertTriangle,
  Building2, Car, Home, Info, Navigation, Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const VENDOR_TYPES = [
  {
    id: "venue",
    label: "Bar, Club or Restaurant",
    subtitle: "Nightclub, bar, lounge, restaurant or social venue",
    icon: Building2,
    color: "#5B0EA6",
    bg: "#EDE0F7",
  },
  {
    id: "event_organizer",
    label: "Event Organizer",
    subtitle: "Host events, sell tickets, tag any CHILLZ venue",
    icon: Calendar,
    color: "#E07B00",
    bg: "#FFF3E0",
  },
  {
    id: "hotel",
    label: "Hotel",
    subtitle: "List your rooms, suites and packages",
    icon: Building2,
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    id: "car_rental",
    label: "Car Rental",
    subtitle: "Airport pickup, event rentals, standard hire",
    icon: Car,
    color: "#059669",
    bg: "#E0F7EA",
  },
  {
    id: "apartment",
    label: "Apartment / Shortlet",
    subtitle: "Shortlets, weekend stays, extended rentals",
    icon: Home,
    color: "#7B2FBE",
    bg: "#F3E8FF",
  },
];

const VENUE_CATEGORIES = [
  { id: "restaurant", label: "Restaurant", subtitle: "Food-first, dining experience" },
  { id: "bar-lounge", label: "Bar / Lounge", subtitle: "Drinks, chill atmosphere, social" },
  { id: "club", label: "Club / Nightclub", subtitle: "Late night, DJ, dancing" },
];

const STEPS = ["Type", "Business Info", "KYC", "Review"];

const validateBVN = (v: string) => {
  const c = v.replace(/\s/g, "");
  if (!/^\d+$/.test(c)) return "BVN / NIN must contain digits only";
  if (c.length !== 11) return "BVN / NIN must be exactly 11 digits";
  return null;
};

const validatePhone = (v: string) => {
  const c = v.replace(/[\s\-\+]/g, "");
  if (!/^\d+$/.test(c)) return "Phone number must contain digits only";
  if (c.length < 10 || c.length > 13) return "Enter a valid Nigerian phone number";
  return null;
};

const validateCAC = (v: string) => {
  if (!v.trim()) return null;
  if (!/^(RC|BN|IT)?\d{5,8}$/i.test(v.trim())) return "CAC format invalid. Example: RC123456";
  return null;
};

const validateBusinessName = (v: string) => {
  if (v.trim().length < 3) return "Business name must be at least 3 characters";
  if (v.trim().length > 100) return "Business name is too long";
  if (/[<>{}]/.test(v)) return "Business name contains invalid characters";
  return null;
};

export default function VendorRegisterPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    vendor_type: "",
    venue_category: "",
    business_name: "",
    account_holder_name: "",
    business_address: "",
    selectedPlace: null as PlaceDetail | null,
    locationInput: "",
    cac_number: "",
    bvn_nin: "",
    id_images: [] as string[],
    phone: user?.phone || "",
    email: user?.email || "",
    // Event organizer extras
    organizer_bio: "",
    organizer_instagram: "",
  });

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const isEventOrganizer = form.vendor_type === "event_organizer";
  // Event organizers don't need a physical address
  const needsAddress = !isEventOrganizer;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/places/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = await res.json();
          const address = data.formatted_address || `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
          setForm((prev) => ({
            ...prev,
            locationInput: address,
            business_address: address,
            selectedPlace: {
              place_id: data.place_id || `manual_${Date.now()}`,
              name: data.name || address,
              formatted_address: address,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            },
          }));
          setFieldErrors((prev) => { const n = { ...prev }; delete n.business_address; return n; });
        } catch {
          const address = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
          setForm((prev) => ({
            ...prev,
            locationInput: address,
            business_address: address,
            selectedPlace: {
              place_id: `manual_${Date.now()}`,
              name: "Current Location",
              formatted_address: address,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            },
          }));
        } finally { setLocating(false); }
      },
      (geoErr) => {
        setLocating(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError("Location permission denied. Search for your address above.");
        } else {
          setError("Could not get location. Search for your address instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePlaceSelect = async (place: PlaceDetail) => {
    setForm((prev) => ({
      ...prev,
      locationInput: place.formatted_address || place.name || "",
      business_address: place.formatted_address || place.name || "",
      selectedPlace: place,
    }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.business_address; return n; });

    if (!place.place_id) return;

    const { data: existingVenueRaw } = await (supabase.from("venues") as any)
      .select("id, name, vendor_id")
      .eq("google_place_id", place.place_id)
      .maybeSingle();
    const existingVenue = existingVenueRaw as { id: string; name: string; vendor_id: string | null } | null;

    if (existingVenue?.vendor_id) {
      setFieldErrors((prev) => ({
        ...prev,
        business_address: `${existingVenue.name} is already registered on Chillz by another vendor.`,
      }));
      setForm((prev) => ({ ...prev, selectedPlace: null, locationInput: "", business_address: "" }));
      return;
    }

    if (user?.id) {
      const { data: existingVendor } = await (supabase.from("vendors") as any)
        .select("id, business_name, kyc_status")
        .eq("google_place_id", place.place_id)
        .neq("user_id", user.id)
        .in("kyc_status", ["approved", "pending"])
        .maybeSingle();

      if (existingVendor) {
        setFieldErrors((prev) => ({
          ...prev,
          business_address: `This location is already associated with another vendor on Chillz.`,
        }));
        setForm((prev) => ({ ...prev, selectedPlace: null, locationInput: "", business_address: "" }));
      }
    }
  };

  const next = () => {
    setError("");
    setFieldErrors({});
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!form.vendor_type) { setError("Please select a vendor type"); return; }
      if (form.vendor_type === "venue" && !form.venue_category) {
        setError("Please select what best describes your venue");
        return;
      }
    }

    if (step === 1) {
      const nameErr = validateBusinessName(form.business_name);
      if (nameErr) errs.business_name = nameErr;
      if (!form.account_holder_name.trim() || form.account_holder_name.trim().length < 3)
        errs.account_holder_name = "Enter your full name exactly as it appears on your bank account";
      // Address only required for non-event-organizer types
      if (needsAddress && !form.selectedPlace)
        errs.business_address = "Please select your business address from Google suggestions";
      const cacErr = validateCAC(form.cac_number);
      if (cacErr) errs.cac_number = cacErr;
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errs.phone = phoneErr;
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setError("Please fix the errors above before continuing");
        return;
      }
    }

    if (step === 2) {
      const bvnErr = validateBVN(form.bvn_nin);
      if (bvnErr) errs.bvn_nin = bvnErr;
      if (form.id_images.length === 0) errs.id_images = "Please upload at least one government ID";
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setError("Please fix the errors above before continuing");
        return;
      }
    }

    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!user) { router.push("/login?redirect=/vendor/register"); return; }
    setLoading(true);
    setError("");
    try {
      const { data: existingRaw } = await (supabase.from("vendors") as any)
        .select("id, kyc_status")
        .eq("user_id", user.id)
        .maybeSingle();
      const existing = existingRaw as { id: string; kyc_status: string } | null;

      if (existing) {
        if (existing.kyc_status === "pending") throw new Error("You already have a pending application.");
        if (existing.kyc_status === "approved") throw new Error("You are already an approved vendor.");
      }

      // Only check Google place conflicts for non-organizer types
      if (!isEventOrganizer && form.selectedPlace?.place_id) {
        const { data: existingVenueRaw2 } = await (supabase.from("venues") as any)
          .select("id, name, vendor_id")
          .eq("google_place_id", form.selectedPlace.place_id)
          .maybeSingle();
        const existingVenue2 = existingVenueRaw2 as { id: string; name: string; vendor_id: string | null } | null;

        if (existingVenue2?.vendor_id) {
          throw new Error(`${existingVenue2.name} is already registered on Chillz by another vendor.`);
        }

        const { data: existingVendor } = await (supabase.from("vendors") as any)
          .select("id, business_name, kyc_status")
          .eq("google_place_id", form.selectedPlace.place_id)
          .neq("user_id", user.id)
          .in("kyc_status", ["approved", "pending"])
          .maybeSingle();

        if (existingVendor) {
          throw new Error(`This location is already associated with another vendor on Chillz.`);
        }
      }

      const { error: insertError } = await (supabase.from("vendors") as any).insert({
        user_id: user.id,
        business_name: form.business_name.trim(),
        account_holder_name: form.account_holder_name.trim(),
        vendor_type: form.vendor_type,
        venue_category: form.venue_category || null,
        kyc_status: "pending",
        address: form.selectedPlace?.formatted_address || form.business_address.trim() || null,
        google_place_id: form.selectedPlace?.place_id || null,
        lat: form.selectedPlace?.lat || null,
        lng: form.selectedPlace?.lng || null,
        cac_number: form.cac_number.trim() || null,
        bvn_nin: form.bvn_nin.trim(),
        id_images: form.id_images,
        payout_schedule: "daily",
        commission_rate: 0.05,
        is_active: false,
        // Event organizer extras stored in description/bio field
        ...(isEventOrganizer && {
          description: form.organizer_bio.trim() || null,
          instagram: form.organizer_instagram.trim() || null,
        }),
      });
      if (insertError) throw insertError;

      await (supabase.from("notifications") as any).insert({
        user_id: user.id,
        title: "Application submitted 🎉",
        body: `Your vendor application for ${form.business_name} has been submitted. We'll review and respond within 24 hours.`,
        type: "booking",
        is_read: false,
      });

      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: "100%",
    backgroundColor: hasError ? "#FEF2F2" : "#F7F5FA",
    border: `1.5px solid ${hasError ? "#FECACA" : "#E4DCF0"}`,
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0A0A0A",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  });

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
        <AlertTriangle size={11} /> {msg}
      </p>
    ) : null;

  const selectedVendorType = VENDOR_TYPES.find((v) => v.id === form.vendor_type);

  if (!user) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 24px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #EDE0F7, #F2EEF9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Building2 size={32} style={{ color: "#5B0EA6" }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0 }}>Sign in to apply</h2>
      <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>You need an account to register as a vendor on Chillz.</p>
      <button onClick={() => router.push("/login?redirect=/vendor/register")}
        style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Sign In
      </button>
    </div>
  );

  if (success) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 32px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{ width: 88, height: 88, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle size={44} style={{ color: "#00C853" }} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0A0A0A", margin: "0 0 10px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Application Submitted
        </h2>
        <p style={{ color: "#6B6B6B", fontSize: 14, margin: "0 0 6px", lineHeight: 1.6 }}>
          We received your application for <strong>{form.business_name}</strong>.
        </p>
        <p style={{ color: "#9E9E9E", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Our team will review your details and respond within 24 hours.
        </p>
      </motion.div>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={() => router.push("/home")}
        style={{ backgroundColor: "#5B0EA6", color: "#FFFFFF", border: "none", borderRadius: 16, padding: "13px 36px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Back to Home
      </motion.button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0", position: "sticky", top: 0, zIndex: 40 }}>
        <button onClick={() => step === 0 ? router.back() : setStep((s) => s - 1)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            Become a Vendor
          </h1>
          <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        {form.vendor_type && step > 0 && selectedVendorType && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: selectedVendorType.bg, borderRadius: 999, padding: "4px 10px" }}>
            <selectedVendorType.icon size={12} style={{ color: selectedVendorType.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: selectedVendorType.color }}>{selectedVendorType.label}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, backgroundColor: "#F2EEF9" }}>
        <motion.div
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg, #5B0EA6, #7B2FBE)", borderRadius: "0 999px 999px 0" }}
        />
      </div>

      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <AnimatePresence mode="wait">

          {/* ── Step 0: Vendor Type ── */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  What type of vendor are you?
                </h2>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>Choose the category that best describes your business.</p>
              </div>

              {VENDOR_TYPES.map(({ id, label, subtitle, icon: Icon, color, bg }) => (
                <button key={id}
                  onClick={() => setForm({ ...form, vendor_type: id, venue_category: id !== "venue" ? "" : form.venue_category })}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 18, border: "2px solid", borderColor: form.vendor_type === id ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.vendor_type === id ? "#F9F5FF" : "#FFFFFF", cursor: "pointer", textAlign: "left", boxShadow: form.vendor_type === id ? "0 4px 16px rgba(91,14,166,0.12)" : "0 1px 4px rgba(91,14,166,0.04)", transition: "all 0.2s ease" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: form.vendor_type === id ? bg : "#F2EEF9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={24} style={{ color: form.vendor_type === id ? color : "#9E9E9E" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 15, color: "#0A0A0A", margin: "0 0 3px" }}>{label}</p>
                    <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.4 }}>{subtitle}</p>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${form.vendor_type === id ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: form.vendor_type === id ? "#5B0EA6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {form.vendor_type === id && <CheckCircle size={14} style={{ color: "#FFFFFF" }} />}
                  </div>
                </button>
              ))}

              {/* Venue sub-category */}
              <AnimatePresence>
                {form.vendor_type === "venue" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "16px", border: "1.5px solid #EDE0F7" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        What best describes your venue?
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {VENUE_CATEGORIES.map(({ id, label, subtitle }) => (
                          <button key={id} onClick={() => setForm({ ...form, venue_category: id })}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1.5px solid", borderColor: form.venue_category === id ? "#5B0EA6" : "#E4DCF0", backgroundColor: form.venue_category === id ? "#F9F5FF" : "#F7F5FA", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px" }}>{label}</p>
                              <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{subtitle}</p>
                            </div>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${form.venue_category === id ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: form.venue_category === id ? "#5B0EA6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {form.venue_category === id && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#FFFFFF" }} />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Event organizer info panel */}
              <AnimatePresence>
                {form.vendor_type === "event_organizer" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                    <div style={{ backgroundColor: "#FFF3E0", borderRadius: 16, padding: "14px", border: "1.5px solid #FDE68A" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#E07B00", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        How it works
                      </p>
                      {[
                        "Create events and tag any venue on CHILLZ",
                        "Set ticket prices and capacities per event",
                        "Sell tickets directly via the CHILLZ wallet",
                        "Earnings paid out after each event minus 5% fee",
                      ].map((text, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#E07B00" }}>{i + 1}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>{text}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Info size={15} style={{ color: "#9E9E9E", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                  All applications are reviewed by the Chillz team within 24 hours. You'll be notified once approved.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Business Info ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ marginBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {isEventOrganizer ? "Organizer Details" : "Business Details"}
                </h2>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>
                  {isEventOrganizer
                    ? "Tell us about yourself as an event organizer."
                    : "Tell us about your business. All fields are verified."}
                </p>
              </div>

              {/* Business / organizer name */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
                  {isEventOrganizer ? "ORGANIZER / BRAND NAME" : "BUSINESS NAME"}
                </p>
                <input type="text"
                  placeholder={
                    isEventOrganizer ? "e.g. Detty December Events" :
                    form.vendor_type === "hotel" ? "e.g. Grand Palace Hotel" :
                    form.vendor_type === "car_rental" ? "e.g. Lagos Luxury Rides" :
                    form.vendor_type === "apartment" ? "e.g. Victoria Island Shortlets" :
                    form.venue_category === "restaurant" ? "e.g. Mama Put Fine Dining" :
                    form.venue_category === "club" ? "e.g. Club Onyx Lagos" :
                    "e.g. The Garden Lounge"
                  }
                  value={form.business_name}
                  onChange={(e) => setField("business_name", e.target.value)}
                  style={inputStyle(!!fieldErrors.business_name)} />
                <FieldError msg={fieldErrors.business_name} />
              </div>

              {/* Full name */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>FULL NAME (AS ON BANK ACCOUNT)</p>
                <input type="text" placeholder="e.g. INNOCENT CHIJINDU AMAECHI"
                  value={form.account_holder_name}
                  onChange={(e) => setField("account_holder_name", e.target.value.toUpperCase())}
                  style={inputStyle(!!fieldErrors.account_holder_name)} />
                <FieldError msg={fieldErrors.account_holder_name} />
                <div style={{ marginTop: 8, backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px" }}>
                  <p style={{ fontSize: 11, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                    ⚠️ Enter your name <strong>exactly</strong> as it appears on your bank account.
                  </p>
                </div>
              </div>

              {/* Address — only for non-organizer types */}
              {needsAddress && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: 0 }}>
                      {form.vendor_type === "hotel" ? "HOTEL ADDRESS" :
                       form.vendor_type === "car_rental" ? "BASE / OFFICE ADDRESS" :
                       "BUSINESS ADDRESS"}
                    </p>
                    <button onClick={handleUseMyLocation} disabled={locating}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: locating ? "not-allowed" : "pointer", color: locating ? "#9E9E9E" : "#5B0EA6", fontSize: 11, fontWeight: 700, padding: 0 }}>
                      {locating
                        ? <><div style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid rgba(91,14,166,0.3)", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />Locating...</>
                        : <><Navigation size={11} />Use my location</>}
                    </button>
                  </div>

                  <PlacesInput
                    value={form.locationInput}
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, locationInput: v, selectedPlace: null, business_address: "" }));
                      if (fieldErrors.business_address) setFieldErrors((prev) => { const n = { ...prev }; delete n.business_address; return n; });
                    }}
                    onSelect={handlePlaceSelect}
                    placeholder="Search on Google Maps..."
                    hasError={!!fieldErrors.business_address}
                  />
                  <FieldError msg={fieldErrors.business_address} />

                  <AnimatePresence>
                    {form.selectedPlace && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ marginTop: 8, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <CheckCircle size={15} style={{ color: "#00C853", flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "#059669", margin: "0 0 2px", fontWeight: 700 }}>Location confirmed</p>
                          <p style={{ fontSize: 12, color: "#0A0A0A", margin: "0 0 2px", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {form.selectedPlace.name !== "Current Location" ? form.selectedPlace.name : form.selectedPlace.formatted_address}
                          </p>
                          <p style={{ fontSize: 11, color: "#6B6B6B", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {form.selectedPlace.formatted_address}
                          </p>
                        </div>
                        <button onClick={() => setForm((prev) => ({ ...prev, selectedPlace: null, locationInput: "", business_address: "" }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#9E9E9E", fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {form.vendor_type === "apartment" && (
                    <div style={{ marginTop: 8, backgroundColor: "#EDE0F7", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 11, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                        📍 This is your main business address. Each apartment listing will require its own location after approval.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Event organizer: bio + instagram */}
              {isEventOrganizer && (
                <>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
                      BIO <span style={{ fontWeight: 400, color: "#C4BAD8" }}>(optional)</span>
                    </p>
                    <textarea
                      placeholder="Tell us about your events, past shows, what kind of experiences you create..."
                      value={form.organizer_bio}
                      onChange={(e) => setField("organizer_bio", e.target.value)}
                      rows={3}
                      style={{ ...inputStyle(), resize: "none", lineHeight: 1.6 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
                      INSTAGRAM <span style={{ fontWeight: 400, color: "#C4BAD8" }}>(optional)</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 14px" }}>
                      <span style={{ fontSize: 14, color: "#9E9E9E" }}>@</span>
                      <input type="text" placeholder="yourbrandname"
                        value={form.organizer_instagram}
                        onChange={(e) => setField("organizer_instagram", e.target.value.replace(/^@/, ""))}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#0A0A0A", fontFamily: "inherit" }} />
                    </div>
                  </div>
                </>
              )}

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>
                  CAC NUMBER <span style={{ color: "#9E9E9E", fontWeight: 400 }}>(optional for organizers)</span>
                </p>
                <input type="text" placeholder="RC123456" value={form.cac_number}
                  onChange={(e) => setField("cac_number", e.target.value.toUpperCase())}
                  style={inputStyle(!!fieldErrors.cac_number)} maxLength={10} />
                <FieldError msg={fieldErrors.cac_number} />
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0" }}>Format: RC followed by 5–8 digits</p>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>PHONE NUMBER</p>
                <input type="tel" placeholder="08012345678" value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  style={inputStyle(!!fieldErrors.phone)} maxLength={14} />
                <FieldError msg={fieldErrors.phone} />
              </div>
            </motion.div>
          )}

          {/* ── Step 2: KYC ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ marginBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  Identity Verification
                </h2>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.5 }}>
                  Required to protect users and maintain trust on the platform.
                </p>
              </div>

              <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Info size={15} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                  Your BVN/NIN is validated against NIBSS records. Providing someone else's details is a criminal offence.
                </p>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>BVN OR NIN</p>
                <input type="text" placeholder="11-digit number" value={form.bvn_nin}
                  onChange={(e) => { const val = e.target.value.replace(/\D/g, ""); setField("bvn_nin", val); }}
                  maxLength={11} style={inputStyle(!!fieldErrors.bvn_nin)} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <FieldError msg={fieldErrors.bvn_nin} />
                  <span style={{ fontSize: 11, color: form.bvn_nin.length === 11 ? "#00C853" : "#9E9E9E", marginLeft: "auto" }}>
                    {form.bvn_nin.length}/11
                  </span>
                </div>
                <AnimatePresence>
                  {form.bvn_nin.length === 11 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ marginTop: 6, backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 10, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle size={13} style={{ color: "#00C853" }} />
                      <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Valid length</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>GOVERNMENT ID</p>
                <ImageUpload
                  images={form.id_images}
                  onChange={(imgs) => {
                    setForm((prev) => ({ ...prev, id_images: imgs }));
                    if (fieldErrors.id_images) setFieldErrors((prev) => { const n = { ...prev }; delete n.id_images; return n; });
                  }}
                  maxImages={2}
                  folder="kyc"
                />
                <FieldError msg={fieldErrors.id_images} />
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "4px 0 0" }}>
                  Upload front and back of your NIN slip, voter's card, or driver's license.
                </p>
              </div>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CheckCircle size={15} style={{ color: "#5B0EA6", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#3D0066", margin: 0, lineHeight: 1.5 }}>
                  Documents are stored securely and only reviewed by the Chillz team.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ marginBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  Review & Submit
                </h2>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>Confirm your details before submitting.</p>
              </div>

              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 16px rgba(91,14,166,0.08)" }}>
                <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "18px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selectedVendorType && <selectedVendorType.icon size={24} style={{ color: "#FFFFFF" }} />}
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      {selectedVendorType?.label}
                      {form.venue_category ? ` · ${VENUE_CATEGORIES.find((c) => c.id === form.venue_category)?.label}` : ""}
                    </p>
                    <p style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                      {form.business_name}
                    </p>
                  </div>
                </div>

                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Type", value: selectedVendorType?.label || "" },
                    form.venue_category ? { label: "Venue Category", value: VENUE_CATEGORIES.find((c) => c.id === form.venue_category)?.label || "" } : null,
                    { label: "Account Name", value: form.account_holder_name },
                    !isEventOrganizer && form.selectedPlace ? { label: "Address", value: form.selectedPlace.formatted_address } : null,
                    isEventOrganizer && form.organizer_instagram ? { label: "Instagram", value: `@${form.organizer_instagram}` } : null,
                    { label: "Phone", value: form.phone },
                    { label: "Email", value: form.email },
                    form.cac_number ? { label: "CAC Number", value: form.cac_number } : null,
                    { label: "BVN/NIN", value: `••••••••${form.bvn_nin.slice(-3)}` },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingBottom: 8, borderBottom: "1px solid #F7F5FA" }}>
                      <span style={{ fontSize: 12, color: "#9E9E9E", flexShrink: 0 }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", textAlign: "right", flex: 1 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #F2EEF9", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>ID Documents</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: form.id_images.length > 0 ? "#00C853" : "#F59E0B", backgroundColor: form.id_images.length > 0 ? "#E0F7EA" : "#FEF3C7", padding: "3px 8px", borderRadius: 999 }}>
                    {form.id_images.length > 0 ? `${form.id_images.length} uploaded` : "Not uploaded"}
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 16, padding: "14px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  What happens next
                </p>
                {[
                  { s: "1", text: "Admin reviews your application within 24 hours" },
                  { s: "2", text: "You get notified once approved" },
                  {
                    s: "3",
                    text: isEventOrganizer
                      ? "Start creating events and tagging CHILLZ venues immediately"
                      : form.vendor_type === "hotel" ? "Add your rooms and set pricing from your dashboard"
                      : form.vendor_type === "apartment" ? "Add each apartment unit with its Google Maps location"
                      : form.vendor_type === "car_rental" ? "Add your vehicles and availability from your dashboard"
                      : "Admin will link your venue — then manage it from your dashboard",
                  },
                ].map(({ s, text }) => (
                  <div key={s} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#5B0EA6" }}>{s}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.5, paddingTop: 2 }}>{text}</p>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
                  By submitting you confirm all information is accurate. False information results in immediate rejection and a permanent ban.
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0 }} />
              <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={step < STEPS.length - 1 ? next : handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: loading ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)" }}>
          {loading
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Submitting...</>
            : step < STEPS.length - 1 ? "Continue" : "Submit Application"}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}