import csv
import json
import math
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from clean_google import load_google_places
from clean_la_metro import load_metro_stops
from clean_yelp import load_yelp_places

OUTPUT_DIR = Path(__file__).parent.parent / "data/processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

UCLA_COORDS = (34.068932, -118.445183)
LOCATION_ALIASES = {
    "ucla": UCLA_COORDS,
    "westwood": (34.0590, -118.4439),
    "downtown": (34.0407, -118.2468),
    "santa_monica": (34.0195, -118.4912),
    "hollywood": (34.0928, -118.3287),
    "koreatown": (34.0584, -118.3006),
    "silver_lake": (34.0869, -118.2702),
    "venice_beach": (33.9850, -118.4695),
    "beverly_hills": (34.0736, -118.4004),
}

# Estimated minutes to spend at each place type
DWELL_MINUTES = {
    "restaurant": 60,
    "cafe": 30,
    "bar": 45,
    "bakery": 20,
}

WALKING_SPEED_MPS = 1.4  # ~5 km/h


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def nearest_metro_stop(lat, lng, metro_stops):
    best = None
    for stop in metro_stops:
        if stop["latitude"] is None or stop["longitude"] is None:
            continue
        distance = haversine(lat, lng, stop["latitude"], stop["longitude"])
        if best is None or distance < best["distance_meters"]:
            best = {
                "stop_id": stop.get("stop_id"),
                "stop_name": stop.get("stop_name"),
                "latitude": stop["latitude"],
                "longitude": stop["longitude"],
                "distance_meters": distance,
                "route_codes": stop.get("route_codes", []),
            }
    return best


