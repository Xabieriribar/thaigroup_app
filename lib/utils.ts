import type { LocationRow, MemberRow } from "@/lib/types";

export const DEFAULT_MAP_CENTER: [number, number] = [13.7563, 100.5018];
export const STALE_MINUTES = 10;
export const LIVE_MINUTES = 2;

export const AVATAR_OPTIONS = ["😎", "🛺", "🌴", "🐘", "🌊", "🍍", "🧋", "📍"];

export const COLOR_OPTIONS = [
  "#fb7185",
  "#f97316",
  "#facc15",
  "#4ade80",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6"
];

const groupCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGroupCode(length = 6) {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * groupCodeChars.length);
    return groupCodeChars[index];
  }).join("");
}

export function normalizeGroupCode(raw: string) {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
}

export function trimLabel(value: string, max = 40) {
  return value.trim().slice(0, max);
}

export function formatClock(value?: string | null) {
  if (!value) {
    return "Sin datos";
  }

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Sin datos";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Nunca";
  }

  const deltaMs = new Date(value).getTime() - Date.now();
  const minutes = Math.round(deltaMs / 60_000);

  if (Math.abs(minutes) < 1) {
    return "ahora mismo";
  }

  if (Math.abs(minutes) < 60) {
    return new Intl.RelativeTimeFormat("es", {
      numeric: "auto"
    }).format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return new Intl.RelativeTimeFormat("es", {
      numeric: "auto"
    }).format(hours, "hour");
  }

  const days = Math.round(hours / 24);
  return new Intl.RelativeTimeFormat("es", {
    numeric: "auto"
  }).format(days, "day");
}

export function isStaleTimestamp(
  value?: string | null,
  thresholdMinutes = STALE_MINUTES
) {
  if (!value) {
    return true;
  }

  return Date.now() - new Date(value).getTime() > thresholdMinutes * 60_000;
}

export function isLiveTimestamp(value?: string | null) {
  return !isStaleTimestamp(value, LIVE_MINUTES);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ha ocurrido un error inesperado.";
}

export function geolocationErrorMessage(
  error: Pick<GeolocationPositionError, "code">
) {
  switch (error.code) {
    case 1:
      return "Permiso de geolocalización denegado.";
    case 2:
      return "No se pudo obtener la ubicación actual.";
    case 3:
      return "La ubicación tardó demasiado en responder.";
    default:
      return "No se pudo acceder a la geolocalización.";
  }
}

export function getMapsUrl(location: Pick<LocationRow, "lat" | "lon">) {
  return `https://maps.google.com/?q=${location.lat},${location.lon}`;
}

export function pickDefaultColor() {
  return COLOR_OPTIONS[0];
}

export function buildPresenceLabel(member: MemberRow, isSelf: boolean) {
  return isSelf ? `${member.display_name} (tú)` : member.display_name;
}

export function locationPrecisionText(accuracy?: number | null) {
  if (typeof accuracy !== "number") {
    return "Precisión no disponible";
  }

  return `±${Math.round(accuracy)} m`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildMarkerHtml(
  member: Pick<MemberRow, "avatar" | "color">,
  options: { stale: boolean; self: boolean }
) {
  const ring = options.self ? "#f8fafc" : "rgba(248,250,252,0.4)";
  const opacity = options.stale ? 0.58 : 1;

  return `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 20px;
      background: ${escapeHtml(member.color)};
      border: 3px solid ${ring};
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.32);
      opacity: ${opacity};
    ">
      <span>${escapeHtml(member.avatar)}</span>
    </div>
  `;
}

export function mergeLatestLocation(
  items: LocationRow[],
  nextLocation: LocationRow
): LocationRow[] {
  const filtered = items.filter((item) => item.member_id !== nextLocation.member_id);
  return [nextLocation, ...filtered];
}

export function sameMembers(left: MemberRow[], right: MemberRow[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];

    if (
      a.id !== b.id ||
      a.group_id !== b.group_id ||
      a.display_name !== b.display_name ||
      a.avatar !== b.avatar ||
      a.color !== b.color ||
      a.created_at !== b.created_at
    ) {
      return false;
    }
  }

  return true;
}

export function sameLocations(left: LocationRow[], right: LocationRow[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];

    if (
      a.id !== b.id ||
      a.member_id !== b.member_id ||
      a.group_id !== b.group_id ||
      a.lat !== b.lat ||
      a.lon !== b.lon ||
      a.accuracy !== b.accuracy ||
      a.created_at !== b.created_at ||
      a.source !== b.source
    ) {
      return false;
    }
  }

  return true;
}

export function distanceBetweenMeters(
  from: Pick<LocationRow, "lat" | "lon">,
  to: Pick<LocationRow, "lat" | "lon">
) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export function sortMembersByFreshness(
  members: MemberRow[],
  latestLocations: LocationRow[],
  currentMemberId?: string
) {
  const byMemberId = new Map(latestLocations.map((location) => [location.member_id, location]));

  return [...members].sort((left, right) => {
    if (left.id === currentMemberId) {
      return -1;
    }

    if (right.id === currentMemberId) {
      return 1;
    }

    const leftDate = byMemberId.get(left.id)?.created_at ?? "";
    const rightDate = byMemberId.get(right.id)?.created_at ?? "";

    return rightDate.localeCompare(leftDate);
  });
}
