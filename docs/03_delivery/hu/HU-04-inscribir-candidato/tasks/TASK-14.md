# TASK-14 — Pipeline y panel de inscribir frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (adversarial de RF-07 y RF-08; RNF-05, RNF-06)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
W5 del TD-frontend, ajustado al gate 4: «200 tarjetas» (EC-27) y «campos de más no se pintan» (EC-30) se hicieron en
TASK-11, junto a las demás pruebas de la tarjeta; aquí quedan los casos hostiles y de fallo. Si un test destapa un
fallo, se arregla en producción (sin adaptar el test).

Fichero `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx`:
- **Seguridad (EC-38, RNF-06):** «nombre `<img src=x onerror=alert(1)>` como texto en la tarjeta y en los resultados
  del buscador; ningún `img` en el documento».
- **Idempotencia (EC-46):** «doble clic en Inscribir → 1 solo POST» (el primero con `hang`).
- **Idempotencia (EC-11):** «*timeout* y reintento → 409 DUPLICATE verídico, alerta en el panel y la recarga muestra la
  tarjeta en Recibida».
- **Fallo de dependencia (EC-01, EC-05, EC-10, EC-42 al inscribir):** `it.each` con 400, 403, 500 y un 201 con forma
  inesperada → alerta `userMessage` en el panel sin *stack*, el panel sigue abierto con lo escrito y los resultados, y
  **sin recarga** del pipeline.
- **Datos en el navegador (EC-45, EC-39, RNF-05):** tras buscar por un email y tras inscribir: `location.href` solo con
  el ID de la oferta, `document.title` = «Pipeline de la oferta · ATS», `history.state` igual que antes (`null`) y
  `localStorage` y `sessionStorage` sin el email ni el texto buscado.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` | crear | EC-01, EC-05, EC-10, EC-11, EC-38, EC-39, EC-42, EC-45, EC-46 |
| `apps/web/src/features/applications/use-enrollment.ts` · `apps/web/src/features/applications/EnrollPanel.tsx` · `apps/web/src/features/applications/PipelineBoard.tsx` | modificar solo si un test destapa un fallo | Arreglos, sin cambiar el comportamiento del TD |

## Implementa
- RF: RF-07, RF-08 · RNF: RNF-05, RNF-06 · Edge cases: EC-01, EC-05, EC-10 (lado web), EC-11, EC-38, EC-39, EC-42
  (inscribir), EC-45, EC-46
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths, § Threat modeling, § Datos personales, DD-03, DD-06,
  § Estrategia de tests (`[adversarial]`), § Checklist W5

## Dependencias
- **Depende de:** TASK-13
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w @ats/web -- applications/PipelineScreen.adversarial` en verde, con **1** fichero de test.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `grep -rn dangerouslySetInnerHTML apps/web/src/features/applications` vacío (RNF-06).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx` (más los ficheros de
      producción arreglados, si los hay) sin errores.
- [ ] `PipelineScreen.adversarial.test.tsx` ≤ 300 líneas tras Prettier. Si pasara, los casos de datos en el navegador
      van a un hermano `apps/web/test/features/applications/PipelineScreen.privacy.test.tsx`.
- [ ] Commit único `test(web): pipeline and enroll panel against hostile data and failures [HU-04 TASK-14]`.

## Notas de implementación
- **Foco:** todo foco movido por un efecto se aserta con `expectFocusOn` (`apps/web/test/helpers/focus.ts`).
- DD-06: la guarda `inFlight` por `ref` evita el segundo `POST` aunque el clic llegue antes del render; tras el 201 el
  panel se cierra y el botón ya no existe. Tras un *timeout* el 409 es verídico y la recarga enseña la tarjeta (EC-11).
- Solo se simula la red (`mockFetch`); datos inventados (`@example.com`).
- Nada de `console.*` en `features/applications/` (DP-01 en la web).

## Reapertura · review ronda 1 (curado) (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, curado de observaciones antes del merge), §9.
- **Qué hay que hacer:** Etiquetas de test: en `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx`, el test de la línea ~120 se llama «EC-11» pero ejerce EC-46 (o el reintento tras un timeout, que es EC-11 del PRD de HU-04: comprueba cuál y deja el ID correcto del PRD de HU-04); y los `it.each` de la línea ~150 usan «EC-01/05/10» con la numeración de HU-02: renómbralos con los IDs del PRD de HU-04 (`docs/03_delivery/hu/HU-04-inscribir-candidato/specs/PRD.md`, § Edge cases) o con una descripción sin ID. Sin cambiar aserciones.
- **Ficheros:** `apps/web/test/features/applications/PipelineScreen.adversarial.test.tsx`
- **Criterios de done:** `npm test -w @ats/web -- applications/PipelineScreen.adversarial` en verde; eslint a 0; ≤ 300 líneas.
