"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Lock, Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase sets the session from the URL hash after the callback redirect
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        // Listen for the session to be established from the URL hash
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") setSessionReady(true);
        });
        return () => listener.subscription.unsubscribe();
      }
    });
  }, []);

  const handleReset = async () => {
    setError("");
    if (!form.password) { setError("Please enter a new password"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (e: any) {
      setError(e.message || "Could not update password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "13px 14px",
  };
  const inputStyle: React.CSSProperties = {
    flex: 1, background: "transparent", border: "none", outline: "none",
    fontSize: 14, color: "#0A0A0A", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>

      <div style={{ background: "linear-gradient(160deg, #3D0066 0%, #5B0EA6 55%, #7B2FBE 100%)", padding: "56px 24px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.25), transparent 70%)" }} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ width: 64, height: 64, borderRadius: 18, overflow: "hidden", marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
          <Image src="/chillz-icon.png" alt="Chillz" width={64} height={64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ color: "#FFFFFF", fontSize: 30, fontWeight: 900, margin: "0 0 6px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          CHILLZ
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0 }}>
          Set a new password
        </motion.p>
      </div>

      <div style={{ flex: 1, padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        <AnimatePresence mode="wait">

          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 20, textAlign: "center" }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={36} style={{ color: "#00C853" }} />
              </motion.div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Password Updated!</h2>
                <p style={{ fontSize: 14, color: "#6B6B6B", margin: 0, lineHeight: 1.6 }}>
                  Your password has been changed. Redirecting you to sign in...
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>New Password</h2>
                <p style={{ fontSize: 13, color: "#9E9E9E", margin: 0 }}>Choose a strong password for your account</p>
              </div>

              {!sessionReady && (
                <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: "#D97706", fontSize: 13, margin: 0 }}>Verifying your reset link...</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={fieldStyle}>
                  <Lock size={17} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <input type={showPassword ? "text" : "password"} placeholder="New password (min 8 characters)" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    style={inputStyle} />
                  <button onClick={() => setShowPassword(!showPassword)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                    {showPassword ? <EyeOff size={16} style={{ color: "#9E9E9E" }} /> : <Eye size={16} style={{ color: "#9E9E9E" }} />}
                  </button>
                </div>

                <div style={fieldStyle}>
                  <Lock size={17} style={{ color: "#9E9E9E", flexShrink: 0 }} />
                  <input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    style={inputStyle} />
                  <button onClick={() => setShowConfirm(!showConfirm)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                    {showConfirm ? <EyeOff size={16} style={{ color: "#9E9E9E" }} /> : <Eye size={16} style={{ color: "#9E9E9E" }} />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {form.password.length > 0 && (
                <div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map((level) => {
                      const strength = form.password.length >= 12 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4
                        : form.password.length >= 10 ? 3
                        : form.password.length >= 8 ? 2 : 1;
                      return (
                        <div key={level} style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: level <= strength ? (strength >= 3 ? "#00C853" : strength === 2 ? "#F59E0B" : "#EF4444") : "#E4DCF0", transition: "background-color 0.2s" }} />
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                    {form.password.length < 8 ? "Too short" : form.password.length < 10 ? "Weak — add numbers or uppercase" : form.password.length >= 12 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? "Strong password" : "Good"}
                  </p>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleReset} disabled={loading || !sessionReady}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: loading || !sessionReady ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading || !sessionReady ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                {loading ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Updating...</> : <>Update Password <ArrowRight size={17} /></>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}