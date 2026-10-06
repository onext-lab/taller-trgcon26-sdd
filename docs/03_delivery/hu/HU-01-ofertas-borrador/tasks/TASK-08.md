# TASK-08 — Cliente HTTP, formato y contrato web de ofertas [setup]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Pendiente
- **Prioridad:** Must (bloquea todas las pantallas)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Todo lo que la web necesita para hablar con la API, sin pantallas todavía:
- `requestJson` y `ApiError` (`apps/web/src/components/http.ts`): `fetch` a `/api/...` con *timeout* de 10 s, que
  interpreta el envelope de DEC-01 y traduce red, *timeout*, cuerpo no JSON y respuestas inesperadas a un error tipado.
- `formatDate` y `formatInteger` (`apps/web/src/components/format.ts`).
- El contrato de la feature en `apps/web/src/features/jobs/`: tipos, una función por endpoint con comprobación mínima de
  la forma de la respuesta, rutas de la web (`jobPaths`, `parseJobId`) y etiquetas.
- El `fetch` simulado por ruta para los tests (`apps/web/test/helpers/fetch.ts`).

Sin dependencias nuevas (DEC-05). Puede ir en paralelo con el backend y con TASK-09 (no comparten ficheros).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/http.ts` | crear | `requestJson`, `ApiError`, `userMessage` |
| `apps/web/src/components/format.ts` | crear | `formatDate`, `formatInteger` |
| `apps/web/src/features/jobs/types.ts` | crear | `Job`, `JobListItem`, `JobPage`, `JobStatus`, `WorkMode`, `JobInput`, `JobPatch` |
| `apps/web/src/features/jobs/api.ts` | crear | `listJobs`, `getJob`, `createJob`, `updateJob`, `deleteJob` (+ `isJob`, `isJobPage`) |
| `apps/web/src/features/jobs/paths.ts` | crear | `jobPaths` y `parseJobId` |
| `apps/web/src/features/jobs/labels.ts` | crear | Etiquetas de estado y modalidad, `formatSalaryBand` |
| `apps/web/test/helpers/fetch.ts` | crear | `fetch` simulado por método y ruta, registro de llamadas, respeta la señal de aborto |
| `apps/web/test/components/http.test.ts` | crear | Cliente HTTP |
| `apps/web/test/components/format.test.ts` | crear | Fechas y enteros |
| `apps/web/test/features/jobs/api.test.ts` | crear | URL y forma de cada llamada |
| `apps/web/test/features/jobs/labels.test.ts` | crear | Banda salarial y etiquetas |

## Implementa
- RF: base de RF-01 a RF-06 (web) · Edge cases: EC-13 (formato de banda), EC-34 (la web no envía parámetros), EC-36
  (fecha en Europe/Madrid), EC-38 (red, *timeout*, 5xx → error)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Dependencias (tabla «Lo que usa la web»), DD-02, DD-06,
  § Error paths (párrafo «Errores del cliente HTTP»), § Estrategia de tests (fila Transversal), § Checklist pasos 1 y 2

## Dependencias
- **Depende de:** nada (el contrato de API está fijado en el diseño)
- **Bloquea:** TASK-10

## Criterios de done
- [ ] `requestJson` pone `Content-Type: application/json` **solo** cuando hay `body`; `GET` y `DELETE` van sin cuerpo y
      sin `Content-Type`.
- [ ] Un 204 devuelve `undefined`; un error con envelope lanza `ApiError` con `status`, `code`, `message` y `details`.
- [ ] Red caída, *timeout* (probado con `timeoutMs` corto) y 5xx sin envelope → «No se ha podido conectar con el
      servidor. Vuelve a intentarlo en unos segundos.»; 2xx con cuerpo no JSON → «La respuesta del servidor no es
      válida. Vuelve a intentarlo.»; la cancelación propia (señal del llamador abortada) no se convierte en mensaje.
- [ ] `formatDate('2026-10-06T22:30:00.000Z')` → «07/10/2026»; una cadena no parseable → «Fecha no válida» (EC-36).
- [ ] `listJobs` llama exactamente a `GET /api/jobs`, sin parámetros (EC-34).
- [ ] `formatSalaryBand`: «40.000 – 40.000 €/año», «Desde 32.000 €/año», «Hasta 40.000 €/año» (EC-13).
- [ ] `npm test -w apps/web -- http format api labels` en verde, con **4** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/http.ts apps/web/src/components/format.ts apps/web/src/features/jobs apps/web/test/helpers/fetch.ts apps/web/test/components apps/web/test/features/jobs`
      sin errores.
- [ ] Commit único `feat(web): HTTP client and jobs API contract [HU-01 TASK-08]` nombrando los ficheros.

## Notas de implementación

**Contrato de la API que consume la web** (manda `plans/TECHNICAL_DOC-backend.md` § Contrato de API):

