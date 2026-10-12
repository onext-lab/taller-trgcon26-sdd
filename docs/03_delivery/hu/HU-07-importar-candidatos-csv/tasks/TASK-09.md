# TASK-09 — Recorrido e2e de la demo y del CSV de Excel en español separado por «;» [e2e]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Should (RF-07)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Spec de Playwright con API y web reales sobre `data/e2e.db` (la regenera `playwright.config.ts` en cada ejecución),
sin IDs fijos y *web-first*. Los CSV se generan **en memoria** con un *token* único (`setInputFiles({ name, mimeType,
buffer })`, DD-08 del TD-frontend): sin ficheros con datos en disco y sin depender del orden de los specs. Usa
`uniqueToken` y `createCandidateByApi` de `e2e/support/applications.ts` (existentes, sin cambios).

`e2e/candidates-import.spec.ts` (**nuevo**) con dos tests y dos constructores de CSV locales:
- `demoCsv(token, existingEmail)`: cabecera `nombre,email,telefono`, 2 filas nuevas con el *token*, el email del
  existente **en mayúsculas** y `,mal@,`.
- **`excelSpanishCsv(token)`** (el fixture del responsable técnico): `﻿` + `nombre;email;telefono` y una fila
  `Importado Excel<token>;excel.<token>@example.com;+34 600 000 041`, unidas y terminadas con `\r\n`, en UTF-8, como
  exporta Excel en un equipo en español. Se elige con `mimeType: 'application/vnd.ms-excel'` (el tipo que da Windows a
  un `.csv`): la web tiene que mandar igualmente `text/csv` y la API decidir por el contenido.

| Test | Pasos y aserciones |
|---|---|
| **T1** `flujo de la demo: 2 creados, 1 duplicado y 1 fila con error` | `createCandidateByApi` → listado → «Importar CSV» → h1 «Importar candidatos» → `setInputFiles(demoCsv)` → «Importar» → `role="status"` «2 creados, 1 duplicado, 1 fila con error.»; en la fila del duplicado, enlace de nombre «Ver candidato (se abre en una pestaña nueva)», `target="_blank"`, `rel="noopener noreferrer"`, `href` `/candidates/{id}`; al activarlo (`context.waitForEvent('page')`), la pestaña nueva muestra el h1 del existente y la original sigue con «Resultado de la importación»; RNF-03: URL `/candidates/import`, título «Importar candidatos · ATS», `history.state`, `localStorage` y `sessionStorage` sin datos (`page.evaluate` con `globalThis`); «Ir al listado» → buscar el *token* → **2** filas |
| **T2** `CA-19 CSV de Excel en español (;, BOM y CRLF) rechazado con el mensaje del separador, corregido y reimportado` | `setInputFiles(excelSpanishCsv)` → «Importar» → `role="alert"` con el texto **exacto** «El fichero está separado por «;». Guárdalo separado por comas (CSV UTF-8) y vuelve a importarlo.» (DT-08 / EC-50), sin h2 «Resultado de la importación» y con «Importar» activo (el fichero sigue elegido); **0 creados**: `page.request.get('/api/candidates?q=<token>')` → `total: 0`. Después, el mismo contenido separado por comas → «1 creado, 0 duplicados, 0 filas con error.» → «Importar otro fichero» → el mismo → «0 creados, 1 duplicado, 0 filas con error.» |

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/candidates-import.spec.ts` | crear | T1 (demo) y T2 (fixture de Excel con `;`, BOM y CRLF; corregido; reimportado) |

## Implementa
- RF: RF-07 (e2e y CSV inventados); de punta a punta RF-01, RF-02, RF-04, RF-06 · CA-02, CA-04, CA-05, CA-11 (caso
  `;`), CA-17/RNF-03 (navegador), CA-18, **CA-19** (T2) · Edge cases: EC-07, EC-08/**EC-50**, EC-33, EC-47 · DD-08 del
  TD-frontend
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests (Playwright T1 y T2), § DD-08, § Checklist 4 ·
  `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-50, «el e2e (CA-19), con el fixture de Excel») · PRD v1.3 DT-08,
  CA-19, EC-50

## Dependencias
- **Depende de:** TASK-03 (ruta de la API) y TASK-07 (pantalla); a través de TASK-03, el mensaje de DT-08 de TASK-02.
- **Bloquea:** nada

## Criterios de done
- [ ] `npx playwright test e2e/candidates-import.spec.ts` en verde con **2** tests.
- [ ] `npm run e2e` en verde (todos los specs: `candidates.spec.ts` y `candidates-list.spec.ts` siguen pasando con los
      candidatos nuevos en `data/e2e.db`).
- [ ] T2 compara el mensaje de DT-08 con `toHaveText` **exacto** (no `toContainText`), igual que la constante
      `SEMICOLON_SEPARATOR_MESSAGE` de `apps/api/src/modules/candidates/import-file.ts`.
- [ ] El spec ≤ 300 líneas tras Prettier; solo datos inventados (`@example.com`, `+34 600 000 0xx`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/candidates-import.spec.ts` sin errores.
- [ ] Commit único `test(e2e): CSV import demo flow and Spanish Excel file [HU-07 TASK-09]` con el fichero.

## Notas de implementación
- **Mutación M1**: T1 también la detecta: si la fila con el email del existente se creara (o se contara como
  creada), el `status` no diría «2 creados, 1 duplicado, 1 fila con error.» y no habría enlace «Ver candidato»; si la
  mutación acabara en 500, saldría un `alert`. La prueba principal es `import.test.ts › CA-04 …` (TASK-03).
- El BOM se escribe como `'﻿'` en el código (escape), nunca como carácter crudo; el CRLF como `'\r\n'`.
  `Buffer.from(text, 'utf8')`.
- `page.evaluate` con `globalThis` (no `window`): *gotcha* del tsconfig del e2e.
- Un solo Playwright a la vez (puertos y `data/e2e.db` compartidos): no lo lances en paralelo con otro e2e.
- No hay fixtures CSV en disco (DD-08 del TD-frontend): el «fixture» de Excel es el constructor en memoria, el mismo
  formato que `excelSpanishCsv()` de `apps/api/test/helpers/csv.ts` (TASK-02).
