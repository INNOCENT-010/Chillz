/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowLeft, User, Building2, CheckCircle } from "lucide-react";
import Link from "next/link";

const VENDOR_TYPES = [
  { value: "restaurant",  label: "Restaurant",   emoji: "🍽️" },
  { value: "bar-lounge",  label: "Bar & Lounge", emoji: "🍷" },
  { value: "club",        label: "Club",          emoji: "🎵" },
  { value: "hotel",       label: "Hotel",         emoji: "🏨" },
  { value: "car_rental",  label: "Car Rental",    emoji: "🚗" },
  { value: "apartment",   label: "Apartment",     emoji: "🏠" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"user" | "vendor" | null>(null);
  const [step, setStep] = useState<"type" | "user_form" | "vendor_details" | "vendor_venue" | "vendor_account">("type");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState(false);

  // User form
  const [userForm, setUserForm] = useState({ full_name: "", email: "", password: "" });

  // Vendor form
  const [vendorForm, setVendorForm] = useState({
    business_name: "",
    vendor_type: "",
    phone: "",
    email: "",
    password: "",
  });

  // Venue search (Google Places)
  const [venueSearch, setVenueSearch] = useState("");
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  // ── User registration ─────────────────────────────────────────────────
  const handleUserRegister = async () => {
    setError("");
    if (!policyAccepted) { setPolicyError(true); return; }
    if (!userForm.full_name.trim()) { setError("Enter your full name"); return; }
    if (!userForm.email.trim()) { setError("Enter your email"); return; }
    if (userForm.password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: userForm.email.trim(),
        password: userForm.password,
        options: {
          data: { full_name: userForm.full_name.trim(), account_type: "user" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;
      if (accountType === "vendor") {
        router.push("/register/confirm-email?next=/vendor/register");
      } else {
        router.push("/register/confirm-email");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Venue search ──────────────────────────────────────────────────────
  const searchVenues = async (query: string) => {
    if (query.length < 3) { setVenueResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(query)}&type=establishment`);
      const data = await res.json();
      setVenueResults(data.results || []);
    } catch {
      setVenueResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Vendor registration ───────────────────────────────────────────────
  const handleVendorRegister = async () => {
    setError("");
    if (!policyAccepted) { setPolicyError(true); return; }
    if (!selectedVenue) { setError("Please select your venue"); return; }
    if (!vendorForm.business_name.trim()) { setError("Enter your business name"); return; }
    if (!vendorForm.vendor_type) { setError("Select your business type"); return; }
    if (!vendorForm.email.trim()) { setError("Enter your email"); return; }
    if (vendorForm.password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: vendorForm.business_name.trim(),
          vendor_type: vendorForm.vendor_type,
          phone: vendorForm.phone.trim(),
          email: vendorForm.email.trim(),
          password: vendorForm.password,
          venue: selectedVenue,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Registration failed");

      // Sign in immediately after registration
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: vendorForm.email.trim(),
        password: vendorForm.password,
      });
      if (signInError) throw signInError;

      router.push("/vendor");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "52px 24px 24px", background: "linear-gradient(135deg, #3D0066, #5B0EA6)" }}>
        {step !== "type" && (
          <button
            onClick={() => {
              setError("");
              if (step === "user_form") { setStep("type"); setAccountType(null); }
              else if (step === "vendor_details") { setStep("type"); setAccountType(null); }
              else if (step === "vendor_venue") setStep("vendor_details");
              else if (step === "vendor_account") setStep("vendor_venue");
            }}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
            <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
            <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
          </button>
        )}
        <h1 style={{ color: "#FFFFFF", fontSize: 26, fontWeight: 900, margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          {step === "type" ? "Create account" :
           step === "user_form" ? "Your details" :
           step === "vendor_details" ? "Business info" :
           step === "vendor_venue" ? "Find your venue" :
           "Account setup"}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0 }}>
          {step === "type" ? "Join Chillz as a user or a vendor" :
           step === "user_form" ? "Create your Chillz account" :
           step === "vendor_details" ? "Tell us about your business" :
           step === "vendor_venue" ? "Search and confirm your location on Google" :
           "Almost there — set your login details"}
        </p>

        {/* Step dots for vendor */}
        {accountType === "vendor" && step !== "type" && (
          <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
            {["vendor_details", "vendor_venue", "vendor_account"].map((s, i) => (
              <div key={s} style={{ height: 4, flex: 1, borderRadius: 999, backgroundColor: ["vendor_details", "vendor_venue", "vendor_account"].indexOf(step) >= i ? "#FFFFFF" : "rgba(255,255,255,0.25)" }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "24px 24px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
        <AnimatePresence mode="wait">

          {/* ── STEP: TYPE SELECTION ── */}
          {step === "type" && (
            <motion.div key="type" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <button
                onClick={() => { setAccountType("user"); setStep("user_form"); }}
                style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: "20px", border: "2px solid #E4DCF0", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={24} style={{ color: "#5B0EA6" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>I'm a User</p>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0, lineHeight: 1.4 }}>Discover venues, book spots, attend events</p>
                </div>
                <ArrowLeft size={18} style={{ color: "#C4BAD8", transform: "rotate(180deg)", flexShrink: 0 }} />
              </button>

              <button
                onClick={() => { setAccountType("vendor"); setStep("user_form"); }}
                style={{ width: "100%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: "20px", border: "2px solid #E4DCF0", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={24} style={{ color: "#00C853" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 16, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>I'm a Vendor</p>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0, lineHeight: 1.4 }}>List your venue, manage bookings, earn</p>
                </div>
                <ArrowLeft size={18} style={{ color: "#C4BAD8", transform: "rotate(180deg)", flexShrink: 0 }} />
              </button>

              <p style={{ textAlign: "center", fontSize: 13, color: "#9E9E9E", margin: "8px 0 0" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── STEP: USER FORM ── */}
          {step === "user_form" && (
            <motion.div key="user_form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Name</p>
                <input type="text" placeholder="Your full name" value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  style={inputStyle} />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</p>
                <input type="email" placeholder="you@email.com" value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  style={inputStyle} />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</p>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    style={{ ...inputStyle, paddingRight: 48 }} />
                  <button onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    {showPassword ? <EyeOff size={18} style={{ color: "#9E9E9E" }} /> : <Eye size={18} style={{ color: "#9E9E9E" }} />}
                  </button>
                </div>
              </div>

              {/* Policy agreement */}
              <button
                onClick={() => { setPolicyAccepted(!policyAccepted); setPolicyError(false); }}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${policyError ? "#EF4444" : policyAccepted ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: policyAccepted ? "#5B0EA6" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                  {policyAccepted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
                  I have read and agree to the Chillz{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Privacy Policy</a>.
                  By creating an account I consent to the use of cookies and data processing as described therein.
                </p>
              </button>

              {policyError && (
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0, fontWeight: 600 }}>
                  Please accept the terms to continue
                </p>
              )}

              {error && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}

              <button onClick={handleUserRegister} disabled={loading}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: loading ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(91,14,166,0.3)", marginTop: 4 }}>
                {loading
                  ? <><div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Creating account...</>
                  : "Create Account"}
              </button>

              <p style={{ textAlign: "center", fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </motion.div>
          )}

          {/* ── STEP: VENDOR DETAILS ── */}
          {step === "vendor_details" && (
            <motion.div key="vendor_details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Business Name</p>
                <input type="text" placeholder="e.g. Quilox Club, The Place Restaurant" value={vendorForm.business_name}
                  onChange={(e) => setVendorForm({ ...vendorForm, business_name: e.target.value })}
                  style={inputStyle} />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Business Type</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {VENDOR_TYPES.map(({ value, label, emoji }) => (
                    <button key={value} onClick={() => setVendorForm({ ...vendorForm, vendor_type: value })}
                      style={{ padding: "12px", borderRadius: 14, border: "2px solid", borderColor: vendorForm.vendor_type === value ? "#5B0EA6" : "#E4DCF0", backgroundColor: vendorForm.vendor_type === value ? "#EDE0F7" : "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: vendorForm.vendor_type === value ? 700 : 500, color: vendorForm.vendor_type === value ? "#5B0EA6" : "#0A0A0A" }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone Number</p>
                <input type="tel" placeholder="+234 800 000 0000" value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  style={inputStyle} />
              </div>

              {error && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setError("");
                  if (!vendorForm.business_name.trim()) { setError("Enter your business name"); return; }
                  if (!vendorForm.vendor_type) { setError("Select your business type"); return; }
                  setStep("vendor_venue");
                }}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(91,14,166,0.3)", marginTop: 4 }}>
                Continue
              </button>
            </motion.div>
          )}

          {/* ── STEP: VENDOR VENUE ── */}
          {step === "vendor_venue" && (
            <motion.div key="vendor_venue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, color: "#5B0EA6", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                  Search for your business on Google. The address you confirm here becomes your official venue on Chillz.
                </p>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Search Your Venue</p>
                <input
                  type="text"
                  placeholder="e.g. Quilox Club Lagos"
                  value={venueSearch}
                  onChange={(e) => {
                    setVenueSearch(e.target.value);
                    setSelectedVenue(null);
                    searchVenues(e.target.value);
                  }}
                  style={inputStyle}
                />
              </div>

              {/* Search results */}
              {searching && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #EDE0F7", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: 13, color: "#9E9E9E" }}>Searching...</span>
                </div>
              )}

              {venueResults.length > 0 && !selectedVenue && (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(91,14,166,0.1)", border: "1px solid #F2EEF9" }}>
                  {venueResults.map((result: any, i: number) => (
                    <button
                      key={result.place_id}
                      onClick={() => {
                        setSelectedVenue(result);
                        setVenueSearch(result.name);
                        setVenueResults([]);
                      }}
                      style={{ width: "100%", padding: "14px 16px", border: "none", borderBottom: i < venueResults.length - 1 ? "1px solid #F7F5FA" : "none", backgroundColor: "#FFFFFF", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A" }}>{result.name}</span>
                      <span style={{ fontSize: 12, color: "#9E9E9E" }}>{result.formatted_address || result.vicinity}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected venue confirmation */}
              <AnimatePresence>
                {selectedVenue && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <CheckCircle size={20} style={{ color: "#00C853", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: "#059669", margin: "0 0 3px" }}>Venue confirmed</p>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>{selectedVenue.name}</p>
                      <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0 }}>{selectedVenue.formatted_address || selectedVenue.vicinity}</p>
                    </div>
                    <button onClick={() => { setSelectedVenue(null); setVenueSearch(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9E9E9E", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setError("");
                  if (!selectedVenue) { setError("Please search and select your venue"); return; }
                  setStep("vendor_account");
                }}
                disabled={!selectedVenue}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: !selectedVenue ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: !selectedVenue ? "not-allowed" : "pointer", boxShadow: !selectedVenue ? "none" : "0 4px 20px rgba(91,14,166,0.3)", marginTop: 4 }}>
                Confirm Venue
              </button>
            </motion.div>
          )}

          {/* ── STEP: VENDOR ACCOUNT ── */}
          {step === "vendor_account" && (
            <motion.div key="vendor_account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Venue summary */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px 16px", border: "1px solid #F2EEF9", display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircle size={18} style={{ color: "#00C853", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 1px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{selectedVenue?.name}</p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{selectedVenue?.formatted_address || selectedVenue?.vicinity}</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</p>
                <input type="email" placeholder="you@business.com" value={vendorForm.email}
                  onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                  style={inputStyle} />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</p>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={vendorForm.password}
                    onChange={(e) => setVendorForm({ ...vendorForm, password: e.target.value })}
                    style={{ ...inputStyle, paddingRight: 48 }} />
                  <button onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    {showPassword ? <EyeOff size={18} style={{ color: "#9E9E9E" }} /> : <Eye size={18} style={{ color: "#9E9E9E" }} />}
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                  Your venue will be reviewed by the Chillz team. Once approved it goes live immediately for users to discover.
                </p>
              </div>

              {/* Policy agreement */}
              <button
                onClick={() => { setPolicyAccepted(!policyAccepted); setPolicyError(false); }}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${policyError ? "#EF4444" : policyAccepted ? "#5B0EA6" : "#E4DCF0"}`, backgroundColor: policyAccepted ? "#5B0EA6" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                  {policyAccepted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
                  I have read and agree to the Chillz{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Privacy Policy</a>.
                  By registering as a vendor I consent to data processing and platform terms.
                </p>
              </button>

              {policyError && (
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0, fontWeight: 600 }}>
                  Please accept the terms to continue
                </p>
              )}

              {error && (
                <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}

              <button onClick={handleVendorRegister} disabled={loading}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: loading ? "#9E9E9E" : "linear-gradient(135deg, #00C853, #059669)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,200,83,0.3)", marginTop: 4 }}>
                {loading
                  ? <><div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Registering...</>
                  : <><Building2 size={18} />Register as Vendor</>}
              </button>

              <p style={{ textAlign: "center", fontSize: 13, color: "#9E9E9E", margin: 0 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}