"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LOCATION_ALIASES, LOCATION_LABELS, LocationKey, ItineraryStop } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const CATEGORIES = [
  { key: "restaurant", label: "Restaurant", icon: "🍽️" },
  { key: "cafe",       label: "Cafe",       icon: "☕" },
  { key: "bar",        label: "Bar",        icon: "🍺" },
  { key: "bakery",     label: "Bakery",     icon: "🥐" },
  { key: "museum",     label: "Museum",     icon: "🏛️" },
  { key: "art_gallery",label: "Art Gallery",icon: "🎨" },
  { key: "park",       label: "Park",       icon: "🌳" },
  { key: "attraction", label: "Activities", icon: "🎭" },
  { key: "night_club", label: "Nightclub",  icon: "🎵" },
];

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

const PLACE_ICONS: Record<string, string> = {
  restaurant:"🍽️", cafe:"☕", bar:"🍺", bakery:"🥐",
  museum:"🏛️", art_gallery:"🎨", park:"🌳", attraction:"🎭", night_club:"🎵",
};

const TYPE_COLOR_CLASS: Record<string, string> = {
  restaurant:"bg-red-400", cafe:"bg-amber-400", bar:"bg-violet-400",
  bakery:"bg-orange-400", museum:"bg-sky-400", art_gallery:"bg-pink-400",
  park:"bg-green-400", attraction:"bg-teal-400", night_club:"bg-indigo-400",
};

const EXAMPLE_QUERIES = [
  "A slow Sunday morning in Silver Lake — good coffee, maybe an art gallery, ending with dinner somewhere cozy",
  "Saturday night in Hollywood: bars, live music, and late-night bites after 8pm",
  "Afternoon in Santa Monica — outdoor stuff, a bakery stop, and somewhere to grab drinks at sunset",
  "Koreatown food crawl on Friday, all the best spots, budget-friendly",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-slate-400 text-xs">No rating</span>;
  return (
    <span className="flex items-center gap-1">
      <span className="text-amber-400 text-xs">{"★".repeat(Math.floor(rating))}{"☆".repeat(5-Math.floor(rating))}</span>
      <span className="text-slate-500 text-xs font-semibold">{rating.toFixed(1)}</span>
    </span>
  );
}

function WalkDivider({ meters }: { meters: number }) {
  const mins = Math.max(1, Math.round(meters / 1.4 / 60));
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 border-t border-dashed border-slate-200" />
      <span className="text-slate-400 text-xs whitespace-nowrap font-medium">
        🚶 {meters >= 1000 ? `${(meters/1000).toFixed(1)} km` : `${meters} m`} · ~{mins} min
      </span>
      <div className="flex-1 border-t border-dashed border-slate-200" />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{children}</p>;
}

// ─── Landing Screen ──────────────────────────────────────────────────────────

function LandingScreen({ onReady }: { onReady: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F6F3" }}>

      {/* Hero */}
      <div className="relative overflow-hidden px-6 pt-16 pb-12 text-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#003B5C 0%,#2774AE 65%,#1a5fa8 100%)" }}>
        <div className="absolute -left-12 -top-12 w-64 h-64 rounded-full opacity-5" style={{ background:"#FFD100" }} />
        <div className="absolute -right-8 top-8 w-40 h-40 rounded-full opacity-10" style={{ background:"#FFD100" }} />
        <div className="relative">
          <div className="text-6xl mb-4">🐻</div>
          <h1 className="text-white font-extrabold text-4xl tracking-tight leading-none">BruinQuest</h1>
          <p className="mt-2 font-semibold text-sm" style={{ color:"#FFD100", letterSpacing:"0.1em" }}>
            AI-POWERED LA DAY PLANNER
          </p>
          <p className="mt-4 text-white/70 text-sm max-w-sm mx-auto leading-relaxed">
            Tell us what kind of day you're after. We'll search 8,800+ real LA venues and build your perfect itinerary.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="px-5 py-8 max-w-lg mx-auto w-full">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">How it works</p>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon:"💬", step:"1", title:"You describe", body:"Write what you're after in plain English (vibe, neighborhood, time of day, etc.)" },
            { icon:"🔍", step:"2", title:"We retrieve", body:"Our system searches 8,800+ real LA venues and filters to the best matches for your day." },
            { icon:"✨", step:"3", title:"Claude narrates", body:"AI adds context, timing, transit info, and a reason why each stop fits your vibe." },
          ].map(({ icon, step, title, body }) => (
            <div key={step} className="bg-white rounded-2xl p-3.5 text-center shadow-sm" style={{ border:"1px solid #EBEBEB" }}>
              <div className="text-2xl mb-2">{icon}</div>
              <p className="font-bold text-slate-800 text-xs mb-1">{title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* NL query input */}
        <div className="mb-4">
          <Label>Describe your ideal day</Label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={3}
            placeholder="e.g. &quot;Start in Westwood on a chill Saturday — good coffee, maybe an art gallery, dinner with a nice vibe&quot;"
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE] resize-none leading-relaxed font-medium"
          />
        </div>

        {/* Example prompts */}
        <div className="mb-6">
          <Label>Try one of these</Label>
          <div className="space-y-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button key={q} type="button" onClick={() => setQuery(q)}
                className="w-full text-left text-xs text-slate-600 bg-white rounded-xl px-3.5 py-2.5 shadow-sm ring-1 ring-slate-200 hover:ring-[#2774AE] hover:text-[#2774AE] transition-all font-medium leading-relaxed">
                "{q}"
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={() => onReady(query)}
          className="w-full py-4 rounded-2xl font-extrabold text-base tracking-wide shadow-lg active:scale-[0.99] transition-all"
          style={{ background:"#FFD100", color:"#003B5C" }}>
          I'm Ready to Explore LA →
        </button>
        <p className="text-center text-xs text-slate-400 mt-3">
          You'll be able to fine-tune filters on the next screen
        </p>
      </div>
    </div>
  );
}

