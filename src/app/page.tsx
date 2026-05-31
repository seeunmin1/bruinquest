"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LOCATION_ALIASES, LOCATION_LABELS, LocationKey, ItineraryStop } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  restaurant: "🍽️", cafe: "☕", bar: "🍺", bakery: "🥐",
  museum: "🏛️", art_gallery: "🎨", park: "🌳", attraction: "🎭", night_club: "🎵",
};

const TYPE_DOT: Record<string, string> = {
  restaurant: "bg-red-400", cafe: "bg-amber-400", bar: "bg-violet-400",
  bakery: "bg-orange-400", museum: "bg-sky-400", art_gallery: "bg-pink-400",
  park: "bg-green-400", attraction: "bg-teal-400", night_club: "bg-indigo-400",
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-slate-400 text-xs">No rating</span>;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="flex items-center gap-1">
      <span className="text-amber-400 text-sm leading-none">
        {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(5 - full - (half ? 1 : 0))}
      </span>
      <span className="text-slate-500 text-xs font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

function WalkDivider({ meters }: { meters: number }) {
  const mins = Math.max(1, Math.round(meters / 1.4 / 60));
  return (
    <div className="flex items-center gap-2 py-1 px-2">
      <div className="flex-1 border-t border-dashed border-slate-200" />
      <span className="text-slate-400 text-xs whitespace-nowrap">
        🚶 {meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`} · ~{mins} min
      </span>
      <div className="flex-1 border-t border-dashed border-slate-200" />
    </div>
  );
}

export default function Home() {
  const today = new Date();

  const [location, setLocation]     = useState<LocationKey>("ucla");
  const [dayOfWeek, setDayOfWeek]   = useState(today.getDay());
  const [startTime, setStartTime]   = useState("12:00");
  const [endTime, setEndTime]       = useState("22:00");
  const [categories, setCategories] = useState<Set<string>>(new Set(["restaurant", "cafe"]));
  const [priceLevels, setPriceLevels] = useState<Set<number>>(new Set());
  const [minRating, setMinRating]   = useState(3.5);
  const [numStops, setNumStops]     = useState(3);

  const [loading, setLoading]   = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryStop[] | null>(null);
  const [summary, setSummary]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const mapCenter = LOCATION_ALIASES[location] ?? LOCATION_ALIASES["ucla"];

  function toggleCategory(key: string) {
    setCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function togglePrice(level: number) {
    setPriceLevels(prev => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.size === 0) { setError("Please select at least one category."); return; }
    setLoading(true); setError(null); setItinerary(null); setSummary(null);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location, dayOfWeek, startTime,
          endTime: endTime || undefined,
          categories: Array.from(categories),
          priceLevels: priceLevels.size > 0 ? Array.from(priceLevels) : undefined,
          minRating: minRating > 0 ? minRating : undefined,
          numStops,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setItinerary(data.itinerary);
      setSummary(data.summary ?? null);
      if (data.itinerary.length === 0)
        setError("No places found matching your criteria. Try adjusting your filters.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="md:flex md:h-screen md:overflow-hidden bg-slate-50">

      {/* ── Left panel ── */}
      <div className="md:w-[44%] md:h-screen md:overflow-y-auto flex flex-col">

        {/* Header */}
        <header className="bg-gradient-to-r from-[#003B5C] to-[#2774AE] text-white px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <span className="text-3xl">🐻</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">BruinQuest</h1>
            <p className="text-[#FFD100] text-xs font-medium">Plan your perfect LA day</p>
          </div>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1">

          {/* Location + Day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">📍 Neighborhood</label>
              <select value={location} onChange={e => setLocation(e.target.value as LocationKey)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE]">
                {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">📅 Day</label>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE]">
                {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
              </select>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">🕐 Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE]" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">🕙 End <span className="normal-case font-normal text-slate-400">(optional)</span></label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE]" />
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">What do you want?</label>
            {categories.size === 0 && <p className="text-xs text-red-500">Select at least one</p>}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ key, label, icon }) => {
                const active = categories.has(key);
                return (
                  <button key={key} type="button" onClick={() => toggleCategory(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                      ${active ? "bg-[#2774AE] border-[#2774AE] text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-[#2774AE] hover:text-[#2774AE]"}`}>
                    <span>{icon}</span>{label}
                  </button>
                );
              })}
            </div>
            {(categories.has("bar") || categories.has("night_club")) && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                🌙 Bars and nightclubs are only scheduled after 8:00 PM
              </p>
            )}
          </div>

          {/* Price + Rating + Stops */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">💰 Price</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(level => {
                  const active = priceLevels.has(level);
                  return (
                    <button key={level} type="button" onClick={() => togglePrice(level)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all
                        ${active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-emerald-500"}`}>
                      {PRICE_LABELS[level]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                ⭐ Min Rating <span className="text-[#2774AE] font-semibold">{minRating === 0 ? "Any" : minRating.toFixed(1)}</span>
              </label>
              <input type="range" min={0} max={5} step={0.5} value={minRating}
                onChange={e => setMinRating(Number(e.target.value))}
                className="w-full h-2 rounded-full cursor-pointer mt-2" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📍 Stops</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setNumStops(n => Math.max(1, n - 1))}
                className="w-8 h-8 rounded-full border-2 border-slate-200 text-slate-600 font-bold hover:border-[#2774AE] hover:text-[#2774AE] transition-colors flex items-center justify-center text-sm">−</button>
              <span className="text-xl font-bold text-slate-800 w-6 text-center">{numStops}</span>
              <button type="button" onClick={() => setNumStops(n => Math.min(12, n + 1))}
                className="w-8 h-8 rounded-full border-2 border-slate-200 text-slate-600 font-bold hover:border-[#2774AE] hover:text-[#2774AE] transition-colors flex items-center justify-center text-sm">+</button>
            </div>
          </div>

          <button type="submit" disabled={loading || categories.size === 0}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-[#FFD100] text-[#003B5C] hover:bg-[#f0c500] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Planning your day…
              </span>
            ) : "Plan My Day →"}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
          )}

          {/* Results */}
          {itinerary && itinerary.length > 0 && (
            <section className="space-y-1 pb-6">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-base font-bold text-slate-800">
                  {DAYS[dayOfWeek]}, {LOCATION_LABELS[location]}
                </h2>
                <span className="text-xs text-slate-400">{itinerary.length} stops</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {itinerary[0].estimated_arrival} → {itinerary[itinerary.length - 1].estimated_departure}
              </p>

              {/* AI summary */}
              {summary && (
                <div className="bg-gradient-to-r from-[#003B5C]/5 to-[#2774AE]/5 border border-[#2774AE]/15 rounded-xl px-4 py-3 flex gap-2.5 items-start mb-3">
                  <span className="mt-0.5">✨</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{summary}</p>
                </div>
              )}

              <div className="space-y-0">
                {itinerary.map((stop, idx) => (
                  <div key={stop.stop_number}>
                    {idx > 0 && stop.travel_from_prev_meters > 0 && (
                      <WalkDivider meters={stop.travel_from_prev_meters} />
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      {/* Card header */}
                      <div className="bg-[#2774AE] px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${TYPE_DOT[stop.place_type] ?? "bg-white"}`} />
                          <span className="text-white font-semibold text-xs">Stop {stop.stop_number}</span>
                        </div>
                        <span className="text-white/90 text-xs font-medium">
                          {stop.estimated_arrival} → {stop.estimated_departure}
                        </span>
                      </div>

                      <div className="px-4 py-3 space-y-2">
                        {/* Name */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="text-xl flex-shrink-0">{PLACE_ICONS[stop.place_type] ?? "📍"}</span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-900 text-sm leading-tight">{stop.name}</h3>
                              <span className="text-slate-400 text-xs capitalize">{stop.place_type.replace("_", " ")}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <StarRating rating={stop.avg_user_rating} />
                            {stop.price_level && (
                              <span className="text-emerald-700 font-semibold text-xs">{PRICE_LABELS[stop.price_level]}</span>
                            )}
                          </div>
                        </div>

                        {/* AI reason */}
                        {stop.ai_reason && (
                          <p className="text-xs text-slate-600 italic leading-snug border-l-2 border-[#FFD100] pl-2.5">
                            {stop.ai_reason}
                          </p>
                        )}

                        {/* Address */}
                        <p className="text-xs text-slate-400 leading-snug">{stop.address}</p>

                        {/* Metro */}
                        {stop.nearest_metro_station && (
                          <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span>🚇</span>
                              <span className="font-medium">{stop.nearest_metro_station}</span>
                              {stop.nearest_metro_distance_meters != null && (
                                <span className="text-slate-400">{Math.round(stop.nearest_metro_distance_meters)} m</span>
                              )}
                            </div>
                            {stop.metro_predictions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 pl-5">
                                {stop.metro_predictions.map((p, pi) => (
                                  <span key={pi} className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-700">
                                    <span className="font-semibold text-[#2774AE]">Rt {p.route_id}</span>
                                    {p.direction && <span className="text-slate-400 hidden sm:inline">· {p.direction}</span>}
                                    <span className="font-medium text-emerald-600">{p.minutes === 0 ? "now" : `${p.minutes}m`}</span>
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
                            className="inline-flex items-center gap-1 text-[#2774AE] text-xs font-medium hover:underline">
                            View on Maps ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-center">
                <button type="button" onClick={() => { setItinerary(null); setSummary(null); }}
                  className="text-slate-400 text-xs hover:text-slate-600 underline">
                  Plan a different day
                </button>
              </div>
            </section>
          )}
        </form>

        <footer className="text-center py-4 text-slate-400 text-xs border-t border-slate-100 flex-shrink-0">
          BruinQuest · UCLA DSU · RAG-powered by Claude · Data from Google Maps, Yelp & LA Metro
        </footer>
      </div>

      {/* ── Right panel: Map ── */}
      <div className="h-56 md:flex-1 md:h-screen relative">
        <MapView center={mapCenter} stops={itinerary ?? []} />

        {/* Map legend */}
        {itinerary && itinerary.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 space-y-1 z-[1000]">
            {itinerary.map(stop => (
              <div key={stop.stop_number} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 ${
                  {restaurant:"bg-red-400",cafe:"bg-amber-400",bar:"bg-violet-400",bakery:"bg-orange-400",
                   museum:"bg-sky-400",art_gallery:"bg-pink-400",park:"bg-green-400",attraction:"bg-teal-400",night_club:"bg-indigo-400"}
                  [stop.place_type] ?? "bg-slate-400"}`}>
                  {stop.stop_number}
                </span>
                <span className="text-slate-700 font-medium truncate max-w-[140px]">{stop.name}</span>
                <span className="text-slate-400 flex-shrink-0">{stop.estimated_arrival}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
