/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Search, X, MapPin,
  Zap, Compass, ChevronDown, SlidersHorizontal,
  Heart, Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { format, isToday, isThisWeek, startOfDay } from "date-fns";
import { useAuthStore } from "@/store/auth";

const NIGERIAN_STATES = [
  "All","Lagos","FCT","Rivers","Kano","Ogun","Oyo","Delta","Enugu",
  "Edo","Imo","Anambra","Cross River","Kaduna","Kwara","Katsina",
  "Benue","Plateau","Bayelsa","Ekiti","Osun","Ondo","Abia",
  "Ebonyi","Akwa Ibom","Taraba","Niger","Sokoto","Kebbi",
  "Adamawa","Gombe","Yobe","Borno","Zamfara","Jigawa","Nasarawa","Bauchi",
];

// Full original tag list — used ONLY for filtering, never on cards
const POPULAR_CATEGORIES = [
  { id:"Party / Rave", emoji:"🎉" },
  { id:"Festival", emoji:"🎪" },
  { id:"Concert / Live Performance", emoji:"🎤" },
  { id:"Game Night / Movie Night", emoji:"🎮" },
  { id:"Dinner / Gala Night", emoji:"🍽️" },
  { id:"Networking Event", emoji:"🤝" },
];
const EXPLORE_CATEGORIES = [
  { id:"Workshop / Training", emoji:"📚" },
  { id:"Community Meetup", emoji:"👥" },
  { id:"Seminar / Webinar", emoji:"💡" },
  { id:"Cultural Event", emoji:"🎭" },
  { id:"Product Launch", emoji:"🚀" },
  { id:"Conference / Summit", emoji:"🏆" },
  { id:"Panel Discussion / Fireside Chat", emoji:"🗣️" },
  { id:"Exhibition / Trade Fair", emoji:"🖼️" },
  { id:"Meet & Greet", emoji:"👋" },
  { id:"Others", emoji:"✨" },
];

// Small fixed list — what vendors pick as the ONE card-visible event_type
const EVENT_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  "Rave/Party":           { color: "#EF4444", bg: "#FEF2F2" },
  "Concert":              { color: "#5B0EA6", bg: "#EDE0F7" },
  "Comedy Show":          { color: "#F59E0B", bg: "#FFF8E1" },
  "Seminar/Conference":   { color: "#2563EB", bg: "#EFF6FF" },
  "Networking":           { color: "#059669", bg: "#E0F7EA" },
  "Festival":             { color: "#7B2FBE", bg: "#F3E8FF" },
  "Sports Viewing":       { color: "#0D9488", bg: "#CCFBF1" },
  "Pop-up/Market":        { color: "#DB2777", bg: "#FDF2F8" },
  "Other":                { color: "#6B6B6B", bg: "#F2EEF9" },
};

