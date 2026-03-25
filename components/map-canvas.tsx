"use client";

import {
  divIcon,
  layerGroup,
  map as createLeafletMap,
  marker,
  tileLayer,
  type LayerGroup,
  type Map as LeafletMap
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
  const markersRef = useRef<LayerGroup | null>(null);
  const initializedRef = useRef(false);

  const visibleLocations = presences.filter((presence) => presence.location);
  const currentMemberLocation = visibleLocations.find(
    (presence) => presence.member.id === currentMemberId
  )?.location;
  const firstKnownLocation = visibleLocations[0]?.location ?? null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const center: [number, number] = currentMemberLocation
      ? [currentMemberLocation.lat, currentMemberLocation.lon]
      : firstKnownLocation
        ? [firstKnownLocation.lat, firstKnownLocation.lon]
        : DEFAULT_MAP_CENTER;
    const zoom = currentMemberLocation ? 14 : 11;

    const mapInstance = createLeafletMap(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false
    });

    tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapInstance);

    const markersLayer = layerGroup().addTo(mapInstance);

    mapRef.current = mapInstance;
    markersRef.current = markersLayer;
    initializedRef.current = true;

    return () => {
      markersLayer.clearLayers();
      mapInstance.remove();
      mapRef.current = null;
      markersRef.current = null;
      initializedRef.current = false;
    };
  }, [currentMemberLocation, firstKnownLocation]);

  useEffect(() => {
    const mapInstance = mapRef.current;
    const markersLayer = markersRef.current;

    if (!mapInstance || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    visibleLocations.forEach((presence) => {
      const location = presence.location;

      if (!location) {
        return;
      }

      const markerInstance = marker([location.lat, location.lon], {
        zIndexOffset: presence.member.id === currentMemberId ? 500 : 0,
        icon: divIcon({
          className: "thaigroup-marker",
          html: buildMarkerHtml(presence.member, {
            stale: presence.isStale,
            self: presence.member.id === currentMemberId
          }),
          iconSize: [42, 42],
          iconAnchor: [21, 21],
          popupAnchor: [0, -18]
        })
      });

      markerInstance.bindPopup(`
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
      `);

      markerInstance.addTo(markersLayer);
    });

    // Only center once, on first successful render with a known location.
    if (
      !initializedRef.current &&
      (currentMemberLocation || firstKnownLocation)
    ) {
      const centerLocation = currentMemberLocation ?? firstKnownLocation;

      if (centerLocation) {
        mapInstance.setView(
          [centerLocation.lat, centerLocation.lon],
          currentMemberLocation ? 14 : 11,
          {
            animate: false
          }
        );
      }

      initializedRef.current = true;
    }

    // Leaflet sometimes needs this after layout changes on mobile Safari.
    window.requestAnimationFrame(() => {
      mapInstance.invalidateSize(false);
    });
  }, [currentMemberId, currentMemberLocation, firstKnownLocation, visibleLocations]);

  if (!currentMemberLocation && !firstKnownLocation) {
    return (
      <div className="grid h-full place-items-center bg-slate-950/70 px-6 text-center text-sm text-slate-300">
        {fallbackText}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
