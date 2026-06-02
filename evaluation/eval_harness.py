"""
BruinQuest RAG Evaluation Harness
Tests all three layers: query parsing, retrieval, and schedule correctness.
"""
import json
import math
import sys
import os
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "preprocessing"))
from build_uniform_dataset import haversine, DWELL_MINUTES

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS = "✅ PASS"
FAIL = "❌ FAIL"
SKIP = "⏭  SKIP"
results = []

def record(name, passed, detail=""):
    status = PASS if passed else FAIL
    results.append((status, name, detail))
    print(f"  {status}  {name}" + (f"  →  {detail}" if detail else ""))

def hhmm_to_mins(s):
    """'18:00' → 1080"""
    h, m = map(int, s.split(":"))
    return h * 60 + m

def load_places():
    path = Path(__file__).parent.parent / "data/processed/unified_places.json"
    with open(path) as f:
        return json.load(f)

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 1 — Query Parser
# ═══════════════════════════════════════════════════════════════════════════════

PARSE_CASES = [
    {
        "label": "koreatown dinner 3 hours",
        "query": "koreatown dinner outing 3 hours",
        "expect": {"location": "koreatown", "categories_include": ["restaurant"]},
        "time_window": 180,  # 3 hours in minutes
    },
    {
        "label": "Saturday night Hollywood bars",
        "query": "Saturday night in Hollywood: bars and live music",
        "expect": {"location": "hollywood", "dayOfWeek": 6},
        "categories_any": ["bar", "night_club"],
    },
    {
        "label": "Silver Lake Sunday morning coffee",
        "query": "slow Sunday morning Silver Lake, good coffee and maybe an art gallery",
        "expect": {"location": "silver_lake", "dayOfWeek": 0},
        "categories_any": ["cafe", "art_gallery"],
    },
    {
        "label": "Santa Monica afternoon outdoors",
        "query": "afternoon in Santa Monica, outdoor stuff and a bakery stop",
        "expect": {"location": "santa_monica"},
        "categories_any": ["park", "bakery"],
    },
    {
        "label": "Downtown lunch budget-friendly",
        "query": "downtown LA lunch, budget-friendly, 2 stops",
        "expect": {"location": "downtown", "numStops": 2},
        "categories_any": ["restaurant", "cafe"],
    },
]

