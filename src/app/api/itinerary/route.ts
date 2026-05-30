import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Place, ItineraryRequest } from "@/lib/types";
import { planItinerary } from "@/lib/itinerary";

let cachedPlaces: Place[] | null = null;

function loadPlaces(): Place[] {
  if (cachedPlaces) return cachedPlaces;
  const filePath = path.join(process.cwd(), "data", "processed", "unified_places.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedPlaces = JSON.parse(raw) as Place[];
  return cachedPlaces;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ItineraryRequest>;

    const { location, dayOfWeek, startTime, endTime, categories, priceLevels, minRating, numStops } = body;

    if (!location || dayOfWeek == null || !startTime || !categories?.length || !numStops) {
      return NextResponse.json(
        { error: "Missing required fields: location, dayOfWeek, startTime, categories, numStops" },
        { status: 400 }
      );
    }

    const places = loadPlaces();

    const itinerary = planItinerary(places, {
      location,
      dayOfWeek,
      startTime,
      endTime,
      categories,
      priceLevels,
      minRating,
      numStops,
    });

    return NextResponse.json({ itinerary });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
