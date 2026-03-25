# ThaiGroup

ThaiGroup es una web app tipo PWA pensada para un viaje de 8 amigos. La app prioriza offline-first: abre sin conexión, guarda sesión y ubicaciones en IndexedDB, mantiene una cola local de eventos pendientes y sincroniza con Supabase cuando vuelve Internet.

## Stack

- Next.js 16 + TypeScript + App Router
- Tailwind CSS
- Leaflet + OpenStreetMap tiles
- Supabase como backend simple
- IndexedDB nativo para persistencia local
- Service worker + `manifest.webmanifest`
- Deploy objetivo: Vercel

## Qué incluye el MVP

- Pantalla de entrada para crear grupo o unirse por código
- Perfil simple con nombre visible, emoji y color
- Dashboard mobile-first con mapa y lista alternativa de miembros
- Botón para empezar/detener compartir ubicación
- Botón `Estoy aquí`
- Botón `Copiar mi ubicación actual`
- Última vez visto por persona y estado desactualizado
- Cola local de ubicaciones pendientes
- Sincronización best effort con Supabase
- Shell PWA cacheada y fallback offline

## Arquitectura rápida

- `app/`: shell de Next y estilos globales
- `components/`: pantalla de entrada, dashboard y mapa
- `lib/sync.ts`: operaciones remotas contra Supabase
- `lib/idb.ts` y `lib/local-store.ts`: capa IndexedDB separada
- `public/sw.js`: service worker manual, sin plugins extra
- `supabase/schema.sql`: tablas, índices, view `latest_locations` y policies
- `supabase/seed.sql`: seed mínima de prueba

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ve a `SQL Editor` y ejecuta [`supabase/schema.sql`](/home/xabieriribar/tailandia/supabase/schema.sql).
3. Opcional: ejecuta [`supabase/seed.sql`](/home/xabieriribar/tailandia/supabase/seed.sql) para cargar un grupo demo con código `THAI24`.
4. Copia [`/home/xabieriribar/tailandia/.env.example`](/home/xabieriribar/tailandia/.env.example) a `.env.local`.
5. Rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Notas sobre policies

Este MVP no implementa auth fuerte. Las policies de `schema.sql` permiten lectura e inserción pública para simplificar el uso entre 8 amigos. Es una decisión pragmática para viaje, no una base segura para producción abierta.

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Para validar producción:

```bash
npm run build
```

## Desplegar en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel.
3. Añade las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy normal. No hacen falta adaptadores ni configuración especial.

## Cómo probar el flujo

1. Crea un grupo desde un móvil o navegador.
2. Abre la app en otra pestaña o dispositivo y únete con el código.
3. Activa `Empezar a compartir` o pulsa `Estoy aquí`.
4. Corta la red y vuelve a pulsar `Estoy aquí`.
5. Verifica que sube la cola al recuperar conexión y que `Última sync` cambia.

## Limitaciones conocidas

- No hay auth real; el código de grupo no protege los datos.
- La geolocalización continua depende de que la app siga abierta y del navegador.
- No hay Background Sync nativo si la app está totalmente cerrada.
- Los tiles de OpenStreetMap sólo estarán offline si ya se descargaron antes.
- La app muestra la última ubicación conocida, no tracking en tiempo real sin red.
- No hay chat, push, rutas ni presencia avanzada.

## Archivos clave

- [`app/page.tsx`](/home/xabieriribar/tailandia/app/page.tsx)
- [`components/app-shell.tsx`](/home/xabieriribar/tailandia/components/app-shell.tsx)
- [`components/group-dashboard.tsx`](/home/xabieriribar/tailandia/components/group-dashboard.tsx)
- [`lib/local-store.ts`](/home/xabieriribar/tailandia/lib/local-store.ts)
- [`lib/sync.ts`](/home/xabieriribar/tailandia/lib/sync.ts)
- [`public/sw.js`](/home/xabieriribar/tailandia/public/sw.js)
- [`public/manifest.webmanifest`](/home/xabieriribar/tailandia/public/manifest.webmanifest)
