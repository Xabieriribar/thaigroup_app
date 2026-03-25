"use client";

import {
  divIcon,
  map as createLeafletMap,
  marker,
  tileLayer,
  type Map as LeafletMap,
  type Marker as LeafletMarker
} from "leaflet";
import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, LeafletMarker>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasCenteredRef = useRef(false);

  const visibleLocations = presences.filter((presence) => presence.location);
  const currentMemberLocation = visibleLocations.find(
    (presence) => presence.member.id === currentMemberId
  )?.location;
  const firstKnownLocation = visibleLocations[0]?.location ?? null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const mapInstance = createLeafletMap(containerRef.current, {
      center: DEFAULT_MAP_CENTER,
      zoom: 11,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
      preferCanvas: true,
      trackResize: true,
      zoomControl: true,
      attributionControl: false
    });

    tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 6
    }).addTo(mapInstance);

    mapRef.current = mapInstance;
    hasCenteredRef.current = false;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => {
        mapInstance.invalidateSize(false);
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markersRef.current.forEach((markerInstance) => {
        markerInstance.remove();
      });
      markersRef.current.clear();
      mapInstance.remove();
      mapRef.current = null;
      hasCenteredRef.current = false;
    };
  }, []);

  useEffect(() => {
    const mapInstance = mapRef.current;

    if (!mapInstance) {
      return;
    }

    const nextIds = new Set<string>();

    visibleLocations.forEach((presence) => {
      const location = presence.location;

      if (!location) {
        return;
      }

      nextIds.add(presence.member.id);

      const popupHtml = `
        <div class="space-y-1 text-sm">
          <p class="font-semibold text-white">${buildPresenceLabel(
            presence.member,
            presence.member.id === currentMemberId
          )}</p>
          <p class="text-slate-300">Ultima vez visto: ${formatClock(
            location.created_at
          )}</p>
          <p class="text-slate-400">${locationPrecisionText(
            location.accuracy
          )}</p>
        </div>
      `;

      const nextIcon = divIcon({
        className: "thaigroup-marker",
        html: buildMarkerHtml(presence.member, {
          stale: presence.isStale,
          self: presence.member.id === currentMemberId
        }),
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -18]
      });

      const existingMarker = markersRef.current.get(presence.member.id);

      if (existingMarker) {
        existingMarker.setLatLng([location.lat, location.lon]);
        existingMarker.setIcon(nextIcon);
        existingMarker.setZIndexOffset(
          presence.member.id === currentMemberId ? 500 : 0
        );

        if (existingMarker.getPopup()) {
          existingMarker.setPopupContent(popupHtml);
        } else {
          existingMarker.bindPopup(popupHtml);
        }

        return;
      }

      const markerInstance = marker([location.lat, location.lon], {
        zIndexOffset: presence.member.id === currentMemberId ? 500 : 0,
        icon: nextIcon
      });

      markerInstance.bindPopup(popupHtml);
      markerInstance.addTo(mapInstance);
      markersRef.current.set(presence.member.id, markerInstance);
    });

    markersRef.current.forEach((markerInstance, memberId) => {
      if (!nextIds.has(memberId)) {
        markerInstance.remove();
        markersRef.current.delete(memberId);
      }
    });

    if (!hasCenteredRef.current && (currentMemberLocation || firstKnownLocation)) {
      const centerLocation = currentMemberLocation ?? firstKnownLocation;

      if (centerLocation) {
        mapInstance.setView(
          [centerLocation.lat, centerLocation.lon],
          currentMemberLocation ? 14 : 11,
          {
            animate: false
          }
        );
        hasCenteredRef.current = true;
      }
    }
  }, [currentMemberId, currentMemberLocation, firstKnownLocation, visibleLocations]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="map-shell h-full w-full" />
      {!currentMemberLocation && !firstKnownLocation ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/70 px-6 text-center text-sm text-slate-300">
          {fallbackText}
        </div>
      ) : null}
    </div>
  );
}
