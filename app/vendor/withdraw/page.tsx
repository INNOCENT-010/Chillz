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

export default function VendorWithdrawPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [step, setStep] = useState<"main" | "link" | "confirm" | "done">("main");
  const [amount, setAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [transferStatus, setTransferStatus] = useState<"success" | "pending" | null>(null);

  const { data: vendor, refetch: refetchVendor } = useQuery({
    queryKey: ["vendor-bank", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("vendors")
        .select("id, bank_name, bank_account_number, bank_account_name, paystack_recipient_code")
        .eq("user_id", user.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: balance } = useQuery({
    queryKey: ["vendor-available-balance", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return 0;
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount")
        .eq("account_id", vendor.id)
        .eq("account_type", "VENDOR_AVAILABLE");
      return ((data || []) as any[]).reduce((acc: number, row: any) =>
        row.direction === "CREDIT" ? acc + row.amount : acc - row.amount, 0);
    },
    enabled: !!vendor?.id,
  });

  const hasBankLinked = !!(vendor?.paystack_recipient_code);

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      setResolving(true);
      setResolveError("");
      setAccountName("");
      fetch(`/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${selectedBank.code}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.account_name) setAccountName(data.account_name);
          else setResolveError("Could not verify account.");
        })
        .catch(() => setResolveError("Verification failed."))
        .finally(() => setResolving(false));
    } else {
      setAccountName("");
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
          entity_type: "vendor",
          entity_id: vendor!.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to link bank");
      await refetchVendor();
      setStep("main");
    } catch (e: any) {
      setLinkError(e.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const withdrawAmount = Number(amount);
      if (!withdrawAmount || withdrawAmount < 100) throw new Error("Minimum withdrawal is ₦100");
      if (withdrawAmount > (balance || 0)) throw new Error("Insufficient balance");
      if (!vendor?.paystack_recipient_code) throw new Error("No bank account linked");

      const res = await fetch("/api/paystack/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_code: vendor.paystack_recipient_code,
          amount: withdrawAmount,
          reason: "Chillz vendor payout",
          entity_type: "vendor",
          entity_id: vendor.id,
          account_type: "VENDOR_AVAILABLE",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Transfer failed");
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vendor-available-balance"] });
      qc.invalidateQueries({ queryKey: ["vendor-earnings"] });
      setTransferStatus(data.status === "success" ? "success" : "pending");
      setStep("done");
    },
    onError: (e: any) => setWithdrawError(e.message),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0",
    borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "#0A0A0A",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 28px" }}>
        <button onClick={() => step === "link" ? setStep("main") : router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
          <ArrowLeft size={18} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Back</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          Withdraw Earnings
        </h1>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "8px 12px" }}>
          <Wallet size={14} style={{ color: "#FFFFFF" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>Available: {formatCurrency(balance || 0)}</span>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── MAIN ── */}
        {step === "main" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                Payout Account
              </p>
              {hasBankLinked ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={20} style={{ color: "#00C853" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>{vendor.bank_account_name}</p>
                    <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>
                      {vendor.bank_name} · ****{vendor.bank_account_number?.slice(-4)}
                    </p>
                  </div>
                  <button onClick={() => { setStep("link"); setAccountNumber(""); setAccountName(""); setSelectedBank(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>
                    Change
                  </button>
                </div>
              ) : (
                <button onClick={() => setStep("link")}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, backgroundColor: "#F7F5FA", border: "1.5px dashed #C4BAD8", borderRadius: 16, padding: "14px", cursor: "pointer" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={20} style={{ color: "#5B0EA6" }} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px" }}>Link Bank Account</p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>Required for payouts</p>
                  </div>
                  <ChevronRight size={16} style={{ color: "#9E9E9E" }} />
                </button>
              )}
            </div>

            {hasBankLinked && (
              <>
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                    Payout Amount
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 14, padding: "14px" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                    <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 24, fontWeight: 900, color: "#0A0A0A", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button key={pct} onClick={() => setAmount(String(Math.floor((balance || 0) * pct)))}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid", borderColor: amount === String(Math.floor((balance || 0) * pct)) ? "#5B0EA6" : "#E4DCF0", backgroundColor: amount === String(Math.floor((balance || 0) * pct)) ? "#EDE0F7" : "#FFFFFF", color: amount === String(Math.floor((balance || 0) * pct)) ? "#5B0EA6" : "#6B6B6B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {pct === 1 ? "All" : `${pct * 100}%`}
                      </button>
                    ))}
                  </div>
                  {amount && Number(amount) > 0 && (
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
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
                      <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                      <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{withdrawError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button onClick={() => { setWithdrawError(""); setStep("confirm"); }}
                  disabled={!amount || Number(amount) < 100 || Number(amount) > (balance || 0)}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: !amount || Number(amount) < 100 || Number(amount) > (balance || 0) ? "#C4A0E8" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: !amount || Number(amount) < 100 || Number(amount) > (balance || 0) ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
                  Continue
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* ── LINK BANK ── */}
        {step === "link" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ backgroundColor: "#EDE0F7", borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ fontSize: 12, color: "#5B0EA6", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                Account name is verified automatically from your bank.
              </p>
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 8px" }}>SELECT BANK</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", backgroundColor: "#FFFFFF", borderRadius: 16, padding: "8px", boxShadow: "0 2px 8px rgba(91,14,166,0.06)" }}>
                {NIGERIAN_BANKS.map((bank) => (
                  <button key={bank.code} onClick={() => { setSelectedBank(bank); setAccountNumber(""); setAccountName(""); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, border: "1.5px solid", borderColor: selectedBank?.code === bank.code ? "#5B0EA6" : "transparent", backgroundColor: selectedBank?.code === bank.code ? "#EDE0F7" : "#F7F5FA", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: selectedBank?.code === bank.code ? 700 : 500, color: selectedBank?.code === bank.code ? "#5B0EA6" : "#0A0A0A" }}>{bank.name}</span>
                    {selectedBank?.code === bank.code && <CheckCircle size={14} style={{ color: "#5B0EA6" }} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>ACCOUNT NUMBER</p>
              <input type="text" inputMode="numeric" placeholder="10-digit account number" maxLength={10}
                value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                style={inputStyle} />
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", margin: "0 0 6px" }}>ACCOUNT NAME</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: `1.5px solid ${accountName ? "#00C853" : "#E4DCF0"}`, borderRadius: 14, padding: "12px 14px" }}>
                {resolving
                  ? <><Loader size={16} style={{ color: "#9E9E9E", animation: "spin 0.8s linear infinite", flexShrink: 0 }} /><span style={{ fontSize: 13, color: "#9E9E9E" }}>Verifying...</span></>
                  : accountName
                    ? <><CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{accountName}</span></>
                    : <span style={{ fontSize: 13, color: "#C4BAD8" }}>Auto-filled after entering account number</span>}
              </div>
              {resolveError && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0" }}>{resolveError}</p>}
            </div>

            {linkError && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{linkError}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("main")}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleLinkBank} disabled={linkLoading || !accountName || !selectedBank}
                style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: linkLoading || !accountName || !selectedBank ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: linkLoading || !accountName || !selectedBank ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {linkLoading
                  ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Linking...</>
                  : <><CheckCircle size={15} />Link Account</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CONFIRM ── */}
        {step === "confirm" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, boxShadow: "0 2px 12px rgba(91,14,166,0.07)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
                Confirm Payout
              </p>
              <div style={{ backgroundColor: "#EDE0F7", borderRadius: 16, padding: "16px", textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#7B2FBE", fontWeight: 600, margin: "0 0 4px" }}>Payout amount</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "#5B0EA6", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                  {formatCurrency(Number(amount))}
                </p>
              </div>
              <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#E0F7EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={20} style={{ color: "#00C853" }} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 2px" }}>{vendor?.bank_account_name}</p>
                  <p style={{ fontSize: 12, color: "#9E9E9E", margin: 0 }}>{vendor?.bank_name} · ****{vendor?.bank_account_number?.slice(-4)}</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#9E9E9E", margin: "12px 0 0", lineHeight: 1.6 }}>
                Transfers are processed instantly via Paystack.
              </p>
            </div>

            <AnimatePresence>
              {withdrawError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8 }}>
                  <AlertTriangle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                  <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{withdrawError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("main")}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Back
              </button>
              <button onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending}
                style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: "none", backgroundColor: withdrawMutation.isPending ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: withdrawMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(91,14,166,0.3)" }}>
                {withdrawMutation.isPending
                  ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Processing...</>
                  : <><CheckCircle size={15} />Confirm & Send</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 40 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
              style={{ width: 88, height: 88, borderRadius: "50%", backgroundColor: transferStatus === "success" ? "#E0F7EA" : "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={44} style={{ color: transferStatus === "success" ? "#00C853" : "#5B0EA6" }} />
            </motion.div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontWeight: 900, fontSize: 22, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                {transferStatus === "success" ? "Payout Successful!" : "Payout Initiated"}
              </h2>
              <p style={{ fontSize: 14, color: "#6B6B6B", margin: "0 0 6px", lineHeight: 1.6 }}>
                {formatCurrency(Number(amount))} {transferStatus === "success" ? "has been sent to" : "is being transferred to"}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                {vendor?.bank_account_name} · {vendor?.bank_name}
              </p>
            </div>
            {transferStatus === "pending" && (
              <div style={{ backgroundColor: "#FFF8E1", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
                <p style={{ fontSize: 12, color: "#92400E", fontWeight: 600, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                  Your payout is being processed. Funds typically arrive within minutes.
                </p>
              </div>
            )}
            <button onClick={() => router.back()}
              style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", backgroundColor: "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
              Back to Dashboard
            </button>
          </motion.div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}