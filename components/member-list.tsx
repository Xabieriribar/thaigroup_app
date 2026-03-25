"use client";

import { memo } from "react";
import type { MemberPresence } from "@/lib/types";
import {
  buildPresenceLabel,
  formatClock,
  formatRelativeTime,
  isLiveTimestamp,
  locationPrecisionText
} from "@/lib/utils";

interface MemberListProps {
  presences: MemberPresence[];
  currentMemberId: string;
}

function MemberListComponent({
  presences,
  currentMemberId
}: MemberListProps) {
  return (
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
                        presence.member.id === currentMemberId
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
  );
}

function areEqualMemberListProps(
  prev: MemberListProps,
  next: MemberListProps
) {
  if (
    prev.currentMemberId !== next.currentMemberId ||
    prev.presences.length !== next.presences.length
  ) {
    return false;
  }

  for (let index = 0; index < prev.presences.length; index += 1) {
    const left = prev.presences[index];
    const right = next.presences[index];

    if (
      left.member.id !== right.member.id ||
      left.member.display_name !== right.member.display_name ||
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
      leftLocation.created_at !== rightLocation.created_at ||
      leftLocation.accuracy !== rightLocation.accuracy ||
      leftLocation.source !== rightLocation.source
    ) {
      return false;
    }
  }

  return true;
}

export const MemberList = memo(MemberListComponent, areEqualMemberListProps);
