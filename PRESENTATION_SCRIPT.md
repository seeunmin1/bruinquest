# BruinQuest — Presentation Script

> Speakable draft. Estimated delivery time: ~8–10 minutes.
> Sections marked [PAUSE] give you a beat to breathe or click to the next slide.

---

## Opening

So — we've all been in this situation. You're trying to plan a day out in LA, you open Google Maps, you get completely overwhelmed, and you end up just going to the same three places you always go.

BruinQuest is our answer to that problem.

It's an AI-powered day planner for Los Angeles, built specifically for students and anyone in the UCLA orbit who wants to actually explore the city. You tell it what kind of day you're after — the vibe, the neighborhood, the time — and it hands you a full itinerary: specific places, walk times, transit options, and an AI-generated reason why each stop fits what you asked for.

[PAUSE]

---

## The Data Foundation

Let's start with the data, because this is where the system is grounded in reality.

We pulled from three sources.

First, **Google Maps** — using their Places API, we scraped restaurants, cafes, bars, bakeries, museums, galleries, parks, and more across seventeen Los Angeles neighborhoods.

Second, **Yelp** — which gave us ratings, review counts, price levels, and categories for over ten thousand businesses, including nightlife, parks, and activities that Google didn't always capture.

Third, the **LA Metro API** — every single bus and rail stop in the system, with coordinates and route codes.

We ran all three sources through a preprocessing pipeline that normalizes everything into a unified schema. Each place ends up with: a name, address, place type, price level, averaged rating from Google and Yelp, coordinates, business hours, and — importantly — its nearest metro station, computed with the Haversine formula.

The final dataset is **8,885 places** across nine categories.

And we found a bug in this process worth mentioning. The Yelp data had been sitting in the wrong directory this whole time — it was living in a Google Maps folder and never getting picked up by the preprocessor. When we fixed the path, the dataset jumped from 2,196 places to 8,885. Four times larger, and it unlocked nightlife, park, and gallery data that we thought we just didn't have.

[PAUSE]

---

## The RAG Architecture

Now, the core of the system. BruinQuest is built as a **Retrieval-Augmented Generation** pipeline — RAG. That's a specific AI architecture where a language model's output is grounded in real data that gets retrieved at query time, rather than relying purely on what the model knows from training.

Here's how ours works:

**Step one is Retrieval.** When you hit "Plan My Day," the system runs your structured preferences — neighborhood, time window, categories, price level, minimum rating — against the full 8,885-place knowledge base. It uses a greedy nearest-neighbor algorithm: starting from your selected neighborhood, it finds the closest qualifying venue for each stop, checking that it's open at your arrival time and that you'd depart before your end time.

One thing we're proud of here is the **schedule distribution fix**. Early on, if you said "three stops, noon to ten PM," the planner would cram all three stops into the first three hours and leave the rest of the day empty. We fixed this by computing a minimum start time per slot — dividing your time window evenly and enforcing that each stop can't start before its slot opens. Now three stops from noon to ten PM are spread at noon, three-twenty, and six-forty.

**Step two is Generation.** After retrieval, we pass the selected stops to Claude — specifically Claude Haiku, which is fast and cost-efficient for this task. Claude receives the list of retrieved venues plus any natural language description the user typed, and it writes a two-sentence summary of the overall day and a one-sentence reason for each stop — specific to the rating, the neighborhood, the time of day, and the sequence.

This is the key RAG insight: retrieval handles the *what* using efficient filters, generation handles the *why* using language understanding.

[PAUSE]

---

## Natural Language Query Parsing

Here's where it gets interesting for the user experience.

We didn't want people to have to fill in eight dropdown fields to get started. So when you type something like "Koreatown dinner outing, three hours" on the landing screen and click I'm Ready — before the app even transitions to the planning screen, it makes a second Claude call to *parse* that sentence.