const DATE_OPTIONS = [
  { label:"All dates", value:null },
  { label:"Today", value:"today" },
  { label:"This Weekend", value:"this_weekend" },
  { label:"This Week", value:"this_week" },
  { label:"Next Week", value:"next_week" },
  { label:"This Month", value:"this_month" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Party / Rave":               ["party","rave","club night","fiesta"],
  "Festival":                   ["festival","fest","carnival"],
  "Concert / Live Performance": ["concert","live","performance","show","music"],
  "Game Night / Movie Night":   ["game","movie","film","cinema","trivia"],
  "Dinner / Gala Night":        ["dinner","gala","banquet","award"],
  "Networking Event":           ["networking","connect","mixer","b2b"],
  "Workshop / Training":        ["workshop","training","masterclass","skill","course","class"],
  "Community Meetup":           ["community","meetup","hangout","gathering"],
  "Seminar / Webinar":          ["seminar","webinar","talk","lecture"],
  "Cultural Event":             ["cultural","culture","art","heritage","fashion"],
  "Product Launch":             ["launch","product","brand","unveil"],
  "Conference / Summit":        ["conference","summit","congress","expo"],
  "Panel Discussion / Fireside Chat": ["panel","fireside","discussion","debate"],
  "Exhibition / Trade Fair":    ["exhibition","trade","fair","showcase","market"],
  "Meet & Greet":               ["meet","greet","fan"],
};

function haversineKm(la1:number,ln1:number,la2:number,ln2:number){
  const R=6371,dL=((la2-la1)*Math.PI)/180,dN=((ln2-ln1)*Math.PI)/180;
  const a=Math.sin(dL/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function rankScore(ev: any): number {
  let score = 0;
  const isOrganizerPost = !!ev.organizer_vendor_id;
  score += isOrganizerPost ? 150 : 100;
  if (ev.is_featured) score += 500;
  const hoursSincePosted = (Date.now() - new Date(ev.created_at).getTime()) / 3600000;
  const recencyScore = Math.max(0, 80 - hoursSincePosted / 4.2);
  score += recencyScore;
  const hoursUntilEvent = (new Date(ev.start_date).getTime() - Date.now()) / 3600000;
  if (hoursUntilEvent <= 168) {
    const proximityScore = 60 - Math.abs(hoursUntilEvent - 48) / 4;
    score += Math.max(0, proximityScore);
  }
  const ticketsSold = ev.tickets_sold || 0;
  if (ticketsSold > 0 && hoursSincePosted > 0) {
    const velocity = ticketsSold / Math.max(1, hoursSincePosted);
    score += Math.min(40, velocity * 20);
  }
  return score;
}

function RangeSlider({ min,max,value,onChange,formatLabel,step=1 }: {
  min:number;max:number;value:[number,number];
  onChange:(v:[number,number])=>void;
  formatLabel:(v:number)=>string;step?:number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min"|"max"|null>(null);
  const pct = (v:number) => ((v-min)/(max-min))*100;
  const getVal = (clientX:number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if(!rect) return min;
    const ratio = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    return Math.round((min+ratio*(max-min))/step)*step;
  };
  const onDown = (which:"min"|"max") => (e:React.PointerEvent) => {
    dragging.current=which; (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e:React.PointerEvent) => {
    if(!dragging.current) return;
    const v=getVal(e.clientX);
    if(dragging.current==="min") onChange([Math.min(v,value[1]-step),value[1]]);
    else onChange([value[0],Math.max(v,value[0]+step)]);
  };
  const onUp = () => { dragging.current=null; };
  const thumb:React.CSSProperties = { position:"absolute",top:"50%",transform:"translate(-50%,-50%)",width:24,height:24,borderRadius:"50%",backgroundColor:"#FFFFFF",border:"2.5px solid #5B0EA6",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",cursor:"grab",zIndex:2,touchAction:"none" };
  return (
    <div style={{ padding:"8px 0 20px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
        <span style={{ fontSize:13,fontWeight:700,color:"#5B0EA6" }}>{formatLabel(value[0])}</span>
        <span style={{ fontSize:13,fontWeight:700,color:"#5B0EA6" }}>{formatLabel(value[1])}</span>
      </div>
      <div ref={trackRef} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ position:"relative",height:6,borderRadius:999,backgroundColor:"#E4DCF0",userSelect:"none" }}>
        <div style={{ position:"absolute",height:"100%",borderRadius:999,backgroundColor:"#5B0EA6",left:`${pct(value[0])}%`,width:`${pct(value[1])-pct(value[0])}%` }}/>
        <div style={{ ...thumb,left:`${pct(value[0])}%` }} onPointerDown={onDown("min")}/>
        <div style={{ ...thumb,left:`${pct(value[1])}%` }} onPointerDown={onDown("max")}/>
      </div>
    </div>
  );
}

interface Filters {
  dateQuick: string|null; dateFrom: string; dateTo: string;
  city: string; categories: string[]; eventType: string|null;
  budgetRange: [number,number]; distanceKm: number;
}
const DEFAULT:Filters = {
  dateQuick:null,dateFrom:"",dateTo:"",city:"All",
  categories:[],eventType:null,budgetRange:[0,500000],distanceKm:100,
};

function LocationPill({ onCityResolved }: { onCityResolved:(city:string)=>void }) {
  const [display, setDisplay] = useState("Lagos");
  const [detecting, setDetecting] = useState(false);
  useEffect(() => {
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        const data = await res.json();
        const loc = (data.location || "Lagos").split(",")[0].trim();
        setDisplay(loc); onCityResolved(loc);
      } catch { setDisplay("Lagos"); onCityResolved("Lagos"); }
      finally { setDetecting(false); }
    }, () => { setDisplay("Lagos"); onCityResolved("Lagos"); setDetecting(false); });
  }, []);
  return (
    <div style={{ display:"flex",alignItems:"center",gap:5,cursor:"pointer" }}>
      <MapPin size={13} style={{ color:"#5B0EA6",flexShrink:0 }} strokeWidth={2.5}/>
      <span style={{ fontSize:12,fontWeight:700,color:"#0A0A0A",maxWidth:90,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis" }}>
        {detecting ? "..." : display}
      </span>
      <ChevronDown size={12} style={{ color:"#9E9E9E",flexShrink:0 }}/>
    </div>
  );
}

// ── Grid event card — FIXED dimensions, no expanding ─────────────────────
function EventGridCard({ ev }: { ev: any }) {
  const typeStyle = EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS["Other"];
  const hasTicketTypes = ev.ticket_types && ev.ticket_types.length > 0;
  const minPrice = hasTicketTypes
    ? Math.min(...ev.ticket_types.map((t: any) => t.price || 0))
    : (ev.ticket_price || 0);
  const isFree = minPrice === 0;
  const isOrganizerPost = !!ev.organizer_vendor_id;

  return (
    <Link href={`/events/${ev.id}`} style={{ textDecoration: "none", display: "block", width: "100%" }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(91,14,166,0.08)", border: "1px solid #F2EEF9", width: "100%" }}>

        <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", backgroundColor: "#EDE0F7", overflow: "hidden" }}>
          {ev.images?.[0] ? (
            <img src={ev.images[0]} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#3D0066,#5B0EA6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={28} style={{ color: "rgba(255,255,255,0.4)" }} />
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.7) 100%)" }} />

          <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
            {ev.event_type && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: typeStyle.color, backgroundColor: typeStyle.bg,
                padding: "3px 8px", borderRadius: 999, maxWidth: "65%",
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", display: "block",
              }}>
                {ev.event_type}
              </span>
            )}
            <div style={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 8, padding: "3px 7px", textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: "#5B0EA6", margin: 0, lineHeight: 1.1, textTransform: "uppercase" }}>
                {format(new Date(ev.start_date), "MMM")}
              </p>
              <p style={{ fontSize: 13, fontWeight: 900, color: "#0A0A0A", margin: 0, lineHeight: 1.1, fontFamily: "var(--font-display,Syne,sans-serif)" }}>
                {format(new Date(ev.start_date), "d")}
              </p>
            </div>
          </div>

          {ev.is_featured && (
            <div style={{ position: "absolute", top: 38, left: 8 }}>
              <span style={{ backgroundColor: "#00C853", color: "#FFFFFF", fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 999 }}>Featured</span>
            </div>
          )}

          <div style={{ position: "absolute", bottom: 6, left: 8, right: 8 }}>
            <p style={{
              color: "#FFFFFF", fontWeight: 800, fontSize: 12, margin: 0, lineHeight: 1.3,
              fontFamily: "var(--font-display,Syne,sans-serif)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {ev.title}
            </p>
          </div>
        </div>

        <div style={{ padding: "8px 10px 10px" }}>
          {ev.address && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 6 }}>
              <MapPin size={9} style={{ color: "#9E9E9E", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#9E9E9E", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 }}>{ev.address}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: isFree ? "#00C853" : "#5B0EA6", fontFamily: "var(--font-display,Syne,sans-serif)", whiteSpace: "nowrap" }}>
              {isFree ? "Free" : `From ${formatCurrency(minPrice)}`}
            </span>
            {isOrganizerPost && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <Star size={9} style={{ color: "#5B0EA6", fill: "#5B0EA6" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: "#5B0EA6", whiteSpace: "nowrap" }}>Organizer</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const searchRef = useRef<HTMLInputElement>(null);

  const [showSearch, setShowSearch]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [filters, setFilters]             = useState<Filters>({ ...DEFAULT });
  const [showFilter, setShowFilter]       = useState(false);
  const [showSaved, setShowSaved]         = useState(false);
  const [quickToday, setQuickToday]       = useState(false);
  const [quickWeekend, setQuickWeekend]   = useState(false);
  const [nearMe, setNearMe]               = useState(false);
  const [userLat, setUserLat]             = useState<number|null>(null);
  const [userLng, setUserLng]             = useState<number|null>(null);
  const [userCity, setUserCity]           = useState("Lagos");
  const [localF, setLocalF]               = useState<Filters>({ ...DEFAULT });

  const openFilter = () => { setLocalF({ ...filters }); setShowFilter(true); };
  const applyFilter = () => { setFilters({ ...localF }); setShowFilter(false); };

  const clearAll = () => {
    setFilters({ ...DEFAULT }); setSearchQuery(""); setQuickToday(false);
    setQuickWeekend(false); setNearMe(false); setShowSaved(false);
  };

  const { data:allEvents, isLoading } = useQuery({
    queryKey:["events-full"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*")
        .eq("is_active",true)
        .order("start_date",{ascending:true})
        .limit(200);
      return (data||[]) as any[];
    },
    staleTime:1000*30,
  });

  const { data:savedEventIds } = useQuery({
    queryKey:["saved-events",user?.id],
    queryFn: async () => {
      if(!user?.id) return [];
      const { data } = await (supabase.from("saved_events") as any)
        .select("event_id").eq("user_id",user.id);
      return (data||[]).map((r:any)=>r.event_id) as string[];
    },
    enabled:!!user?.id,
    staleTime:1000*60,
  });

  const now = new Date();
  const isWeekend = (d:Date) => { const day=d.getDay(); return day===0||day===5||day===6; };

  const matchesCategory = (event:any, cat:string) => {
    if((event.event_tags||[]).includes(cat)) return true;
    const keywords = CATEGORY_KEYWORDS[cat] || [];
    const text = `${event.title||""} ${event.description||""}`.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  };

  const filteredRaw = (allEvents||[]).filter((ev:any) => {
    // ── ALWAYS exclude expired events from default browsing ──
    if (new Date(ev.start_date) < now && !showSaved) return false;

    if(showSaved) {
      if(!(savedEventIds||[]).includes(ev.id)) return false;
    }
    if(searchQuery.trim()){
      const q=searchQuery.toLowerCase();
      if(!ev.title?.toLowerCase().includes(q)&&!ev.address?.toLowerCase().includes(q)&&!ev.description?.toLowerCase().includes(q))return false;
    }
    if(quickToday && !isToday(new Date(ev.start_date))) return false;
    if(quickWeekend && !isWeekend(new Date(ev.start_date))) return false;
    if(nearMe && userLat && userLng) {
      if(!ev.lat||!ev.lng) return false;
      if(haversineKm(userLat,userLng,ev.lat,ev.lng)>30) return false;
    }
    if(filters.dateQuick==="today" && !isToday(new Date(ev.start_date))) return false;
    if(filters.dateQuick==="this_week" && !isThisWeek(new Date(ev.start_date),{weekStartsOn:1})) return false;
    if(filters.dateQuick==="this_weekend"){const d=new Date(ev.start_date);const day=d.getDay();if(day!==0&&day!==6&&day!==5)return false;}
    if(filters.dateQuick==="next_week"){
      const d=new Date(ev.start_date);
      const nw=new Date(now);nw.setDate(now.getDate()+(7-now.getDay()+1)%7||7);
      const ne=new Date(nw);ne.setDate(nw.getDate()+6);
      if(d<nw||d>ne)return false;
    }
    if(filters.dateQuick==="this_month"){const d=new Date(ev.start_date);if(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear())return false;}
    if(filters.dateQuick==="custom"){
      if(filters.dateFrom&&new Date(ev.start_date)<startOfDay(new Date(filters.dateFrom)))return false;
      if(filters.dateTo&&new Date(ev.start_date)>new Date(filters.dateTo+"T23:59:59"))return false;
    }
    if(filters.city!=="All"&&!ev.address?.toLowerCase().includes(filters.city.toLowerCase()))return false;
    if(filters.budgetRange[0]>0||filters.budgetRange[1]<500000){
      const price=ev.ticket_price||(ev.ticket_types?.[0]?.price??0);
      if(price<filters.budgetRange[0]||price>filters.budgetRange[1])return false;
    }
    if(filters.distanceKm<100&&userLat&&userLng&&ev.lat&&ev.lng){
      if(haversineKm(userLat,userLng,ev.lat,ev.lng)>filters.distanceKm)return false;
    }
    // Categories filter now reads event_tags (full 16-list, never card-visible)
    if(filters.categories.length>0){
      if(!filters.categories.some(cat=>matchesCategory(ev,cat)))return false;
    }
    if(filters.eventType==="free"&&(ev.ticket_price||0)>0)return false;
    if(filters.eventType==="paid"&&(ev.ticket_price||0)===0)return false;
    return true;
  });

  const events = [...filteredRaw].sort((a, b) => rankScore(b) - rankScore(a));

  const thisWeekendEvents = events.filter((ev: any) => isWeekend(new Date(ev.start_date))).slice(0, 6);
  const organizerEvents   = events.filter((ev: any) => !!ev.organizer_vendor_id).slice(0, 6);
  const venueEvents       = events.filter((ev: any) => !ev.organizer_vendor_id).slice(0, 6);

  const filterActive = filters.dateQuick!==null||filters.city!=="All"||filters.categories.length>0||filters.eventType!==null||filters.budgetRange[0]>0||filters.budgetRange[1]<500000||filters.distanceKm<100;
  const anyActive    = filterActive||searchQuery.trim()!=""||quickToday||quickWeekend||nearMe||showSaved;

  const pill = (active:boolean, color="#5B0EA6", bg="#EDE0F7"):React.CSSProperties => ({
    display:"flex",alignItems:"center",gap:5,padding:"7px 13px",
    borderRadius:999,border:"1.5px solid",
    borderColor:active?color:"#E4DCF0",
    backgroundColor:active?bg:"#F7F5FA",
    cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const,
    fontSize:12,fontWeight:active?700:600,color:active?color:"#6B6B6B",
  });

  const renderGrid = (list: any[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {list.map((ev: any, i: number) => (
        <motion.div key={ev.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}} style={{ width: "100%" }}>
          <EventGridCard ev={ev} />
        </motion.div>
      ))}
    </div>
  );

  return (
    <MainLayout>
      <div style={{ backgroundColor:"#FFFFFF",position:"sticky",top:0,zIndex:40,borderBottom:showFilter?"none":"1px solid #F2EEF9",boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 8px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button onClick={()=>router.back()} style={{ background:"none",border:"none",cursor:"pointer",padding:6,marginLeft:-6,display:"flex" }}>
              <ArrowLeft size={22} style={{ color:"#0A0A0A" }}/>
            </button>
            <div>
              <h1 style={{ fontSize:20,fontWeight:900,color:"#0A0A0A",margin:0,fontFamily:"var(--font-display,Syne,sans-serif)" }}>🎵 Events</h1>
              <p style={{ fontSize:11,color:"#9E9E9E",margin:0 }}>
                {isLoading?"Loading...":`${events.length} event${events.length!==1?"s":""} found`}
              </p>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {anyActive && (
              <button onClick={clearAll} style={{ display:"flex",alignItems:"center",gap:4,background:"none",border:"1px solid #FECACA",borderRadius:999,padding:"4px 10px",cursor:"pointer" }}>
                <X size={10} style={{ color:"#EF4444" }}/><span style={{ fontSize:11,fontWeight:700,color:"#EF4444" }}>Clear</span>
              </button>
            )}
            <LocationPill onCityResolved={(city)=>{
              setUserCity(city);
              navigator.geolocation?.getCurrentPosition((pos)=>{setUserLat(pos.coords.latitude);setUserLng(pos.coords.longitude);},()=>{});
            }}/>
          </div>
        </div>

        <div style={{ display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto",scrollbarWidth:"none" }}>
          <button onClick={openFilter} style={pill(filterActive||showFilter)}>
            <SlidersHorizontal size={13}/>Filter
            {filterActive&&<div style={{ width:6,height:6,borderRadius:"50%",backgroundColor:"#5B0EA6" }}/>}
          </button>
          <button onClick={()=>setShowSaved(!showSaved)} style={pill(showSaved,"#FF4B6E","#FFF0F3")}>
            <Heart size={13} style={{ fill:showSaved?"#FF4B6E":"none" }}/>
            {user?"My Events":"Saved"}
          </button>
          <button onClick={()=>{setQuickToday(!quickToday);if(quickWeekend)setQuickWeekend(false);}} style={pill(quickToday,"#EF4444","#FFF0F0")}>
            <Zap size={13}/>Today
          </button>
          <button onClick={()=>{setQuickWeekend(!quickWeekend);if(quickToday)setQuickToday(false);}} style={pill(quickWeekend)}>
            📅 Weekend
          </button>
          <button onClick={()=>{
            setNearMe(!nearMe);
            if(!nearMe) navigator.geolocation?.getCurrentPosition((pos)=>{setUserLat(pos.coords.latitude);setUserLng(pos.coords.longitude);},()=>{});
          }} style={pill(nearMe)}>
            <MapPin size={13}/>Near Me
          </button>
          <button onClick={()=>{setShowSearch(!showSearch);setTimeout(()=>searchRef.current?.focus(),100);}} style={pill(showSearch||!!searchQuery)}>
            <Search size={13}/>Search
          </button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
              <div style={{ padding:"0 16px 12px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,backgroundColor:"#F7F5FA",border:"1.5px solid #5B0EA6",borderRadius:14,padding:"11px 14px" }}>
                  <Search size={15} style={{ color:"#5B0EA6" }}/>
                  <input ref={searchRef} type="text" placeholder="Search events, artists, venues..."
                    value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                    style={{ flex:1,background:"transparent",border:"none",outline:"none",fontSize:14,color:"#0A0A0A",fontFamily:"inherit" }}/>
                  {searchQuery&&<button onClick={()=>setSearchQuery("")} style={{ background:"none",border:"none",cursor:"pointer" }}><X size={14} style={{ color:"#9E9E9E" }}/></button>}
                  <button onClick={()=>{setShowSearch(false);setSearchQuery("");}} style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#5B0EA6",padding:"0 0 0 4px",flexShrink:0 }}>Done</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Original filter panel — full 16-category list, unchanged ── */}
        <AnimatePresence>
          {showFilter && (
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={applyFilter}
                style={{ position:"fixed",inset:0,zIndex:38,backgroundColor:"rgba(0,0,0,0.25)" }}/>
              <motion.div initial={{y:-12,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-12,opacity:0}}
                transition={{type:"spring",damping:30,stiffness:350}}
                style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:39,backgroundColor:"#FFFFFF",borderRadius:"0 0 24px 24px",boxShadow:"0 12px 40px rgba(0,0,0,0.12)",maxHeight:"72vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>

                <div style={{ flex:1,overflowY:"auto",padding:"20px 20px 0" }}>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                      <p style={{ fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0 }}>Date</p>
                      <button onClick={()=>setLocalF(p=>({...p,dateQuick:null,dateFrom:"",dateTo:""}))} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:14 }}>
                      {DATE_OPTIONS.map(opt=>(
                        <button key={opt.label} onClick={()=>setLocalF(p=>({...p,dateQuick:opt.value,dateFrom:"",dateTo:""}))}
                          style={{ padding:"8px 14px",borderRadius:999,border:"1.5px solid",borderColor:localF.dateQuick===opt.value?"#5B0EA6":"#E4DCF0",backgroundColor:localF.dateQuick===opt.value?"#EDE0F7":"#FFFFFF",color:localF.dateQuick===opt.value?"#5B0EA6":"#6B6B6B",fontSize:12,fontWeight:localF.dateQuick===opt.value?700:500,cursor:"pointer" }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:"flex",gap:10 }}>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:11,color:"#9E9E9E",fontWeight:600,margin:"0 0 4px" }}>From</p>
                        <div style={{ display:"flex",alignItems:"center",gap:8,backgroundColor:"#F7F5FA",border:"1.5px solid #E4DCF0",borderRadius:12,padding:"10px 12px" }}>
                          <Calendar size={13} style={{ color:"#9E9E9E" }}/>
                          <input type="date" value={localF.dateFrom} onChange={e=>setLocalF(p=>({...p,dateFrom:e.target.value,dateQuick:"custom"}))} style={{ flex:1,background:"transparent",border:"none",outline:"none",fontSize:12,color:"#0A0A0A",fontFamily:"inherit" }}/>
                        </div>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:11,color:"#9E9E9E",fontWeight:600,margin:"0 0 4px" }}>To</p>
                        <div style={{ display:"flex",alignItems:"center",gap:8,backgroundColor:"#F7F5FA",border:"1.5px solid #E4DCF0",borderRadius:12,padding:"10px 12px" }}>
                          <Calendar size={13} style={{ color:"#9E9E9E" }}/>
                          <input type="date" value={localF.dateTo} onChange={e=>setLocalF(p=>({...p,dateTo:e.target.value,dateQuick:"custom"}))} style={{ flex:1,background:"transparent",border:"none",outline:"none",fontSize:12,color:"#0A0A0A",fontFamily:"inherit" }}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                      <p style={{ fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0 }}>City / State</p>
                      <button onClick={()=>setLocalF(p=>({...p,city:"All"}))} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                      {NIGERIAN_STATES.slice(0,12).map(s=>(
                        <button key={s} onClick={()=>setLocalF(p=>({...p,city:s}))}
                          style={{ padding:"7px 14px",borderRadius:999,border:"1.5px solid",borderColor:localF.city===s?"#5B0EA6":"#E4DCF0",backgroundColor:localF.city===s?"#EDE0F7":"#FFFFFF",color:localF.city===s?"#5B0EA6":"#6B6B6B",fontSize:12,fontWeight:localF.city===s?700:500,cursor:"pointer" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                      <p style={{ fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0 }}>Category</p>
                      <button onClick={()=>setLocalF(p=>({...p,categories:[]}))} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444" }}>Clear</button>
                    </div>
                    <p style={{ fontSize:12,fontWeight:700,color:"#6B6B6B",margin:"0 0 8px",display:"flex",alignItems:"center",gap:5 }}><Zap size={13} style={{ color:"#F59E0B" }}/>Popular</p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:14 }}>
                      {POPULAR_CATEGORIES.map(({id,emoji})=>{
                        const on=localF.categories.includes(id);
                        return<button key={id} onClick={()=>setLocalF(p=>({...p,categories:on?p.categories.filter(c=>c!==id):[...p.categories,id]}))}
                          style={{ padding:"8px 14px",borderRadius:999,border:"1.5px solid",borderColor:on?"#5B0EA6":"#E4DCF0",backgroundColor:on?"#EDE0F7":"#FFFFFF",color:on?"#5B0EA6":"#3A3A3A",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                          <span>{emoji}</span>{id}
                        </button>;
                      })}
                    </div>
                    <p style={{ fontSize:12,fontWeight:700,color:"#6B6B6B",margin:"0 0 8px",display:"flex",alignItems:"center",gap:5 }}><Compass size={13} style={{ color:"#5B0EA6" }}/>Explore</p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                      {EXPLORE_CATEGORIES.map(({id,emoji})=>{
                        const on=localF.categories.includes(id);
                        return<button key={id} onClick={()=>setLocalF(p=>({...p,categories:on?p.categories.filter(c=>c!==id):[...p.categories,id]}))}
                          style={{ padding:"8px 14px",borderRadius:999,border:"1.5px solid",borderColor:on?"#5B0EA6":"#E4DCF0",backgroundColor:on?"#EDE0F7":"#FFFFFF",color:on?"#5B0EA6":"#3A3A3A",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                          <span>{emoji}</span>{id}
                        </button>;
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                      <p style={{ fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0 }}>Ticket Type</p>
                      <button onClick={()=>setLocalF(p=>({...p,eventType:null}))} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444" }}>Clear</button>
                    </div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                      {[{label:"Free",val:"free"},{label:"Paid",val:"paid"},{label:"Online",val:"online"},{label:"In-Person",val:"in_person"}].map(t=>(
                        <button key={t.val} onClick={()=>setLocalF(p=>({...p,eventType:p.eventType===t.val?null:t.val}))}
                          style={{ padding:"8px 16px",borderRadius:999,border:"1.5px solid",borderColor:localF.eventType===t.val?"#5B0EA6":"#E4DCF0",backgroundColor:localF.eventType===t.val?"#EDE0F7":"#FFFFFF",color:localF.eventType===t.val?"#5B0EA6":"#6B6B6B",fontSize:12,fontWeight:localF.eventType===t.val?700:500,cursor:"pointer" }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                      <p style={{ fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0 }}>Budget Range</p>
                      <button onClick={()=>setLocalF(p=>({...p,budgetRange:[0,500000]}))} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444" }}>Reset</button>
                    </div>
                    <RangeSlider min={0} max={500000} step={1000}
                      value={localF.budgetRange}
                      onChange={v=>setLocalF(p=>({...p,budgetRange:v}))}
                      formatLabel={v=>v===0?"Free":v>=500000?"₦500k+":v>=1000?`₦${(v/1000).toFixed(0)}k`:`₦${v}`}
                    />
                  </div>

                </div>

                <div style={{ padding:"12px 20px 24px",borderTop:"1px solid #F2EEF9",flexShrink:0 }}>
                  <button onClick={applyFilter}
                    style={{ width:"100%",padding:"15px 0",borderRadius:16,border:"none",backgroundColor:"#0A0A0A",color:"#FFFFFF",fontSize:15,fontWeight:700,cursor:"pointer" }}>
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div style={{ padding:"16px" }}>
        {isLoading ? (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} style={{ width:"100%",aspectRatio:"4/5",borderRadius:18,backgroundColor:"#F2EEF9" }}/>
            ))}
          </div>
        ) : events.length===0 ? (
          <div style={{ textAlign:"center",paddingTop:80 }}>
            <motion.div animate={{y:[0,-8,0]}} transition={{duration:3,repeat:Infinity,ease:"easeInOut"}}
              style={{ width:64,height:64,borderRadius:20,backgroundColor:"#EDE0F7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
              <Calendar size={28} style={{ color:"#5B0EA6" }}/>
            </motion.div>
            <p style={{ fontWeight:800,fontSize:16,color:"#0A0A0A",margin:"0 0 6px",fontFamily:"var(--font-display,Syne,sans-serif)" }}>
              {showSaved?"No saved events yet":"No events found"}
            </p>
            <p style={{ fontSize:13,color:"#9E9E9E",margin:"0 0 20px" }}>
              {showSaved?"Tap the heart on any event to save it":"Try adjusting your filters"}
            </p>
            <button onClick={clearAll}
              style={{ padding:"10px 28px",borderRadius:12,border:"none",backgroundColor:"#5B0EA6",color:"#FFFFFF",fontSize:13,fontWeight:700,cursor:"pointer" }}>
              Clear filters
            </button>
          </div>
        ) : showSaved || anyActive ? (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <p style={{ fontSize:12,color:"#9E9E9E",fontWeight:600,margin:0 }}>
              {events.length} event{events.length!==1?"s":""}
              {showSaved?" · Saved":""}
              {anyActive&&!showSaved?" · Filtered":""}
            </p>
            {renderGrid(events)}
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:24 }}>

            {thisWeekendEvents.length>0 && (
              <div>
                <div style={{ marginBottom:12 }}>
                  <h2 style={{ fontSize:17,fontWeight:800,color:"#0A0A0A",margin:"0 0 2px",fontFamily:"var(--font-display,Syne,sans-serif)" }}>📅 This Weekend</h2>
                  <p style={{ fontSize:11,color:"#9E9E9E",margin:0 }}>Don't miss out</p>
                </div>
                {renderGrid(thisWeekendEvents)}
              </div>
            )}

            {organizerEvents.length>0 && (
              <div>
                <div style={{ marginBottom:12 }}>
                  <h2 style={{ fontSize:17,fontWeight:800,color:"#0A0A0A",margin:"0 0 2px",fontFamily:"var(--font-display,Syne,sans-serif)" }}>⭐ From Top Organizers</h2>
                  <p style={{ fontSize:11,color:"#9E9E9E",margin:0 }}>Curated experiences from event specialists</p>
                </div>
                {renderGrid(organizerEvents)}
              </div>
            )}

            {venueEvents.length>0 && (
              <div>
                <div style={{ marginBottom:12 }}>
                  <h2 style={{ fontSize:17,fontWeight:800,color:"#0A0A0A",margin:"0 0 2px",fontFamily:"var(--font-display,Syne,sans-serif)" }}>📍 Happening at Venues</h2>
                  <p style={{ fontSize:11,color:"#9E9E9E",margin:0 }}>Hosted by bars, clubs and restaurants</p>
                </div>
                {renderGrid(venueEvents)}
              </div>
            )}

            <div>
              <div style={{ marginBottom:12 }}>
                <h2 style={{ fontSize:17,fontWeight:800,color:"#0A0A0A",margin:"0 0 2px",fontFamily:"var(--font-display,Syne,sans-serif)" }}>🎵 All Events</h2>
                <p style={{ fontSize:11,color:"#9E9E9E",margin:0 }}>{userCity!=="Lagos"?`In ${userCity}`:"Browse everything"}</p>
              </div>
              {renderGrid(events)}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}