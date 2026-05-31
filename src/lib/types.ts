export interface MetroPrediction {
  route_id: string;
  minutes: number;
  direction: string;
}

export interface HoursPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface Place {
  id: string;
  source: string;
  name: string;
  address: string;
  place_type: string;
  price_level: number | null;
  user_rating_google: number | null;
  user_rating_yelp: number | null;
  avg_user_rating: number | null;
  review_count: number | null;
  is_open: boolean | null;
  hours_periods: HoursPeriod[] | null;
  latitude: number;
  longitude: number;
  nearest_metro_station_name: string | null;
  nearest_metro_station_id: string | null;
  nearest_metro_distance_meters: number | null;
  nearest_metro_route_codes: number[];
  detail_url: string | null;
}

export interface ItineraryStop {
  stop_number: number;
  name: string;
  address: string;
  place_type: string;
  price_level: number | null;
  avg_user_rating: number | null;
  latitude: number;
  longitude: number;
  nearest_metro_station: string | null;
  nearest_metro_station_id: string | null;
  nearest_metro_distance_meters: number | null;
  nearest_metro_route_codes: number[];
  estimated_arrival: string;
  estimated_departure: string;
  arrival_hhmm: number;
  travel_from_prev_meters: number;
  detail_url: string | null;
  // Added by RAG generation layer
  ai_reason?: string;
  metro_predictions: MetroPrediction[];
}

export interface ItineraryRequest {
  location: string;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  categories: string[];
  priceLevels?: number[];
  minRating?: number;
  numStops: number;
}

export type LocationKey =
  | "ucla"
  | "westwood"
  | "downtown"
  | "santa_monica"
  | "hollywood"
  | "koreatown"
  | "silver_lake"
  | "venice_beach"
  | "beverly_hills";

export const LOCATION_ALIASES: Record<LocationKey, [number, number]> = {
  ucla: [34.068932, -118.445183],
  westwood: [34.059, -118.4439],
  downtown: [34.0407, -118.2468],
  santa_monica: [34.0195, -118.4912],
  hollywood: [34.0928, -118.3287],
  koreatown: [34.0584, -118.3006],
  silver_lake: [34.0869, -118.2702],
  venice_beach: [33.985, -118.4695],
  beverly_hills: [34.0736, -118.4004],
};

export const LOCATION_LABELS: Record<LocationKey, string> = {
  ucla: "UCLA",
  westwood: "Westwood",
  downtown: "Downtown LA",
  santa_monica: "Santa Monica",
  hollywood: "Hollywood",
  koreatown: "Koreatown",
  silver_lake: "Silver Lake",
  venice_beach: "Venice Beach",
  beverly_hills: "Beverly Hills",
};

export const DWELL_MINUTES: Record<string, number> = {
  restaurant: 60,
  cafe: 30,
  bar: 90,
  bakery: 20,
  museum: 90,
  art_gallery: 45,
  park: 60,
  attraction: 75,
  night_club: 120,
};

export const WALKING_SPEED_MPS = 1.4;

export const BAR_EARLIEST_HHMM = 2000;
