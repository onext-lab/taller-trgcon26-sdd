# TASK-15 — Recorridos e2e de ofertas sobre una base regenerada [e2e]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** test (e2e)
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Recorridos de Playwright (solo Chromium) de la HU de extremo a extremo, contra la API y la web reales:
1. Configuración determinista (DD-08): `data/e2e.db` se regenera en el arranque del `webServer` de la API (esquema,
   migraciones y seed de 4 borradores), con puertos propios de e2e, sin reutilizar servidores y con un solo *worker*.
2. `e2e/jobs.spec.ts` con los flujos de alta, edición, borrado, consulta, listado del seed y API caída.

`e2e/smoke.spec.ts` ya está actualizado (TASK-10) y debe seguir en verde con la nueva configuración.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `playwright.config.ts` | modificar | DD-08: reset en el comando del `webServer` de la API, puertos 3101/5174, `reuseExistingServer: false`, `workers: 1` |
| `e2e/jobs.spec.ts` | crear | Flujos de la HU |
| `docs/SETUP.md` | modificar | Puertos de e2e (3101/5174) en «Requisitos» y nota de por qué la base de e2e se regenera en el `webServer` (lo pide el aprobador) |

**No** se crea fichero de `globalSetup` (ver notas).

## Implementa
- RF: RF-01 a RF-07 de extremo a extremo · CA: CA-01, CA-02, CA-03 (UI), CA-09, CA-10, CA-11, CA-13, CA-18, CA-19,
  CA-20 · Edge cases: EC-03, EC-08, EC-21, EC-23, EC-38
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Módulos y ficheros afectados (filas e2e), DD-08, § Estrategia de tests
  (columna Playwright y «E2E deterministas»), § Riesgos, § Checklist pasos 8 y 9

## Dependencias
- **Depende de:** TASK-13 (todas las pantallas; por cadena, todo el backend y el seed de TASK-04)
- **Bloquea:** nada (puede ir en paralelo con TASK-14: no comparten ficheros)

## Criterios de done
- [ ] `npx playwright test e2e/smoke.spec.ts e2e/jobs.spec.ts` en verde.
- [ ] Ejecutado **dos veces seguidas**, da el mismo resultado (la base se regenera en cada ejecución).
- [ ] Con `npm run dev` arrancado (puertos 3001/5173), `npm run e2e` sigue funcionando y no toca `data/ats.db`.
- [ ] El porqué queda documentado (lo pide el aprobador), en dos sitios:
      - un comentario en `playwright.config.ts`, junto al `webServer` de la API;
      - una nota en `docs/SETUP.md`.
      Los dos dicen que en Playwright 1.63 el `webServer` arranca **antes** que `globalSetup`, y que por eso la base de
      e2e se regenera en el comando del `webServer`, con `reuseExistingServer: false`, puertos 3101/5174 y
      `workers: 1`. Además, la fila «Puertos libres» de `docs/SETUP.md` incluye 3101 y 5174 para los e2e.
- [ ] `npm run typecheck` sin errores (el `tsconfig.json` raíz incluye `e2e/` y `playwright.config.ts`).
- [ ] `npx eslint playwright.config.ts e2e/jobs.spec.ts` sin errores.
- [ ] Commit único `test(e2e): job opening flows on a fresh e2e database [HU-01 TASK-15]` nombrando los ficheros
      (incluido `docs/SETUP.md`).

## Notas de implementación

**Configuración (DD-08).** Comprobado en `@playwright/test` 1.63.0: los `webServer` arrancan **antes** que
`globalSetup`. Si un `globalSetup` borrase `data/e2e.db` (y `-wal`/`-shm`), la API ya la tendría abierta en modo WAL y
seguiría escribiendo en ficheros borrados. Por eso el reset va en el propio comando del servidor:

- `webServer` de la API: `command: 'npm run db:reset -w apps/api && npm run start -w apps/api'`, con el
  `ATS_DB_PATH` que ya fija su `env` (`data/e2e.db`); `apps/api/src/db/reset.ts` ya honra `ATS_DB_PATH`. `&&` funciona
  en `sh` y en `cmd.exe`.
- Puertos de e2e: API **3101** y web **5174**, pasados como `API_PORT` y `WEB_PORT` en el `env` de **los dos**
  servidores (el proxy de Vite lee `API_PORT` en `apps/web/vite.config.ts`; `server.ts` lee `API_PORT`). `baseURL` =
  `http://127.0.0.1:5174`; `url` de salud de la API = `http://127.0.0.1:3101/api/health`.
