"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowRight, Eye, EyeOff, Lock, X, Building2, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "chillz_past_emails";

type View = "login" | "forgot" | "forgot_sent";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [pastEmails, setPastEmails] = useState<string[]>([]);
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [resetError, setResetError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("confirmed") === "true") setConfirmed(true);
  }, [searchParams]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPastEmails(JSON.parse(stored));
    } catch {}
  }, []);

  const savePastEmail = (email: string) => {
    try {
      const existing: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const updated = [email, ...existing.filter((e) => e !== email)].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPastEmails(updated);
    } catch {}
  };

  const filteredSuggestions = pastEmails.filter((e) =>
    e.toLowerCase().includes(form.email.toLowerCase())
  );

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSignIn = async () => {
    setError("");
    if (!form.email.trim()) { setError("Please enter your email"); return; }
    if (!form.password) { setError("Please enter your password"); return; }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("Sign in failed. Try again.");
      savePastEmail(form.email.trim());
      await new Promise((r) => setTimeout(r, 400));
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirect");
      if (redirectTo) { window.location.replace(redirectTo); return; }
      const isAdmin =
        data.user.user_metadata?.role === "admin" ||
        data.user.email?.endsWith("@chillz.admin");
      if (isAdmin) { window.location.replace("/admin"); return; }
      const accountType = data.user.user_metadata?.account_type;
      if (accountType === "vendor") { window.location.replace("/vendor"); return; }
      try {
        const { data: vendorRecord } = await supabase
          .from("vendors").select("id").eq("user_id", data.user.id).maybeSingle();
        if (vendorRecord) { window.location.replace("/vendor"); return; }
      } catch {}
      window.location.replace("/home");
    } catch (e: any) {
      setError(e.message || "Sign in failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetError("");
    if (!resetEmail.trim()) { setResetError("Please enter your email address"); return; }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setView("forgot_sent");
    } catch (e: any) {
      setResetError(e.message || "Could not send reset email. Try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, background: "transparent", border: "none", outline: "none",
    fontSize: 14, color: "#0A0A0A", fontFamily: "inherit",
  };
  const fieldStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "13px 14px",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>

      {/* Purple hero */}
      <div style={{ background: "linear-gradient(160deg, #3D0066 0%, #5B0EA6 55%, #7B2FBE 100%)", padding: "56px 24px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.25), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(123,47,190,0.4), transparent 70%)" }} />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 64, height: 64, borderRadius: 18, overflow: "hidden", marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
          <Image src="/chillz-icon.png" alt="Chillz" width={64} height={64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ color: "#FFFFFF", fontSize: 30, fontWeight: 900, margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          CHILLZ
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0 }}>
          Your city. Your vibe.
        </motion.p>
      </div>

      {/* Form area */}
      <div style={{ flex: 1, padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        <AnimatePresence mode="wait">

          {/* ── LOGIN VIEW ── */}
          {view === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {confirmed && (
                <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                  style={{ backgroundColor:"#E0F7EA", border:"1px solid #A7F3D0", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:10 }}>
                  <CheckCircle size={18} style={{ color:"#00C853", flexShrink:0, marginTop:1 }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:"#059669", margin:"0 0 2px" }}>Email confirmed!</p>
                    <p style={{ fontSize:12, color:"#065F46", margin:0, lineHeight:1.5 }}>Your account is verified. Sign in below to get started.</p>
                  </div>
                </motion.div>
              )}

              <div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Welcome back</h2>
                <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Sign in to your Chillz account</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Email */}
                <div style={{ position: "relative" }}>
                  <div style={fieldStyle}>
                    <Mail size={17} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                    <input type="email" placeholder="Email address" value={form.email} autoComplete="email"
                      onChange={(e) => { setForm({ ...form, email: e.target.value }); setShowEmailSuggestions(true); }}
                      onFocus={() => setShowEmailSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
                      onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                      style={inputStyle} />
                    {form.email && (
                      <button onClick={() => setForm({ ...form, email: "" })} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                        <X size={15} style={{ color: "#9E9E9E" }} />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
                    {showEmailSuggestions && filteredSuggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                        style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, backgroundColor: "#FFFFFF", border: "1.5px solid #E4DCF0", borderRadius: 14, overflow: "hidden", zIndex: 50, boxShadow: "0 8px 24px rgba(91,14,166,0.12)" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px", margin: 0 }}>Recent</p>
                        {filteredSuggestions.map((email, i) => (
                          <button key={email} onMouseDown={() => { setForm({ ...form, email }); setShowEmailSuggestions(false); }}
                            style={{ width: "100%", padding: "10px 14px", border: "none", backgroundColor: "transparent", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderTop: i === 0 ? "none" : "1px solid #F2EEF9", textAlign: "left" }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Mail size={13} style={{ color: "#5B0EA6" }} />
                            </div>
                            <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 500, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{email}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password */}
                <div style={fieldStyle}>
                  <Lock size={17} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <input type={showPassword ? "text" : "password"} placeholder="Your password" value={form.password} autoComplete="current-password"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                    style={inputStyle} />
                  <button onClick={() => setShowPassword(!showPassword)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                    {showPassword ? <EyeOff size={16} style={{ color: "#9E9E9E" }} /> : <Eye size={16} style={{ color: "#9E9E9E" }} />}
                  </button>
                </div>

                {/* Forgot password link */}
                <button onClick={() => { setView("forgot"); setResetEmail(form.email); setResetError(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#5B0EA6" }}>
                  Forgot password?
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleSignIn} disabled={loading}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: loading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(91,14,166,0.3)", transition: "background-color 0.2s" }}>
                {loading ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Signing in...</> : <>Sign In <ArrowRight size={17} /></>}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "#E4DCF0" }} />
                <span style={{ color: "#9E9E9E", fontSize: 12 }}>or</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "#E4DCF0" }} />
              </div>

              <button onClick={handleGoogleSignIn} disabled={googleLoading}
                style={{ width: "100%", padding: "13px 0", borderRadius: 16, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#0A0A0A", fontSize: 14, fontWeight: 600, cursor: googleLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {googleLoading
                  ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #E4DCF0", borderTopColor: "#5B0EA6", animation: "spin 0.8s linear infinite" }} />
                  : <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>}
                Continue with Google
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <p style={{ textAlign: "center", fontSize: 14, color: "#6B6B6B", margin: 0 }}>
                  Don't have an account?{" "}
                  <Link href="/register" style={{ color: "#5B0EA6", fontWeight: 700, textDecoration: "none" }}>Create one</Link>
                </p>
                <Link href="/register?type=vendor" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "12px 16px" }}>
                    <Building2 size={16} style={{ color: "#00C853" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#6B6B6B" }}>Register as a Vendor</span>
                    <ArrowRight size={14} style={{ color: "#9E9E9E" }} />
                  </div>
                </Link>
              </div>

              <p style={{ textAlign: "center", color: "#9E9E9E", fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                By continuing you agree to our Terms of Service and Privacy Policy
              </p>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {view === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => { setView("login"); setResetError(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
                  <ArrowLeft size={20} style={{ color: "#0A0A0A" }} />
                </button>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Reset Password</h2>
                  <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>We'll send a recovery link to your email</p>
                </div>
              </div>

              <div style={fieldStyle}>
                <Mail size={17} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                <input type="email" placeholder="Your email address" value={resetEmail} autoComplete="email"
                  onChange={(e) => setResetEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                  style={inputStyle} />
              </div>

              <AnimatePresence>
                {resetError && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{resetError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleForgotPassword} disabled={resetLoading}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: resetLoading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: resetLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {resetLoading ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Sending...</> : <>Send Recovery Link <ArrowRight size={17} /></>}
              </button>
            </motion.div>
          )}

          {/* ── EMAIL SENT CONFIRMATION ── */}
          {view === "forgot_sent" && (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 20, textAlign: "center" }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={36} style={{ color: "#00C853" }} />
              </motion.div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Check your inbox</h2>
                <p style={{ fontSize: 14, color: "#6B6B6B", margin: "0 0 4px", lineHeight: 1.6 }}>
                  We sent a recovery link to
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6", margin: 0 }}>{resetEmail}</p>
              </div>
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px 16px", width: "100%", textAlign: "left" }}>
                <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
                  Click the link in the email to set a new password. The link expires in 1 hour. Check your spam folder if you don't see it.
                </p>
              </div>
              <button onClick={() => { setView("login"); setResetEmail(""); }}
                style={{ width: "100%", padding: "13px 0", borderRadius: 16, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#5B0EA6", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Back to Sign In
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}