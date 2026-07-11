/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import {
  Users, Building2, TrendingUp, Wallet, AlertTriangle,
  Shield, ChevronRight, Calendar, BarChart2,
  Layers, ShoppingBag, MessageCircle, LayoutDashboard,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format, subDays } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useState } from "react";

export default function AdminDashboard() {
  const [revenuePeriod, setRevenuePeriod] = useState<7 | 30>(7);

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [
        usersRes, venuesRes, eventsRes, vendorsRes,
        ledgerRes, bookingsRes, disputesRes,
      ] = await Promise.all([
        supabase.from("users").select("id, created_at", { count: "exact" }),
        supabase.from("venues").select("id, is_active", { count: "exact" }),
        supabase.from("events").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("vendors").select("id, kyc_status, business_name, vendor_type, created_at"),
        supabase.from("ledger_entries").select("direction, amount, account_type, created_at").order("created_at", { ascending: false }),
        supabase.from("bookings").select("id, status, reserved_amount, final_amount, created_at, receipts(subtotal)").order("created_at", { ascending: false }),
        supabase.from("bookings").select("id", { count: "exact" }).eq("status", "disputed"),
      ]);

      const ledger = (ledgerRes.data || []) as any[];
      const bookings = (bookingsRes.data || []) as any[];
      const vendors = (vendorsRes.data || []) as any[];

      let totalRevenue = 0, vendorFloat = 0, userFloat = 0;
      ledger.forEach((row: any) => {
        const val = row.direction === "CREDIT" ? row.amount : -row.amount;
        if (row.account_type === "CHILLZ_REVENUE") totalRevenue += val;
        if (["VENDOR_PENDING","VENDOR_AVAILABLE"].includes(row.account_type)) vendorFloat += val;
        if (["USER_WALLET","USER_RESERVED"].includes(row.account_type)) userFloat += val;
      });

      const days = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(new Date(), 29 - i);
        return { date: format(d, "MMM dd"), day: format(d, "yyyy-MM-dd"), revenue: 0, bookings: 0 };
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

      const pendingKYC = vendors.filter((v: any) => v.kyc_status === "pending");
      const weekAgo = subDays(new Date(), 7);
      return {
        totalUsers: usersRes.count || 0,
        activeVenues: (venuesRes.data || []).filter((v: any) => v.is_active).length,
        activeEvents: eventsRes.count || 0,
        totalRevenue, vendorFloat, userFloat,
        totalFloat: vendorFloat + userFloat,
        openDisputes: disputesRes.count || 0,
        pendingKYC,
        recentBookings: bookings.slice(0, 5),
        chartData: days,
        newUsers: (usersRes.data || []).filter((u: any) => new Date(u.created_at) > weekAgo).length,
        totalBookings: bookings.length,
        completedBookings: bookings.filter((b: any) => b.status === "completed").length,
      };
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 120,
  });

  const chartData = (stats?.chartData || []).slice(revenuePeriod === 7 ? 23 : 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor:"#FFFFFF", border:"1px solid #E4DCF0", borderRadius:12, padding:"10px 14px", boxShadow:"0 4px 16px rgba(91,14,166,0.1)" }}>
        <p style={{ fontSize:11, color:"#9E9E9E", margin:"0 0 4px" }}>{label}</p>
        <p style={{ fontSize:14, fontWeight:800, color:"#5B0EA6", margin:0 }}>{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  const navItems = [
    { href:"/admin/homepage",  label:"Homepage",  sub:"Categories & banners",                                                  icon:LayoutDashboard, color:"#059669", bg:"#D1FAE5" },
    { href:"/admin/vendors",   label:"Vendors",   sub:"Manage & approve",                                                      icon:ShoppingBag,     color:"#5B0EA6", bg:"#EDE0F7" },
    { href:"/admin/venues",    label:"Venues",    sub:"Assign & manage",                                                       icon:Building2,       color:"#7B2FBE", bg:"#F3E8FF" },
    { href:"/admin/kyc",       label:"KYC",       sub:`${stats?.pendingKYC?.length || 0} pending`,                            icon:Shield,          color:"#5B0EA6", bg:"#EDE0F7" },
    { href:"/admin/disputes",  label:"Disputes",  sub:stats?.openDisputes ? `${stats.openDisputes} open` : "All clear",       icon:AlertTriangle,   color:"#D97706", bg:"#FEF3C7" },
    { href:"/admin/analytics", label:"Analytics", sub:"Performance data",                                                      icon:BarChart2,       color:"#00C853", bg:"#E0F7EA" },
    { href:"/admin/splits",    label:"Splits",    sub:"Income breakdown",                                                      icon:Layers,          color:"#D97706", bg:"#FEF3C7" },
    { href:"/admin/events",    label:"Events",    sub:"All events",                                                            icon:Calendar,        color:"#EF4444", bg:"#FEF2F2" },
    { href:"/admin/payouts",   label:"Payouts",   sub:"Vendor payouts",                                                        icon:TrendingUp,      color:"#059669", bg:"#D1FAE5" },
    { href:"/admin/support",   label:"Support",   sub:"User tickets & chat",                                                   icon:MessageCircle,   color:"#7B2FBE", bg:"#F3E8FF" },
  ];

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#F7F5FA", maxWidth:480, margin:"0 auto", paddingBottom:40 }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#3D0066 0%,#5B0EA6 100%)", padding:"44px 20px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,200,83,0.15),transparent 70%)" }} />
        <div style={{ position:"relative", zIndex:1 }}>
          <p style={{ color:"rgba(255,255,255,0.6)", fontSize:11, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 }}>Admin</p>
          <h1 style={{ color:"#FFFFFF", fontSize:28, fontWeight:900, margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)", letterSpacing:"-0.02em" }}>CHILLZ</h1>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:12, margin:0 }}>{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
      </div>

      <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* KYC alert */}
        {(stats?.pendingKYC?.length || 0) > 0 && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
            <Link href="/admin/kyc" style={{ textDecoration:"none" }}>
              <div style={{ backgroundColor:"#EDE0F7", border:"1.5px solid #C4A0E8", borderRadius:16, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:11, backgroundColor:"#5B0EA6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Shield size={18} style={{ color:"#FFFFFF" }} />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:800, color:"#3D0066", fontSize:13, margin:0 }}>
                    {stats?.pendingKYC?.length} KYC Application{stats?.pendingKYC?.length !== 1 ? "s" : ""} Pending
                  </p>
                  <p style={{ color:"#7B2FBE", fontSize:11, margin:"2px 0 0" }}>Tap to review and approve vendors</p>
                </div>
                <ChevronRight size={16} style={{ color:"#5B0EA6" }} />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Disputes alert */}
        {(stats?.openDisputes || 0) > 0 && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
            <Link href="/admin/disputes" style={{ textDecoration:"none" }}>
              <div style={{ backgroundColor:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:16, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:11, backgroundColor:"#FEF3C7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <AlertTriangle size={18} style={{ color:"#D97706" }} />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, color:"#92400E", fontSize:13, margin:0 }}>
                    {stats?.openDisputes} open dispute{stats?.openDisputes !== 1 ? "s" : ""}
                  </p>
                  <p style={{ color:"#B45309", fontSize:11, margin:"2px 0 0" }}>Resolve within 8 hours</p>
                </div>
                <ChevronRight size={16} style={{ color:"#D97706" }} />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { label:"Total Users",    value:stats?.totalUsers?.toLocaleString() || "0",   sub:`+${stats?.newUsers || 0} this week`,        icon:Users,     color:"#5B0EA6", bg:"#EDE0F7" },
            { label:"Active Venues",  value:stats?.activeVenues?.toLocaleString() || "0", sub:`${stats?.activeEvents || 0} events live`,    icon:Building2, color:"#7B2FBE", bg:"#F3E8FF" },
            { label:"Total Bookings", value:stats?.totalBookings?.toLocaleString() || "0",sub:`${stats?.completedBookings || 0} completed`, icon:Calendar,  color:"#00C853", bg:"#E0F7EA" },
            { label:"Platform Float", value:formatCurrency(stats?.totalFloat || 0),        sub:"In escrow",                                 icon:Wallet,    color:"#3D0066", bg:"#F2EEF9" },
          ].map(({ label, value, sub, icon:Icon, color, bg }, i) => (
            <motion.div key={label} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i * 0.06 }}
              style={{ backgroundColor:"#FFFFFF", borderRadius:18, padding:"14px", boxShadow:"0 2px 12px rgba(91,14,166,0.06)" }}>
              <div style={{ width:36, height:36, borderRadius:10, backgroundColor:bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p style={{ fontSize:20, fontWeight:900, color:"#0A0A0A", margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>{value}</p>
              <p style={{ fontSize:11, fontWeight:600, color:"#0A0A0A", margin:"0 0 1px" }}>{label}</p>
              <p style={{ fontSize:10, color:"#9E9E9E", margin:0 }}>{sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Revenue chart */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
          style={{ backgroundColor:"#FFFFFF", borderRadius:20, padding:"16px", boxShadow:"0 2px 12px rgba(91,14,166,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div>
              <p style={{ fontWeight:900, fontSize:15, color:"#0A0A0A", margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>Revenue</p>
              <p style={{ fontSize:22, fontWeight:900, color:"#5B0EA6", margin:"2px 0 0", fontFamily:"var(--font-display,Syne,sans-serif)" }}>
                {formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {([7,30] as const).map((p) => (
                <button key={p} onClick={() => setRevenuePeriod(p)}
                  style={{ padding:"5px 12px", borderRadius:999, border:"1.5px solid", borderColor:revenuePeriod===p?"#5B0EA6":"#E4DCF0", backgroundColor:revenuePeriod===p?"#EDE0F7":"#FFFFFF", color:revenuePeriod===p?"#5B0EA6":"#9E9E9E", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  {p}d
                </button>
              ))}
            </div>
          </div>
          <div style={{ height:160, marginTop:12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B0EA6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#5B0EA6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEF9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize:9, fill:"#9E9E9E" }} tickLine={false} axisLine={false} interval={revenuePeriod===7?1:6} />
                <YAxis tick={{ fontSize:9, fill:"#9E9E9E" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#5B0EA6" strokeWidth={2} fill="url(#revenueGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Navigation grid */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
          <p style={{ fontSize:11, fontWeight:700, color:"#9E9E9E", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px 2px" }}>Management</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {navItems.map(({ href, label, sub, icon:Icon, color, bg }) => (
              <Link key={href} href={href} style={{ textDecoration:"none" }}>
                <div style={{ backgroundColor:"#FFFFFF", borderRadius:16, padding:"14px", boxShadow:"0 2px 8px rgba(91,14,166,0.05)", display:"flex", alignItems:"center", gap:10, height:"100%" }}>
                  <div style={{ width:40, height:40, borderRadius:12, backgroundColor:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:13, color:"#0A0A0A", margin:0 }}>{label}</p>
                    <p style={{ fontSize:11, color:"#9E9E9E", margin:"1px 0 0" }}>{sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent bookings */}
        {stats?.recentBookings && stats.recentBookings.length > 0 && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            style={{ backgroundColor:"#FFFFFF", borderRadius:20, padding:"16px", boxShadow:"0 2px 12px rgba(91,14,166,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <p style={{ fontWeight:800, fontSize:15, color:"#0A0A0A", margin:0, fontFamily:"var(--font-display,Syne,sans-serif)" }}>Recent Bookings</p>
              <Link href="/admin/splits" style={{ fontSize:12, fontWeight:700, color:"#5B0EA6", textDecoration:"none", display:"flex", alignItems:"center", gap:3 }}>
                View all <ChevronRight size={13} />
              </Link>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {stats.recentBookings.map((b: any) => {
                const statusColors: Record<string,string> = { completed:"#00C853", confirmed:"#5B0EA6", disputed:"#D97706", cancelled:"#EF4444", receipt_sent:"#F59E0B", pending:"#9E9E9E" };
                const color = statusColors[b.status] || "#9E9E9E";
                const displayAmount = b.receipts?.[0]?.subtotal ?? b.final_amount ?? b.reserved_amount;
                return (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #F7F5FA" }}>
                    <div>
                      <p style={{ fontSize:12, fontWeight:600, color:"#0A0A0A", margin:"0 0 2px" }}>#{b.id.slice(0,8).toUpperCase()}</p>
                      <p style={{ fontSize:10, color:"#9E9E9E", margin:0 }}>{format(new Date(b.created_at), "dd MMM · HH:mm")}</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#5B0EA6", margin:"0 0 2px", fontFamily:"var(--font-display,Syne,sans-serif)" }}>
                        {formatCurrency(displayAmount)}
                      </p>
                      <span style={{ fontSize:9, fontWeight:700, color, backgroundColor:`${color}18`, padding:"1px 7px", borderRadius:999 }}>
                        {b.status.replace(/_/g," ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}