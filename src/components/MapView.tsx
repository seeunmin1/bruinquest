"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";
import { ItineraryStop } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  restaurant: "#ef4444",
  cafe:        "#f59e0b",
  bar:         "#8b5cf6",
  bakery:      "#f97316",
  museum:      "#0ea5e9",
  art_gallery: "#ec4899",
  park:        "#22c55e",
  attraction:  "#14b8a6",
  night_club:  "#6366f1",
};

function numberedHtml(n: number, color: string) {
  return `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-family:sans-serif">${n}</div>`;
}

interface Props {
  center: [number, number];
  stops: ItineraryStop[];
}

export default function MapView({ center, stops }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const layersRef    = useRef<L.Layer[]>([]);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { attribution: "© CARTO © OSM" }
      ).addTo(map);

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw markers/route whenever stops or center changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Remove previous dynamic layers
      layersRef.current.forEach(l => l.remove());
      layersRef.current = [];

      const push = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); };

      // Start pin (bear emoji)
      push(
        L.marker(center, {
          icon: L.divIcon({
            html: `<div style="background:#003B5C;color:#FFD100;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🐻</div>`,
            className: "",
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        }).bindPopup("<b>Starting point</b>")
      );

      if (stops.length > 0) {
        const route: [number, number][] = [center, ...stops.map(s => [s.latitude, s.longitude] as [number, number])];

        // Dashed route line
        push(L.polyline(route, { color: "#2774AE", weight: 2.5, dashArray: "6 9", opacity: 0.7 }));

        // Stop markers
        stops.forEach(stop => {
          const color = TYPE_COLORS[stop.place_type] ?? "#2774AE";
          push(
            L.marker([stop.latitude, stop.longitude], {
              icon: L.divIcon({
                html: numberedHtml(stop.stop_number, color),
                className: "",
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -18],
              }),
            }).bindPopup(
              `<div style="font-family:sans-serif;min-width:150px">
                <p style="font-weight:700;margin:0 0 3px">${stop.name}</p>
                <p style="font-size:12px;color:#64748b;margin:0 0 2px">${stop.estimated_arrival} → ${stop.estimated_departure}</p>
                ${stop.address ? `<p style="font-size:11px;color:#94a3b8;margin:0">${stop.address}</p>` : ""}
              </div>`
            )
          );
        });

        // Fit bounds
        map.fitBounds(L.latLngBounds(route), { padding: [48, 48], maxZoom: 15 });
      } else {
        map.setView(center, 13);
      }
    });
  }, [stops, center]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
