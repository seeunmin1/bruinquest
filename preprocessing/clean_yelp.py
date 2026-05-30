import json
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent / "data/raw/yelp"

YELP_CATEGORY_MAP = {
    "restaurants": "restaurant",
    "food": "restaurant",
    "breakfast_brunch": "restaurant",
    "coffee": "cafe",
    "cafes": "cafe",
    "bars": "bar",
    "wine_bars": "bar",
    "bakeries": "bakery",
    "bagels": "bakery",
    "donuts": "bakery",
    "pizza": "restaurant",
    "sandwiches": "restaurant",
    "asianfusion": "restaurant",
    "mexican": "restaurant",
    "italian": "restaurant",
    "japanese": "restaurant",
    "sushi": "restaurant",
    "korean": "restaurant",
    "chinese": "restaurant",
    "thai": "restaurant",
    "vietnamese": "restaurant",
    "indpak": "restaurant",
    "mediterranean": "restaurant",
    "seafood": "restaurant",
    "bbq": "restaurant",
    "burgers": "restaurant",
}


def map_yelp_place_type(categories):
    if not categories:
        return None

    for category in categories:
        alias = category.get("alias", "").lower()
        if alias in YELP_CATEGORY_MAP:
            return YELP_CATEGORY_MAP[alias]
        if "coffee" in alias or "cafe" in alias:
            return "cafe"
        if "bar" in alias:
            return "bar"
        if "bakery" in alias:
            return "bakery"

    return None


def load_yelp_places(base_dir: Path = RAW_DIR):
    if not base_dir.exists():
        raise FileNotFoundError(f"Yelp raw directory not found: {base_dir}")

    places = []
    for path in sorted(base_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as f:
            raw = json.load(f)

        businesses = raw if isinstance(raw, list) else raw.get("businesses", [])
        for business in businesses:
            place_type = map_yelp_place_type(business.get("categories", []))
            if not place_type:
                continue

            coords = business.get("coordinates", {})
            lat = coords.get("latitude")
            lng = coords.get("longitude")
            if lat is None or lng is None:
                continue

            price = business.get("price")
            price_level = len(price) if isinstance(price, str) else None

            address = ", ".join(filter(None, [
                business.get("location", {}).get("address1"),
                business.get("location", {}).get("city"),
                business.get("location", {}).get("state"),
            ]))

            is_closed = business.get("is_closed")
            places.append({
                "id": business.get("id"),
                "source": "yelp",
                "name": business.get("name"),
                "address": address,
                "place_type": place_type,
                "price_level": price_level,
                "user_rating_google": None,
                "user_rating_yelp": business.get("rating"),
                "review_count": business.get("review_count"),
                "is_open": (not is_closed) if is_closed is not None else None,
                "latitude": lat,
                "longitude": lng,
                "detail_url": business.get("url"),
            })

    return places


if __name__ == "__main__":
    places = load_yelp_places()
    print(f"Loaded {len(places)} Yelp places")
