"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState
} from "react";
import { EntryScreen } from "@/components/entry-screen";
import { GroupDashboard } from "@/components/group-dashboard";
import { hasSupabaseEnv } from "@/lib/env";
import {
  clearSession,
  enqueueLocation,
  loadLastSyncAt,
  loadLatestLocations,
  loadMembers,
  loadPendingLocations,
  loadSession,
  removePendingLocations,
  replaceLatestLocations,
  replaceMembers,
  resetLocalCache,
  saveLastSyncAt,
  saveLatestLocation,
  saveSession
} from "@/lib/local-store";
import { registerServiceWorker } from "@/lib/pwa";
import {
  createGroupSession,
  fetchGroupSnapshot,
  joinGroupSession,
  uploadPendingLocations
} from "@/lib/sync";
import type {
  CreateGroupInput,
  GroupSnapshot,
  JoinGroupInput,
  LocationSource,
  LocationRow,
  SessionRecord
} from "@/lib/types";
import {
  distanceBetweenMeters,
  geolocationErrorMessage,
  getErrorMessage,
  getMapsUrl,
  isStaleTimestamp,
  mergeLatestLocation,
  sameLocations,
  sameMembers,
  sortMembersByFreshness
} from "@/lib/utils";

function isGeolocationError(
  error: unknown
): error is Pick<GeolocationPositionError, "code"> {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
}

async function getCurrentPosition() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    throw new Error("La geolocalización no está disponible en este dispositivo.");
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 15_000
    });
  });
}

const GPS_HEARTBEAT_INTERVAL_MS = 300_000;
const GPS_MIN_DISTANCE_METERS = 75;
const AUTO_SYNC_DELAY_MS = 8_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 90_000;
const SHARE_POLL_INTERVAL_MS = 45_000;

