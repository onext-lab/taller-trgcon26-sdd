# Decisiones de arquitectura (DEC-NN)

Registro de las decisiones que condicionan el diseño de cualquier HU. Las consultan `/prd-writer` (sección *Decisiones
aplicables*), `/tech-design` y `/reviewer`. Una decisión nueva o un cambio abre el siguiente `DEC-NN`; las antiguas no
se borran: se marcan `Sustituida por DEC-NN`.

Formato: **Contexto · Decisión · Alternativas · Consecuencias · Estado**.

---

## DEC-01 · Stack TypeScript: Fastify, `node:sqlite` y React + Vite

- **Contexto.** Repo de taller que tiene que arrancar en portátiles ajenos (macOS, Linux y Windows) sin servicios
  externos ni binarios que compilar, y ser legible en una demo de 2 horas.
- **Decisión.** TypeScript estricto en todo el repo. API con **Fastify 5** (validación con JSON Schema por ruta y
  `fastify.inject` para tests). Persistencia con **`node:sqlite`** (`DatabaseSync`) sobre `data/ats.db`. Web con
  **React 19 + Vite**. Tests con **Vitest** (api y web) y **Playwright** solo con Chromium (e2e). La API ejecuta
  TypeScript directamente con el *type stripping* de Node 24 (sin paso de compilación).
- **Alternativas.** Express (sin validación por esquema de serie); `better-sqlite3` (binario nativo que compila en la
  instalación y falla en portátiles sin toolchain); Postgres en Docker (requisito de más para el asistente); Next.js
  (más conceptos de los que la demo necesita).
- **Consecuencias.** Requiere **Node 24 LTS ≥ 24.15** ([SETUP.md](../SETUP.md)). `node:sqlite` es síncrono: basta para
  un único usuario local. Errores de la API con envelope uniforme `{ error: { code, message, details? } }`.
- **Estado.** Aceptada (2026-10-06).

## DEC-02 · Monorepo con npm workspaces

- **Contexto.** API, web y e2e comparten versiones de TypeScript, ESLint y Prettier, y el asistente tiene que
  arrancarlo todo con un comando.
- **Decisión.** Un único repo con **npm workspaces** (`apps/api`, `apps/web`) y `e2e/` en la raíz. Scripts raíz:
  `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `e2e`, `db:reset`, `check:env` y `check:harness`.
- **Alternativas.** pnpm o Turborepo (otra herramienta que instalar); dos repos (rompe la HU vertical).
- **Consecuencias.** Un solo `package-lock.json`; los comandos acotados usan `-w apps/<app>`.
- **Estado.** Aceptada (2026-10-06).

## DEC-03 · La base de datos `.db` no se versiona

- **Contexto.** Un fichero binario en git provoca conflictos en cada merge y arrastra datos de una etiqueta a otra.
- **Decisión.** Se versionan `apps/api/src/db/schema.sql`, las migraciones (`apps/api/src/db/migrations/NNN-descripcion.sql`)
  y el seed (`apps/api/src/db/seed.ts`). `npm run db:reset` regenera `data/ats.db` desde cero. `.gitignore` excluye
  `data/*.db`. Los e2e usan su propia base (`data/e2e.db`).
- **Alternativas.** Versionar la `.db` (conflictos binarios); crear el esquema desde el código en el arranque (oculta
  el historial de cambios del modelo).
- **Consecuencias.** Toda HU que cambie el modelo añade una migración nueva; nunca se edita una ya comiteada. El seed
  usa **solo datos inventados**.
- **Estado.** Aceptada (2026-10-06).

## DEC-04 · Sin login: un único rol, «reclutador»

- **Contexto.** El taller enseña el flujo SDD, no autenticación; un login añade pantallas, secretos y casos límite que
  no aportan a la demo.
- **Decisión.** No hay autenticación ni autorización por usuario. Toda la aplicación la usa un único rol,
  **«reclutador»**, que puede gestionar ofertas, candidatos e inscripciones. La API escucha solo en `127.0.0.1`.
- **Alternativas.** Login local con sesión (más superficie y más tiempo de demo); roles reclutador/administrador
  (duplica casos de uso sin enseñar nada nuevo del flujo).
- **Consecuencias.** Los PRD no declaran permisos por rol; la categoría «seguridad» de los edge cases se centra en
  exposición de datos personales, inyección, enumeración y abuso de tamaño. Si una feature necesitara roles, abriría
  un `DEC-NN` nuevo.
- **Estado.** Aceptada (2026-10-06).

## DEC-05 · Dependencias de desarrollo añadidas y TypeScript 6.0.x

- **Contexto.** El plan fija como dependencias `fastify`, `react`, `react-dom` y `vite`; en desarrollo, `typescript`,
  `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `eslint`, `typescript-eslint` y `prettier`, más los
  plugins imprescindibles. Cualquier otra se justifica aquí.
- **Decisión.** Se añaden, solo en desarrollo:
  - `@types/node`, `@types/react`, `@types/react-dom`: tipos de Node y React para el modo `strict`.
  - `@eslint/js` y `globals`: configuración base de ESLint *flat config* y globales de Node y navegador.
  - `@testing-library/dom`: dependencia *peer* obligatoria de `@testing-library/react` 16.
  - `eslint-plugin-react-hooks`: reglas de hooks de React (plugin imprescindible).
  - `@vitejs/plugin-react`: plugin de React para Vite (plugin imprescindible).

  Y se fija **TypeScript 6.0.3**: `typescript-eslint` 8.71 exige `typescript < 6.1`, así que la 7.x todavía no es
  compatible con el lint.
- **Alternativas.** TypeScript 7.x sin lint de tipos (perdemos `typescript-eslint`); ESLint sin plugin de hooks (deja
  pasar errores de React que la review tendría que cazar a mano).
- **Consecuencias.** Las versiones van fijadas (sin `^`) en los `package.json`. Subir TypeScript a 7.x queda pendiente
  de que `typescript-eslint` lo soporte; se hará con un `DEC-NN` nuevo.
- **Estado.** Aceptada (2026-10-06).
