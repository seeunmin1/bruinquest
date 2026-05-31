import { MetroPrediction } from "./types";

const METRO_BASE = "https://api.metro.net";
// LA Metro uses two agency IDs for bus vs. rail
const AGENCIES = ["LACMTA", "LACMTA_Rail"];

export async function fetchStopPredictions(
  stationId: string | null
): Promise<MetroPrediction[]> {
  if (!stationId) return [];

  for (const agency of AGENCIES) {
    try {
      const url = `${METRO_BASE}/${agency}/stops/${stationId}/predictions/`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 0 }, // always fresh — real-time data
      });
      if (!res.ok) continue;

      const data = await res.json();
      const items: unknown[] = Array.isArray(data) ? data : (data?.items ?? []);
      if (items.length === 0) continue;

      return (items as Record<string, unknown>[])
        .slice(0, 4)
        .map((item) => ({
          route_id: String(item.route_id ?? item.route ?? ""),
          minutes: Math.max(0, Math.round(Number(item.seconds ?? 0) / 60)),
          direction: String(item.direction_name ?? item.direction ?? ""),
        }))
        .filter((p) => p.route_id !== "");
    } catch {
      // Try next agency or give up — never block the response
    }
  }
  return [];
}
