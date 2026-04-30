import os
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

OUTPUT_DIR = Path("data/raw/google_maps")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://maps.googleapis.com/maps/api"

LA_NEIGHBORHOODS = {
    "downtown":        {"lat": 34.0407, "lng": -118.2468},
    "silver_lake":     {"lat": 34.0869, "lng": -118.2702},
    "koreatown":       {"lat": 34.0584, "lng": -118.3006},
    "west_hollywood":  {"lat": 34.0900, "lng": -118.3617},
    "santa_monica":    {"lat": 34.0195, "lng": -118.4912},
    "culver_city":     {"lat": 34.0211, "lng": -118.3965},
    "los_feliz":       {"lat": 34.1084, "lng": -118.2864},
    "echo_park":       {"lat": 34.0782, "lng": -118.2606},
    "westwood":        {"lat": 34.0635, "lng": -118.4454},
    "sawtelle":        {"lat": 34.0376, "lng": -118.4376},
    "brentwood":       {"lat": 34.0490, "lng": -118.4748},
    "century_city":    {"lat": 34.0560, "lng": -118.4160},
    "venice_beach":    {"lat": 33.9850, "lng": -118.4695},
    "beverly_hills":   {"lat": 34.0736, "lng": -118.4004},
    "hollywood":       {"lat": 34.0928, "lng": -118.3287},
    "pasadena":        {"lat": 34.1478, "lng": -118.1445},
    "manhattan_beach": {"lat": 33.8847, "lng": -118.4109},
}

SEARCH_RADIUS = 1500
PLACE_TYPES = ["restaurant", "cafe", "bar", "store"]

DETAIL_FIELDS = [
    "place_id", "name", "types", "formatted_address",
    "geometry", "rating", "user_ratings_total", "price_level",
    "opening_hours", "website", "formatted_phone_number",
    "reviews", "editorial_summary",
]


def nearby_search(lat, lng, place_type, radius=SEARCH_RADIUS):
    results = []
    url = f"{BASE_URL}/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": place_type,
        "key": API_KEY,
    }

    while True:
        response = requests.get(url, params=params)
        data = response.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"  Warning: {data.get('status')} — {data.get('error_message', '')}")
            break

        results.extend(data.get("results", []))

        next_token = data.get("next_page_token")
        if not next_token:
            break

        time.sleep(2)
        params = {"pagetoken": next_token, "key": API_KEY}

    return results


def get_place_details(place_id):
    url = f"{BASE_URL}/place/details/json"
    params = {
        "place_id": place_id,
        "fields": ",".join(DETAIL_FIELDS),
        "key": API_KEY,
    }
    response = requests.get(url, params=params)
    data = response.json()

    if data.get("status") != "OK":
        print(f"  Detail fetch failed for {place_id}: {data.get('status')}")
        return None

    return data.get("result")


def fetch_la_data():
    all_places = {}

    for neighborhood, coords in LA_NEIGHBORHOODS.items():
        print(f"\n📍 Fetching: {neighborhood}")

        for place_type in PLACE_TYPES:
            print(f"  → type: {place_type}")
            stubs = nearby_search(coords["lat"], coords["lng"], place_type)
            print(f"     {len(stubs)} results")

            for stub in stubs:
                place_id = stub["place_id"]
                if place_id in all_places:
                    continue

                detail = get_place_details(place_id)
                if detail:
                    detail["_neighborhood"] = neighborhood
                    all_places[place_id] = detail

                time.sleep(0.05)

    return list(all_places.values())


if __name__ == "__main__":
    print("Starting Google Maps fetch for LA...\n")
    places = fetch_la_data()

    output_path = OUTPUT_DIR / "la_places.json"
    with open(output_path, "w") as f:
        json.dump(places, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done. {len(places)} places saved to {output_path}")