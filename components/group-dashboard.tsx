"use client";

import { MapView } from "@/components/map-view";
import type { MemberPresence, SessionRecord } from "@/lib/types";
import {
  buildPresenceLabel,
  formatClock,
  formatDateTime,
  formatRelativeTime,
  getMapsUrl,
  isLiveTimestamp,
  locationPrecisionText
} from "@/lib/utils";

interface GroupDashboardProps {
  session: SessionRecord;
  presences: MemberPresence[];
  online: boolean;
  syncing: boolean;
  locating: boolean;
  sharingBusy: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  notice: string | null;
  error: string | null;
  hasSupabaseEnv: boolean;
  onStartSharing: () => Promise<void>;
  onStopSharing: () => Promise<void>;
  onMarkHere: () => Promise<void>;
  onCopyMyLocation: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onResetSession: () => Promise<void>;
}

export function GroupDashboard({
  session,
  presences,
  online,
  syncing,
  locating,
  sharingBusy,
  pendingCount,
  lastSyncAt,
  notice,
  error,
  hasSupabaseEnv,
  onStartSharing,
  onStopSharing,
  onMarkHere,
  onCopyMyLocation,
  onSyncNow,
  onResetSession
}: GroupDashboardProps) {
  const myPresence =
    presences.find((presence) => presence.member.id === session.member.id) ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-4 sm:px-6">
      <div className="space-y-4">
        <section className="glass-card rounded-[2rem] p-5 shadow-2xl shadow-black/25 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
                  style={{ backgroundColor: session.member.color }}
                >
                  {session.member.avatar}
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">
                    Grupo {session.group.code}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold text-white">
                    {session.group.name}
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Último estado conocido del grupo. Las nuevas posiciones se
                guardan localmente y se sincronizan cuando la red vuelve.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill
                label={
                  online && hasSupabaseEnv ? "Con conexión" : "Modo offline"
                }
                active={online && hasSupabaseEnv}
              />
              <button
                type="button"
                onClick={() => void onResetSession()}
                className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
              >
                Cambiar grupo
              </button>
            </div>
          </div>

          {!online ? (
            <InlineBanner tone="warning">
              Sin conexión. La app sigue funcionando con lo guardado en el
              dispositivo y encola nuevas ubicaciones.
            </InlineBanner>
          ) : null}

          {online && !hasSupabaseEnv ? (
            <InlineBanner tone="danger">
              Falta la configuración pública de Supabase. La parte offline sigue
              viva, pero la sincronización remota está desactivada.
            </InlineBanner>
          ) : null}

          {error ? <InlineBanner tone="danger">{error}</InlineBanner> : null}
          {notice && !error ? <InlineBanner tone="info">{notice}</InlineBanner> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Tu última actualización"
              value={
                myPresence?.location
                  ? formatRelativeTime(myPresence.location.created_at)
                  : "Sin ubicación"
              }
              hint={
                myPresence?.location
                  ? `${formatClock(myPresence.location.created_at)} · ${locationPrecisionText(
                      myPresence.location.accuracy
                    )}`
                  : "Pulsa “Estoy aquí” para guardar tu punto actual."
              }
            />
            <MetricCard
              label="Cola pendiente"
              value={String(pendingCount)}
              hint={
                pendingCount > 0
                  ? "Se enviará cuando haya red."
                  : "No hay eventos esperando sincronización."
              }
            />
            <MetricCard
              label="Última sync"
              value={lastSyncAt ? formatRelativeTime(lastSyncAt) : "Aún no"}
              hint={lastSyncAt ? formatDateTime(lastSyncAt) : "Todavía sin descarga remota."}
            />
            <MetricCard
              label="Compartir ubicación"
              value={session.sharingEnabled ? "Activado" : "Pausado"}
              hint={
                session.sharingEnabled
                  ? "watchPosition activo mientras la app siga abierta."
                  : "Sólo manual hasta que pulses iniciar."
              }
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionButton
              onClick={() =>
                void (session.sharingEnabled ? onStopSharing() : onStartSharing())
              }
              emphasis={session.sharingEnabled ? "muted" : "primary"}
              disabled={sharingBusy}
            >
              {sharingBusy
                ? "Activando..."
                : session.sharingEnabled
                  ? "Detener compartir"
                  : "Empezar a compartir"}
            </ActionButton>
            <ActionButton onClick={() => void onMarkHere()} disabled={locating}>
              {locating ? "Buscando..." : "Estoy aquí"}
            </ActionButton>
            <ActionButton onClick={() => void onCopyMyLocation()}>
              Copiar mi ubicación
            </ActionButton>
            <ActionButton onClick={() => void onSyncNow()} disabled={syncing}>
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </ActionButton>
          </div>
        </section>

        <section className="map-panel rounded-[2rem] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-lg font-semibold text-white">Mapa del grupo</h2>
              <p className="text-sm text-slate-400">
                Muestra la última ubicación conocida de cada persona.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {presences.filter((presence) => presence.location).length}/
              {presences.length} con posición
            </span>
          </div>

          <div className="map-frame h-[330px] overflow-hidden rounded-[1.6rem]">
            <MapView
              presences={presences}
              currentMemberId={session.member.id}
              fallbackText="Sin ubicaciones todavía. Usa “Estoy aquí” o activa compartir."
            />
          </div>

          <p className="px-1 pt-3 text-xs leading-5 text-slate-400">
            Si el mapa falla o no hay tiles offline, la lista inferior sigue
            siendo la fuente fiable del último estado. Para compartir un enlace
            rápido usa <code>{getMapsUrl({ lat: 13.7563, lon: 100.5018 })}</code>{" "}
            como formato de referencia.
          </p>
        </section>

        <section className="glass-card rounded-[2rem] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Miembros</h2>
              <p className="text-sm text-slate-400">
                Lista alternativa por si el mapa no carga.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
              Última vista visible
            </span>
          </div>

          <div className="space-y-3">
            {presences.map((presence) => {
              const live = isLiveTimestamp(presence.location?.created_at);

              return (
                <article
                  key={presence.member.id}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
                      style={{ backgroundColor: presence.member.color }}
                    >
                      {presence.member.avatar}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">
                          {buildPresenceLabel(
                            presence.member,
                            presence.member.id === session.member.id
                          )}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            presence.isStale
                              ? "bg-amber-400/10 text-amber-100"
                              : live
                                ? "bg-emerald-400/10 text-emerald-100"
                                : "bg-sky-400/10 text-sky-100"
                          }`}
                        >
                          {presence.isStale
                            ? "Desactualizado"
                            : live
                              ? "Reciente"
                              : "En espera"}
                        </span>
                      </div>

                      {presence.location ? (
                        <>
                          <p className="mt-1 text-sm text-slate-300">
                            Visto {formatRelativeTime(presence.location.created_at)} a
                            las {formatClock(presence.location.created_at)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {locationPrecisionText(presence.location.accuracy)} ·{" "}
                            {presence.location.source === "manual"
                              ? "Marcado manualmente"
                              : "GPS"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">
                          Todavía no ha compartido ubicación.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${
        active
          ? "border border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
          : "border border-amber-300/25 bg-amber-400/10 text-amber-100"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-emerald-300" : "bg-amber-300"
        }`}
      />
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{hint}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  emphasis = "secondary",
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  emphasis?: "primary" | "secondary" | "muted";
  disabled?: boolean;
}) {
  const styles =
    emphasis === "primary"
      ? "bg-white text-slate-950"
      : emphasis === "muted"
        ? "bg-rose-400/10 text-rose-100"
        : "bg-slate-950/65 text-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[1.4rem] px-4 py-4 text-sm font-semibold transition ${styles} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {children}
    </button>
  );
}

function InlineBanner({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "warning" | "danger" | "info";
}) {
  const className =
    tone === "warning"
      ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
      : tone === "danger"
        ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
        : "border-sky-300/20 bg-sky-400/10 text-sky-100";

  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}
