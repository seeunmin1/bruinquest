import json
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent / "data/raw/yelp"
# Legacy path used by earlier fetch script
_LEGACY_YELP_PATH = Path(__file__).parent.parent / "data/raw/google_maps/raw_yelp.json"

YELP_CATEGORY_MAP = {
    "restaurants": "restaurant",
    "food": "restaurant",
    "breakfast_brunch": "restaurant",
    "coffee": "cafe",
    "cafes": "cafe",
    "bars": "bar",
    "wine_bars": "bar",
    "cocktailbars": "bar",
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
    # Museums & cultural
    "museums": "museum",
    "art_museums": "museum",
    "sciencemuseums": "museum",
    "historicalmuseums": "museum",
    "childrenmuseum": "museum",
    # Galleries
    "galleries": "art_gallery",
    "artgalleries": "art_gallery",
    # Outdoors & parks
    "parks": "park",
    "hiking": "park",
    "beaches": "park",
    "botanicalgardens": "park",
    "recreation": "park",
    # Attractions & activities
    "arts": "attraction",
    "amusementparks": "attraction",
    "arcades": "attraction",
    "escape_games": "attraction",
    "bowling": "attraction",
    "movietheaters": "attraction",
    "zoos": "attraction",
    "aquariums": "attraction",
    "tours": "attraction",
    # Nightlife
    "nightlife": "night_club",
    "danceclubs": "night_club",
    "musicvenues": "night_club",
    "jazzandblues": "night_club",
    "comedyclubs": "night_club",
    "lounges": "night_club",
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
        if "bakery" in alias or "pastry" in alias:
            return "bakery"
        if "museum" in alias:
            return "museum"
        if "gallery" in alias or "galleries" in alias:
            return "art_gallery"
        if "park" in alias or "garden" in alias or "nature" in alias:
            return "park"
        if "club" in alias or "nightlife" in alias or "lounge" in alias:
            return "night_club"
        if "attraction" in alias or "amusement" in alias or "arcade" in alias or "theater" in alias:
            return "attraction"

    return None


def load_yelp_places(base_dir: Path = RAW_DIR):
    # Collect all JSON paths: new-style dir + legacy single file
    json_paths = sorted(base_dir.glob("*.json")) if base_dir.exists() else []
    if _LEGACY_YELP_PATH.exists():
        json_paths = [_LEGACY_YELP_PATH] + [p for p in json_paths if p != _LEGACY_YELP_PATH]
    if not json_paths:
        raise FileNotFoundError(f"No Yelp data found in {base_dir} or {_LEGACY_YELP_PATH}")

    places = []
    for path in json_paths:
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
