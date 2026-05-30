import {
  BAR_EARLIEST_HHMM,
  DWELL_MINUTES,
  HoursPeriod,
  ItineraryRequest,
  ItineraryStop,
  LOCATION_ALIASES,
  LocationKey,
  Place,
  WALKING_SPEED_MPS,
} from "./types";

export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// Converts "HH:MM" to integer HHMM (e.g. "14:30" → 1430)
export function parseTimeToHHMM(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 100 + m;
}

// Adds minutes to a HHMM integer (handles hour overflow)
export function addMinutesToHHMM(hhmm: number, minutes: number): number {
  const totalMinutes = Math.floor(hhmm / 100) * 60 + (hhmm % 100) + minutes;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return h * 100 + m;
}

// Adds seconds to HHMM
export function addSecondsToHHMM(hhmm: number, seconds: number): number {
  return addMinutesToHHMM(hhmm, Math.round(seconds / 60));
}

export function formatHHMM(hhmm: number): string {
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Checks if a place is open at a given time.
// dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday (Google convention)
// timeHHMM: integer like 1430 for 2:30 PM
// Returns true if open, or if hours are unknown (permissive fallback).
export function isOpenAt(
  periods: HoursPeriod[] | null | undefined,
  dayOfWeek: number,
  timeHHMM: number
): boolean {
  if (!periods || periods.length === 0) return true; // unknown hours — assume open

  for (const period of periods) {
    const openDay = period.open.day;
    const openTime = parseInt(period.open.time, 10);

    if (!period.close) {
      // 24-hour place
      return true;
    }

    const closeDay = period.close.day;
    const closeTime = parseInt(period.close.time, 10);

    if (openDay === closeDay) {
      if (dayOfWeek === openDay && timeHHMM >= openTime && timeHHMM < closeTime)
        return true;
    } else {
      // Period spans midnight
      if (dayOfWeek === openDay && timeHHMM >= openTime) return true;
      if (dayOfWeek === closeDay && timeHHMM < closeTime) return true;
    }
  }

  return false;
}

export function locationToCoords(location: string): [number, number] {
  const key = location.trim().toLowerCase().replace(/\s+/g, "_") as LocationKey;
  return LOCATION_ALIASES[key] ?? LOCATION_ALIASES["ucla"];
}

export function planItinerary(
  places: Place[],
  req: ItineraryRequest
): ItineraryStop[] {
  const { location, dayOfWeek, startTime, endTime, categories, priceLevels, minRating, numStops } = req;

  if (!categories || categories.length === 0) return [];

  const categorySequence = Array.from(
    { length: numStops },
    (_, i) => categories[i % categories.length]
  );

  const endHHMM = endTime ? parseTimeToHHMM(endTime) : null;

  let currentHHMM = parseTimeToHHMM(startTime);
  let [currentLat, currentLng] = locationToCoords(location);
  const usedIds = new Set<string>();
  const itinerary: ItineraryStop[] = [];

  for (let i = 0; i < categorySequence.length; i++) {
    const category = categorySequence[i];

    // Estimate arrival at nearest candidate to get a time check
    // We'll compute arrival per candidate since distance varies
    const candidates: Array<{ dist: number; place: Place; arrivalHHMM: number }> = [];

    for (const place of places) {
      if (usedIds.has(place.id)) continue;
      if (place.place_type !== category) continue;

      // Price filter
      if (priceLevels && priceLevels.length > 0) {
        if (place.price_level === null || !priceLevels.includes(place.price_level))
          continue;
      }

      // Rating filter
      if (minRating != null && minRating > 0) {
        if (place.avg_user_rating === null || place.avg_user_rating < minRating)
          continue;
      }

      const dist = haversine(currentLat, currentLng, place.latitude, place.longitude);
      const travelSecs = dist / WALKING_SPEED_MPS;
      const arrivalHHMM = addSecondsToHHMM(currentHHMM, travelSecs);

      // Bar/club rule: no bars before 8 PM
      if (category === "bar" && arrivalHHMM < BAR_EARLIEST_HHMM) continue;

      // Hours check
      if (!isOpenAt(place.hours_periods, dayOfWeek, arrivalHHMM)) continue;

      // End-time check: departure must be before endTime
      const dwell = DWELL_MINUTES[category] ?? 45;
      const departureHHMM = addMinutesToHHMM(arrivalHHMM, dwell);
      if (endHHMM !== null && departureHHMM > endHHMM) continue;

      candidates.push({ dist, place, arrivalHHMM });
    }

    if (candidates.length === 0) continue;

    // Pick closest; break ties by rating descending
    candidates.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return (b.place.avg_user_rating ?? 0) - (a.place.avg_user_rating ?? 0);
    });

    const { dist, place, arrivalHHMM } = candidates[0];
    usedIds.add(place.id);

    const dwell = DWELL_MINUTES[category] ?? 45;
    const departureHHMM = addMinutesToHHMM(arrivalHHMM, dwell);

    itinerary.push({
      stop_number: itinerary.length + 1,
      name: place.name,
      address: place.address,
      place_type: place.place_type,
      price_level: place.price_level,
      avg_user_rating: place.avg_user_rating,
      latitude: place.latitude,
      longitude: place.longitude,
      nearest_metro_station: place.nearest_metro_station_name,
      nearest_metro_distance_meters: place.nearest_metro_distance_meters,
      nearest_metro_route_codes: place.nearest_metro_route_codes ?? [],
      estimated_arrival: formatHHMM(arrivalHHMM),
      estimated_departure: formatHHMM(departureHHMM),
      arrival_hhmm: arrivalHHMM,
      travel_from_prev_meters: Math.round(dist),
      detail_url: place.detail_url,
    });

    currentLat = place.latitude;
    currentLng = place.longitude;
    currentHHMM = departureHHMM;
  }

  return itinerary;
}