// ─── Planner Screen ───────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen]           = useState<"home" | "plan">("home");
  const [nlQuery, setNlQuery]         = useState("");

  const [location, setLocation]       = useState<LocationKey>("ucla");
  const [dayOfWeek, setDayOfWeek]     = useState(new Date().getDay());
  const [startTime, setStartTime]     = useState("12:00");
  const [endTime, setEndTime]         = useState("22:00");
  const [categories, setCategories]   = useState<Set<string>>(new Set(["restaurant","cafe"]));
  const [priceLevels, setPriceLevels] = useState<Set<number>>(new Set());
  const [minRating, setMinRating]     = useState(3.5);
  const [numStops, setNumStops]       = useState(3);

  const [loading, setLoading]         = useState(false);
  const [itinerary, setItinerary]     = useState<ItineraryStop[] | null>(null);
  const [summary, setSummary]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const mapCenter = LOCATION_ALIASES[location] ?? LOCATION_ALIASES["ucla"];

  function handleReady(query: string) {
    setNlQuery(query);
    setScreen("plan");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categories.size) { setError("Pick at least one category."); return; }
    setLoading(true); setError(null); setItinerary(null); setSummary(null);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location, dayOfWeek, startTime,
          endTime: endTime || undefined,
          categories: Array.from(categories),
          priceLevels: priceLevels.size ? Array.from(priceLevels) : undefined,
          minRating: minRating > 0 ? minRating : undefined,
          numStops,
          query: nlQuery.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setItinerary(data.itinerary);
      setSummary(data.summary ?? null);
      if (!data.itinerary.length) setError("No places found. Try loosening your filters.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  // ── Landing screen
  if (screen === "home") return <LandingScreen onReady={handleReady} />;

  // ── Planner screen
  return (
    <div className="md:flex md:h-screen md:overflow-hidden" style={{ background:"#F7F6F3" }}>

      {/* Left panel */}
      <div className="md:w-[44%] md:h-screen md:overflow-y-auto flex flex-col">

        {/* Header */}
        <header className="relative overflow-hidden px-5 py-4 flex-shrink-0 flex items-center justify-between"
          style={{ background:"linear-gradient(135deg,#003B5C 0%,#2774AE 60%,#1a5fa8 100%)" }}>
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10" style={{ background:"#FFD100" }} />
          <div className="relative flex items-center gap-3">
            <span className="text-3xl">🐻</span>
            <div>
              <h1 className="text-white font-extrabold text-xl tracking-tight leading-none">BruinQuest</h1>
              <p className="mt-0.5 font-semibold text-xs" style={{ color:"#FFD100", letterSpacing:"0.08em" }}>
                YOUR PERFECT LA DAY
              </p>
            </div>
          </div>
          <button onClick={() => setScreen("home")}
            className="relative text-white/60 hover:text-white text-xs font-semibold transition-colors">
            ← Back
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 flex-1">

          {/* Natural language query */}
          <div>
            <Label>Your vibe</Label>
            <textarea
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              rows={2}
              placeholder="Describe what you're after — Claude will use this to personalise your itinerary…"
              className="w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE] resize-none leading-relaxed font-medium"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Fine-tune filters</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Location + Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>📍 Neighborhood</Label>
              <select value={location} onChange={e => setLocation(e.target.value as LocationKey)}
                className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-800 text-sm font-medium shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE]">
                {Object.entries(LOCATION_LABELS).map(([k,l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label>📅 Day</Label>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-800 text-sm font-medium shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE]">
                {DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>🕐 Start time</Label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-800 text-sm font-medium shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE]" />
            </div>
            <div>
              <Label>🕙 End time <span className="normal-case font-normal text-slate-400">(optional)</span></Label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-800 text-sm font-medium shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2774AE]" />
            </div>
          </div>

          {/* Categories */}
          <div>
            <Label>What do you want?</Label>
            {!categories.size && <p className="text-xs text-red-500 mb-1">Pick at least one</p>}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ key, label, icon }) => {
                const on = categories.has(key);
                return (
                  <button key={key} type="button"
                    onClick={() => {
                      const n = new Set(categories); on ? n.delete(key) : n.add(key); setCategories(n);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                      ${on ? "text-white shadow-md" : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-[#2774AE] hover:text-[#2774AE]"}`}
                    style={on ? { background:"linear-gradient(135deg,#2774AE,#1a5fa8)" } : {}}>
                    {icon} {label}
                  </button>
                );
              })}
            </div>
            {(categories.has("bar") || categories.has("night_club")) && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 inline-block">
                🌙 Bars & nightclubs after 8 PM only
              </p>
            )}
          </div>

          {/* Price + Rating */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>💰 Price range</Label>
              <div className="flex gap-1.5">
                {[1,2,3,4].map(lv => {
                  const on = priceLevels.has(lv);
                  return (
                    <button key={lv} type="button"
                      onClick={() => { const n = new Set(priceLevels); on ? n.delete(lv) : n.add(lv); setPriceLevels(n); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
                        ${on ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:ring-emerald-400"}`}>
                      {PRICE_LABELS[lv]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>⭐ Min rating — <span className="text-[#2774AE]">{minRating === 0 ? "any" : `${minRating.toFixed(1)}★`}</span></Label>
              <input type="range" min={0} max={5} step={0.5} value={minRating}
                onChange={e => setMinRating(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer mt-2.5" />
            </div>
          </div>

          {/* Stops */}
          <div className="flex items-center justify-between">
            <Label>📍 Number of stops</Label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setNumStops(n => Math.max(1,n-1))}
                className="w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-slate-600 font-bold hover:ring-[#2774AE] hover:text-[#2774AE] transition-all flex items-center justify-center">−</button>
              <span className="text-2xl font-extrabold text-slate-800 w-6 text-center tabular-nums">{numStops}</span>
              <button type="button" onClick={() => setNumStops(n => Math.min(12,n+1))}
                className="w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-slate-600 font-bold hover:ring-[#2774AE] hover:text-[#2774AE] transition-all flex items-center justify-center">+</button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading || !categories.size}
            className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.99]"
            style={{ background: loading || !categories.size ? "#ccc" : "#FFD100", color:"#003B5C" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Planning your day…
              </span>
            ) : "Plan My Day →"}
          </button>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background:"#FFF0F0", color:"#b91c1c" }}>
              {error}
            </div>
          )}

          {/* Results */}
          {itinerary && itinerary.length > 0 && (
            <section className="space-y-1 pb-8">
              <div className="flex items-baseline justify-between pt-1 pb-0.5">
                <h2 className="font-extrabold text-slate-900 text-base">{DAYS[dayOfWeek]} in {LOCATION_LABELS[location]}</h2>
                <span className="text-xs text-slate-400 font-medium">{itinerary.length} stops</span>
              </div>
              <p className="text-xs text-slate-400 font-medium mb-3">
                {itinerary[0].estimated_arrival} → {itinerary[itinerary.length-1].estimated_departure}
              </p>

              {summary && (
                <div className="rounded-2xl px-4 py-3 flex gap-2.5 items-start mb-4"
                  style={{ background:"linear-gradient(135deg,rgba(39,116,174,0.07),rgba(0,59,92,0.04))", border:"1px solid rgba(39,116,174,0.12)" }}>
                  <span className="mt-0.5 flex-shrink-0">✨</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{summary}</p>
                </div>
              )}

              <div className="space-y-0">
                {itinerary.map((stop, idx) => (
                  <div key={stop.stop_number}>
                    {idx > 0 && stop.travel_from_prev_meters > 0 && <WalkDivider meters={stop.travel_from_prev_meters}/>}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border:"1px solid #EBEBEB" }}>
                      <div className="px-4 py-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${TYPE_COLOR_CLASS[stop.place_type] ?? "bg-slate-400"}`}>
                              {stop.stop_number}
                            </span>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Stop {stop.stop_number}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                            {stop.estimated_arrival} → {stop.estimated_departure}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="text-xl flex-shrink-0">{PLACE_ICONS[stop.place_type]}</span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-900 text-sm leading-snug">{stop.name}</h3>
                              <p className="text-slate-400 text-xs capitalize">{stop.place_type.replace("_"," ")}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <StarRating rating={stop.avg_user_rating}/>
                            {stop.price_level && <span className="text-emerald-600 font-semibold text-xs">{PRICE_LABELS[stop.price_level]}</span>}
                          </div>
                        </div>

                        {stop.ai_reason && (
                          <p className="text-xs text-slate-600 leading-relaxed pl-2.5 border-l-[3px] border-[#FFD100] italic">
                            {stop.ai_reason}
                          </p>
                        )}

                        <p className="text-xs text-slate-400">{stop.address}</p>

                        {stop.nearest_metro_station && (
                          <div className="rounded-xl px-3 py-2 space-y-1.5" style={{ background:"#F7F6F3" }}>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span>🚇</span>
                              <span className="font-semibold">{stop.nearest_metro_station}</span>
                              {stop.nearest_metro_distance_meters != null && (
                                <span className="text-slate-400">{Math.round(stop.nearest_metro_distance_meters)} m</span>
                              )}
                            </div>
                            {stop.metro_predictions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 pl-5">
                                {stop.metro_predictions.map((p,pi) => (
                                  <span key={pi} className="inline-flex items-center gap-1 text-xs bg-white rounded-full px-2 py-0.5 font-medium shadow-sm ring-1 ring-slate-100">
                                    <span className="text-[#2774AE] font-bold">Rt {p.route_id}</span>
                                    <span className="text-emerald-600">{p.minutes === 0 ? "now" : `${p.minutes}m`}</span>
                                  </span>
                                ))}
                              </div>
                            ) : stop.nearest_metro_route_codes.length > 0 ? (
                              <p className="text-xs text-slate-400 pl-5">Lines {stop.nearest_metro_route_codes.join(", ")} · live times unavailable</p>
                            ) : null}
                          </div>
                        )}

                        {stop.detail_url && (
                          <a href={stop.detail_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2774AE] hover:underline">
                            View on Maps ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 text-center">
                <button type="button" onClick={() => { setItinerary(null); setSummary(null); }}
                  className="text-slate-400 text-xs hover:text-slate-600 underline">
                  Try different filters
                </button>
                <span className="text-slate-300 mx-2">·</span>
                <button type="button" onClick={() => { setItinerary(null); setSummary(null); setScreen("home"); }}
                  className="text-slate-400 text-xs hover:text-slate-600 underline">
                  Start over
                </button>
              </div>
            </section>
          )}
        </form>

        <footer className="text-center py-3 text-slate-400 text-xs border-t border-slate-100 flex-shrink-0"
          style={{ background:"#F7F6F3" }}>
          BruinQuest · UCLA DSU · RAG-powered by Claude
        </footer>
      </div>

      {/* Map panel */}
      <div className="h-56 md:flex-1 md:h-screen relative">
        <MapView center={mapCenter} stops={itinerary ?? []}/>
        {itinerary && itinerary.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl px-3 py-2.5 space-y-1.5 z-[1000]"
            style={{ border:"1px solid #EBEBEB" }}>
            {itinerary.map(stop => (
              <div key={stop.stop_number} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 ${TYPE_COLOR_CLASS[stop.place_type] ?? "bg-slate-400"}`}>
                  {stop.stop_number}
                </span>
                <span className="text-slate-700 font-semibold truncate max-w-[130px]">{stop.name}</span>
                <span className="text-slate-400 flex-shrink-0">{stop.estimated_arrival}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
