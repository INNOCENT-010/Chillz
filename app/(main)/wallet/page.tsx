/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthStore } from "@/store/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Plus, ArrowUpRight,
  ArrowDownLeft, Lock, Wallet, CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [fundAmount, setFundAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFundSheet, setShowFundSheet] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const ref    = params.get("ref");
    const amount = params.get("amount");
    const uid    = params.get("uid");

    if (status) {
      setPaymentStatus(status);
      if (status === "success" && ref && uid) {
        // Credit the wallet now that we're back on the client
        fetch("/api/wallet/fund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref, user_id: uid }),
        }).then(() => {
          qc.invalidateQueries({ queryKey: ["wallet-balance"] });
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["wallet-quick"] });
        }).catch(console.error);
      }
      window.history.replaceState({}, "", "/wallet");
    }
  }, [qc]);

  const { data: ledger } = useQuery({
    queryKey: ["wallet-balance", user?.id],
    queryFn: async () => {
      if (!user?.id) return { balance: 0, reserved: 0 };
      const { data } = await supabase
        .from("ledger_entries")
        .select("direction, amount, account_type")
        .eq("account_id", user.id)
        .in("account_type", ["USER_WALLET", "USER_RESERVED"]);

      let balance  = 0;
      let reserved = 0;
      ((data || []) as any[]).forEach((row: any) => {
        const val = row.direction === "CREDIT" ? row.amount : -row.amount;
        if (row.account_type === "USER_WALLET") balance += val;
        else reserved += val;
      });
      return { balance, reserved };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("account_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 15,
  });

  const handleFund = async () => {
    const amount = Number(fundAmount);
    if (!amount || amount < 100) { alert("Minimum funding amount is ₦100"); return; }
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: amount * 100,
          user_id: user.id,
          callback_url: `${window.location.origin}/api/wallet/callback`,
        }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error(data.error || "Failed to initialize payment");
      }
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  };

  const TX_LABEL: Record<string, string> = {
    USER_WALLET:    "Wallet credit",
    USER_RESERVED:  "Booking reserved",
    VENDOR_PENDING: "Vendor credit",
    VENDOR_EARNINGS:"Vendor earnings",
    CHILLZ_REVENUE: "Platform fee",
    PAYSTACK_INFLOW: "Deposit",
    PAYSTACK_OUTFLOW: "Withdrawal",
    ESCROW:         "Escrow hold",
  };

  return (
    <MainLayout>
      {/* Header */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E4DCF0" }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, marginLeft: -6, display: "flex" }}>
          <ArrowLeft size={22} style={{ color: "#0A0A0A" }} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0A0A0A", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>
          My Wallet
        </h1>
      </div>

      {/* Payment status banners */}
      <AnimatePresence>
        {paymentStatus === "success" && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ margin: "12px 16px 0", backgroundColor: "#E0F7EA", border: "1px solid #A7F3D0", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={16} style={{ color: "#00C853", flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "#059669", fontWeight: 600, margin: 0 }}>Wallet funded successfully</p>
          </motion.div>
        )}
        {paymentStatus === "failed" && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ margin: "12px 16px 0", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "12px 16px" }}>
            <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, margin: 0 }}>Payment was not completed. Try again.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ borderRadius: 24, padding: "28px 24px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #3D0066 0%, #5B0EA6 60%, #7B2FBE 100%)" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.2), transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(123,47,190,0.4), transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Wallet size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0, fontWeight: 500 }}>Available Balance</p>
            </div>

            <h2 style={{ color: "#FFFFFF", fontSize: 36, fontWeight: 900, margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)", letterSpacing: "-0.02em" }}>
              {formatCurrency(ledger?.balance || 0)}
            </h2>

            {(ledger?.reserved || 0) > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", marginBottom: 16 }}>
                <Lock size={12} style={{ color: "rgba(255,255,255,0.7)" }} />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                  {formatCurrency(ledger?.reserved || 0)} reserved
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowFundSheet(true)}
                style={{ backgroundColor: "#00C853", color: "#FFFFFF", border: "none", borderRadius: 14, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,200,83,0.35)" }}>
                <Plus size={16} />
                Add Money
              </button>

              <button
                onClick={() => router.push("/wallet/withdraw")}
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 14, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowUpRight size={16} />
                Withdraw
              </button>
            </div>
          </div>
        </motion.div>

        {/* Transaction history */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            Transactions
          </h3>

          {transactions && transactions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.map((tx: any, i: number) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 8px rgba(91,14,166,0.05)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tx.direction === "CREDIT" ? "#E0F7EA" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {tx.direction === "CREDIT"
                      ? <ArrowDownLeft size={18} style={{ color: "#00C853" }} />
                      : <ArrowUpRight size={18} style={{ color: "#EF4444" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#0A0A0A", margin: "0 0 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {tx.note || TX_LABEL[tx.account_type] || tx.account_type}
                    </p>
                    <p style={{ fontSize: 11, color: "#9E9E9E", margin: 0 }}>
                      {new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: tx.direction === "CREDIT" ? "#00C853" : "#EF4444", flexShrink: 0 }}>
                    {tx.direction === "CREDIT" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "40px 20px", textAlign: "center", boxShadow: "0 2px 8px rgba(91,14,166,0.05)" }}>
              <p style={{ color: "#9E9E9E", fontSize: 13, margin: 0 }}>No transactions yet. Fund your wallet to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Fund bottom sheet */}
      <AnimatePresence>
        {showFundSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !loading && setShowFundSheet(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50 }} />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51, backgroundColor: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "20px 20px 48px", maxWidth: 480, margin: "0 auto" }}>

              <div style={{ width: 40, height: 4, backgroundColor: "#E4DCF0", borderRadius: 999, margin: "0 auto 20px" }} />

              <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                Add Money
              </h3>
              <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 20px" }}>Funds are added instantly via Paystack</p>

              {/* Amount input */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#F7F5FA", border: "1.5px solid #E4DCF0", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#5B0EA6" }}>₦</span>
                <input
                  type="number"
                  placeholder="0"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  autoFocus
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 24, fontWeight: 700, color: "#0A0A0A", fontFamily: "inherit", width: "100%", minWidth: 0 }}
                />
              </div>

              {/* Quick amounts */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {QUICK_AMOUNTS.map((amt) => (
                  <button key={amt} onClick={() => setFundAmount(String(amt))}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid", borderColor: fundAmount === String(amt) ? "#5B0EA6" : "#E4DCF0", backgroundColor: fundAmount === String(amt) ? "#EDE0F7" : "#FFFFFF", color: fundAmount === String(amt) ? "#5B0EA6" : "#6B6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s ease" }}>
                    ₦{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {/* Fund button */}
              <button
                onClick={handleFund}
                disabled={!fundAmount || Number(fundAmount) < 100 || loading}
                style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", backgroundColor: !fundAmount || Number(fundAmount) < 100 || loading ? "#C4A0E8" : "#5B0EA6", color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: !fundAmount || Number(fundAmount) < 100 || loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background-color 0.2s ease", boxShadow: !fundAmount || Number(fundAmount) < 100 || loading ? "none" : "0 4px 16px rgba(91,14,166,0.35)" }}>
                {loading
                  ? <><div style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Redirecting to Paystack...</>
                  : <><Plus size={18} />Fund {fundAmount && Number(fundAmount) >= 100 ? formatCurrency(Number(fundAmount)) : "Wallet"}</>}
              </button>

              {fundAmount && Number(fundAmount) < 100 && (
                <p style={{ textAlign: "center", fontSize: 12, color: "#EF4444", marginTop: 8 }}>
                  Minimum amount is ₦100
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </MainLayout>
  );
}