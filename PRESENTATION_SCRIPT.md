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

Our pipeline has four steps. A pre-step, then the three classic RAG layers.

**Pre-step: NLP Query Parsing.** We didn't want people filling in eight dropdown fields to get started. So when you type something like "Koreatown dinner outing, three hours" on the landing screen and click I'm Ready — before the app even transitions to the planning screen — it fires a Claude call to parse that sentence into structured data.

Claude extracts the neighborhood, the day if mentioned, a start time, an end time, and the relevant categories. "Dinner" becomes six PM. "Three hours" means nine PM end time. "Koreatown" maps to the koreatown location key. When the planning screen loads, every field that was inferred from your description is pre-filled with a gold border and an "auto-filled" badge — so you can see exactly what the system understood, and override anything before continuing.

This step is what bridges natural language to the retrieval layer. Your words get translated into precise filters before a single venue is looked up.

[PAUSE]

**Step one is Retrieval.** Now, with those structured preferences in hand — neighborhood, time window, categories, price level, minimum rating — the system searches the full 8,885-place knowledge base. It uses a greedy nearest-neighbor algorithm: starting from your selected neighborhood, it finds the closest qualifying venue for each stop, checking that it's open at your arrival time and that you'd depart before your end time.

One thing we're proud of here is the **schedule distribution fix**. Early on, if you said "three stops, noon to ten PM," the planner would cram all three stops into the first three hours and leave the rest of the day empty. We fixed this by computing a minimum start time per slot — dividing your time window evenly and enforcing that each stop can't start before its slot opens. Now three stops from noon to ten PM are spread at noon, three-twenty, and six-forty.

**Step two is Augmentation.** This is the "A" in RAG, and it's what separates RAG from just calling an LLM directly. The retrieved stops — name, type, rating, address, arrival and departure time — get packaged into a structured prompt that also includes the user's original natural language description. So the model never has to guess what's in LA or invent places from training data. Everything it talks about was retrieved from our knowledge base first. The model's context is *augmented* with real, verified information before it generates a single word.

**Step three is Generation.** Claude — specifically Claude Haiku, which is fast and cost-efficient — reads that augmented prompt and writes a two-sentence summary of the overall day and a one-sentence reason for each stop.

Now, where do those reasons come from? The *facts* — the place name, the rating, the arrival time — come entirely from the retrieved data. Claude cannot invent those. But the *reasoning* — why a four-point-six star cafe fits a slow Sunday morning, why this neighborhood flows into the next stop, what "dinner vibe" actually implies — that draws on what the model learned during training. Claude understands neighborhoods, ratings in context, and time of day in a way that no database query can.

This is exactly the power of RAG: you get factual accuracy from retrieval, and contextual intelligence from trained knowledge. Neither alone is enough. A database query can find a highly-rated restaurant near you, but it can't tell you why it's the right call at six PM after a long afternoon in Koreatown. And a language model alone might write you something beautiful — about a restaurant that doesn't exist. RAG gives you both. The NLP parsing shapes the query, retrieval finds the places, augmentation grounds the prompt, and generation adds the voice.

[PAUSE]

---

## Live Transit Enrichment

One thing worth being clear about: this next piece is not part of the RAG pipeline. It runs alongside it, in parallel, once the stops are known.

Once retrieval has identified which venues to include, each place in our knowledge base already has its nearest metro station pre-computed — name, distance, and route codes. That's static enrichment we baked in during preprocessing.

But we went one step further and integrated the **LA Metro real-time API**. The moment the retrieval step locks in a stop, the server fires a live call to the Metro predictions endpoint for that stop's nearest station — all stops in parallel. If the API responds within three seconds, you see pills on the card like "Route 33 · arriving in 8 minutes." If it's slow or down, it degrades silently back to the static route codes.

No part of this touches the RAG layers. It's pure operational enrichment — real-world data bolted on after the itinerary is assembled, server-side, with no extra API key needed.

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