Claude reads your description and extracts: the neighborhood, the day if mentioned, a start time, an end time, and the relevant categories. "Dinner" becomes six PM, "three hours" means nine PM end time, "Koreatown" maps to the koreatown location key.

When the planning screen loads, every field that was inferred from your description is pre-filled with a gold border and an "auto-filled" badge. You can see exactly what the system understood, and you can override anything before you hit Plan My Day.

This is what makes it genuinely RAG — the natural language query isn't just sent to the generation layer. It shapes the *retrieval* inputs too. Your words change what places get retrieved.

[PAUSE]

---

## Live Transit Integration

Each stop in the itinerary shows the nearest metro station and the distance to it.

But we also integrated the **LA Metro real-time API**. At the moment you generate an itinerary, the server makes a live call to the Metro predictions endpoint for each stop's nearest station, in parallel. If the API responds in time — it has a three-second timeout — you see pills like "Route 33 · arriving in 8 minutes" right on the card.

This is all server-side, so there are no CORS issues, no browser exposure, and no extra API key needed. If the Metro API is down or slow, it degrades silently and just shows the static route codes.

[PAUSE]

---

## The Interface

The app is split into two panels.

The left panel is scrollable — it has the landing screen, the form, and the itinerary results. The right panel is a live map powered by Leaflet and CartoDB tiles. When you generate an itinerary, numbered markers appear on the map — color-coded by place type, red for restaurants, amber for cafes, purple for bars, green for parks — and a dashed blue polyline connects them in route order. The map auto-zooms to fit all your stops. A legend in the corner shows the stop names and arrival times at a glance.

For the font and visual language, we moved away from Inter — which is honestly what every AI tool uses right now — to Plus Jakarta Sans, which gives it a more editorial, less template-y feel.

[PAUSE]

---

## Evaluation

We wrote a formal evaluation harness with 21 tests across three layers.

Layer three tests the **knowledge base** offline — does the dataset load, are all place types valid, are there missing coordinates, is metro enrichment complete, any duplicate IDs. All thirteen passed. A hundred percent metro coverage, ninety-nine percent rating coverage, zero duplicates.

Layer two tests the **retrieval logic** by hitting the live API. Does it return the right number of stops? Does it respect the end time? Are stops geographically close? Does the bar rule hold — no bars before eight PM? Does the slot distribution work? Does the rating filter apply? All eight passed.

Layer one tests the **query parser** — given natural language like "Saturday night Hollywood bars," does Claude extract the right location, day, and categories? These require the API key and a running server, so they were skipped in the offline run, but the test cases are written and ready.

Final score: twenty-one out of twenty-one, a hundred percent.

[PAUSE]

---

## What's Next

A few things are on the roadmap.

**More data.** Museums, tourist attractions, and more parks need a fresh Google Maps fetch with the new search types we've already wired into the collection script. The pipeline is ready — it just needs an API key and a run.

**Smarter retrieval.** Right now the retrieval is purely algorithmic — distance, rating, hours, price. The natural next step is embedding-based semantic retrieval: pre-compute vector embeddings for each place's name and category, then at query time, find places that are semantically close to the user's description. That would let "cozy studying spot" find cafes even if the user doesn't say "cafe."

**User accounts and history.** Right now every session starts fresh. With persistent profiles, the system could learn that you're a vegetarian or you always skip chains, and the retrieval would reflect that.

---

## Closing

BruinQuest is a working, deployed RAG application built on real data with a real evaluation suite. It's live on Vercel, backed by 8,885 LA venues, and it connects a language model to a knowledge base that didn't exist six months ago.

The architecture is production-grade: the retrieval layer is deterministic and fast, the generation layer adds personality without hallucinating — it can only narrate places that were actually retrieved. And the eval harness gives us a way to catch regressions as the dataset and the model evolve.

Thanks.

---

*Total word count: ~1,050 words. At a comfortable presentation pace of ~120 words/minute: approximately 8–9 minutes.*
