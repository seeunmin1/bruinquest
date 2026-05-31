# BruinQuest RAG Backend — Step-by-Step Walkthrough

## What is RAG?

**Retrieval-Augmented Generation (RAG)** is an AI architecture pattern where a language model's output is grounded in real data retrieved from a knowledge base, rather than relying solely on what the model memorized during training.

```
User Query
    │
    ▼
┌─────────────┐     retrieves     ┌──────────────────┐
│  Retriever  │ ─────────────── ▶ │  Knowledge Base  │
│ (algorithm) │ ◀ ─ candidates ── │ (8,885 LA places)│
└─────────────┘                   └──────────────────┘
    │
    │  retrieved stops
    ▼
┌─────────────┐
│  Generator  │  ──▶  Final itinerary + narrative
│  (Claude)   │
└─────────────┘
```

In BruinQuest:
- The **knowledge base** is `unified_places.json` — 8,885 real LA venues
- The **retriever** is the `planItinerary()` function — filters and ranks candidates
- The **generator** is Claude Haiku — reads retrieved stops and writes the narrative layer

---

## Step 1 — Build the Knowledge Base

### Data Sources

Three real-world APIs were collected and merged:

| Source | Script | What it fetches |
|--------|--------|-----------------|
| Google Maps Places API | `collection/fetch_google.py` | Restaurants, cafes, bars, museums, attractions |
| Yelp Fusion API | `collection/fetch_yelp.py` | Restaurants, bars, nightlife, parks, galleries |
| LA Metro API | `collection/fetch_la_metro.py` | All bus/rail stops with coordinates |

### Running the Fetch

```bash
# Set API keys
export GOOGLE_MAPS_API_KEY=your_key
export YELP_API_KEY=your_key

python3 collection/fetch_google.py   # → data/raw/google_maps/la_places.json
python3 collection/fetch_yelp.py     # → data/raw/yelp/yelp_businesses.json
python3 collection/fetch_la_metro.py # → data/raw/la_metro/metro_stops.json
```

### Preprocessing Pipeline

Each raw source is cleaned and normalized to a shared schema:

```
fetch_google.py  ──▶  clean_google.py  ─┐
fetch_yelp.py    ──▶  clean_yelp.py    ─┼──▶  build_uniform_dataset.py
fetch_la_metro.py──▶  clean_la_metro.py─┘           │
                                                      ▼
                                          unified_places.json (8,885 places)
```

**`clean_google.py`** maps Google's verbose type system to normalized categories:

```python
GOOGLE_TYPE_PRIORITY = [
    "restaurant", "cafe", "bar", "bakery",
    "museum", "art_gallery", "tourist_attraction",
    "park", "amusement_park", "night_club", ...
]
GOOGLE_TYPE_REMAP = {
    "meal_takeaway": "restaurant",
    "amusement_park": "attraction",
    "tourist_attraction": "attraction",
}
```

**`clean_yelp.py`** maps Yelp's alias system (e.g. `"danceclubs"`, `"musicvenues"`) to the same normalized categories:

```python
YELP_CATEGORY_MAP = {
    "bars": "bar", "cocktailbars": "bar", "wine_bars": "bar",
    "museums": "museum", "artgalleries": "art_gallery",
    "parks": "park", "hiking": "park", "beaches": "park",
    "danceclubs": "night_club", "musicvenues": "night_club", "lounges": "night_club",
    "arcades": "attraction", "escape_games": "attraction", ...
}
```

**`build_uniform_dataset.py`** merges everything into one JSON:
- Deduplicates by place ID
- Averages Google + Yelp ratings into `avg_user_rating`
- **Enriches each place with its nearest metro station** using Haversine distance

Final schema per place:

```json
{
  "id": "ChIJ...",
  "source": "google",
  "name": "Gjusta",
  "place_type": "bakery",
  "price_level": 2,
  "avg_user_rating": 4.6,
  "latitude": 33.9913,
  "longitude": -118.4748,
  "hours_periods": [{ "open": {"day": 1, "time": "0700"}, "close": {"day": 1, "time": "1500"} }],
  "nearest_metro_station_name": "Venice / Lincoln",
  "nearest_metro_station_id": "8166",
  "nearest_metro_distance_meters": 312.4,
  "nearest_metro_route_codes": [108, 733],
  "detail_url": "https://www.google.com/maps/place/?q=place_id:ChIJ..."
}
```

---

## Step 2 — The Retriever (`src/lib/itinerary.ts`)

