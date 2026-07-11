/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { AlertTriangle } from "lucide-react";

type VendorTab = "overview" | "events" | "tickets" | "menu" | "offers" | "packages" | "listings" | "withdraw" | "my-place" | "disputes" | "posts" | "profile";

interface Props {
  vendor: any;
  tabs: { id: VendorTab; label: string; icon: any }[];
  activeTab: VendorTab;
  setActiveTab: (t: VendorTab) => void;
  disputeCount: number;
  heroImage?: string | null;
}

export function VendorHeader({ vendor, tabs, activeTab, setActiveTab, disputeCount, heroImage }: Props) {
  return (
    <div style={{ background: "linear-gradient(135deg, #3D0066 0%, #5B0EA6 100%)", padding: "44px 20px 0", position: "relative", overflow: "hidden" }}>

      {/* Background image — venue/hotel/business photo */}
      {heroImage && (
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18 }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(61,0,102,0.93) 0%, rgba(91,14,166,0.87) 100%)" }} />
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.18), transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 1, marginBottom: 16 }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Vendor Dashboard
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {disputeCount > 0 && (
              <button onClick={() => setActiveTab("disputes")}
                style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 999, padding: "3px 10px", cursor: "pointer" }}>
                <AlertTriangle size={11} style={{ color: "#FCD34D" }} />
                <span style={{ fontSize: 11, color: "#FCD34D", fontWeight: 700 }}>{disputeCount} dispute{disputeCount > 1 ? "s" : ""}</span>
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "rgba(0,200,83,0.2)", borderRadius: 999, padding: "3px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#00C853" }} />
              <span style={{ fontSize: 11, color: "#00C853", fontWeight: 700 }}>Active</span>
            </div>
          </div>
        </div>

        {/* Business name + avatar row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Business avatar */}
          <div style={{ width: 52, height: 52, borderRadius: 16, overflow: "hidden", flexShrink: 0, backgroundColor: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.25)" }}>
            {heroImage
              ? <img src={heroImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
                    {vendor.business_name?.[0]?.toUpperCase()}
                  </span>
                </div>}
          </div>
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>
              {vendor.business_name}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: 0, textTransform: "capitalize" }}>
              {vendor.vendor_type?.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const hasAlert = id === "disputes" && disputeCount > 0;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ flexShrink: 0, padding: "10px 14px 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", borderBottom: isActive ? "2.5px solid #FFFFFF" : "2.5px solid transparent", display: "flex", alignItems: "center", gap: 5, position: "relative" }}>
              <Icon size={13} style={{ color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.4)" }} />
              <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                {label}
              </span>
              {hasAlert && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#FCD34D", position: "absolute", top: 8, right: 4 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}