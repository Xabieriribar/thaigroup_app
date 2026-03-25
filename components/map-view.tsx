"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type { MemberPresence } from "@/lib/types";

interface MapViewProps {
  presences: MemberPresence[];
  currentMemberId: string;
  fallbackText: string;
}

const MapCanvas = dynamic(() => import("@/components/map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-slate-950/70 text-sm text-slate-300">
      Cargando mapa...
    </div>
  )
});

function MapViewComponent(props: MapViewProps) {
  return <MapCanvas {...props} />;
}

function areEqualMapProps(prev: MapViewProps, next: MapViewProps) {
  if (
    prev.currentMemberId !== next.currentMemberId ||
    prev.fallbackText !== next.fallbackText ||
    prev.presences.length !== next.presences.length
  ) {
    return false;
  }

  for (let index = 0; index < prev.presences.length; index += 1) {
    const left = prev.presences[index];
    const right = next.presences[index];

    if (
      left.member.id !== right.member.id ||
      left.member.avatar !== right.member.avatar ||
      left.member.color !== right.member.color ||
      left.isStale !== right.isStale
    ) {
      return false;
    }

    const leftLocation = left.location;
    const rightLocation = right.location;

    if (!leftLocation && !rightLocation) {
      continue;
    }

    if (!leftLocation || !rightLocation) {
      return false;
    }

    if (
      leftLocation.id !== rightLocation.id ||
      leftLocation.lat !== rightLocation.lat ||
      leftLocation.lon !== rightLocation.lon ||
      leftLocation.accuracy !== rightLocation.accuracy ||
      leftLocation.created_at !== rightLocation.created_at ||
      leftLocation.source !== rightLocation.source
    ) {
      return false;
    }
  }

  return true;
}

export const MapView = memo(MapViewComponent, areEqualMapProps);