The retriever takes the user's preferences and filters 8,885 places down to the best N candidates using a **greedy nearest-neighbor algorithm with hard constraints**.

### How it works

```
User inputs: location, startTime, endTime, categories, numStops, minRating, priceLevels
                │
                ▼
        For each stop slot i (0 → numStops-1):
                │
                ├── Compute slot's minimum start time (even distribution across window)
                │     minSlotHHMM = startTime + (i × windowMinutes / numStops)
                │
                ├── For every place in knowledge base:
                │     ✗ Skip: wrong category
                │     ✗ Skip: price level doesn't match
                │     ✗ Skip: rating below minimum
                │     ✗ Skip: bar/nightclub before 8 PM
                │     ✗ Skip: closed at arrival time (via hours_periods)
                │     ✗ Skip: departure would exceed endTime
                │     ✓ Keep: compute travel distance (Haversine) + arrival time
                │
                ├── Rank candidates: closest first, rating as tiebreaker
                │
                └── Pick winner → add to itinerary → move currentLocation to winner
```

### Schedule Distribution Fix

The key insight: when `endTime` is provided, naive greedy selection crammed all stops into the first few hours. The fix computes a **minimum slot start time** for each stop index:

```typescript
// windowMins = e.g. 600 for 12pm–10pm
const slotMins = windowMins / numStops;  // e.g. 200 min per slot

// For stop i, don't start earlier than this time
const minSlotHHMM = addMinutesToHHMM(startHHMM, Math.floor(i * slotMins));

// Effective departure time = max(actual previous departure, slot minimum)
// This allows "waiting" between stops while keeping spacing even
const fromHHMM = Math.max(currentHHMM, minSlotHHMM);
```

**Result for 3 stops, 12pm–10pm:**

| Stop | Earliest start | Dwell | Departs |
|------|---------------|-------|---------|
| 1 | 12:00 PM | 60 min (restaurant) | ~1:00 PM |
| 2 | 3:20 PM | 30 min (cafe) | ~3:50 PM |
| 3 | 6:40 PM | 90 min (bar) | ~8:10 PM |

### Hours Checking

The retriever checks if a place is open at estimated arrival time using Google's `hours_periods` format:

```typescript
function isOpenAt(periods, dayOfWeek, timeHHMM): boolean {
  // Falls back to "open" if hours unknown
  // Handles multi-day periods (e.g. a bar open Mon 10pm → Tue 2am)
  for (const period of periods) {
    if (openDay === closeDay) {
      if (dayOfWeek === openDay && timeHHMM >= openTime && timeHHMM < closeTime)
        return true;
    } else {
      // Period spans midnight
      if (dayOfWeek === openDay && timeHHMM >= openTime) return true;
      if (dayOfWeek === closeDay && timeHHMM < closeTime) return true;
    }
  }
}
```

---

## Step 3 — Live Metro Enrichment (`src/lib/metro.ts`)

After the retriever produces stops, **real-time transit predictions** are fetched for each stop's nearest station.

```typescript
// Called in parallel for all stops at request time
export async function fetchStopPredictions(stationId: string): Promise<MetroPrediction[]> {
  for (const agency of ["LACMTA", "LACMTA_Rail"]) {
    const res = await fetch(
      `https://api.metro.net/${agency}/stops/${stationId}/predictions/`,
      { signal: AbortSignal.timeout(3000) }  // never blocks the response
    );
    // Returns: [{ route_id, minutes, direction }]
  }
}
```

Key design decisions:
- **Server-side only** — no CORS issues, no API key needed
- **3-second timeout** — transit API is optional; failure returns empty array silently
- **Parallel fetches** — all stops' predictions fetched simultaneously via `Promise.all`
- **Both agencies** — LACMTA (buses) and LACMTA_Rail tried in sequence per station

---

## Step 4 — The Generator (`src/app/api/itinerary/route.ts`)

This is the "G" in RAG. Claude receives the retrieved stops and generates the narrative layer.

### The full request flow

```
POST /api/itinerary
        │
        ▼
1. Load unified_places.json (cached in memory after first request)
        │
        ▼
2. planItinerary() — RETRIEVAL
   Filters 8,885 places → N best stops with timing
        │
        ├── Promise.all([
        │     3. fetchStopPredictions() × N stops  ← parallel
        │     4. generateNarrative() via Claude     ← parallel
        │   ])
        │
        ▼
5. Merge: stops + metro predictions + AI reasons
        │
        ▼