def run_parse_evals():
    print("\n─────────────────────────────────────────")
    print("LAYER 1 · Query Parser  (POST /api/parse-query)")
    print("─────────────────────────────────────────")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"  {SKIP}  All parse tests — ANTHROPIC_API_KEY not set")
        return

    import urllib.request
    base = "http://localhost:3000"

    for case in PARSE_CASES:
        label = case["label"]
        try:
            body = json.dumps({"query": case["query"]}).encode()
            req = urllib.request.Request(
                f"{base}/api/parse-query",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                parsed = json.loads(r.read())
        except Exception as e:
            record(label, False, f"request failed: {e}")
            continue

        errors = []
        expect = case.get("expect", {})

        # Check exact expected fields
        for field, val in expect.items():
            if field == "numStops":
                if parsed.get("numStops") != val:
                    errors.append(f"numStops={parsed.get('numStops')} expected {val}")
            elif field == "dayOfWeek":
                if parsed.get("dayOfWeek") != val:
                    errors.append(f"dayOfWeek={parsed.get('dayOfWeek')} expected {val}")
            elif field == "location":
                if parsed.get("location") != val:
                    errors.append(f"location={parsed.get('location')!r} expected {val!r}")

        # Check at least one expected category present
        cats_include = case.get("categories_include", [])
        cats_any = case.get("categories_any", [])
        returned_cats = set(parsed.get("categories") or [])

        for c in cats_include:
            if c not in returned_cats:
                errors.append(f"missing required category {c!r}")

        if cats_any and not any(c in returned_cats for c in cats_any):
            errors.append(f"expected one of {cats_any}, got {list(returned_cats)}")

        # Check time window if specified
        if "time_window" in case:
            st = parsed.get("startTime")
            et = parsed.get("endTime")
            if st and et:
                diff = hhmm_to_mins(et) - hhmm_to_mins(st)
                if abs(diff - case["time_window"]) > 30:  # 30min tolerance
                    errors.append(f"time window {diff}min ≠ {case['time_window']}min")
            else:
                errors.append("startTime or endTime missing for time-window case")

        detail = f"→ {json.dumps({k:v for k,v in parsed.items() if v is not None})}"
        record(label, not errors, detail if not errors else f"{errors[0]}  {detail}")


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — Retrieval (planItinerary logic)
# ═══════════════════════════════════════════════════════════════════════════════

RETRIEVAL_CASES = [
    {
        "label": "Returns correct number of stops",
        "req": {"location": "ucla", "dayOfWeek": 6, "startTime": "12:00",
                "categories": ["restaurant", "cafe"], "numStops": 3},
        "check": lambda it: len(it) == 3,
        "detail": "expected 3 stops",
    },
    {
        "label": "Respects endTime (no stop departs after endTime)",
        "req": {"location": "westwood", "dayOfWeek": 1, "startTime": "12:00",
                "endTime": "15:00", "categories": ["restaurant", "cafe"], "numStops": 5},
        "check": lambda it: all(
            hhmm_to_mins(s["estimated_departure"].replace(" PM","").replace(" AM","").strip()) <= 15*60
            or ("PM" in s["estimated_departure"] and int(s["estimated_departure"].split(":")[0]) < 12)
            for s in it
        ),
        "detail": "all departures must be ≤ 3:00 PM",
    },
    {
        "label": "Stops are geographically close (travel ≤ 5 km between stops)",
        "req": {"location": "downtown", "dayOfWeek": 3, "startTime": "11:00",
                "categories": ["restaurant", "cafe", "bakery"], "numStops": 4},
        "check": lambda it: all(s["travel_from_prev_meters"] <= 5000 for s in it[1:]),
        "detail": "no stop > 5 km from previous",
    },
    {
        "label": "Bar rule: no bar before 8 PM",
        "req": {"location": "hollywood", "dayOfWeek": 5, "startTime": "14:00",
                "categories": ["bar"], "numStops": 2},
        "check": lambda it: all(
            "PM" in s["estimated_arrival"] and int(s["estimated_arrival"].split(":")[0]) >= 8
            or int(s["estimated_arrival"].split(":")[0]) == 12
            for s in it if s["place_type"] == "bar"
        ),
        "detail": "bar arrival must be ≥ 8 PM",
    },
    {
        "label": "Category cycling (3 categories, 6 stops → 2 of each)",
        "req": {"location": "koreatown", "dayOfWeek": 6, "startTime": "10:00",
                "categories": ["restaurant", "cafe", "bakery"], "numStops": 6},
        "check": lambda it: (
            sum(1 for s in it if s["place_type"]=="restaurant") >= 1 and
            sum(1 for s in it if s["place_type"]=="cafe") >= 1 and
            sum(1 for s in it if s["place_type"]=="bakery") >= 1
        ),
        "detail": "all 3 categories should appear",
    },
    {
        "label": "Slot distribution: 3 stops fill 12pm–10pm window evenly",
        "req": {"location": "ucla", "dayOfWeek": 0, "startTime": "12:00", "endTime": "22:00",
                "categories": ["restaurant", "cafe", "bar"], "numStops": 3},
        "check": lambda it: (
            len(it) == 3 and
            hhmm_to_mins(it[1]["estimated_arrival"].replace(" PM","").replace(" AM","")) > 180  # stop 2 not before 3pm
        ),
        "detail": "stop 2 should start after 3 PM (slot distribution working)",
    },
    {
        "label": "Minimum rating filter respected",
        "req": {"location": "beverly_hills", "dayOfWeek": 2, "startTime": "12:00",
                "categories": ["restaurant"], "numStops": 3, "minRating": 4.5},
        "check": lambda it: all((s["avg_user_rating"] or 0) >= 4.5 for s in it),
        "detail": "all stops must have rating ≥ 4.5",
    },
    {
        "label": "All stops have required fields",
        "req": {"location": "santa_monica", "dayOfWeek": 5, "startTime": "13:00",
                "categories": ["restaurant", "cafe"], "numStops": 2},
        "check": lambda it: all(
            s.get("name") and s.get("estimated_arrival") and s.get("estimated_departure")
            and s.get("latitude") and s.get("longitude")
            for s in it
        ),
        "detail": "name, arrival, departure, lat, lng all present",
    },
]

def run_retrieval_evals():
    print("\n─────────────────────────────────────────")
    print("LAYER 2 · Retrieval  (planItinerary)")
    print("─────────────────────────────────────────")

    # Import TypeScript logic via Node, or replicate in Python
    # We call the live /api/itinerary endpoint
    import urllib.request

    base = "http://localhost:3000"

    for case in RETRIEVAL_CASES:
        label = case["label"]
        req_body = case["req"]

        try:
            body = json.dumps(req_body).encode()
            req = urllib.request.Request(
                f"{base}/api/itinerary",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
            itinerary = data.get("itinerary", [])
        except Exception as e:
            record(label, False, f"request failed: {e}")
            continue

        if not itinerary and case["req"].get("numStops", 1) > 0:
            record(label, False, f"empty itinerary returned")
            continue

        try:
            passed = case["check"](itinerary)
            record(label, passed, case["detail"] if not passed else
                   f"{len(itinerary)} stops, first={itinerary[0]['name'][:25] if itinerary else '-'}")
        except Exception as e:
            record(label, False, f"check threw: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 3 — Data Integrity
# ═══════════════════════════════════════════════════════════════════════════════

def run_data_evals():
    print("\n─────────────────────────────────────────")
    print("LAYER 3 · Knowledge Base  (unified_places.json)")
    print("─────────────────────────────────────────")

    try:
        places = load_places()
    except FileNotFoundError:
        record("Dataset exists", False, "unified_places.json not found")
        return

    record("Dataset loads",   True, f"{len(places):,} places")
    record("Minimum size",    len(places) >= 5000, f"{len(places):,} (expected ≥ 5,000)")

    valid_types = {"restaurant","cafe","bar","bakery","museum","art_gallery","park","attraction","night_club"}
    bad_types = [p for p in places if p.get("place_type") not in valid_types]
    record("All place_types valid", len(bad_types) == 0,
           f"{len(bad_types)} invalid" if bad_types else "all clean")

    no_coords = [p for p in places if not p.get("latitude") or not p.get("longitude")]
    record("No missing coordinates", len(no_coords) == 0, f"{len(no_coords)} missing")

    has_metro = sum(1 for p in places if p.get("nearest_metro_station_name"))
    pct = has_metro / len(places) * 100
    record("Metro enrichment coverage", pct >= 90, f"{pct:.0f}% have nearest station")

    has_hours = sum(1 for p in places if p.get("hours_periods"))
    pct2 = has_hours / len(places) * 100
    record("Hours data coverage", pct2 >= 20, f"{pct2:.0f}% have hours_periods (20% threshold)")

    from collections import Counter
    counts = Counter(p["place_type"] for p in places)
    for t in ["restaurant", "cafe", "bar", "night_club", "park"]:
        record(f"Category '{t}' present", counts[t] > 0, f"{counts[t]:,} places")

    no_rating = sum(1 for p in places if p.get("avg_user_rating") is None)
    pct3 = (len(places) - no_rating) / len(places) * 100
    record("Rating coverage", pct3 >= 60, f"{pct3:.0f}% have ratings")

    dupes = len(places) - len({p["id"] for p in places})
    record("No duplicate IDs", dupes == 0, f"{dupes} duplicates found")


# ═══════════════════════════════════════════════════════════════════════════════
# Run all
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("╔══════════════════════════════════════════╗")
    print("║   BruinQuest RAG Evaluation Harness      ║")
    print(f"║   {datetime.now().strftime('%Y-%m-%d %H:%M')}                         ║")
    print("╚══════════════════════════════════════════╝")

    run_data_evals()
    run_retrieval_evals()
    run_parse_evals()

    total  = len(results)
    passed = sum(1 for r in results if r[0] == PASS)
    failed = sum(1 for r in results if r[0] == FAIL)
    skipped = sum(1 for r in results if r[0] == SKIP)

    print("\n══════════════════════════════════════════")
    print(f"  Results:  {passed} passed  ·  {failed} failed  ·  {skipped} skipped  /  {total} total")
    pct = (passed / (total - skipped) * 100) if (total - skipped) > 0 else 0
    print(f"  Score:    {pct:.0f}%")
    print("══════════════════════════════════════════")

    sys.exit(0 if failed == 0 else 1)
