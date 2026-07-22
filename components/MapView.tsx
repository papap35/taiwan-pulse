"use client";

import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Fragment, useEffect } from "react";
import { PulseEvent } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_SHAPE, SEVERITY_COLORS } from "@/lib/style";
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

// Categories beyond the 8 fixed hues reuse an existing color but render as a
// square instead of a circle (composite encoding — see lib/style.ts
// CATEGORY_SHAPE) so they never look identical to the category whose hue
// they share.
function squareIcon(e: PulseEvent, isSelected: boolean) {
  const size = isSelected ? 18 : 13;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${CATEGORY_COLORS[e.category]};border:2px solid ${SEVERITY_COLORS[e.severity]};border-radius:2px;opacity:0.9;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function EventPopup({ e }: { e: PulseEvent }) {
  return (
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
  );
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
      {located.map((e) => {
        const isSelected = e.id === selected?.id;
        // A coarse road-direction segment (see traffic.ts
        // approximateRouteSegment — not real road geometry), rendered under
        // the marker so the point stays the click target and popup anchor.
        const routeLine = e.route && (
          <Polyline
            positions={e.route.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: SEVERITY_COLORS[e.severity],
              weight: isSelected ? 5 : 3,
              opacity: 0.6,
            }}
          />
        );
        if (CATEGORY_SHAPE[e.category] === "square") {
          return (
            <Fragment key={e.id}>
              {routeLine}
              <Marker
                position={[e.location!.lat, e.location!.lng]}
                icon={squareIcon(e, isSelected)}
                eventHandlers={{ click: () => onSelect(e) }}
              >
                <EventPopup e={e} />
              </Marker>
            </Fragment>
          );
        }
        return (
          <Fragment key={e.id}>
            {routeLine}
            <CircleMarker
              center={[e.location!.lat, e.location!.lng]}
              radius={isSelected ? 11 : 8}
              pathOptions={{
                color: SEVERITY_COLORS[e.severity],
                weight: 2,
                fillColor: CATEGORY_COLORS[e.category],
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelect(e) }}
            >
              <EventPopup e={e} />
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
