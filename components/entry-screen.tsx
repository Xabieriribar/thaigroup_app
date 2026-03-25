"use client";

import { useState } from "react";
import type { CreateGroupInput, JoinGroupInput } from "@/lib/types";
import {
  AVATAR_OPTIONS,
  COLOR_OPTIONS,
  normalizeGroupCode,
  pickDefaultColor
} from "@/lib/utils";

type EntryMode = "create" | "join";

interface EntryScreenProps {
  busy: boolean;
  online: boolean;
  hasSupabaseEnv: boolean;
  error: string | null;
  onCreate: (input: CreateGroupInput) => Promise<void>;
  onJoin: (input: JoinGroupInput) => Promise<void>;
}

export function EntryScreen({
  busy,
  online,
  hasSupabaseEnv,
  error,
  onCreate,
  onJoin
}: EntryScreenProps) {
  const [mode, setMode] = useState<EntryMode>("create");
  const [groupName, setGroupName] = useState("Bangkok Crew");
  const [groupCode, setGroupCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("😎");
  const [color, setColor] = useState(pickDefaultColor());

  const disabled = busy || !online || !hasSupabaseEnv;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "create") {
      await onCreate({
        groupName,
        displayName,
        avatar,
        color
      });
      return;
    }

    await onJoin({
      code: normalizeGroupCode(groupCode),
      displayName,
      avatar,
      color
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6">
      <div className="grid w-full gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-card rounded-[2rem] p-6 shadow-2xl shadow-black/25 sm:p-8">
          <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-emerald-200">
            ThaiGroup
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            PWA simple para no perder a nadie en el viaje.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Funciona offline-first, guarda todo en el navegador, y sincroniza
            cuando vuelve Internet. Pensada para un grupo pequeño, sin auth
            compleja y con foco en abrir rápido desde el móvil.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <FeatureCard
              title="Offline real"
              body="La app abre sin conexión y sigue mostrando el último estado guardado."
            />
            <FeatureCard
              title="Sync best effort"
              body="Las ubicaciones nuevas se encolan localmente y suben después."
            />
            <FeatureCard
              title="Sin overkill"
              body="Código de grupo, nombre visible y emoji. Ya está."
            />
          </div>
        </section>

        <section className="glass-card rounded-[2rem] p-5 shadow-2xl shadow-black/25 sm:p-6">
          <div className="flex rounded-[1.4rem] bg-slate-900/55 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                mode === "create"
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Crear grupo
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                mode === "join"
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Unirse
            </button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {mode === "create" ? (
              <Field label="Nombre del grupo">
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value.slice(0, 48))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50"
                  placeholder="Bangkok Crew"
                  maxLength={48}
                  required
                />
              </Field>
            ) : (
              <Field label="Código del grupo">
                <input
                  value={groupCode}
                  onChange={(event) =>
                    setGroupCode(normalizeGroupCode(event.target.value))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base uppercase tracking-[0.2em] text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50"
                  placeholder="THAI24"
                  maxLength={8}
                  required
                />
              </Field>
            )}

            <Field label="Tu nombre visible">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50"
                placeholder="Xabi"
                maxLength={40}
                required
              />
            </Field>

            <Field label="Avatar emoji">
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAvatar(option)}
                    className={`rounded-2xl border px-3 py-3 text-2xl transition ${
                      option === avatar
                        ? "border-emerald-300/70 bg-emerald-300/15"
                        : "border-white/10 bg-slate-950/60 hover:border-white/25"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                value={avatar}
                onChange={(event) => setAvatar(event.target.value.slice(0, 4))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50"
                placeholder="😎"
                maxLength={4}
                required
              />
            </Field>

            <Field label="Color">
              <div className="grid grid-cols-4 gap-2">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setColor(option)}
                    className={`h-12 rounded-2xl border transition ${
                      option === color
                        ? "border-white ring-2 ring-white/80"
                        : "border-white/10"
                    }`}
                    style={{ backgroundColor: option }}
                  />
                ))}
              </div>
            </Field>

            {!online ? (
              <Banner tone="warning">
                Sin conexión: si ya habías entrado antes, podrás usar la app
                offline. Crear o unirse a un grupo requiere Internet.
              </Banner>
            ) : null}

            {!hasSupabaseEnv ? (
              <Banner tone="danger">
                Falta configurar Supabase en `.env.local`. La app podrá compilar,
                pero no crear ni unirse a grupos.
              </Banner>
            ) : null}

            {error ? <Banner tone="danger">{error}</Banner> : null}

            <button
              type="submit"
              disabled={disabled}
              className="w-full rounded-[1.4rem] bg-white px-4 py-4 text-base font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy
                ? "Procesando..."
                : mode === "create"
                  ? "Crear grupo"
                  : "Entrar al grupo"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function Banner({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "warning" | "danger";
}) {
  const className =
    tone === "warning"
      ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
      : "border-rose-300/25 bg-rose-400/10 text-rose-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}
