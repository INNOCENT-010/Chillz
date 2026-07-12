/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Wallet, CheckCircle, AlertTriangle,
  Building2, ChevronRight, Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "First Bank", code: "011" },
  { name: "Zenith Bank", code: "057" },
  { name: "UBA", code: "033" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "Polaris Bank", code: "076" },
  { name: "Kuda Bank", code: "090267" },
  { name: "Opay", code: "100004" },
  { name: "PalmPay", code: "999991" },
  { name: "Moniepoint", code: "50515" },
  { name: "Stanbic IBTC", code: "221" },
  { name: "FCMB", code: "214" },
  { name: "Ecobank", code: "050" },
];

export default function UserWithdrawPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [step, setStep] = useState<"main" | "link" | "link_otp" | "otp" | "confirm" | "done">("main");
  const [amount, setAmount] = useState("");

  // Link bank state
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  // OTP state (withdrawal)
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  // OTP state (bank link)
  const [linkOtpValue, setLinkOtpValue] = useState("");
  const [linkOtpLoading, setLinkOtpLoading] = useState(false);
  const [linkOtpError, setLinkOtpError] = useState("");

  // Withdraw state
  const [withdrawError, setWithdrawError] = useState("");
  const [coolingPeriod, setCoolingPeriod] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<"success" | "pending" | null>(null);

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile-bank", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("users")
        .select("bank_name, bank_account_number, bank_account_name, paystack_recipient_code, bank_linked_at")
        .eq("id", user.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: balance } = useQuery({
    queryKey: ["user-wallet-balance", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount")
        .eq("account_id", user.id)
        .eq("account_type", "USER_WALLET");
      return ((data || []) as any[]).reduce((acc: number, row: any) =>
        row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);
    },
    enabled: !!user?.id,
  });

  const hasBankLinked = !!(profile?.paystack_recipient_code);

  // Auto-resolve account name
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      setResolving(true);
      setResolveError("");
      setAccountName("");
      fetch(`/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${selectedBank.code}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.account_name) setAccountName(data.account_name);
          else setResolveError("Could not verify account. Check the number.");
        })
        .catch(() => setResolveError("Verification failed. Check your details."))
        .finally(() => setResolving(false));
    } else {
      setAccountName("");
      setResolveError("");
    }
  }, [accountNumber, selectedBank]);

  const handleLinkBank = async () => {
    if (!selectedBank || !accountNumber || !accountName) { setLinkError("Complete all fields"); return; }
    if (accountNumber.length !== 10) { setLinkError("Account number must be 10 digits"); return; }
    setLinkLoading(true);
    setLinkError("");
    try {
      const res = await fetch("/api/paystack/create-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: selectedBank.name,
          account_number: accountNumber,
          account_name: accountName,
          bank_code: selectedBank.code,
          entity_type: "user",
          entity_id: user!.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to link bank");
      await refetchProfile();
      setStep("main");
      qc.invalidateQueries({ queryKey: ["user-profile-bank"] });
    } catch (e: any) {
      setLinkError(e.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const sendOTP = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/paystack/send-withdrawal-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, email: user!.email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (e: any) {
      setOtpError(e.message);
      throw e;
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otpValue.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/paystack/verify-withdrawal-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, otp: otpValue }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setOtpVerified(true);
      setStep("confirm");
    } catch (e: any) {
      setOtpError(e.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const withdrawAmount = Number(amount);
      if (!withdrawAmount || withdrawAmount < 100) throw new Error("Minimum withdrawal is ₦100");
      if (withdrawAmount > (balance || 0)) throw new Error("Insufficient balance");
      if (!profile?.paystack_recipient_code) throw new Error("No bank account linked");
      if (!otpVerified) throw new Error("OTP verification required");

      const res = await fetch("/api/paystack/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_code: profile.paystack_recipient_code,
          amount: withdrawAmount,
          reason: "Chillz wallet withdrawal",
          entity_type: "user",
          entity_id: user!.id,
          account_type: "USER_WALLET",
          otp_verified: true,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        const err: any = new Error(data.error || "Transfer failed");
        err.code = data.code;
        err.available_at = data.available_at;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["user-wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["wallet-quick"] });
      setTransferStatus(data.status === "success" ? "success" : "pending");
      setStep("done");
    },
    onError: (e: any) => {
      if (e.code === "COOLING_PERIOD") setCoolingPeriod(e.available_at);
      setWithdrawError(e.message);
    },
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #5B0EA6, #7B2FBE)", padding: "44px 20px 28px" }}>
        <button
          onClick={() => {
            if (step === "link") setStep("main");
            else if (step === "link_otp") setStep("link");
            else if (step === "otp") setStep("main");
            else if (step === "confirm") setStep("otp");
            else router.back();
          }}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Withdraw Funds
        </h1>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "8px 12px" }}>
          <Wallet size={14} style={{ color: "#FFFFFF" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>
            Balance: {formatCurrency(balance || 0)}
          </span>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <AnimatePresence mode="wait">

          {/* ── MAIN ── */}
          {step === "main" && (
            <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Linked bank card */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                  Withdrawal Account
                </p>
                {hasBankLinked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 size={20} style={{ color: "#00C853" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>{profile.bank_account_name}</p>
                      <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                        {profile.bank_name} · ****{profile.bank_account_number?.slice(-4)}
                      </p>
                    </div>
                    <button
                      onClick={() => { setStep("link"); setAccountNumber(""); setAccountName(""); setSelectedBank(null); setLinkError(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#5B0EA6", padding: "4px 8px" }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setStep("link")}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, backgroundColor: "#F7F5FA", border: "1.5px dashed #C4BAD8", borderRadius: 16, padding: "14px", cursor: "pointer" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 size={20} style={{ color: "#5B0EA6" }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>Link Bank Account</p>
                      <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Required for withdrawals</p>
                    </div>
                    <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                  </button>
                )}
              </div>

              {/* Amount input — only if bank is linked */}
              {hasBankLinked && (
                <>
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                      Amount to Withdraw
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "14px" }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setWithdrawError(""); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 24, fontWeight: 900, color: "#0A0A0A", fontFamily: "inherit" }}
                      />
                    </div>

                    {/* Quick amount buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {[0.25, 0.5, 0.75, 1].map((pct) => {
                        const quickAmt = String(Math.floor((balance || 0) * pct));
                        return (
                          <button key={pct} onClick={() => setAmount(quickAmt)}
                            style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid", borderColor: amount === quickAmt ? "#5B0EA6" : "#E4DCF0", backgroundColor: amount === quickAmt ? "#EDE0F7" : "#FFFFFF", color: amount === quickAmt ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            {pct === 1 ? "All" : `${pct * 100}%`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Balance feedback */}
                    {amount && Number(amount) > 0 && (
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#9E9E9E" }}>You receive</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: Number(amount) > (balance || 0) ? "#EF4444" : "#00C853" }}>
                          {Number(amount) > (balance || 0) ? "Exceeds balance" : formatCurrency(Number(amount))}
                        </span>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {withdrawError && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                        <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                        <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{withdrawError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={async () => {
                      setWithdrawError("");
                      setOtpError("");
                      setOtpValue("");
                      setOtpVerified(false);
                      try {
                        await sendOTP();
                        setStep("otp");
                      } catch {}
                    }}
                    disabled={!amount || Number(amount) < 100 || Number(amount) > (balance || 0) || otpLoading}
                    style={{
                      width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
                      backgroundColor: !amount || Number(amount) < 100 || Number(amount) > (balance || 0) ? "#C4A0E8" : "#5B0EA6",
                      color: "#FFFFFF", fontSize: 15, fontWeight: 700,
                      cursor: !amount || Number(amount) < 100 || Number(amount) > (balance || 0) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 4px 16px rgba(91,14,166,0.3)",
                    }}>
                    {otpLoading
                      ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Sending OTP...</>
                      : "Continue"}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* ── LINK BANK ── */}
          {step === "link" && (
            <motion.div key="link" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                  Your account name is verified automatically from your bank. No manual entry needed.
                </p>
              </div>

              {/* Bank selector */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>SELECT BANK</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto", backgroundColor: "#FFFFFF", borderRadius: 16, padding: "8px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
                  {NIGERIAN_BANKS.map((bank) => (
                    <button key={bank.code}
                      onClick={() => { setSelectedBank(bank); setAccountNumber(""); setAccountName(""); setResolveError(""); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 12, border: "1.5px solid", borderColor: selectedBank?.code === bank.code ? "#5B0EA6" : "transparent", backgroundColor: selectedBank?.code === bank.code ? "#EDE0F7" : "#F7F5FA", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, fontWeight: selectedBank?.code === bank.code ? 700 : 500, color: selectedBank?.code === bank.code ? "#5B0EA6" : "#0A0A0A" }}>{bank.name}</span>
                      {selectedBank?.code === bank.code && <CheckCircle size={14} style={{ color: "#5B0EA6" }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account number */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>ACCOUNT NUMBER</p>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit account number"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  style={inputStyle}
                />
              </div>

              {/* Account name — auto resolved */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>ACCOUNT NAME</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${accountName ? "#00C853" : resolveError ? "#EF4444" : "#E4DCF0"}`, borderRadius: 14, padding: "12px 14px", minHeight: 48 }}>
                  {resolving
                    ? <><Loader size={16} style={{ color: "#9E9E9E", flexShrink: 0 }} /><span style={{ fontSize: 13, color: "#9E9E9E" }}>Verifying account...</span></>
                    : accountName
                      ? <><CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{accountName}</span></>
                      : <span style={{ fontSize: 13, color: "#C4BAD8" }}>Auto-filled after entering account number</span>}
                </div>
                {resolveError && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0" }}>{resolveError}</p>}
              </div>

              <AnimatePresence>
                {linkError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{linkError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("main")}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!accountName || !selectedBank) return;
                    setLinkOtpLoading(true);
                    setLinkError("");
                    try {
                      const res = await fetch("/api/paystack/send-withdrawal-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user!.id, email: user!.email }),
                      });
                      const data = await res.json();
                      if (!data.success) throw new Error(data.error || "Failed to send OTP");
                      setLinkOtpValue("");
                      setLinkOtpError("");
                      setStep("link_otp");
                    } catch (e: any) {
                      setLinkError(e.message);
                    } finally {
                      setLinkOtpLoading(false);
                    }
                  }}
                  disabled={linkOtpLoading || !accountName || !selectedBank}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: linkOtpLoading || !accountName || !selectedBank ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: linkOtpLoading || !accountName || !selectedBank ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {linkOtpLoading
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Sending OTP...</>
                    : <><CheckCircle size={15} />Continue</>}
                </button>
              </div>

              {/* Security note */}
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0, lineHeight: 1.6 }}>
                  🔒 For your security, withdrawals to newly linked accounts are held for 24 hours before processing.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── LINK BANK OTP ── */}
          {step === "link_otp" && (
            <motion.div key="link_otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "16px 18px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6", margin: "0 0 4px" }}>Verify your email</p>
                <p style={{ fontSize: 12, color: "#7B2FBE", margin: 0, lineHeight: 1.6 }}>
                  We sent a 6-digit code to <strong>{user?.email}</strong>. Enter it to confirm linking this bank account.
                </p>
              </div>

              {/* Account summary */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={18} style={{ color: "#00C853" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{accountName}</p>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>{selectedBank?.name} · {accountNumber}</p>
                </div>
                <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} />
              </div>

              {/* OTP input */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>ENTER OTP</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={linkOtpValue}
                  onChange={(e) => { setLinkOtpValue(e.target.value.replace(/\D/g, "")); setLinkOtpError(""); }}
                  style={{
                    width: "100%", backgroundColor: "#F7F5FA",
                    border: `1.5px solid ${linkOtpError ? "#EF4444" : linkOtpValue.length === 6 ? "#00C853" : "#E4DCF0"}`,
                    borderRadius: 14, padding: "16px", fontSize: 32, fontWeight: 900,
                    color: "#0A0A0A", outline: "none", fontFamily: "monospace",
                    boxSizing: "border-box" as const, textAlign: "center" as const, letterSpacing: 12,
                  }}
                />
                {linkOtpError && (
                  <p style={{ fontSize: 12, color: "#EF4444", margin: "6px 0 0", textAlign: "center", fontWeight: 600 }}>{linkOtpError}</p>
                )}
              </div>

              {/* Resend */}
              <p style={{ textAlign: "center", fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                Didn't receive it?{" "}
                <button
                  onClick={async () => {
                    setLinkOtpError("");
                    setLinkOtpValue("");
                    try {
                      await fetch("/api/paystack/send-withdrawal-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user!.id, email: user!.email }),
                      });
                    } catch {}
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0 }}>
                  Resend code
                </button>
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("link")}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Back
                </button>
                <button
                  onClick={async () => {
                    if (linkOtpValue.length !== 6) { setLinkOtpError("Enter the 6-digit code"); return; }
                    setLinkOtpLoading(true);
                    setLinkOtpError("");
                    try {
                      // Verify OTP
                      const verifyRes = await fetch("/api/paystack/verify-withdrawal-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user!.id, otp: linkOtpValue }),
                      });
                      const verifyData = await verifyRes.json();
                      if (!verifyData.success) throw new Error(verifyData.error || "Invalid OTP");

                      // OTP good — now link the bank
                      await handleLinkBank();
                    } catch (e: any) {
                      setLinkOtpError(e.message);
                    } finally {
                      setLinkOtpLoading(false);
                    }
                  }}
                  disabled={linkOtpLoading || linkOtpValue.length !== 6}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: linkOtpLoading || linkOtpValue.length !== 6 ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: linkOtpLoading || linkOtpValue.length !== 6 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {linkOtpLoading
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Verifying...</>
                    : <><CheckCircle size={15} />Verify & Link</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── OTP ── */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "16px 18px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#5B0EA6", margin: "0 0 4px" }}>Check your email</p>
                <p style={{ fontSize: 12, color: "#7B2FBE", margin: 0, lineHeight: 1.6 }}>
                  We sent a 6-digit OTP to <strong>{user?.email}</strong>. Enter it below to confirm your withdrawal.
                </p>
              </div>

              {/* Withdrawal summary */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 2px" }}>Withdrawing to {profile?.bank_name}</p>
                  <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0 }}>****{profile?.bank_account_number?.slice(-4)}</p>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#5B0EA6", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(Number(amount))}
                </span>
              </div>

              {/* OTP input */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>ENTER OTP</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpValue}
                  onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
                  style={{
                    width: "100%", backgroundColor: "#F7F5FA",
                    border: `1.5px solid ${otpError ? "#EF4444" : otpValue.length === 6 ? "#00C853" : "#E4DCF0"}`,
                    borderRadius: 14, padding: "16px", fontSize: 32, fontWeight: 900,
                    color: "#0A0A0A", outline: "none", fontFamily: "monospace",
                    boxSizing: "border-box", textAlign: "center", letterSpacing: 12,
                  }}
                />
                {otpError && (
                  <p style={{ fontSize: 12, color: "#EF4444", margin: "6px 0 0", textAlign: "center", fontWeight: 600 }}>{otpError}</p>
                )}
              </div>

              {/* Resend */}
              <p style={{ textAlign: "center", fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                Didn't receive it?{" "}
                <button
                  onClick={async () => {
                    setOtpError("");
                    setOtpValue("");
                    try { await sendOTP(); } catch {}
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#5B0EA6", fontSize: 12, fontWeight: 700, padding: 0 }}>
                  Resend OTP
                </button>
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("main")}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Back
                </button>
                <button onClick={verifyOTP} disabled={otpLoading || otpValue.length !== 6}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: otpLoading || otpValue.length !== 6 ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: otpLoading || otpValue.length !== 6 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {otpLoading
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Verifying...</>
                    : <><CheckCircle size={15} />Verify OTP</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── CONFIRM ── */}
          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* OTP verified badge */}
              <div style={{ backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={15} style={{ color: "#00C853", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#059669", fontWeight: 600, margin: 0 }}>Identity verified via OTP</p>
              </div>

              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
                  Confirm Withdrawal
                </p>

                {/* Amount highlight */}
                <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: "#7B2FBE", fontWeight: 600, margin: "0 0 6px" }}>You're withdrawing</p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {formatCurrency(Number(amount))}
                  </p>
                </div>

                {/* Destination account */}
                <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={20} style={{ color: "#00C853" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>{profile?.bank_account_name}</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                      {profile?.bank_name} · ****{profile?.bank_account_number?.slice(-4)}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: 11, color: "#9E9E9E", margin: "12px 0 0", lineHeight: 1.6 }}>
                  Transfers are processed instantly via Paystack. Funds should arrive in your account within minutes.
                </p>
              </div>

              {/* Cooling period warning */}
              <AnimatePresence>
                {coolingPeriod && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#D97706", margin: "0 0 4px" }}>24-Hour Security Hold</p>
                    <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                      Your bank account was linked recently. Withdrawals will be available from{" "}
                      <strong>{new Date(coolingPeriod).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</strong>.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {withdrawError && !coolingPeriod && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{withdrawError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setStep("otp"); setOtpValue(""); setOtpVerified(false); setWithdrawError(""); setCoolingPeriod(null); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Back
                </button>
                <button
                  onClick={() => withdrawMutation.mutate()}
                  disabled={withdrawMutation.isPending || !!coolingPeriod}
                  style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: withdrawMutation.isPending || !!coolingPeriod ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: withdrawMutation.isPending || !!coolingPeriod ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                  {withdrawMutation.isPending
                    ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                    : <><CheckCircle size={15} />Confirm & Send</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 40 }}>

              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
                style={{ width: 88, height: 88, borderRadius: "50%", backgroundColor: transferStatus === "success" ? "#E0F7EA" : "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={44} style={{ color: transferStatus === "success" ? "#00C853" : "#5B0EA6" }} />
              </motion.div>

              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontWeight: 900, fontSize: 22, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {transferStatus === "success" ? "Transfer Successful!" : "Transfer Initiated"}
                </h2>
                <p style={{ fontSize: 14, color: "#6B6B6B", margin: "0 0 6px", lineHeight: 1.6 }}>
                  {formatCurrency(Number(amount))} {transferStatus === "success" ? "has been sent to" : "is being transferred to"}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                  {profile?.bank_account_name}
                </p>
                <p style={{ fontSize: 12, color: "#9E9E9E", margin: "2px 0 0" }}>
                  {profile?.bank_name} · ****{profile?.bank_account_number?.slice(-4)}
                </p>
              </div>

              {transferStatus === "pending" && (
                <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
                  <p style={{ fontSize: 12, color: "#92400E", fontWeight: 600, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                    Your transfer is being processed. Funds typically arrive within a few minutes.
                  </p>
                </div>
              )}

              <button onClick={() => router.push("/wallet")}
                style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                Back to Wallet
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}