export function AppShell() {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [members, setMembers] = useState<GroupSnapshot["members"]>([]);
  const [latestLocations, setLatestLocations] = useState<
    GroupSnapshot["latestLocations"]
  >([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shareIntervalRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const shareRequestInFlightRef = useRef(false);
  const sessionRef = useRef<SessionRecord | null>(null);
  const latestLocationsRef = useRef<LocationRow[]>([]);

  const refreshPendingCount = useEffectEvent(async () => {
    const pending = await loadPendingLocations();
    setPendingCount((current) =>
      current === pending.length ? current : pending.length
    );
    return pending;
  });

  const applySession = useEffectEvent(async (nextSession: SessionRecord | null) => {
    sessionRef.current = nextSession;
    startTransition(() => {
      setSession(nextSession);
    });

    if (nextSession) {
      await saveSession(nextSession);
    } else {
      await clearSession();
    }
  });

  const applySnapshot = useEffectEvent(async (snapshot: GroupSnapshot) => {
    const membersChanged = !sameMembers(members, snapshot.members);
    const locationsChanged = !sameLocations(
      latestLocationsRef.current,
      snapshot.latestLocations
    );

    if (!membersChanged && !locationsChanged) {
      return;
    }

    await Promise.all([
      membersChanged ? replaceMembers(snapshot.members) : Promise.resolve(),
      locationsChanged
        ? replaceLatestLocations(snapshot.latestLocations)
        : Promise.resolve()
    ]);

    if (locationsChanged) {
      latestLocationsRef.current = snapshot.latestLocations;
    }

    startTransition(() => {
      if (membersChanged) {
        setMembers(snapshot.members);
      }

      if (locationsChanged) {
        setLatestLocations(snapshot.latestLocations);
      }
    });
  });

  const syncNow = useEffectEvent(async (reason: string) => {
    if (
      typeof window === "undefined" ||
      !window.navigator.onLine ||
      !sessionRef.current ||
      !hasSupabaseEnv ||
      syncInFlightRef.current
    ) {
      return;
    }

    syncInFlightRef.current = true;
    if (reason === "manual") {
      setSyncing(true);
    }

    try {
      const pending = await refreshPendingCount();

      if (pending.length > 0) {
        await uploadPendingLocations(pending);
        await removePendingLocations(pending.map((location) => location.id));
        setPendingCount(0);
      }

      if (reason === "location") {
        return;
      }

      const snapshot = await fetchGroupSnapshot(sessionRef.current.group.id);
      await applySnapshot(snapshot);

      const now = new Date().toISOString();

      if (["manual", "online", "create", "join", "boot"].includes(reason)) {
        await saveLastSyncAt(now);
        setLastSyncAt(now);
      }

      setError(null);

      if (["manual", "online", "create", "join"].includes(reason)) {
        setNotice("Sincronización completada.");
      }
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      syncInFlightRef.current = false;
      if (reason === "manual") {
        setSyncing(false);
      }
    }
  });

  const scheduleSync = useEffectEvent(() => {
    if (
      typeof window === "undefined" ||
      !window.navigator.onLine ||
      !hasSupabaseEnv ||
      syncTimerRef.current !== null
    ) {
      return;
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void syncNow("location");
    }, AUTO_SYNC_DELAY_MS);
  });

  const buildLocationEvent = useEffectEvent(
    (position: GeolocationPosition, source: LocationSource): LocationRow => {
      const activeSession = sessionRef.current;

      if (!activeSession) {
        throw new Error("No hay una sesión activa para guardar la ubicación.");
      }

      return {
        id: crypto.randomUUID(),
        member_id: activeSession.member.id,
        group_id: activeSession.group.id,
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy:
          typeof position.coords.accuracy === "number"
            ? position.coords.accuracy
            : null,
        created_at: new Date(position.timestamp || Date.now()).toISOString(),
        source
      };
    }
  );

  const shouldStoreLocation = useEffectEvent((location: LocationRow) => {
    const previousLocation = latestLocationsRef.current.find(
      (item) => item.member_id === location.member_id
    );

    if (!previousLocation || location.source === "manual") {
      return true;
    }

    const elapsedMs =
      new Date(location.created_at).getTime() -
      new Date(previousLocation.created_at).getTime();
    const movedMeters = distanceBetweenMeters(previousLocation, location);

    return (
      movedMeters >= GPS_MIN_DISTANCE_METERS ||
      elapsedMs >= GPS_HEARTBEAT_INTERVAL_MS
    );
  });

  const queueNewLocation = useEffectEvent(
    async (
      location: LocationRow,
      options?: { announce?: boolean; immediateSync?: boolean }
    ) => {
      if (!shouldStoreLocation(location)) {
        return location;
      }

      await Promise.all([enqueueLocation(location), saveLatestLocation(location)]);
      await refreshPendingCount();

      latestLocationsRef.current = mergeLatestLocation(
        latestLocationsRef.current,
        location
      );

      startTransition(() => {
        setLatestLocations((current) => mergeLatestLocation(current, location));
      });

      if (options?.announce) {
        setNotice(
          window.navigator.onLine
            ? "Ubicación guardada localmente."
            : "Sin conexión: ubicación guardada en local."
        );
      }

      if (window.navigator.onLine) {
        if (options?.immediateSync) {
          void syncNow("manual");
        } else {
          scheduleSync();
        }
      }

      return location;
    }
  );

  const captureLocation = useEffectEvent(async (source: LocationSource) => {
    const position = await getCurrentPosition();
    const location = buildLocationEvent(position, source);
    await queueNewLocation(location, {
      announce: true,
      immediateSync: source === "manual"
    });
    return location;
  });

  const pollSharedLocation = useEffectEvent(async (announce = false) => {
    if (shareRequestInFlightRef.current) {
      return;
    }

    shareRequestInFlightRef.current = true;

    try {
      const position = await getCurrentPosition();
      const location = buildLocationEvent(position, "gps");
      await queueNewLocation(location, {
        announce,
        immediateSync: false
      });
      setError(null);
    } catch (locationError) {
      if (
        isGeolocationError(locationError) &&
        locationError.code === 1
      ) {
        setError(geolocationErrorMessage(locationError));
        await stopSharing();
        return;
      }

      if (announce) {
        setNotice("Esperando una señal de ubicación más estable...");
      }
    } finally {
      shareRequestInFlightRef.current = false;
      setSharingBusy(false);
    }
  });

  const stopSharing = useEffectEvent(async () => {
    if (shareIntervalRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(shareIntervalRef.current);
      shareIntervalRef.current = null;
    }

    if (syncTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    shareRequestInFlightRef.current = false;

    if (sessionRef.current?.sharingEnabled) {
      const nextSession = {
        ...sessionRef.current,
        sharingEnabled: false
      };
      await applySession(nextSession);
    }

    setNotice("Compartir ubicación detenido.");
  });

  const startSharing = useEffectEvent(async () => {
    if (shareIntervalRef.current !== null || sharingBusy) {
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("La geolocalización no está disponible en este dispositivo.");
      return;
    }

    try {
      setSharingBusy(true);
      setError(null);
      setNotice(null);

      // Safari on iPhone behaves better when the first geolocation request
      // happens directly from the tap handler before any other async work.
      const firstPosition = await getCurrentPosition();
      const firstLocation = buildLocationEvent(firstPosition, "gps");
      await queueNewLocation(firstLocation, {
        announce: true,
        immediateSync: false
      });

      if (sessionRef.current) {
        const nextSession = {
          ...sessionRef.current,
          sharingEnabled: true
        };
        await applySession(nextSession);
      }

      if (typeof window !== "undefined") {
        if (shareIntervalRef.current !== null) {
          window.clearInterval(shareIntervalRef.current);
        }

        shareIntervalRef.current = window.setInterval(() => {
          void pollSharedLocation(false);
        }, SHARE_POLL_INTERVAL_MS);
      }

      setNotice("Compartir ubicación activado.");
    } catch (shareError) {
      if (isGeolocationError(shareError)) {
        setError(geolocationErrorMessage(shareError));
      } else {
        setError(getErrorMessage(shareError));
      }

      if (sessionRef.current?.sharingEnabled) {
        const nextSession = {
          ...sessionRef.current,
          sharingEnabled: false
        };
        await applySession(nextSession);
      }

      if (shareIntervalRef.current !== null && typeof window !== "undefined") {
        window.clearInterval(shareIntervalRef.current);
        shareIntervalRef.current = null;
      }

      setNotice(null);
    } finally {
      setSharingBusy(false);
    }
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await registerServiceWorker();

      if (typeof window !== "undefined") {
        setOnline(window.navigator.onLine);
      }

      const [cachedSession, cachedMembers, cachedLocations, cachedLastSync, pending] =
        await Promise.all([
          loadSession(),
          loadMembers(),
          loadLatestLocations(),
          loadLastSyncAt(),
          loadPendingLocations()
        ]);

      if (cancelled) {
        return;
      }

      const normalizedSession =
        cachedSession?.sharingEnabled && typeof window !== "undefined"
          ? {
              ...cachedSession,
              sharingEnabled: false
            }
          : cachedSession;

      sessionRef.current = normalizedSession;

      if (
        normalizedSession &&
        cachedSession &&
        normalizedSession.sharingEnabled !== cachedSession.sharingEnabled
      ) {
        await saveSession(normalizedSession);
      }

      startTransition(() => {
        setSession(normalizedSession);
        setMembers(cachedMembers);
        setLatestLocations(cachedLocations);
        setLastSyncAt(cachedLastSync);
        setPendingCount(pending.length);
        setHydrated(true);
      });

      if (cachedSession && typeof window !== "undefined" && window.navigator.onLine) {
        void syncNow("boot");
      }
    })();

    return () => {
      cancelled = true;

      if (shareIntervalRef.current !== null && typeof window !== "undefined") {
        window.clearInterval(shareIntervalRef.current);
        shareIntervalRef.current = null;
      }

      if (syncTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [startSharing, syncNow]);

  useEffect(() => {
    latestLocationsRef.current = latestLocations;
  }, [latestLocations]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      setOnline(true);
      setNotice("Conexión recuperada. Intentando sincronizar.");
      void syncNow("online");
    };

    const handleOffline = () => {
      setOnline(false);
      setNotice("Modo offline activado. Seguimos guardando cambios en local.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [hydrated, syncNow]);

  useEffect(() => {
    if (!hydrated || !session) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncNow("interval");
    }, BACKGROUND_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [hydrated, session, syncNow]);

  async function handleCreate(input: CreateGroupInput) {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setError("Necesitas conexión para crear un grupo.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await resetLocalCache();
      const nextSession = await createGroupSession(input);
      await applySession(nextSession);
      await applySnapshot({
        group: nextSession.group,
        members: [nextSession.member],
        latestLocations: []
      });
      setPendingCount(0);
      setLastSyncAt(null);
      setNotice(`Grupo ${nextSession.group.code} listo.`);
      void syncNow("create");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(input: JoinGroupInput) {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setError("Necesitas conexión para unirte a un grupo.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await resetLocalCache();
      const nextSession = await joinGroupSession(input);
      await applySession(nextSession);
      await applySnapshot({
        group: nextSession.group,
        members: [nextSession.member],
        latestLocations: []
      });
      setPendingCount(0);
      setLastSyncAt(null);
      setNotice(`Entraste en ${nextSession.group.name}.`);
      void syncNow("join");
    } catch (joinError) {
      setError(getErrorMessage(joinError));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkHere() {
    setLocating(true);
    setError(null);

    try {
      await captureLocation("manual");
    } catch (locationError) {
      setError(getErrorMessage(locationError));
    } finally {
      setLocating(false);
    }
  }

  async function handleCopyMyLocation() {
    setError(null);

    try {
      const currentLocation =
        latestLocations.find(
          (location) => location.member_id === sessionRef.current?.member.id
        ) ?? (await captureLocation("manual"));

      await navigator.clipboard.writeText(getMapsUrl(currentLocation));
      setNotice("Enlace de tu ubicación copiado al portapapeles.");
    } catch (copyError) {
      setError(getErrorMessage(copyError));
    }
  }

  async function handleResetSession() {
    try {
      await stopSharing();
      await resetLocalCache();
      sessionRef.current = null;
      startTransition(() => {
        setSession(null);
        setMembers([]);
        setLatestLocations([]);
        setPendingCount(0);
        setLastSyncAt(null);
        setNotice(null);
        setError(null);
        setSharingBusy(false);
      });
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    }
  }

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="glass-card rounded-[2rem] px-6 py-5 text-sm text-slate-300">
          Cargando estado local de ThaiGroup...
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <EntryScreen
        busy={busy}
        online={online}
        hasSupabaseEnv={hasSupabaseEnv}
        error={error}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />
    );
  }

  const sortedMembers = sortMembersByFreshness(
    members,
    latestLocations,
    session.member.id
  );
  const latestByMemberId = new Map(
    latestLocations.map((location) => [location.member_id, location])
  );
  const presences = sortedMembers.map((member) => {
    const location = latestByMemberId.get(member.id) ?? null;

    return {
      member,
      location,
      isSelf: member.id === session.member.id,
      isStale: isStaleTimestamp(location?.created_at)
    };
  });

  return (
    <GroupDashboard
      session={session}
      presences={presences}
      online={online}
      syncing={syncing}
      locating={locating}
      sharingBusy={sharingBusy}
      pendingCount={pendingCount}
      lastSyncAt={lastSyncAt}
      notice={notice}
      error={error}
      hasSupabaseEnv={hasSupabaseEnv}
      onStartSharing={startSharing}
      onStopSharing={stopSharing}
      onMarkHere={handleMarkHere}
      onCopyMyLocation={handleCopyMyLocation}
      onSyncNow={() => syncNow("manual")}
      onResetSession={handleResetSession}
    />
  );
}