def normalize_place(place, metro_stops):
    lat = place.get("latitude")
    lng = place.get("longitude")
    if lat is None or lng is None:
        return None

    nearest = nearest_metro_stop(lat, lng, metro_stops)

    ratings = [r for r in [place.get("user_rating_google"), place.get("user_rating_yelp")] if r is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    return {
        "id": place.get("id"),
        "source": place.get("source"),
        "name": place.get("name"),
        "address": place.get("address"),
        "place_type": place.get("place_type"),
        "price_level": place.get("price_level"),
        "user_rating_google": place.get("user_rating_google"),
        "user_rating_yelp": place.get("user_rating_yelp"),
        "avg_user_rating": avg_rating,
        "latitude": lat,
        "longitude": lng,
        "nearest_metro_station_name": nearest.get("stop_name") if nearest else None,
        "nearest_metro_station_id": nearest.get("stop_id") if nearest else None,
        "nearest_metro_distance_meters": nearest.get("distance_meters") if nearest else None,
        "nearest_metro_route_codes": nearest.get("route_codes") if nearest else [],
        "detail_url": place.get("detail_url"),
    }


def build_unified_dataset():
    google_places = load_google_places()
    yelp_places = load_yelp_places()
    metro_stops = load_metro_stops()

    if not google_places and not yelp_places:
        raise RuntimeError("No Google or Yelp data found. Run the fetch scripts first.")

    unified = []
    for place in google_places + yelp_places:
        row = normalize_place(place, metro_stops)
        if row:
            unified.append(row)

    unified.sort(key=lambda r: (r["place_type"] or "", -(r["avg_user_rating"] or 0)))
    return unified


def location_to_coords(location):
    if location is None:
        return UCLA_COORDS
    if isinstance(location, tuple) and len(location) == 2:
        return location
    key = str(location).strip().lower().replace(" ", "_")
    return LOCATION_ALIASES.get(key, UCLA_COORDS)


def recommend(places, place_type=None, price_level=None, location=None, top_n=10):
    user_lat, user_lng = location_to_coords(location)
    candidates = []

    for place in places:
        if place_type and place.get("place_type") != place_type:
            continue
        if price_level is not None and place.get("price_level") != price_level:
            continue

        dist = haversine(user_lat, user_lng, place["latitude"], place["longitude"])
        candidates.append({**place, "user_distance_meters": dist})

    # Sort by distance first, break ties by rating descending
    candidates.sort(key=lambda r: (r["user_distance_meters"], -(r.get("avg_user_rating") or 0)))
    return candidates[:top_n]


def _parse_start_time(start_time):
    if start_time is None:
        return datetime.now()
    if isinstance(start_time, datetime):
        return start_time
    today = datetime.now().date()
    for fmt in ("%I:%M %p", "%H:%M", "%I%p"):
        try:
            t = datetime.strptime(start_time.strip(), fmt)
            return datetime.combine(today, t.time())
        except ValueError:
            continue
    return datetime.now()


def plan_itinerary(places, categories, location=None, price_level=None, start_time=None, num_stops=None):
    """
    Build a time-stamped multi-stop itinerary.

    Args:
        places:      full unified dataset
        categories:  list of place_type strings, e.g. ["restaurant", "cafe", "bar"]
                     repeats are fine; stops cycle through the list
        location:    string alias or (lat, lng) tuple; defaults to UCLA
        price_level: int 1-4 or None for any price
        start_time:  datetime or "HH:MM" / "10:30 AM" string; defaults to now
        num_stops:   total stops to plan; defaults to len(categories)

    Returns:
        list of stop dicts with estimated arrival/departure and travel info
    """
    if not categories:
        categories = ["restaurant"]
    if num_stops is None:
        num_stops = len(categories)

    # Repeat categories cyclically to fill num_stops slots
    category_sequence = (categories * ((num_stops // len(categories)) + 1))[:num_stops]

    current_time = _parse_start_time(start_time)
    current_lat, current_lng = location_to_coords(location)
    used_ids = set()
    itinerary = []

    for i, category in enumerate(category_sequence):
        candidates = []
        for place in places:
            if place.get("id") in used_ids:
                continue
            if place.get("place_type") != category:
                continue
            if price_level is not None and place.get("price_level") != price_level:
                continue
            dist = haversine(current_lat, current_lng, place["latitude"], place["longitude"])
            candidates.append((dist, place))

        if not candidates:
            continue

        # Pick closest with best rating as tiebreaker
        candidates.sort(key=lambda t: (t[0], -(t[1].get("avg_user_rating") or 0)))
        dist_m, pick = candidates[0]
        used_ids.add(pick["id"])

        travel_secs = dist_m / WALKING_SPEED_MPS
        arrival = current_time + timedelta(seconds=travel_secs)
        dwell = DWELL_MINUTES.get(category, 45)
        departure = arrival + timedelta(minutes=dwell)

        itinerary.append({
            "stop_number": i + 1,
            "name": pick["name"],
            "address": pick["address"],
            "place_type": pick["place_type"],
            "price_level": pick.get("price_level"),
            "avg_user_rating": pick.get("avg_user_rating"),
            "user_rating_google": pick.get("user_rating_google"),
            "user_rating_yelp": pick.get("user_rating_yelp"),
            "latitude": pick["latitude"],
            "longitude": pick["longitude"],
            "nearest_metro_station": pick.get("nearest_metro_station_name"),
            "nearest_metro_distance_meters": pick.get("nearest_metro_distance_meters"),
            "nearest_metro_route_codes": pick.get("nearest_metro_route_codes", []),
            "estimated_arrival": arrival.strftime("%I:%M %p"),
            "estimated_departure": departure.strftime("%I:%M %p"),
            "travel_from_prev_meters": round(dist_m),
            "detail_url": pick.get("detail_url"),
        })

        current_lat, current_lng = pick["latitude"], pick["longitude"]
        current_time = departure

    return itinerary


def save_json(data, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def save_csv(data, path):
    if not data:
        return
    keys = [
        "id", "source", "name", "address", "place_type", "price_level",
        "user_rating_google", "user_rating_yelp", "avg_user_rating",
        "latitude", "longitude",
        "nearest_metro_station_name", "nearest_metro_distance_meters",
        "nearest_metro_route_codes", "detail_url",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in data:
            copy = {k: row.get(k) for k in keys}
            if isinstance(copy.get("nearest_metro_route_codes"), list):
                copy["nearest_metro_route_codes"] = ",".join(str(x) for x in copy["nearest_metro_route_codes"])
            writer.writerow(copy)


if __name__ == "__main__":
    print("Building unified dataset...")
    unified = build_unified_dataset()

    json_path = OUTPUT_DIR / "unified_places.json"
    csv_path = OUTPUT_DIR / "unified_places.csv"
    save_json(unified, json_path)
    save_csv(unified, csv_path)
    print(f"Saved {len(unified)} places → {json_path} and {csv_path}")

    # Sample single-type recommendation
    print("\n--- Sample: top 5 restaurants near UCLA, price level 2 ---")
    recs = recommend(unified, place_type="restaurant", price_level=2, location="ucla", top_n=5)
    for r in recs:
        print(f"  {r['name']} | rating={r['avg_user_rating']} | price={r['price_level']} "
              f"| metro={r['nearest_metro_station_name']} ({r['nearest_metro_distance_meters']} m)")

    # Sample itinerary
    print("\n--- Sample itinerary: restaurant → cafe → bar, starting at UCLA at 6:00 PM ---")
    itinerary = plan_itinerary(
        unified,
        categories=["restaurant", "cafe", "bar"],
        location="ucla",
        start_time="6:00 PM",
    )
    for stop in itinerary:
        print(
            f"  Stop {stop['stop_number']}: {stop['name']} ({stop['place_type']})\n"
            f"    Arrive {stop['estimated_arrival']} → Leave {stop['estimated_departure']}\n"
            f"    Rating: {stop['avg_user_rating']} | Price: {stop['price_level']}\n"
            f"    Nearest metro: {stop['nearest_metro_station']} ({stop['nearest_metro_distance_meters']} m)\n"
            f"    Travel from prev: {stop['travel_from_prev_meters']} m"
        )
