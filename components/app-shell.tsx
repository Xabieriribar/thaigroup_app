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
  geolocationErrorMessage,
  getErrorMessage,
  getMapsUrl,
  isStaleTimestamp,
  mergeLatestLocation,
  sortMembersByFreshness
} from "@/lib/utils";

async function getCurrentPosition() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    throw new Error("La geolocalización no está disponible en este dispositivo.");
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000
    });
  });
}

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
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const sessionRef = useRef<SessionRecord | null>(null);

  const refreshPendingCount = useEffectEvent(async () => {
    const pending = await loadPendingLocations();
    setPendingCount(pending.length);
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
    await Promise.all([
      replaceMembers(snapshot.members),
      replaceLatestLocations(snapshot.latestLocations)
    ]);

    startTransition(() => {
      setMembers(snapshot.members);
      setLatestLocations(snapshot.latestLocations);
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
    setSyncing(true);

    try {
      const pending = await refreshPendingCount();

      if (pending.length > 0) {
        await uploadPendingLocations(pending);
        await removePendingLocations(pending.map((location) => location.id));
        setPendingCount(0);
      }

      const snapshot = await fetchGroupSnapshot(sessionRef.current.group.id);
      await applySnapshot(snapshot);

      const now = new Date().toISOString();
      await saveLastSyncAt(now);
      setLastSyncAt(now);
      setError(null);

      if (reason !== "interval") {
        setNotice("Sincronización completada.");
      }
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
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

  const queueNewLocation = useEffectEvent(async (location: LocationRow) => {
    await Promise.all([enqueueLocation(location), saveLatestLocation(location)]);
    await refreshPendingCount();

    startTransition(() => {
      setLatestLocations((current) => mergeLatestLocation(current, location));
    });

    setNotice(
      window.navigator.onLine
        ? "Ubicación guardada y lista para sincronizar."
        : "Sin conexión: ubicación guardada en local."
    );

    if (window.navigator.onLine) {
      void syncNow("location");
    }
  });

  const captureLocation = useEffectEvent(async (source: LocationSource) => {
    const position = await getCurrentPosition();
    const location = buildLocationEvent(position, source);
    await queueNewLocation(location);
    return location;
  });

  const stopSharing = useEffectEvent(async () => {
    if (watchIdRef.current !== null && typeof window !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

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
    if (watchIdRef.current !== null) {
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("La geolocalización no está disponible en este dispositivo.");
      return;
    }

    try {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          void queueNewLocation(buildLocationEvent(position, "gps"));
        },
        (watchError) => {
          setError(geolocationErrorMessage(watchError));
          void stopSharing();
        },
        {
          enableHighAccuracy: true,
          maximumAge: 15_000,
          timeout: 25_000
        }
      );

      watchIdRef.current = watchId;

      if (sessionRef.current) {
        const nextSession = {
          ...sessionRef.current,
          sharingEnabled: true
        };
        await applySession(nextSession);
      }

      setError(null);
      setNotice(
        "Compartiendo ubicación mientras la app siga abierta en este dispositivo."
      );

      await captureLocation("gps");
    } catch (shareError) {
      setError(getErrorMessage(shareError));
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

      sessionRef.current = cachedSession;

      startTransition(() => {
        setSession(cachedSession);
        setMembers(cachedMembers);
        setLatestLocations(cachedLocations);
        setLastSyncAt(cachedLastSync);
        setPendingCount(pending.length);
        setHydrated(true);
      });

      if (cachedSession?.sharingEnabled) {
        void startSharing();
      }

      if (cachedSession && typeof window !== "undefined" && window.navigator.onLine) {
        void syncNow("boot");
      }
    })();

    return () => {
      cancelled = true;

      if (watchIdRef.current !== null && typeof window !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startSharing, syncNow]);

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
    }, 30_000);

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