Return: { itinerary: EnrichedStop[], summary: string }
```

Steps 3 and 4 run **in parallel** — Claude generation and Metro API calls happen simultaneously so neither blocks the other.

### The Claude prompt

The prompt frames the RAG role explicitly:

```
You are BruinQuest, an LA day-trip assistant. This app uses RAG: a retrieval 
system pulled these venues from a database of 10,000+ real LA places based on 
the user's preferences, and you are the generation layer — your job is to add 
a human, engaging narrative to the retrieved results.

User's plan:
- Neighborhood: westwood
- Day: Saturday
- Time: 12:00 to 22:00
- Wants: restaurant, cafe, bar

Retrieved itinerary (3 stops):
Stop 1: Gjusta (bakery, 4.6★, $$) — 12:02 PM–1:02 PM, Venice Beach
Stop 2: Intelligentsia Coffee (cafe, 4.5★, $$) — 3:22 PM–3:52 PM, Silver Lake
Stop 3: Good Times at Davey Wayne's (bar, 4.4★, $$) — 6:44 PM–8:14 PM, Hollywood

Write a 2-sentence day summary and a 1-2 sentence reason per stop (max 25 words).
Respond with ONLY valid JSON: {"summary":"...","stops":[{"stop_number":1,"reason":"..."}]}
```

### Parsing the response

Claude's response is parsed defensively (strips markdown code fences if present):

```typescript
const cleaned = text.replace(/```(?:json)?\n?|\n?```/g, "").trim();
return JSON.parse(cleaned);
```

If Claude is unavailable (no `ANTHROPIC_API_KEY`) or parsing fails, the response degrades gracefully — stops are returned without `ai_reason`, no error thrown.

---

## Step 5 — What the Frontend Receives

Each stop in the final response looks like:

```json
{
  "stop_number": 1,
  "name": "Gjusta",
  "place_type": "bakery",
  "avg_user_rating": 4.6,
  "estimated_arrival": "12:02 PM",
  "estimated_departure": "1:02 PM",
  "nearest_metro_station": "Venice / Lincoln",
  "nearest_metro_distance_meters": 312,
  "nearest_metro_route_codes": [108, 733],
  "metro_predictions": [
    { "route_id": "108", "minutes": 4, "direction": "To Culver City" },
    { "route_id": "733", "minutes": 11, "direction": "To Santa Monica" }
  ],
  "ai_reason": "Gjusta's legendary pastries and 4.6★ rating make it the perfect first stop — arrive early before the weekend rush.",
  "detail_url": "https://www.google.com/maps/place/?q=place_id:ChIJ..."
}
```

And the top-level response includes the AI summary:

```json
{
  "summary": "A Venice-to-Hollywood Saturday that balances a slow artisanal morning with an electric evening. Each stop flows naturally into the next as the energy of the city picks up.",
  "itinerary": [ ...stops... ]
}
```

---

## Supported Place Categories

| Category | Type key | Dwell time | Source |
|----------|----------|-----------|--------|
| Restaurant | `restaurant` | 60 min | Google + Yelp |
| Cafe | `cafe` | 30 min | Google + Yelp |
| Bar | `bar` | 90 min | Google + Yelp |
| Bakery | `bakery` | 20 min | Google + Yelp |
| Museum | `museum` | 90 min | Yelp (re-fetch needed for more) |
| Art Gallery | `art_gallery` | 45 min | Google + Yelp |
| Park / Outdoors | `park` | 60 min | Yelp |
| Activities | `attraction` | 75 min | Google + Yelp |
| Nightclub | `night_club` | 120 min | Google + Yelp |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Optional | Claude generation layer. App works without it (no AI reasons/summary). |
| `GOOGLE_MAPS_API_KEY` | For data fetch only | Only needed when re-running `fetch_google.py` |
| `YELP_API_KEY` | For data fetch only | Only needed when re-running `fetch_yelp.py` |

Set for local dev:
```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
```

Set for Vercel: **Settings → Environment Variables** in the Vercel dashboard.

---

## Re-fetching Data (to add museums, more parks, etc.)

```bash
# 1. Set keys
export GOOGLE_MAPS_API_KEY=...
export YELP_API_KEY=...

# 2. Fetch (takes ~30 min due to API rate limits)
python3 collection/fetch_google.py   # adds museum, park, tourist_attraction, night_club
python3 collection/fetch_yelp.py     # adds museums, amusements, parks, galleries, nightlife

# 3. Rebuild unified dataset
python3 preprocessing/build_uniform_dataset.py

# 4. Commit and push
git add data/processed/
git commit -m "Rebuild dataset with new place categories"
git push origin sarah && git push bruinquest sarah
```
