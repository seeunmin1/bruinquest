import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()
YELP_API_KEY = os.getenv("YELP_API_KEY")
if not YELP_API_KEY:
    raise RuntimeError("YELP_API_KEY is missing. Add it to .env or export it in your environment.")

OUTPUT_DIR = Path("data/raw/yelp")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://api.yelp.com/v3/businesses/search"
HEADERS = {"Authorization": f"Bearer {YELP_API_KEY}"}
SEARCH_LIMIT = 50
MAX_PAGES = 3

LA_NEIGHBORHOODS = {
    "downtown": "Downtown, Los Angeles, CA",
    "silver_lake": "Silver Lake, Los Angeles, CA",
    "koreatown": "Koreatown, Los Angeles, CA",
    "west_hollywood": "West Hollywood, CA",
    "santa_monica": "Santa Monica, CA",
    "culver_city": "Culver City, CA",
    "los_feliz": "Los Feliz, Los Angeles, CA",
    "echo_park": "Echo Park, Los Angeles, CA",
    "westwood": "Westwood, Los Angeles, CA",
    "brentwood": "Brentwood, Los Angeles, CA",
    "century_city": "Century City, Los Angeles, CA",
    "venice_beach": "Venice Beach, Los Angeles, CA",
    "beverly_hills": "Beverly Hills, CA",
    "hollywood": "Hollywood, Los Angeles, CA",
    "pasadena": "Pasadena, CA",
    "manhattan_beach": "Manhattan Beach, CA",
}

DEFAULT_CATEGORIES = ["restaurants", "cafes", "bars", "coffee", "bakeries"]


def search_businesses(location, categories, offset=0):
    params = {
        "location": location,
        "categories": categories,
        "limit": SEARCH_LIMIT,
        "offset": offset,
        "radius": 1500,
    }
    response = requests.get(BASE_URL, headers=HEADERS, params=params, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"Yelp API error {response.status_code}: {response.text[:500]}")
    return response.json()


def save_json(data, filename):
    path = OUTPUT_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved {path}")


def fetch_yelp_data():
    businesses = {}

    for neighborhood, location in LA_NEIGHBORHOODS.items():
        print(f"Fetching Yelp businesses for {neighborhood} ({location})")

        for category in DEFAULT_CATEGORIES:
            offset = 0
            page = 0

            while page < MAX_PAGES:
                print(f"  → category={category} offset={offset}")
                data = search_businesses(location, category, offset)
                results = data.get("businesses", [])
                if not results:
                    break

                for business in results:
                    businesses[business["id"]] = business

                if len(results) < SEARCH_LIMIT:
                    break

                page += 1
                offset += SEARCH_LIMIT
                time.sleep(0.5)

    rows = list(businesses.values())
    save_json(rows, "yelp_businesses.json")
    return rows


if __name__ == "__main__":
    print("Starting Yelp fetch for LA...")
    rows = fetch_yelp_data()
    print(f"Fetched {len(rows)} unique Yelp businesses")
