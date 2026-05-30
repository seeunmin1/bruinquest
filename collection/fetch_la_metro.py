import json
import time
import requests
from pathlib import Path

BASE_URL = "https://api.metro.net"
OUT_DIR = Path("data/raw/la_metro")
OUT_DIR.mkdir(parents=True, exist_ok=True)

AGENCIES = ["LACMTA", "LACMTA_Rail"]


def fetch_json(url, params=None):
    response = requests.get(url, params=params, timeout=30)
    print("GET:", response.url, "→", response.status_code)
    response.raise_for_status()
    return response.json()


def fetch_all_routes():
    data = fetch_json(f"{BASE_URL}/routes")
    # API returns either a list or {"items": [...]}
    return data if isinstance(data, list) else data.get("items", [])


def fetch_route_stops(agency_id, route_code):
    try:
        data = fetch_json(f"{BASE_URL}/{agency_id}/route_stops/{route_code}")
        return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        print(f"  Skipping {agency_id}/{route_code}: {e}")
        return []


def extract_coords(stop):
    # Handle GeoJSON geometry or flat lat/lng fields
    geometry = stop.get("geometry") or {}
    coords = geometry.get("coordinates")
    if coords and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        return coords[1], coords[0]  # GeoJSON is [lng, lat]
    lat = stop.get("latitude") or stop.get("lat")
    lng = stop.get("longitude") or stop.get("lng") or stop.get("lon")
    return lat, lng


def fetch_all_stops():
    routes = fetch_all_routes()
    print(f"Found {len(routes)} routes across all agencies")

    stops_by_id = {}

    for route in routes:
        agency_id = route.get("agency_id") or route.get("agency")
        route_code = route.get("route_code") or route.get("id") or route.get("code")

        if not agency_id or not route_code:
            continue

        if agency_id not in AGENCIES:
            continue

        raw_stops = fetch_route_stops(agency_id, route_code)

        for stop in raw_stops:
            stop_id = stop.get("id") or stop.get("stop_id")
            if not stop_id:
                continue

            stop_id = str(stop_id)
            lat, lng = extract_coords(stop)

            if stop_id not in stops_by_id:
                stops_by_id[stop_id] = {
                    "stop_id": stop_id,
                    "stop_name": stop.get("display_name") or stop.get("stop_name") or stop.get("name"),
                    "latitude": lat,
                    "longitude": lng,
                    "route_codes": [],
                }

            if route_code not in stops_by_id[stop_id]["route_codes"]:
                stops_by_id[stop_id]["route_codes"].append(route_code)

        time.sleep(0.1)

    return list(stops_by_id.values())


if __name__ == "__main__":
    stops = fetch_all_stops()
    with_coords = [s for s in stops if s["latitude"] is not None and s["longitude"] is not None]
    print(f"\nTotal unique stops: {len(stops)}, with coordinates: {len(with_coords)}")

    out_path = OUT_DIR / "metro_stops.json"
    with open(out_path, "w") as f:
        json.dump(stops, f, indent=2)
    print(f"Saved to {out_path}")
    print("Sample:", json.dumps(stops[:2], indent=2))
