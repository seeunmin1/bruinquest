import json
from pathlib import Path

RAW_PATH = Path(__file__).parent.parent / "data/raw/google_maps/la_places.json"

GOOGLE_TYPE_PRIORITY = [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "meal_takeaway",
    "meal_delivery",
    "food",
]


def get_google_place_type(types):
    types = [t.lower() for t in (types or []) if isinstance(t, str)]
    for preferred in GOOGLE_TYPE_PRIORITY:
        if preferred in types:
            if preferred in {"meal_takeaway", "meal_delivery", "food"}:
                return "restaurant"
            return preferred
    return None


def load_google_places(path: Path = RAW_PATH):
    if not path.exists():
        raise FileNotFoundError(f"Google raw file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        raw_places = json.load(f)

    places = []
    for raw in raw_places:
        place_type = get_google_place_type(raw.get("types", []))
        if not place_type:
            continue

        location = raw.get("geometry", {}).get("location", {})
        lat = location.get("lat")
        lng = location.get("lng")
        if lat is None or lng is None:
            continue

        price_level = raw.get("price_level")
        if price_level is not None:
            try:
                price_level = int(price_level)
            except (TypeError, ValueError):
                price_level = None

        places.append({
            "id": raw.get("place_id"),
            "source": "google",
            "name": raw.get("name"),
            "address": raw.get("formatted_address"),
            "place_type": place_type,
            "price_level": price_level,
            "user_rating_google": raw.get("rating"),
            "user_rating_yelp": None,
            "latitude": lat,
            "longitude": lng,
            "detail_url": f"https://www.google.com/maps/place/?q=place_id:{raw.get('place_id')}",
        })

    return places


if __name__ == "__main__":
    places = load_google_places()
    print(f"Loaded {len(places)} Google places")
