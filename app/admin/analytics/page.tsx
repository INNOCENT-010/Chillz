/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ArrowLeft, TrendingUp, Users, Building2, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#5B0EA6", "#7B2FBE", "#00C853", "#F59E0B", "#EF4444", "#3D0066"];

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: async () => {
      const since = subDays(new Date(), period).toISOString();

      const [ledgerRes, bookingsRes, usersRes, venuesRes, eventsRes] = await Promise.all([
        supabase.from("ledger_entries").select("direction, amount, account_type, created_at").gte("created_at", since),
        supabase.from("bookings").select("id, status, reserved_amount, created_at, venues(category), events(event_tags)").gte("created_at", since).order("created_at", { ascending: true }),
        supabase.from("users").select("id, created_at").order("created_at", { ascending: true }),
        supabase.from("venues").select("id, name, category, rating, review_count").eq("is_active", true),
        supabase.from("events").select("id, title, start_date, ticket_price, ticket_types").eq("is_active", true),
      ]);

      const ledger = (ledgerRes.data || []) as any[];
      const bookings = (bookingsRes.data || []) as any[];
      const allUsers = (usersRes.data || []) as any[];
      const venues = (venuesRes.data || []) as any[];

      // Revenue by day
      const days = Array.from({ length: period }, (_, i) => {
        const d = subDays(new Date(), period - 1 - i);
        return {
          date: format(d, period <= 7 ? "EEE" : period <= 30 ? "dd MMM" : "MMM dd"),
          day: format(d, "yyyy-MM-dd"),
          revenue: 0,
          bookings: 0,
          users: 0,
        };
      });

      ledger.forEach((row: any) => {
        if (row.account_type !== "CHILLZ_REVENUE" || row.direction !== "CREDIT") return;
        const day = format(new Date(row.created_at), "yyyy-MM-dd");
        const found = days.find((d) => d.day === day);
        if (found) found.revenue += row.amount;
      });

      bookings.forEach((b: any) => {
        const day = format(new Date(b.created_at), "yyyy-MM-dd");
        const found = days.find((d) => d.day === day);
        if (found) found.bookings += 1;
      });

      allUsers.forEach((u: any) => {
        const day = format(new Date(u.created_at), "yyyy-MM-dd");
        const found = days.find((d) => d.day === day);
        if (found) found.users += 1;
      });

      // Bookings by category
      const catCounts: Record<string, number> = {};
      bookings.forEach((b: any) => {
        const cat = b.venues?.category || "event";
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
      const categoryData = Object.entries(catCounts)
        .map(([name, value]) => ({ name: name.replace(/-/g, " "), value }))
        .sort((a, b) => b.value - a.value);

      // Total revenue
      const totalRevenue = ledger
        .filter((r: any) => r.account_type === "CHILLZ_REVENUE" && r.direction === "CREDIT")
        .reduce((s: number, r: any) => s + r.amount, 0);

      // Completion rate
      const completed = bookings.filter((b: any) => b.status === "completed").length;
      const completionRate = bookings.length > 0
        ? Math.round((completed / bookings.length) * 100)
        : 0;

      // Top venues by booking count
      const venueCounts: Record<string, { name: string; bookings: number; revenue: number }> = {};
      bookings.forEach((b: any) => {
        const name = b.venues?.name;
        if (!name) return;
        if (!venueCounts[name]) venueCounts[name] = { name, bookings: 0, revenue: 0 };
        venueCounts[name].bookings += 1;
        venueCounts[name].revenue += b.reserved_amount * 0.05;
      });
      const topVenues = Object.values(venueCounts)
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 8);

      // New users in period
      const newUsers = allUsers.filter(
        (u: any) => new Date(u.created_at) >= subDays(new Date(), period)
      ).length;

      return {
        chartData: days,
        categoryData,
        topVenues,
        totalRevenue,
        totalBookings: bookings.length,
        completionRate,
        newUsers,
        totalVenues: venues.length,
        avgRating: venues.length > 0
          ? (venues.reduce((s: number, v: any) => s + (v.rating || 0), 0) / venues.length).toFixed(1)
          : "0",
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E4DCF0", borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 16px rgba(91,14,166,0.1)" }}>
        <p style={{ fontSize: 11, color: "#9E9E9E", margin: "0 0 4px" }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ fontSize: 13, fontWeight: 800, color: p.color, margin: "2px 0 0" }}>
            {p.dataKey === "revenue" ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #065F46, #00C853)", padding: "44px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)" }} />
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={17} style={{ color: "#FFFFFF" }} />
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Dashboard</span>
        </button>
        <h1 style={{ color: "#FFFFFF", fontSize: 24, fontWeight: 900, margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Analytics</h1>

        {/* Period toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {([7, 30, 90] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid", borderColor: period === p ? "#FFFFFF" : "rgba(255,255,255,0.3)", backgroundColor: period === p ? "#FFFFFF" : "transparent", color: period === p ? "#00C853" : "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Key metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Revenue", value: formatCurrency(data?.totalRevenue || 0), icon: TrendingUp, color: "#5B0EA6", bg: "#EDE0F7" },
            { label: "Bookings", value: data?.totalBookings?.toLocaleString() || "0", icon: Calendar, color: "#00C853", bg: "#E0F7EA" },
            { label: "New Users", value: data?.newUsers?.toLocaleString() || "0", icon: Users, color: "#F59E0B", bg: "#FEF3C7" },
            { label: "Completion Rate", value: `${data?.completionRate || 0}%`, icon: Building2, color: "#7B2FBE", bg: "#F3E8FF" },
          ].map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              style={{ backgroundColor: "#FFFFFF", borderRadius: 18, padding: "14px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{value}</p>
              <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0 }}>{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Revenue Over Time</p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B0EA6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5B0EA6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEF9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} interval={period === 7 ? 0 : period === 30 ? 6 : 14} />
                <YAxis tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#5B0EA6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bookings chart */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Daily Bookings</p>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chartData || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEF9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} interval={period === 7 ? 0 : period === 30 ? 6 : 14} />
                <YAxis tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="bookings" fill="#EDE0F7" radius={[4, 4, 0, 0]}>
                  {(data?.chartData || []).map((_: any, i: number) => (
                    <Cell key={i} fill={i % 2 === 0 ? "#5B0EA6" : "#7B2FBE"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bookings by category */}
        {data?.categoryData && data.categoryData.length > 0 && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Bookings by Category</p>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                    {data.categoryData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "#6B6B6B", textTransform: "capitalize" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* User growth */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 16px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>User Growth</p>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C853" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEF9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} interval={period === 7 ? 0 : period === 30 ? 6 : 14} />
                <YAxis tick={{ fontSize: 9, fill: "#9E9E9E" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="users" stroke="#00C853" strokeWidth={2} fill="url(#userGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top venues */}
        {data?.topVenues && data.topVenues.length > 0 && (
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(91,14,166,0.06)" }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#0A0A0A", margin: "0 0 14px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>Top Venues by Bookings</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.topVenues.map((venue: any, i: number) => {
                const maxBookings = data.topVenues[0].bookings;
                const pct = Math.round((venue.bookings / maxBookings) * 100);
                return (
                  <div key={venue.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A" }}>
                        {i + 1}. {venue.name}
                      </span>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#9E9E9E" }}>{venue.bookings} bookings</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5B0EA6" }}>{formatCurrency(venue.revenue)}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, backgroundColor: "#F2EEF9", borderRadius: 999, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                        style={{ height: "100%", backgroundColor: COLORS[i % COLORS.length], borderRadius: 999 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}