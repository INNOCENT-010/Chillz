/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MainLayout } from "@/components/layout/main-layout";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin, SlidersHorizontal, ChevronDown, ArrowLeft, Heart } from "lucide-react";
import { VenueDiscoverCard } from "@/components/discover/venue-discover-card";
import { useAuthStore } from "@/store/auth";
import { LocationHeader } from "@/components/home/location-header";

const CATEGORY="club"; const CATEGORY_LABEL="Clubs"; const CATEGORY_EMOJI="🎵";
const ACCENT="#5B0EA6"; const ACCENT_BG="#EDE0F7";
const MUSIC_GENRES=["Afrobeats","Amapiano","Hip-Hop","R&B","EDM","House","Reggae","Drill"];
const VIBE_TAGS=["VIP Table","Bottle Service","Rooftop","Live DJ","18+","No Dress Code","Open Bar","Celebrity Night"];
const SPEND_RANGES=[{label:"Free Entry",min:0,max:0},{label:"Under ₦10k",min:1,max:10000},{label:"₦10k–₦50k",min:10000,max:50000},{label:"₦50k+",min:50000,max:999999999}];

function haversineKm(la1:number,ln1:number,la2:number,ln2:number){const R=6371,dL=((la2-la1)*Math.PI)/180,dN=((ln2-ln1)*Math.PI)/180;const a=Math.sin(dL/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

function LocationPill({onCityResolved}:{onCityResolved:(c:string)=>void}){
  const [display,setDisplay]=useState("Lagos");const [detecting,setDetecting]=useState(false);
  useEffect(()=>{setDetecting(true);navigator.geolocation?.getCurrentPosition(async(pos)=>{try{const r=await fetch(`/api/places/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);const d=await r.json();const loc=(d.location||"Lagos").split(",")[0].trim();setDisplay(loc);onCityResolved(loc);}catch{setDisplay("Lagos");onCityResolved("Lagos");}finally{setDetecting(false);}},()=>{setDisplay("Lagos");onCityResolved("Lagos");setDetecting(false);});},[]);
  return(<div style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}><MapPin size={13} style={{color:ACCENT,flexShrink:0}} strokeWidth={2.5}/><span style={{fontSize:12,fontWeight:700,color:"#0A0A0A",maxWidth:90,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{detecting?"...":display}</span><ChevronDown size={12} style={{color:"#9E9E9E",flexShrink:0}}/></div>);
}
function Section({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return(<div style={{marginBottom:28}}><div style={{marginBottom:14}}><h2 style={{fontSize:17,fontWeight:800,color:"#0A0A0A",margin:"0 0 2px",fontFamily:"var(--font-display,Syne,sans-serif)"}}>{title}</h2><p style={{fontSize:11,color:"#9E9E9E",margin:0}}>{subtitle}</p></div>{children}</div>);}

export default function ClubPage(){
  const router=useRouter();const{user}=useAuthStore();
  const [search,setSearch]=useState("");const [showSearch,setShowSearch]=useState(false);const [showFilter,setShowFilter]=useState(false);
  const [showSaved,setShowSaved]=useState(false);const [quickTonight,setQuickTonight]=useState(false);const [quickWeekend,setQuickWeekend]=useState(false);
  const [nearMe,setNearMe]=useState(false);const [userLat,setUserLat]=useState<number|null>(null);const [userLng,setUserLng]=useState<number|null>(null);const [userCity,setUserCity]=useState("Lagos");
  const [genres,setGenres]=useState<string[]>([]);const [vibes,setVibes]=useState<string[]>([]);const [spendIdx,setSpendIdx]=useState<number|null>(null);
  const [appliedGenres,setAppliedGenres]=useState<string[]>([]);const [appliedVibes,setAppliedVibes]=useState<string[]>([]);const [appliedSpend,setAppliedSpend]=useState<number|null>(null);

  const openFilter=()=>{setGenres(appliedGenres);setVibes(appliedVibes);setSpendIdx(appliedSpend);setShowFilter(true);};
  const applyFilter=()=>{setAppliedGenres(genres);setAppliedVibes(vibes);setAppliedSpend(spendIdx);setShowFilter(false);};
  const clearAll=()=>{setSearch("");setQuickTonight(false);setQuickWeekend(false);setNearMe(false);setShowSaved(false);setAppliedGenres([]);setAppliedVibes([]);setAppliedSpend(null);};

  const PAGE_SIZE = 20;
  const [allVenues,      setAllVenues]      = useState<any[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore,        setHasMore]        = useState(true);
  const [phase,          setPhase]          = useState<"neighbourhood"|"city"|"national">("neighbourhood");
  const [phasePageNum,   setPhasePageNum]   = useState(0);
  const [seenIds,        setSeenIds]        = useState<Set<string>>(new Set());
  const [showNationalDivider, setShowNationalDivider] = useState(false);
  const [menuPrices,     setMenuPrices]     = useState<Record<string,number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  function parseLocation(loc: string): { neighbourhood: string | null; city: string | null } {
    if (!loc || loc === "__everywhere__") return { neighbourhood: null, city: null };
    const parts = loc.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) return { neighbourhood: null, city: parts[0] };
    return { neighbourhood: parts[0], city: parts[1] };
  }

  const fetchPhase = async (
    currentPhase: "neighbourhood"|"city"|"national",
    pageNum: number,
    city: string,
    currentSeenIds: Set<string>
  ) => {
    const from = pageNum * PAGE_SIZE;
    const { neighbourhood, city: cityName } = parseLocation(city);
    let query = (supabase.from("venues") as any)
      .select("*,google_data")
      .eq("is_active", true)
      .eq("category", CATEGORY)
      .order("rating", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (currentPhase === "neighbourhood" && neighbourhood) {
      query = query.or(`address.ilike.%${neighbourhood}%,city.ilike.%${neighbourhood}%`);
    } else if (currentPhase === "city" && cityName) {
      query = query.or(`address.ilike.%${cityName}%,city.ilike.%${cityName}%`);
    }
    const { data } = await query;
    return ((data || []) as any[]).filter((v: any) => !currentSeenIds.has(v.id));
  };

  const enrichMenuPrices = (data: any[]) => {
    const vids = data.filter((v:any) => !v.minimum_spend && v.vendor_id).map((v:any) => v.vendor_id);
    if (vids.length) {
      supabase.from("vendor_menu").select("vendor_id,price").in("vendor_id", vids).eq("is_available", true)
        .then(({ data: md }) => {
          const map: Record<string,number> = {};
          (md||[]).forEach((i:any) => { if (!map[i.vendor_id]||i.price<map[i.vendor_id]) map[i.vendor_id]=i.price; });
          setMenuPrices(prev => ({ ...prev, ...map }));
        });
    }
  };

  const initFetch = async (city: string) => {
    setIsLoading(true);
    setAllVenues([]);
    setSeenIds(new Set());
    setShowNationalDivider(false);
    const { neighbourhood, city: cityName } = parseLocation(city);
    const startPhase: "neighbourhood"|"city"|"national" =
      !neighbourhood && !cityName ? "national" : neighbourhood ? "neighbourhood" : "city";
    setPhase(startPhase);
    setPhasePageNum(0);
    const data = await fetchPhase(startPhase, 0, city, new Set());
    setAllVenues(data);
    setSeenIds(new Set(data.map((v:any) => v.id)));
    setHasMore(data.length === PAGE_SIZE || (data.length < PAGE_SIZE && startPhase !== "national"));
    setIsLoading(false);
    enrichMenuPrices(data);
  };

  useEffect(() => { initFetch(userCity); }, [userCity]);

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const { neighbourhood, city: cityName } = parseLocation(userCity);
    let currentPhase: "neighbourhood" | "city" | "national" = phase;
    let currentPageNum = phasePageNum + 1;
    let data = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
    if (data.length < PAGE_SIZE) {
      if (currentPhase === "neighbourhood" && cityName) {
        currentPhase = "city"; currentPageNum = 0;
        data = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
      } else if (currentPhase !== "national") {
        currentPhase = "national"; currentPageNum = 0;
        setShowNationalDivider(true);
        data = await fetchPhase(currentPhase, currentPageNum, userCity, seenIds);
      }
    }
    if (data.length > 0) {
      setAllVenues(prev => [...prev, ...data]);
      setSeenIds(prev => { const s = new Set(prev); data.forEach((v:any) => s.add(v.id)); return s; });
      enrichMenuPrices(data);
    }
    setPhase(currentPhase);
    setPhasePageNum(currentPageNum);
    setHasMore(data.length > 0);
    setIsFetchingMore(false);
  };

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !isFetchingMore && hasMore) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFetchingMore, hasMore, phase, phasePageNum, seenIds, userCity]);

  const{data:savedVenueIds}=useQuery({queryKey:["saved-venues",user?.id,CATEGORY],queryFn:async()=>{if(!user?.id)return[];const{data}=await(supabase.from("saved_venues")as any).select("venue_id").eq("user_id",user.id);return(data||[]).map((r:any)=>r.venue_id)as string[];},enabled:!!user?.id,staleTime:1000*60});
  const isWeekend=(d:Date)=>{const day=d.getDay();return day===0||day===5||day===6;};const now=new Date();
  const filtered=(allVenues||[]).filter((v:any)=>{
    if(showSaved){if(!(savedVenueIds||[]).includes(v.id))return false;}
    if(search.trim()){const q=search.toLowerCase();if(!v.name?.toLowerCase().includes(q)&&!v.address?.toLowerCase().includes(q))return false;}
    if(quickTonight&&!v.opening_hours)return false;
    if(quickWeekend&&!isWeekend(now))return false;
    if(nearMe&&userLat&&userLng){if(!v.lat||!v.lng)return false;if(haversineKm(userLat,userLng,v.lat,v.lng)>15)return false;}
    const googleTypes=(v.google_data?.types||[]).map((t:string)=>t.toLowerCase().replace(/_/g," "));
    const tags=[...(v.filters||[]),...(v.tags||[]),...googleTypes].map((t:string)=>t.toLowerCase());
    const hasAnyTags=(v.filters||[]).length>0||(v.tags||[]).length>0;
    if(appliedGenres.length>0&&hasAnyTags&&!appliedGenres.some(g=>tags.includes(g.toLowerCase())))return false;
    if(appliedVibes.length>0&&hasAnyTags&&!appliedVibes.some(vb=>tags.includes(vb.toLowerCase())))return false;
    if(appliedSpend!==null){
      const sr=SPEND_RANGES[appliedSpend];
      const googlePrice=v.google_data?.price_level?[0,5000,25000,75000,200000][v.google_data.price_level]:null;
      const price=v.minimum_spend||googlePrice||0;
      if(sr.max===0&&price!==0)return false;
      if(sr.max>0&&(price<sr.min||price>sr.max))return false;
    }
    return true;
  });

  const featured=filtered.filter((v:any)=>v.is_featured);
  const trending=filtered.filter((v:any)=>!v.is_featured&&v.rating>=4).slice(0,8);
  const nearby=userLat&&userLng?filtered.filter((v:any)=>v.lat&&v.lng).map((v:any)=>({...v,_d:haversineKm(userLat,userLng,v.lat,v.lng)})).sort((a:any,b:any)=>a._d-b._d).slice(0,6):[];
  const newAdded=[...filtered].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,6);
  const filterActive=appliedGenres.length>0||appliedVibes.length>0||appliedSpend!==null;
  const anyActive=search.trim()!=""||quickTonight||quickWeekend||nearMe||showSaved||filterActive;
  const pill=(active:boolean,color=ACCENT,bg=ACCENT_BG):React.CSSProperties=>({display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:999,border:"1.5px solid",borderColor:active?color:"#E4DCF0",backgroundColor:active?bg:"#F7F5FA",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const,fontSize:12,fontWeight:active?700:600,color:active?color:"#6B6B6B"});
  const renderCard=(v:any,i:number)=><motion.div key={v.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}><VenueDiscoverCard venue={v} cheapestMenuPrice={v.vendor_id?(menuPrices as any)?.[v.vendor_id]:undefined} categoryEmoji={CATEGORY_EMOJI} accentColor={ACCENT} accentBg={ACCENT_BG}/></motion.div>;

  return(
    <MainLayout>
      <div style={{backgroundColor:"#FFFFFF",position:"sticky",top:0,zIndex:40,borderBottom:showFilter?"none":"1px solid #F2EEF9",boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>router.back()} style={{background:"none",border:"none",cursor:"pointer",padding:6,marginLeft:-6,display:"flex"}}><ArrowLeft size={22} style={{color:"#0A0A0A"}}/></button>
            <div><h1 style={{fontSize:20,fontWeight:900,color:"#0A0A0A",margin:0,fontFamily:"var(--font-display,Syne,sans-serif)"}}>{CATEGORY_EMOJI} {CATEGORY_LABEL}</h1><p style={{fontSize:11,color:"#9E9E9E",margin:0}}>{isLoading?"Loading...":`${filtered.length} club${filtered.length!==1?"s":""} found`}</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {anyActive&&<button onClick={clearAll} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"1px solid #FECACA",borderRadius:999,padding:"4px 10px",cursor:"pointer"}}><X size={10} style={{color:"#EF4444"}}/><span style={{fontSize:11,fontWeight:700,color:"#EF4444"}}>Clear</span></button>}
            <LocationHeader
              onLocationResolved={(city) => {
                setUserCity(city === "__everywhere__" ? "__everywhere__" : city);
                if (city !== "__everywhere__") {
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
                    () => {}
                  );
                }
              }}
            />
          </div>
        </div>
        <div style={{display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto",scrollbarWidth:"none"}}>
          <button onClick={openFilter} style={pill(filterActive||showFilter)}><SlidersHorizontal size={13}/>Filter{filterActive&&<div style={{width:6,height:6,borderRadius:"50%",backgroundColor:ACCENT}}/>}</button>
          <button onClick={()=>setShowSaved(!showSaved)} style={pill(showSaved,"#FF4B6E","#FFF0F3")}><Heart size={13} style={{fill:showSaved?"#FF4B6E":"none"}}/>Saved</button>
          <button onClick={()=>setQuickTonight(!quickTonight)} style={pill(quickTonight)}>🌙 Tonight</button>
          <button onClick={()=>setQuickWeekend(!quickWeekend)} style={pill(quickWeekend)}>📅 Weekend</button>
          <button onClick={()=>{setNearMe(!nearMe);if(!nearMe)navigator.geolocation?.getCurrentPosition((pos)=>{setUserLat(pos.coords.latitude);setUserLng(pos.coords.longitude);},()=>{});}} style={pill(nearMe)}><MapPin size={13}/>Near Me</button>
          <button onClick={()=>setShowSearch(!showSearch)} style={pill(showSearch||!!search)}><Search size={13}/>Search</button>
        </div>
        <AnimatePresence>
          {showSearch&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}><div style={{padding:"0 16px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8,backgroundColor:"#F7F5FA",border:`1.5px solid ${ACCENT}`,borderRadius:14,padding:"11px 14px"}}><Search size={15} style={{color:ACCENT}}/><input autoFocus type="text" placeholder="Search clubs..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:14,color:"#0A0A0A",fontFamily:"inherit"}}/>{search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer"}}><X size={14} style={{color:"#9E9E9E"}}/></button>}</div></div></motion.div>}
        </AnimatePresence>
        <AnimatePresence>
          {showFilter&&(<><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={applyFilter} style={{position:"fixed",inset:0,zIndex:38,backgroundColor:"rgba(0,0,0,0.25)"}}/>
          <motion.div initial={{y:-12,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-12,opacity:0}} transition={{type:"spring",damping:30,stiffness:350}} style={{position:"absolute",top:"100%",left:0,right:0,zIndex:39,backgroundColor:"#FFFFFF",borderRadius:"0 0 24px 24px",boxShadow:"0 12px 40px rgba(0,0,0,0.12)",maxHeight:"72vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{flex:1,overflowY:"auto",padding:"20px 20px 0"}}>
              <div style={{marginBottom:24}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><p style={{fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0}}>Spend Range</p><button onClick={()=>setSpendIdx(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444"}}>Clear</button></div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{SPEND_RANGES.map((sr,idx)=><button key={sr.label} onClick={()=>setSpendIdx(spendIdx===idx?null:idx)} style={{padding:"8px 16px",borderRadius:999,border:"1.5px solid",borderColor:spendIdx===idx?ACCENT:"#E4DCF0",backgroundColor:spendIdx===idx?ACCENT_BG:"#FFFFFF",color:spendIdx===idx?ACCENT:"#6B6B6B",fontSize:12,fontWeight:spendIdx===idx?700:500,cursor:"pointer"}}>{sr.label}</button>)}</div></div>
              <div style={{marginBottom:24}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><p style={{fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0}}>Music & Genre</p><button onClick={()=>setGenres([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444"}}>Clear</button></div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{MUSIC_GENRES.map(g=>{const on=genres.includes(g);return<button key={g} onClick={()=>setGenres(on?genres.filter(x=>x!==g):[...genres,g])} style={{padding:"8px 14px",borderRadius:999,border:"1.5px solid",borderColor:on?ACCENT:"#E4DCF0",backgroundColor:on?ACCENT_BG:"#FFFFFF",color:on?ACCENT:"#6B6B6B",fontSize:12,fontWeight:on?700:500,cursor:"pointer"}}>{g}</button>;})}</div></div>
              <div style={{marginBottom:24}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><p style={{fontSize:13,fontWeight:800,color:"#0A0A0A",margin:0}}>Vibe & Features</p><button onClick={()=>setVibes([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#EF4444"}}>Clear</button></div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{VIBE_TAGS.map(vb=>{const on=vibes.includes(vb);return<button key={vb} onClick={()=>setVibes(on?vibes.filter(x=>x!==vb):[...vibes,vb])} style={{padding:"8px 14px",borderRadius:999,border:"1.5px solid",borderColor:on?ACCENT:"#E4DCF0",backgroundColor:on?ACCENT_BG:"#FFFFFF",color:on?ACCENT:"#6B6B6B",fontSize:12,fontWeight:on?700:500,cursor:"pointer"}}>{vb}</button>;})}</div></div>
            </div>
            <div style={{padding:"12px 20px 24px",borderTop:"1px solid #F2EEF9",flexShrink:0}}><button onClick={applyFilter} style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",backgroundColor:"#0A0A0A",color:"#FFFFFF",fontSize:14,fontWeight:700,cursor:"pointer"}}>Apply Filters</button></div>
          </motion.div></>)}
        </AnimatePresence>
      </div>
      {showNationalDivider && allVenues.length > 0 && (
        <div style={{ margin:"8px 16px 0", backgroundColor:"#F7F5FA", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>🇳🇬</span>
          <p style={{ fontSize:12, fontWeight:700, color:"#6B6B6B", margin:0 }}>More from across Nigeria</p>
        </div>
      )}
      <div style={{padding:"16px"}}>
        {isLoading?(<div style={{display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:4}).map((_,i)=><div key={i} style={{height:260,borderRadius:20,backgroundColor:"#F2EEF9"}}/>)}</div>)
        :filtered.length===0?(<div style={{textAlign:"center",paddingTop:80}}><div style={{fontSize:48,marginBottom:16}}>{showSaved?"❤️":CATEGORY_EMOJI}</div><p style={{fontWeight:800,fontSize:16,color:"#0A0A0A",margin:"0 0 6px"}}>{showSaved?"No saved clubs yet":"No clubs found"}</p><p style={{fontSize:13,color:"#9E9E9E",margin:"0 0 20px"}}>{showSaved?"Tap the heart on any venue to save it":"Try adjusting your filters"}</p><button onClick={clearAll} style={{padding:"10px 28px",borderRadius:12,border:"none",backgroundColor:ACCENT,color:"#FFFFFF",fontSize:13,fontWeight:700,cursor:"pointer"}}>Clear filters</button></div>)
        :showSaved?(<Section title="❤️ Your Saved" subtitle="Clubs you've saved">{filtered.map(renderCard)}</Section>)
        :anyActive?(<Section title={`${filtered.length} result${filtered.length!==1?"s":""}`} subtitle="Matching your filters">{filtered.map(renderCard)}</Section>)
        :(<>{featured.length>0&&<Section title="✨ Featured" subtitle="Hand-picked for you">{featured.map(renderCard)}</Section>}{trending.length>0&&<Section title={`🔥 Trending in ${userCity}`} subtitle="Hottest clubs right now">{trending.map(renderCard)}</Section>}{nearby.length>0&&<Section title="📍 Around You" subtitle="Closest to your location">{nearby.map(renderCard)}</Section>}{newAdded.length>0&&<Section title="🆕 New on Chillz" subtitle="Recently added">{newAdded.map(renderCard)}</Section>}</>)}
      </div>
    <div ref={bottomRef} style={{ height: 1 }} />
      {isFetchingMore && (
        <div style={{ display:"flex", justifyContent:"center", padding:"20px 0" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", border:`2.5px solid ${ACCENT_BG}`, borderTopColor:ACCENT, animation:"spin 0.8s linear infinite" }}/>
        </div>
      )}
      {!hasMore && allVenues.length > 0 && (
        <p style={{ textAlign:"center", fontSize:12, color:"#C4BAD8", padding:"16px 0 32px" }}>You've seen all clubs ✓</p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </MainLayout>
  );
}