# TASK-10 — Pantalla de detalle de la inscripción (`/applications/:id`)

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-07)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
W2 del diseño: pantalla nueva con su ruta, estados e historial.

1. **`ApplicationDetailScreen.tsx`** (nuevo, ~80): `ApplicationDetailScreen({ notFound })` lee `parseApplicationId(
   usePath())`; `null` → `props.notFound` **sin petición**; si no, `ApplicationLoader key={id}` con
   `useResource(signal => getApplicationDetail(id, signal))`:
   - cargando → `h1` «Inscripción» + `LoadingMessage` «Cargando la inscripción…» (`role="status"`);
   - error 400 o 404 → `props.notFound` («Página no encontrada», DT-08);
   - otro error (red, 5xx, no JSON, forma no válida) → `h1` + `ErrorMessage(userMessage(error))` + «Reintentar»
     (`retry`, repite el `GET`);
   - éxito → `ApplicationDetails { detail }`.
2. **`ApplicationDetails.tsx`** (nuevo, ~90, presentacional): `h1` «Inscripción» (`tabIndex -1`, sin nombre); `<dl>` con
   «Candidato» → `<Link to={candidatePaths.detail(candidate.id)}>` (de `apps/web/src/features/candidates/paths.ts`,
   DD-08), «Oferta» → `<Link to={pipelinePath(job.id)}>{job.title}</Link>`, «Etapa actual» → `stageLabel(stage)`;
   `h2 id="history-title"` «Historial» y `<ol className="history" aria-labelledby="history-title">` en el orden de la
   API. Cada `<li>`: `<p>{origen o '—'} → {destino}</p>`, `<p>Fecha: <time dateTime={changedAt}>{formatDate(...)}
   </time></p>` (Europe/Madrid, `dd/mm/aaaa`), `<p>Motivo: …</p>` si hay motivo (incluye «Oferta cerrada»), y si hay
   nota `<p>Nota:</p><p className="pre-wrap long-text">{note}</p>`. Todo como texto JSX; `job.status` no se pinta.
3. **Ruta** en `apps/web/src/App.tsx` (tabla `ROUTES`): `{ pattern: APPLICATION_ROUTE, title: 'Inscripción', element:
   <ApplicationDetailScreen notFound={<NotFoundScreen />} /> }` → título «Inscripción · ATS» en todos los estados.
4. **Estilo** `.history` en `apps/web/src/styles.css`.
5. **Fixtures:** añade `renderDetail(path, routes)` a `apps/web/test/features/applications/stage-fixtures.ts`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/ApplicationDetailScreen.tsx` | crear | Ruta, `notFound` por prop, loader y estados |
| `apps/web/src/features/applications/ApplicationDetails.tsx` | crear | Cabecera, etapa e historial (presentacional) |
| `apps/web/src/App.tsx` | modificar | Ruta `/applications/:id` en `ROUTES` |
| `apps/web/src/styles.css` | modificar | `.history` |
| `apps/web/test/features/applications/stage-fixtures.ts` | modificar | `renderDetail` |
| `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx` | crear | Estados, cabecera, historial (CA-24 a CA-28) |
| `apps/web/test/App.test.tsx` | modificar | Ruta, título y foco; `/applications/abc` sin petición |

## Implementa
- RF: RF-07 · CA: CA-24, CA-25, CA-26, CA-27, CA-28 · EC: EC-20, EC-22, EC-42, EC-43 (fecha y «—»), EC-44, EC-45 ·
  RNF: RNF-06 (título), RNF-08 (`ol`) · DD-08, DD-09
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Rutas y títulos, § Detalle de la inscripción, DD-08, DD-09, § Estrategia
  de tests (RF-07), § Checklist W2

## Dependencias
- **Depende de:** TASK-09 (tipos, rutas, cliente), TASK-05 (endpoint `GET /api/applications/:id`)
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/ApplicationDetailScreen.test App.test` en verde con **2** ficheros:
  - «CA-24 cabecera con link al candidato (/candidates/40) y a la oferta (/jobs/7/pipeline), Etapa actual Entrevista y
    3 listitem en orden con dd/mm/aaaa».
  - «CA-25 recién creada: — → Recibida».
  - «CA-26 rechazo con motivo y nota multilínea; job_closed con Motivo: Oferta cerrada y sin Nota».
  - «CA-27 404 y 400 → Página no encontrada».
  - «EC-42 /applications/abc → Página no encontrada sin petición».
  - «CA-28/EC-44 red → mensaje útil y Reintentar que repite el GET».
  - «EC-45 forma no válida → error con Reintentar».
  - «EC-43 2026-12-31T23:30:00.000Z → 01/01/2027».
  - «EC-20 5 cambios en orden».
  - «título Inscripción · ATS en cargando, error y datos» y, en `App.test.tsx`, «/applications/32 con título
    Inscripción · ATS y foco en main»; «/applications/abc → Página no encontrada sin petición».
- [ ] `npm test -w @ats/web` en verde (sin regresiones).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/ApplicationDetailScreen.tsx apps/web/src/features/applications/ApplicationDetails.tsx apps/web/src/App.tsx apps/web/src/styles.css apps/web/test/features/applications/stage-fixtures.ts apps/web/test/features/applications/ApplicationDetailScreen.test.tsx apps/web/test/App.test.tsx`
      sin errores (ESLint ignora el `.css` si no está configurado: dilo en la salida).
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); `ApplicationDetailScreen.test.tsx` previsto en
      ~250.
- [ ] Commit único `feat(web): application detail screen with stage history [HU-05 TASK-10]`.

## Notas de implementación
- Dirección entre features: `applications → candidates` está permitida (`paths.ts` es API pública); nada de
  `features/jobs/`. `NotFoundScreen` llega por prop desde `App.tsx`.
- Un `history` vacío es una respuesta no válida (INV-08): error, no «vacío».
- Sin email ni teléfono (la API no los da); los casos hostiles del detalle (HTML, campos de más) son de TASK-14.
- Datos inventados.
