"use client";

import { useState } from "react";
import { LOCATION_LABELS, LocationKey, ItineraryStop } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CATEGORIES = [
  { key: "restaurant", label: "Restaurant", icon: "🍽️" },
  { key: "cafe", label: "Cafe", icon: "☕" },
  { key: "bar", label: "Bar", icon: "🍺" },
  { key: "bakery", label: "Bakery", icon: "🥐" },
  { key: "museum", label: "Museum", icon: "🏛️" },
  { key: "art_gallery", label: "Art Gallery", icon: "🎨" },
  { key: "park", label: "Park / Outdoors", icon: "🌳" },
  { key: "attraction", label: "Activities", icon: "🎭" },
  { key: "night_club", label: "Nightclub", icon: "🎵" },
];

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

const PLACE_ICONS: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  bar: "🍺",
  bakery: "🥐",
  museum: "🏛️",
  art_gallery: "🎨",
  park: "🌳",
  attraction: "🎭",
  night_club: "🎵",
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-slate-400 text-sm">No rating</span>;
  const stars = Math.round(rating * 2) / 2;
  return (
    <span className="flex items-center gap-1">
      <span className="text-amber-400">{"★".repeat(Math.floor(stars))}{"☆".repeat(5 - Math.ceil(stars))}</span>
      <span className="text-slate-600 text-sm font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

function PriceBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className="text-emerald-700 font-semibold text-sm bg-emerald-50 px-2 py-0.5 rounded">
      {PRICE_LABELS[level]}
    </span>
  );
}

