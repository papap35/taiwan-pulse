"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { PulseEvent } from "@/lib/types";
import { CATEGORY_COLORS, SEVERITY_COLORS } from "@/lib/style";
import { relativeTime } from "@/lib/time";
import SeverityBadge from "./SeverityBadge";

const TAIWAN_CENTER: [number, number] = [23.7, 121.0];

function FlyTo({ target }: { target: PulseEvent | null }) {
  const map = useMap();
  useEffect(() => {
    if (target?.location) {
      map.flyTo([target.location.lat, target.location.lng], 10, { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

export default function MapView({
  events,
  selected,
  onSelect,
}: {
  events: PulseEvent[];
  selected: PulseEvent | null;
  onSelect: (e: PulseEvent) => void;
}) {
  const located = events.filter((e) => e.location);

  return (
    <MapContainer
      center={TAIWAN_CENTER}
      zoom={8}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FlyTo target={selected} />
      {located.map((e) => (
        <CircleMarker
          key={e.id}
          center={[e.location!.lat, e.location!.lng]}
          radius={e.id === selected?.id ? 11 : 8}
          pathOptions={{
            color: SEVERITY_COLORS[e.severity],
            weight: 2,
            fillColor: CATEGORY_COLORS[e.category],
            fillOpacity: 0.85,
          }}
          eventHandlers={{ click: () => onSelect(e) }}
        >
          <Popup>
            <div className="min-w-[200px] space-y-1 text-sm">
              <div className="font-semibold">{e.title}</div>
              <SeverityBadge severity={e.severity} />
              {e.description && <p className="text-xs opacity-80">{e.description}</p>}
              <p className="text-xs opacity-60">
                {relativeTime(e.time)} ・ {e.source}
                {e.isDemo && "（示範資料）"}
              </p>
              {e.sourceUrl && (
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  查看原始來源
                </a>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