| Elemento | Contrato |
|---|---|
| Oferta completa (`POST` 201, `GET /:id` 200, `PATCH` 200) | `{ id, title, description, location, workMode, salaryMin, salaryMax, status, createdAt, publishedAt, closedAt }`. Opcionales sin valor **siempre** `null`, nunca ausentes. Fechas ISO 8601 UTC con milisegundos. `publishedAt`/`closedAt` = `null` en HU-01 |
| Listado (`GET /api/jobs`) | `{ items: [{ id, title, status, referenceDate }], total, page: 1, pageSize: 20 }`. Cualquier parámetro de query da 400 |
| `status` | `draft` \| `published` \| `closed` |
| `workMode` | literal exacto `presencial`, `híbrida` (í en NFC) o `remota`. `""` da 400; para vaciar se envía `null` |
| `details` de `VALIDATION_ERROR` | `[{ field, message }]`, uno por campo; `field` = propiedad del cuerpo (también las sobrantes, «Campo no permitido.»), `"id"` (parámetro de ruta) o `"body"` (`PATCH {}` → «Envía al menos un campo.»). Mínimo > máximo → en `salaryMin`. `message` superior: «Hay campos con errores.» |
| Vaciar un opcional | `null` en `POST` y `PATCH` (en `POST` también vale omitirlo). `title` no admite `null`. En `PATCH`, campo omitido = sin cambios |
| Otros errores | 404 `NOT_FOUND` («La oferta no existe.»), 500 `INTERNAL_ERROR`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, todos en el envelope `{ error: { code, message, details? } }` |
| Cabeceras | `GET` y `DELETE` **sin cuerpo y sin `Content-Type`** (con `application/json` y cuerpo vacío, Fastify responde 400) |
| IDs de ruta | enteros positivos sin ceros a la izquierda |
| Longitudes | caracteres Unicode (`[...s].length`), no unidades UTF-16 |

**`requestJson`** (DD-02): combina la señal del llamador con `AbortSignal.timeout(10_000)` mediante `AbortSignal.any`
(parámetro `timeoutMs` para los tests). Traduce a `ApiError { status, code, message, details }`:

| Situación | `message` mostrado (`userMessage`) |
|---|---|
| Error con envelope (incluidos `INTERNAL_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`) | su `message` |
| Sin red, *timeout* o 5xx sin envelope | «No se ha podido conectar con el servidor. Vuelve a intentarlo en unos segundos.» |
| 2xx con forma inesperada o no JSON | «La respuesta del servidor no es válida. Vuelve a intentarlo.» |
| Cancelación por desmontaje (`AbortError` propio) | no se muestra nunca: se relanza para que el llamador la ignore |

- El `status`/`code` internos de un `ApiError` sin envelope (red, *timeout*) no los fija el diseño: elige valores que no
  choquen con los códigos de la API y déjalos documentados en `http.ts`; la UI solo usa `userMessage` y, para decidir
  pantallas, `status` 400/404.
- Nunca muestres el cuerpo crudo ni `stack`, y no hagas `console.log` de respuestas. El cliente **no reintenta** solo
  (EC-09).

**`api.ts`**: `listJobs(signal?)` → `GET /api/jobs` (URL exacta); `getJob(id, signal?)` → `GET /api/jobs/{id}`;
`createJob(input)` → `POST`; `updateJob(id, patch)` → `PATCH`; `deleteJob(id)` → `DELETE` (sin cuerpo, devuelve
`undefined`). `isJob`/`isJobPage` comprueban la forma mínima; si no cuadra, `ApiError` con «La respuesta del servidor no
es válida. Vuelve a intentarlo.» (el test adversarial EC-40 está en TASK-14). Si el contrato cambiase, solo se tocan
`types.ts`, `api.ts` y `job-form-model.ts`.

**`paths.ts`**: `jobPaths` = `/jobs`, `/jobs/new`, `/jobs/{id}`, `/jobs/{id}/edit`. `parseJobId(text)` devuelve el
número o `null` con **la misma expresión que la API: `/^[1-9][0-9]{0,14}$/`** (sin ceros a la izquierda, ≤ 15 cifras).
El TECHNICAL_DOC-frontend escribe `\d{0,15}` (16 cifras) por error, aunque dice «la misma regla»; lo decidió el
team-lead el 2026-10-06. Nunca construyas `/api/jobs/{id}` con un ID que no pase `parseJobId`.

**`labels.ts`**: modalidad `presencial` → «Presencial», `híbrida` → «Híbrida», `remota` → «Remota», `null` → «Sin
indicar». Estado `draft` → «Borrador» (lo comprueba el e2e), `published` → «Publicada», `closed` → «Cerrada» (estas
dos no las fijaba el diseño; decididas por el team-lead el 2026-10-06). `formatSalaryBand(min, max)`:
los dos → «{min} – {max} €/año»; solo mínimo → «Desde {min} €/año»; solo máximo → «Hasta {max} €/año»; ninguno → «Sin
indicar».

**`format.ts`** (DD-06): `Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit',
year: 'numeric' })` → `dd/mm/aaaa`; no parseable → «Fecha no válida» (nunca «Invalid Date»). `formatInteger` con
`Intl.NumberFormat('es-ES')`: «32.000». Gotcha: en `es-ES` los números de 4 cifras no llevan separador por defecto
(«4000»); las bandas de los tests y del seed tienen 5 cifras.

**`helpers/fetch.ts`**: `vi.stubGlobal('fetch', …)` con respuestas por método y ruta, registro de llamadas (método,
URL, cabeceras, cuerpo) y que rechace con `AbortError` si la señal se aborta. Se simula solo la red.

**Tests** (Vitest + jsdom; `fireEvent` y `expect` de Vitest, sin `user-event` ni `jest-dom`):
- `http.test.ts`: envelope → `ApiError`; 204 → `undefined`; cuerpo no JSON; `GET`/`DELETE` sin `Content-Type` y
  `POST`/`PATCH` con él; red caída; *timeout* con `timeoutMs` corto; aborto propio silencioso.
- `format.test.ts`: EC-36 (`2026-10-06T22:30:00.000Z` → «07/10/2026»), fecha no válida, `formatInteger(32000)`.
- `api.test.ts`: URL exacta `/api/jobs` (EC-34); método, URL y cuerpo de cada función.
- `labels.test.ts`: los tres formatos de banda de EC-13 y «Sin indicar».
- Datos inventados («Desarrollador/a backend (Node.js)», «Técnica/o de selección», «Valencia»).