function WalkDivider({ meters }: { meters: number }) {
  const mins = Math.max(1, Math.round((meters / 1.4) / 60));
  return (
    <div className="flex items-center gap-3 py-1 px-4">
      <div className="flex-1 border-t-2 border-dashed border-slate-200" />
      <span className="text-slate-400 text-sm whitespace-nowrap">
        🚶 {meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`} · ~{mins} min walk
      </span>
      <div className="flex-1 border-t-2 border-dashed border-slate-200" />
    </div>
  );
}

export default function Home() {
  const today = new Date();
  const defaultDay = today.getDay(); // 0=Sun

  const [location, setLocation] = useState<LocationKey>("ucla");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDay);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("22:00");
  const [categories, setCategories] = useState<Set<string>>(new Set(["restaurant", "cafe"]));
  const [priceLevels, setPriceLevels] = useState<Set<number>>(new Set());
  const [minRating, setMinRating] = useState(3.5);
  const [numStops, setNumStops] = useState(3);

  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryStop[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(key: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePrice(level: number) {
    setPriceLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.size === 0) {
      setError("Please select at least one category.");
      return;
    }
    setLoading(true);
    setError(null);
    setItinerary(null);
    setSummary(null);

    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          dayOfWeek,
          startTime,
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
      if (data.itinerary.length === 0) {
        setError("No places found matching your criteria. Try adjusting your filters.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#003B5C] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
          <span className="text-3xl">🐻</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">BruinQuest</h1>
            <p className="text-[#FFD100] text-sm font-medium">Plan your perfect LA day</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6"
        >
          {/* Location + Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                📍 Starting Neighborhood
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as LocationKey)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE] focus:border-transparent"
              >
                {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                📅 Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE] focus:border-transparent"
              >
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                🕐 Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE] focus:border-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                🕙 End Time <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2774AE] focus:border-transparent"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              What do you want to do?
            </label>
            {categories.size === 0 && (
              <p className="text-xs text-red-500">Select at least one category</p>
            )}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ key, label, icon }) => {
                const active = categories.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCategory(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all
                      ${active
                        ? "bg-[#2774AE] border-[#2774AE] text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#2774AE] hover:text-[#2774AE]"
                      }`}
                  >
                    <span>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            {(categories.has("bar") || categories.has("night_club")) && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
                🌙 Bars and nightclubs are only scheduled after 8:00 PM
              </p>
            )}
            {(categories.has("museum") || categories.has("art_gallery") || categories.has("park") || categories.has("attraction")) && (
              <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
                ℹ️ Museum/park/activity data requires a fresh data fetch — see README for instructions
              </p>
            )}
          </div>

          {/* Price Level */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              💰 Price Range <span className="font-normal text-slate-400">(any if none selected)</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((level) => {
                const active = priceLevels.has(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => togglePrice(level)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all
                      ${active
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600"
                      }`}
                  >
                    {PRICE_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min Rating + Num Stops */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                ⭐ Minimum Rating:{" "}
                <span className="text-[#2774AE]">{minRating === 0 ? "Any" : minRating.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>Any</span>
                <span>5.0 ★</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                📍 Number of Stops
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNumStops((n) => Math.max(1, n - 1))}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 text-slate-600 text-lg font-bold hover:border-[#2774AE] hover:text-[#2774AE] transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-slate-800 w-8 text-center">{numStops}</span>
                <button
                  type="button"
                  onClick={() => setNumStops((n) => Math.min(8, n + 1))}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 text-slate-600 text-lg font-bold hover:border-[#2774AE] hover:text-[#2774AE] transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || categories.size === 0}
            className="w-full py-3.5 rounded-xl font-bold text-base transition-all
              bg-[#FFD100] text-[#003B5C] hover:bg-[#f0c500] active:scale-[0.99]
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-md hover:shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Planning your day…
              </span>
            ) : (
              "Plan My Day →"
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {itinerary && itinerary.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800 px-1">
              Your Itinerary — {DAYS[dayOfWeek]}, {LOCATION_LABELS[location as LocationKey]}
            </h2>
            <p className="text-sm text-slate-500 px-1">
              {itinerary[0].estimated_arrival} → {itinerary[itinerary.length - 1].estimated_departure}
              {" · "}{itinerary.length} stop{itinerary.length !== 1 ? "s" : ""}
            </p>

            {/* AI-generated day summary */}
            {summary && (
              <div className="bg-[#003B5C]/5 border border-[#003B5C]/10 rounded-xl px-4 py-3 flex gap-3 items-start">
                <span className="text-lg mt-0.5">✨</span>
                <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
              </div>
            )}

            <div className="space-y-1 pt-1">
              {itinerary.map((stop, idx) => (
                <div key={stop.stop_number}>
                  {/* Walk divider between stops */}
                  {idx > 0 && stop.travel_from_prev_meters > 0 && (
                    <WalkDivider meters={stop.travel_from_prev_meters} />
                  )}

                  {/* Stop card */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Card header bar */}
                    <div className="bg-[#2774AE] px-5 py-2 flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">
                        Stop {stop.stop_number}
                      </span>
                      <span className="text-white/90 text-sm font-medium">
                        {stop.estimated_arrival} → {stop.estimated_departure}
                      </span>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                      {/* Name + type */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0 mt-0.5">
                            {PLACE_ICONS[stop.place_type] ?? "📍"}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-base leading-tight">
                              {stop.name}
                            </h3>
                            <span className="text-slate-500 text-sm capitalize">{stop.place_type}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StarRating rating={stop.avg_user_rating} />
                          <PriceBadge level={stop.price_level} />
                        </div>
                      </div>

                      {/* AI reason */}
                      {stop.ai_reason && (
                        <p className="text-sm text-slate-600 italic leading-snug border-l-2 border-[#FFD100] pl-3">
                          {stop.ai_reason}
                        </p>
                      )}

                      {/* Address */}
                      <p className="text-sm text-slate-500 leading-snug">{stop.address}</p>

                      {/* Metro info with live predictions */}
                      {stop.nearest_metro_station && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>🚇</span>
                            <span className="font-medium">{stop.nearest_metro_station}</span>
                            {stop.nearest_metro_distance_meters != null && (
                              <span className="text-slate-400 text-xs">
                                {Math.round(stop.nearest_metro_distance_meters)} m away
                              </span>
                            )}
                          </div>
                          {stop.metro_predictions.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pl-6">
                              {stop.metro_predictions.map((p, pi) => (
                                <span
                                  key={pi}
                                  className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-700"
                                >
                                  <span className="font-semibold text-[#2774AE]">
                                    Route {p.route_id}
                                  </span>
                                  {p.direction && (
                                    <span className="text-slate-400">· {p.direction}</span>
                                  )}
                                  <span className="font-medium text-emerald-600">
                                    {p.minutes === 0 ? "arriving now" : `${p.minutes} min`}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : stop.nearest_metro_route_codes.length > 0 ? (
                            <p className="text-xs text-slate-400 pl-6">
                              Lines {stop.nearest_metro_route_codes.join(", ")} · live times unavailable
                            </p>
                          ) : null}
                        </div>
                      )}

                      {/* Link */}
                      {stop.detail_url && (
                        <a
                          href={stop.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#2774AE] text-sm font-medium hover:underline"
                        >
                          View on Maps ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reset */}
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => { setItinerary(null); setSummary(null); }}
                className="text-slate-400 text-sm hover:text-slate-600 underline"
              >
                Plan a different day
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-8 text-slate-400 text-xs">
        BruinQuest · UCLA Data Science Union · RAG-powered by Claude · Data from Google Maps, Yelp & LA Metro
      </footer>
    </div>
  );
}
