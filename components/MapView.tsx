"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { PulseEvent } from "@/lib/types";
import { CATEGORY_COLORS, SEVERITY_COLORS } from "@/lib/style";
import { relativeTime, formatClock } from "@/lib/time";
import SeverityBadge from "./SeverityBadge";
import FreshnessBadge from "./FreshnessBadge";
import DemoBadge from "./DemoBadge";

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
            <div className="min-w-[220px] space-y-1.5 text-sm">
              {e.isDemo && <DemoBadge />}
              <div className="font-semibold">{e.title}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <SeverityBadge severity={e.severity} />
                <FreshnessBadge event={e} />
              </div>
              {e.description && <p className="text-xs opacity-80">{e.description}</p>}
              <p className="text-xs opacity-60">
                發布於 {formatClock(e.time)}（{relativeTime(e.time)}） ・ 來源：{e.source}
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
