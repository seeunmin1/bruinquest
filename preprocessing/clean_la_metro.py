import json
from pathlib import Path

RAW_PATH = Path(__file__).parent.parent / "data/raw/la_metro/metro_stops.json"


def load_metro_stops(path: Path = RAW_PATH):
    if not path.exists():
        raise FileNotFoundError(f"Metro stops file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    stops = []
    for item in raw:
        geometry = item.get("geometry") or {}
        coords = geometry.get("coordinates")
        if coords and isinstance(coords, (list, tuple)) and len(coords) >= 2:
            longitude, latitude = coords[0], coords[1]
        else:
            latitude = item.get("latitude")
            longitude = item.get("longitude")

        if latitude is None or longitude is None:
            continue

        stops.append({
            "stop_id": item.get("stop_id"),
            "stop_name": item.get("stop_name"),
            "latitude": latitude,
            "longitude": longitude,
            "route_codes": item.get("route_codes", []),
        })

    return stops


if __name__ == "__main__":
    stops = load_metro_stops()
    print(f"Loaded {len(stops)} metro stops from {RAW_PATH}")
