import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { Place, ItineraryRequest, ItineraryStop } from "@/lib/types";
import { planItinerary } from "@/lib/itinerary";
import { fetchStopPredictions } from "@/lib/metro";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let cachedPlaces: Place[] | null = null;

function loadPlaces(): Place[] {
  if (cachedPlaces) return cachedPlaces;
  const filePath = path.join(process.cwd(), "data", "processed", "unified_places.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedPlaces = JSON.parse(raw) as Place[];
  return cachedPlaces;
}

// RAG generation layer: Claude receives the retrieved stops and produces narrative + reasons
async function generateNarrative(
  itinerary: ItineraryStop[],
  req: ItineraryRequest
): Promise<{ summary: string; stops: { stop_number: number; reason: string }[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || itinerary.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const stopList = itinerary
    .map(
      (s) =>
        `Stop ${s.stop_number}: ${s.name} (${s.place_type}, ${s.avg_user_rating?.toFixed(1) ?? "?"}★` +
        `${s.price_level ? ", $".repeat(s.price_level) : ""}) — ${s.estimated_arrival}–${s.estimated_departure}, ${s.address}`
    )
    .join("\n");

  const prompt = `You are BruinQuest, an LA day-trip assistant. This app uses RAG: a retrieval system pulled these venues from a database of 10,000+ real LA places based on the user's preferences, and you are the generation layer — your job is to add a human, engaging narrative to the retrieved results.

${req.query ? `User's own words: "${req.query}"\n` : ""}User's plan:
- Neighborhood: ${req.location}
- Day: ${DAYS[req.dayOfWeek]}
- Time: ${req.startTime}${req.endTime ? ` to ${req.endTime}` : ""}
- Wants: ${req.categories.join(", ")}${req.minRating ? `, min ${req.minRating}★` : ""}${req.priceLevels?.length ? `, price ${req.priceLevels.map((p) => "$".repeat(p)).join("/")}` : ""}

Retrieved itinerary (${itinerary.length} stop${itinerary.length !== 1 ? "s" : ""}):
${stopList}

Write:
1. A 2-sentence summary of the overall day vibe (reference the neighborhood and sequence of stops)
2. For each stop, a 1–2 sentence reason (max 25 words) that's specific: mention the rating, type, time of day, or how it flows from the previous stop

Respond with ONLY valid JSON — no markdown, no code fences:
{"summary":"...","stops":[{"stop_number":1,"reason":"..."}]}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```(?:json)?\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ItineraryRequest>;

    const { location, dayOfWeek, startTime, endTime, categories, priceLevels, minRating, numStops, query } = body;

    if (!location || dayOfWeek == null || !startTime || !categories?.length || !numStops) {
      return NextResponse.json(
        { error: "Missing required fields: location, dayOfWeek, startTime, categories, numStops" },
        { status: 400 }
      );
    }

    const places = loadPlaces();

    // Retrieval step: greedy distance-based filter over 10K+ venues
    const itinerary = planItinerary(places, {
      location,
      dayOfWeek,
      startTime,
      endTime,
      categories,
      priceLevels,
      minRating,
      numStops,
      query,
    });

    // Enrich in parallel: live Metro predictions + Claude narrative generation
    const [metroResults, aiResult] = await Promise.all([
      Promise.all(itinerary.map((stop) => fetchStopPredictions(stop.nearest_metro_station_id))),
      generateNarrative(itinerary, { location, dayOfWeek, startTime, endTime, categories, priceLevels, minRating, numStops, query }),
    ]);

    // Merge predictions and AI reasons into stops
    const enriched = itinerary.map((stop, i) => {
      const aiStop = aiResult?.stops.find((s) => s.stop_number === stop.stop_number);
      return {
        ...stop,
        metro_predictions: metroResults[i] ?? [],
        ai_reason: aiStop?.reason,
      };
    });

    return NextResponse.json({
      itinerary: enriched,
      summary: aiResult?.summary ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
