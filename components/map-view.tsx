"use client";

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

export function MapView(props: MapViewProps) {
  return <MapCanvas {...props} />;
}
