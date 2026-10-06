# TASK-14 — Listado, ficha y consentimiento en la web frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (gate 4 de RF-04, RF-05 y RF-06 en la web)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Segunda mitad de la fila W5 del TD-frontend (ver ROADMAP, «Ajustes respecto a los TD»), aparte de los caminos felices de
TASK-10 y TASK-12:
1. `apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx`: filtros fuera de rango o con control,
   `q` hostil codificado y fuera de la URL, nombre con HTML.
2. `apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx`: HTML como texto, título sin nombre,
   doble clic en el consentimiento, 404 y 500 al cambiarlo, error dentro del diálogo y respuesta con forma inesperada.

Si un caso destapa un fallo, se arregla en `apps/web/src/features/candidates/` (como mucho 2 ciclos).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx` | crear | CA-20 (web), EC-33 |
| `apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx` | crear | CA-29, CA-30, EC-40, EC-45, EC-48, EC-49, EC-53, EC-56, RNF-06, RNF-09 |
| `apps/web/src/features/candidates/{CandidateFilters,CandidateListScreen,CandidateDetailScreen,ConsentSection,use-consent-actions}.ts(x)` | modificar solo si un caso falla | Arreglos que destape el test |

## Implementa
- RF: RF-04, RF-05, RF-06 (web) · CA: CA-20 (web), CA-29, CA-30 (web) · Edge cases: EC-33, EC-40, EC-45, EC-48, EC-49,
  EC-53, EC-56 · RNF-06, RNF-09
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (CA-20, EC-33, EC-40, EC-45, EC-48, EC-49, EC-53, EC-56,
  respuesta con forma inesperada), § Threat modeling, § Estrategia de tests (RF-04 a RF-06 `[adversarial]`),
  § Checklist W5

## Dependencias
- **Depende de:** TASK-10 (listado), TASK-12 (ficha y consentimiento)
- **Bloquea:** nada

## Criterios de done
- [ ] CA-20: `q` de 101 y con un carácter de control, skill de 41 → error junto al campo y **ninguna petición**; `q` de
      100 → se pide.
- [ ] EC-33: `' OR 1=1 --` → URL de `fetch` codificada (`encodeURIComponent`); `location.search` vacío, `history.state`
      sin `q` y título «Candidatos · ATS»; un nombre `<img src=x onerror=alert(1)>` se ve como texto (0 elementos
      `img`).
- [ ] EC-40 / RNF-06: resumen `<script>alert(1)</script>`, nombre con `<b>x</b>` y skill `<i>x</i>` → texto literal
      (0 elementos `script`, `b`, `i` creados); `document.title` «Ficha de candidato · ATS» sin el nombre (RNF-09).
- [ ] EC-49: doble clic en la casilla o en «Renovar consentimiento» → **un solo** `POST`.
- [ ] CA-29 / EC-48: 404 al registrar → alerta con el `message` de la API; la ficha no cambia.
- [ ] CA-30 / EC-45 / EC-53 / EC-56: 500 al registrar o renovar → alerta con el `message` genérico; casilla, resumen y
      fin de retención como estaban. 500 al retirar → el error se queda **dentro del diálogo**.
- [ ] Respuesta 2xx con forma inesperada al cargar la ficha o al cambiar el consentimiento → error con «Reintentar» o
      alerta (`CLIENT_BAD_RESPONSE`), sin datos a medias.
- [ ] `npm test -w @ats/web -- CandidateListScreen.adversarial CandidateDetailScreen.adversarial` en verde, con **2**
      ficheros de test.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/candidates/CandidateListScreen.adversarial.test.tsx apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx`
      (y los de producción que se toquen) sin errores.
- [ ] Commit único `test(web): adversarial candidate list, detail and consent [HU-03 TASK-14]` nombrando los ficheros.

## Notas de implementación
- `beforeEach` del listado: `saveListState(INITIAL_LIST_QUERY)`.
- «0 elementos creados»: `container.querySelectorAll('script, b, i, img').length === 0` dentro de la ficha o la tabla.
- Polyfill de `<dialog>` en `apps/web/test/helpers/dialog.ts`.
- Datos inventados con `@example.com`.
