"use client";
import { useState } from "react";

export default function SeedVenuesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"seed" | "update">("seed");

  const handleAction = async (actionMode: "seed" | "update") => {
    setLoading(true);
    setMode(actionMode);
    setError("");
    setResult(null);
    try {
      const url = actionMode === "update"
        ? "/api/admin/seed-google-venues?update=true"
        : "/api/admin/seed-google-venues";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": "Bearer chillz-admin-2024",
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
        Google Venues Manager
      </h1>
      <p style={{ color: "#6B6B6B", marginBottom: 24 }}>
        Seed new venues from Google Places or update existing ones with latest data. takes -2mins
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => handleAction("seed")}
          disabled={loading}
          style={{ padding: "14px 28px", borderRadius: 12, border: "none", backgroundColor: loading ? "#9E9E9E" : "#5B0EA6", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading && mode === "seed" ? "Seeding..." : "Seed New Venues"}
        </button>

        <button
          onClick={() => handleAction("update")}
          disabled={loading}
          style={{ padding: "14px 28px", borderRadius: 12, border: "none", backgroundColor: loading ? "#9E9E9E" : "#059669", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading && mode === "update" ? "Updating..." : "Update Existing Venues"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "#FEF2F2", borderRadius: 12, color: "#EF4444", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: 14, backgroundColor: "#E0F7EA", borderRadius: 12 }}>
          <p style={{ fontWeight: 700, color: "#059669", marginBottom: 8 }}>
            ✓ {mode === "update" ? "Update" : "Seeding"} complete
          </p>
          {mode === "seed" && <p>Inserted: {result.inserted}</p>}
          {mode === "seed" && <p>Skipped (already exist): {result.skipped}</p>}
          {mode === "update" && <p>Updated: {result.updated}</p>}
          <p>Errors: {result.errors}</p>
          <div style={{ marginTop: 12, maxHeight: 200, overflowY: "auto" }}>
            {result.venues?.map((v: string, i: number) => (
              <p key={i} style={{ fontSize: 12, color: "#059669", margin: "2px 0" }}>✓ {v}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}