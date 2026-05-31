"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
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

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${n}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function startIcon() {
  return L.divIcon({
    html: `<div style="background:#003B5C;color:#FFD100;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)">🐻</div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

function AutoFit({ stops, center }: { stops: ItineraryStop[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length > 0) {
      const latlngs: [number, number][] = [center, ...stops.map(s => [s.latitude, s.longitude] as [number, number])];
      map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 15 });
    } else {
      map.setView(center, 13);
    }
  }, [stops, center, map]);
  return null;
}

interface Props {
  center: [number, number];
  stops: ItineraryStop[];
}

export default function MapView({ center, stops }: Props) {
  const routePoints: [number, number][] = [center, ...stops.map(s => [s.latitude, s.longitude] as [number, number])];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />

      {/* Dashed route line */}
      {stops.length > 0 && (
        <Polyline positions={routePoints} color="#2774AE" weight={2.5} dashArray="6 9" opacity={0.75} />
      )}

      {/* Start pin */}
      <Marker position={center} icon={startIcon()}>
        <Popup><span className="font-semibold">Starting point</span></Popup>
      </Marker>

      {/* Stop markers */}
      {stops.map(stop => (
        <Marker
          key={stop.stop_number}
          position={[stop.latitude, stop.longitude]}
          icon={numberedIcon(stop.stop_number, TYPE_COLORS[stop.place_type] ?? "#2774AE")}
        >
          <Popup>
            <p className="font-bold text-sm leading-tight mb-0.5">{stop.name}</p>
            <p className="text-xs text-slate-500 mb-0.5">{stop.estimated_arrival} → {stop.estimated_departure}</p>
            {stop.address && <p className="text-xs text-slate-400">{stop.address}</p>}
          </Popup>
        </Marker>
      ))}

      <AutoFit stops={stops} center={center} />
    </MapContainer>
  );
}
