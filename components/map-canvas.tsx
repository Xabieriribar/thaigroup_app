"use client";

import { divIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { MemberPresence } from "@/lib/types";
import {
  buildMarkerHtml,
  buildPresenceLabel,
  DEFAULT_MAP_CENTER,
  formatClock,
  locationPrecisionText
} from "@/lib/utils";

interface MapCanvasProps {
  presences: MemberPresence[];
  currentMemberId: string;
  fallbackText: string;
}

export default function MapCanvas({
  presences,
  currentMemberId,
  fallbackText
}: MapCanvasProps) {
  const visibleLocations = presences.filter((presence) => presence.location);
  const currentMemberLocation = visibleLocations.find(
    (presence) => presence.member.id === currentMemberId
  )?.location;
  const firstKnownLocation = visibleLocations[0]?.location ?? null;

  if (!currentMemberLocation && !firstKnownLocation) {
    return (
      <div className="grid h-full place-items-center bg-slate-950/70 px-6 text-center text-sm text-slate-300">
        {fallbackText}
      </div>
    );
  }

  const center: [number, number] = currentMemberLocation
    ? [currentMemberLocation.lat, currentMemberLocation.lon]
    : firstKnownLocation
      ? [firstKnownLocation.lat, firstKnownLocation.lon]
      : DEFAULT_MAP_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={currentMemberLocation ? 14 : 11}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {visibleLocations.map((presence) => {
        const location = presence.location;

        if (!location) {
          return null;
        }

        return (
          <Marker
            key={presence.member.id}
            position={[location.lat, location.lon]}
            zIndexOffset={presence.member.id === currentMemberId ? 500 : 0}
            icon={divIcon({
              className: "thaigroup-marker",
              html: buildMarkerHtml(presence.member, {
                stale: presence.isStale,
                self: presence.member.id === currentMemberId
              }),
              iconSize: [42, 42],
              iconAnchor: [21, 21],
              popupAnchor: [0, -18]
            })}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-white">
                  {buildPresenceLabel(
                    presence.member,
                    presence.member.id === currentMemberId
                  )}
                </p>
                <p className="text-slate-300">
                  Última vez visto: {formatClock(location.created_at)}
                </p>
                <p className="text-slate-400">
                  {locationPrecisionText(location.accuracy)}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
