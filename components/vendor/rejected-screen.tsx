"use client";
import { supabase } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

export function RejectedScreen({ vendor, router, qc, user }: { vendor: any; router: any; qc: any; user: any }) {
  const [deleting, setDeleting] = useState(false);

  const handleReRegister = async () => {
    setDeleting(true);
    try {
      // Delete the rejected vendor record so they can register fresh
      await (supabase.from("vendors") as any)
        .delete()
        .eq("id", vendor.id);
      qc.invalidateQueries({ queryKey: ["vendor", user?.id] });
      router.push("/vendor/register");
    } catch {}
    finally { setDeleting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg, #3D0066, #5B0EA6)", padding: "44px 20px 28px" }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>{vendor.business_name}</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "4px 0 0", textTransform: "capitalize" }}>{vendor.vendor_type?.replace(/_/g, " ")}</p>
      </div>
      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 20, padding: "24px", textAlign: "center" }}>
          <AlertTriangle size={32} style={{ color: "#EF4444", marginBottom: 12 }} />
          <h3 style={{ fontWeight: 900, fontSize: 17, color: "#991B1B", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
            Application Rejected
          </h3>
          <p style={{ fontSize: 13, color: "#B91C1C", margin: 0, lineHeight: 1.5 }}>
            Your application for <strong>{vendor.business_name}</strong> was not approved. You can start a new application or contact support for more information.
          </p>
        </div>

        <button onClick={handleReRegister} disabled={deleting}
          style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: deleting ? "#9E9E9E" : "linear-gradient(135deg, #5B0EA6, #7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(91,14,166,0.3)" }}>
          {deleting
            ? <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", animation: "spin 0.8s linear infinite" }} />Please wait...</>
            : "Start New Application"}
        </button>

        <button onClick={() => router.push("/support")}
          style={{ width: "100%", padding: "13px 0", borderRadius: 16, border: "1.5px solid #E4DCF0", backgroundColor: "#FFFFFF", color: "#6B6B6B", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Contact Support
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}