- `reuseExistingServer: false` en los dos (si no, un `npm run dev` abierto se reutilizaría y los e2e probarían contra
  `data/ats.db`). Si los puertos están ocupados, Playwright falla en vez de probar contra otra base.
- `workers: 1` (dos ficheros no escriben a la vez). `retries` se queda como está (0 en local).

**Documentar el porqué** (lo pide el aprobador):
- **Comentario en `playwright.config.ts`**, junto al `webServer` de la API. Breve y en castellano, como los comentarios
  que ya tiene el fichero. Contenido: en Playwright 1.63 los `webServer` arrancan antes que `globalSetup`; por eso
  `data/e2e.db` se regenera en el comando del `webServer` (`db:reset && start`). Con `reuseExistingServer: false`,
  puertos 3101/5174 y `workers: 1`, la ejecución es determinista y convive con `npm run dev`.
- **Nota en `docs/SETUP.md`**: la misma explicación, en lenguaje de taller. Ponla en una sección corta sobre los e2e o
  como fila de «Problemas frecuentes», por ejemplo «`npm run e2e` falla porque el puerto 3101 o 5174 está ocupado».
- **Fila «Puertos libres» de «Requisitos» en `docs/SETUP.md`**: pasa a decir 3001 y 5173 para `npm run dev`, y 3101 y
  5174 para los e2e.
- No cambies nada más de `docs/SETUP.md`.

**Tests** (`e2e/jobs.spec.ts`; selectores por rol y nombre, como en Testing Library; datos inventados):
- **Sin dependencias entre tests:** cada test que escribe crea sus propias ofertas con un **título fijo y distinto** del
  de los demás tests y del seed. Si hay reintentos, busca tu oferta con `.first()`.
- «RF-05/RF-07 listado del seed»: los 4 borradores del seed con estado «Borrador» y fecha `dd/mm/aaaa`, en este orden
  **relativo** (no compruebes posiciones absolutas ni número de filas: otros tests crean ofertas más recientes):

  ```ts
  const SEED_TITLES = [ // orden del listado (más reciente primero); actualizar junto a apps/api/src/db/seed.ts
    'Desarrollador/a frontend (React)', // 01/10/2026
    'Diseñador/a de producto',          // 28/09/2026
    'Técnico/a de soporte IT',          // 24/09/2026
    'Analista de datos junior',         // 21/09/2026
  ];
  ```

- «CA-01 alta solo con título»: listado → «Nueva oferta» → título → «Guardar» → ficha (h1 = título, «Oferta creada.»)
  → «Ofertas» → aparece en el listado.
- «CA-02/EC-03 alta completa»: «  Técnica/o de selección  » (con espacios), «Híbrida», «Valencia», 32000-40000 → la
  ficha muestra «Técnica/o de selección», «Híbrida», «Valencia» y «32.000 – 40.000 €/año».
- «CA-03 título de 2 caracteres»: error junto al campo y sigue en el formulario (h1 «Nueva oferta»).
- «CA-09/CA-10/EC-21 editar y vaciar»: editar descripción y ubicación → la ficha los muestra; volver a editar y vaciar
  la descripción → «Sin indicar».
- «CA-11/EC-23 dos páginas editan el mismo borrador»: dos `page` del mismo `context` abren `/jobs/{id}/edit`, guardan
  una después de otra el mismo campo con valores distintos → la ficha muestra el de la última.
- «CA-13 borrar con confirmación»: «Borrar» → el foco está en «Cancelar» → `Escape` → la oferta sigue → «Borrar» →
  «Borrar oferta» → listado con «Oferta borrada.» y sin la oferta.
- «CA-18/EC-38 API caída»: `page.route('**/api/jobs', r => r.abort())` → `role="alert"` + «Reintentar», sin tabla.
- «CA-19 HTML literal»: alta con título `Oferta <b>X</b>` → la ficha muestra el texto literal (0 `b` en el h1).
- «CA-20 oferta inexistente»: `page.goto('/jobs/999999999')` → «Oferta no encontrada», sin «Borrar».
- «EC-08 inyección SQL»: alta con título `'); DROP TABLE job_openings; --` → se ve literal y el listado sigue
  cargando.

El estado «vacío» (CA-17) y los 25 elementos (CA-15) **no** van en e2e (exigirían borrar el seed o crear 21 ofertas):
están en Vitest (TASK-10) y en la API (TASK-04).
