# TASK-07 — Recorrido e2e: cerrar una oferta con 2 activas y 1 contratada [e2e]

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** frontend (e2e)
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-05)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Primer e2e que cierra una oferta con inscripciones (DT-10 de HU-04 deja de aplicar). **Sin cambios en
`apps/web/src/`** (DD-01 del TD-frontend: `CloseJobAction.tsx` ya pide la previa y pinta `activeApplicationsText`) **ni
tests nuevos de Vitest** (DD-02). Tres piezas:

1. **Helper `advanceByApi`** en `e2e/support/applications.ts` (69 → ~90 líneas, DD-03), con su comentario en inglés
   como el resto del fichero:
   ```ts
   export async function advanceByApi(
     page: Page,
     applicationId: number,
     target: 'screening' | 'interview' | 'offer' | 'hired',
   ): Promise<void>;
   ```
   Recorre `received → screening → interview → offer → hired` hasta `target` con `POST
   /api/applications/:id/advance` y `{ expectedStage, toStage }` (solo a la etapa siguiente) y espera 200 en cada
   paso. Asume que la inscripción parte de `received`.
2. **Spec nuevo `e2e/jobs-close-applications.spec.ts`** (DD-04) con el test **T1** y *helpers* locales (`closeDialog`,
   `cardIn`) al estilo de `e2e/jobs-lifecycle.spec.ts` y `e2e/pipeline-stages.spec.ts`; comentario de cabecera en
   inglés (qué cubre, datos creados por la API, *token* único, sin IDs fijos ni datos del seed).

   **T1** · `CA-12 y EC-26 cerrar con 2 activas y 1 contratada: diálogo con 2, «Oferta cerrada.», pipeline en solo
   lectura y detalle «Oferta cerrada» sin nota`:
   - **Preparación (API):** `createJobByApi(page, 'published')`; candidatos A, B y C con `createCandidateByApi`;
     `enrollByApi` de los tres; B → `interview` y C → `hired` con `advanceByApi`; A se queda en `received`.
   - **UI:** `/jobs/:id` → `button` «Cerrar» (`exact`) → en el `dialog` «¿Cerrar la oferta?», `status` con «Se
     rechazarán 2 inscripciones activas.» → «Cerrar oferta» → texto «Oferta cerrada.» y el `dialog` oculto → `link`
     «Ver pipeline» → URL `/jobs/:id/pipeline`; 0 botones «Inscribir candidato», `/^Avanzar/`, `/^Rechazar/`,
     `/^Contratar/`; A y B en la `region` «Rechazado» con «Motivo: Oferta cerrada»; C en «Contratado» sin «Motivo:»; 0
     tarjetas de A en «Recibida» y de B en «Entrevista» → clic en el nombre de B → «Etapa actual» «Rechazado»; el
     último `listitem` de la lista «Historial» con «Entrevista → Rechazado», «Motivo: Oferta cerrada» y sin «Nota:».
3. **Comentarios que daban por hecho que ningún e2e cerraba ofertas con inscripciones** (DD-05), en inglés:
   `e2e/pipeline-closed.spec.ts` líneas 4-6 (la `closed` ya no viene siempre del seed: puede ser una que cierra
   `jobs-close-applications.spec.ts`; sus aserciones siguen valiendo) y `e2e/applications.spec.ts` líneas 13-14 (ya no
   es cierto que «No test closes a job that has applications (DT-10)»). Solo comentarios.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/support/applications.ts` | modificar | `advanceByApi(page, applicationId, target)` con su comentario |
| `e2e/jobs-close-applications.spec.ts` | crear | Cabecera, *helpers* locales y T1 (CA-12, EC-26, EC-21 sin acciones) |
| `e2e/pipeline-closed.spec.ts` | modificar | Solo el comentario de las líneas 4-6 |
| `e2e/applications.spec.ts` | modificar | Solo el comentario de las líneas 13-14 |

## Implementa
- RF: RF-05 (camino feliz) · RF-01 a RF-03 de punta a punta en el navegador · RF-06 (umbrales, parte web) · Edge
  cases: EC-26 (2 real), EC-21 (pipeline sin acciones) · CA-12 · DD-01 a DD-05 del TD-frontend
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Pantallas y estados, § Diagrama de secuencia (CA-12),
  DD-03, DD-04, DD-05, § Estrategia de tests (T1), § Checklist de implementación 1-3

## Dependencias
- **Depende de:** TASK-02 (puerto real conectado: sin él el diálogo dice 0 y T1 falla)
- **Bloquea:** TASK-08

## Criterios de done
- [ ] `npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts`
      en verde (en una sola ejecución, para que `pipeline-closed` corra después del spec nuevo, como en `npm run e2e`,
      y se vea el efecto de DD-05).
- [ ] **Mutaciones de la review vistas desde el navegador:** con M1, T1 falla (A y B no están en «Rechazado»); con
      M2, T1 falla («Se rechazarán 3 inscripciones activas.» en vez de 2). No hace falta aplicarlas aquí: las cubren
      los tests de API de TASK-02 y TASK-03; se citan para la review.
- [ ] Sin cambios en `apps/web/` (diff vacío en esa carpeta); `apps/web/test/features/jobs/CloseJobAction.test.tsx`
      sigue en 298 líneas.
- [ ] Spec ≤ 300 líneas, cada `test` y cada *helper* ≤ 50; `e2e/support/applications.ts` ≤ 300. Ningún fichero tocado
      pasa de 300 líneas ni ninguna función de 50 (`wc -l` tras Prettier).
- [ ] Aserciones *web-first*: todas con `await expect(locator)…` (`toBeVisible`, `toHaveText`, `toHaveCount`,
      `toHaveURL`, `toBeHidden`), que esperan solas; **ninguna** sobre `await locator.textContent()` ni `innerText()`
      leída una vez, y **ningún** `waitForTimeout` ni espera fija.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/support/applications.ts e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts`
      sin errores.
- [ ] Commit único `test(e2e): close a job with active applications from the job page [HU-06 TASK-07]` con los 4
      ficheros.

## Notas de implementación
- Datos solo por la API con *token* único (`uniqueToken`, `createCandidateByApi`: `Inscribe Apellido{token}`,
  `inscribe.{token}@example.com`, sin teléfono ni consentimiento). Sin IDs fijos y sin cerrar ofertas del seed.
- Filtra las tarjetas por el apellido con *token*, que ningún otro nombre contiene: con varios candidatos en
  «Rechazado», un filtro por texto genérico encontraría dos.
- El diálogo es un `dialog` nativo con nombre «¿Cerrar la oferta?»; el recuento va en un `status` dentro del diálogo.
  Mientras carga muestra «Comprobando las inscripciones activas…» y «Cerrar oferta» está deshabilitado: espera al texto
  final con `await expect(...).toHaveText(...)`, no al botón.
- El e2e corre sobre `data/e2e.db`, que `playwright.config.ts` regenera con `db:reset` en cada ejecución (puertos
  3101/5174, `workers: 1`): no toca `data/ats.db`.
- Código y comentarios del e2e en inglés; los textos de la UI que se buscan, en castellano tal cual.
