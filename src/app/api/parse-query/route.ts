import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const VALID_LOCATIONS = [
  "ucla","westwood","downtown","santa_monica",
  "hollywood","koreatown","silver_lake","venice_beach","beverly_hills",
];
const VALID_CATEGORIES = [
  "restaurant","cafe","bar","bakery","museum",
  "art_gallery","park","attraction","night_club",
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({});

  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({});

  const client = new Anthropic({ apiKey });

  const prompt = `Extract structured day-planning preferences from this natural language query. Be generous in your inferences — if someone says "dinner" infer restaurant + reasonable dinner start time, if they say "3 hours" compute endTime = startTime + 3h, if they mention a neighborhood map it to the closest option.

Query: "${query}"

Valid locations: ${VALID_LOCATIONS.join(", ")}
Valid categories: ${VALID_CATEGORIES.join(", ")}

Rules:
- "dinner" → startTime ~18:00, categories include restaurant
- "lunch" → startTime ~12:00, categories include restaurant
- "morning" or "brunch" → startTime ~09:00 or 10:00
- "night out" / "nightlife" → startTime ~20:00, categories include bar or night_club
- "X hours" → endTime = inferred startTime + X hours
- For dayOfWeek: only set if explicitly mentioned (e.g. "Friday", "Saturday night") — Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
- Only include fields you're confident about. Omit (don't set null) anything ambiguous.

Respond with ONLY valid JSON, no markdown:
{
  "location": "koreatown",
  "dayOfWeek": 5,
  "startTime": "18:00",
  "endTime": "21:00",
  "categories": ["restaurant"],
  "numStops": 3
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```(?:json)?\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate and sanitise before returning
    const result: Record<string, unknown> = {};
    if (VALID_LOCATIONS.includes(parsed.location)) result.location = parsed.location;
    if (typeof parsed.dayOfWeek === "number" && parsed.dayOfWeek >= 0 && parsed.dayOfWeek <= 6)
      result.dayOfWeek = parsed.dayOfWeek;
    if (typeof parsed.startTime === "string" && /^\d{2}:\d{2}$/.test(parsed.startTime))
      result.startTime = parsed.startTime;
    if (typeof parsed.endTime === "string" && /^\d{2}:\d{2}$/.test(parsed.endTime))
      result.endTime = parsed.endTime;
    if (Array.isArray(parsed.categories)) {
      const cats = parsed.categories.filter((c: unknown) => VALID_CATEGORIES.includes(c as string));
      if (cats.length) result.categories = cats;
    }
    if (typeof parsed.numStops === "number" && parsed.numStops >= 1 && parsed.numStops <= 12)
      result.numStops = parsed.numStops;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
