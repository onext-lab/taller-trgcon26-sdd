# TASK-08 — Pantalla de importación frente a ficheros, respuestas y usos hostiles [adversarial]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02 parte web, RF-06 parte web; RNF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Adversarial de la pantalla de TASK-07 con Testing Library y `fetch` simulado. **Solo tests**: si destapan un fallo en
`apps/web/src/`, el arreglo va aquí (techo de 2 ciclos) y se nombra en el commit. Solo se simula `fetch` y, en EC-13,
el `arrayBuffer` del `File` (`Object.defineProperty` que rechaza).

`apps/web/test/features/candidates/CandidateImportScreen.adversarial.test.tsx` (**nuevo**), con los ayudantes de
`apps/web/test/features/candidates/import-fixtures.ts` (TASK-07).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/candidates/CandidateImportScreen.adversarial.test.tsx` | crear | EC-01, EC-04, EC-05, EC-06, EC-11, EC-13, EC-16, EC-17, EC-26, EC-33, EC-43, EC-47, EC-48 |

## Implementa
- RF: RF-01 (input inválido, concurrencia, datos corruptos, seguridad, idempotencia), RF-02 (bordes de tamaño, fichero
  ilegible), RF-06 (500 filas, minimización) · CA-14 (bordes en cliente), CA-17 (parte web) · RNF-03 · Edge cases:
  EC-01, EC-04, EC-05, EC-06, EC-11, EC-13, EC-16, EC-17, EC-26, EC-33, EC-43, EC-47, EC-48
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths, § Threat modeling, § Datos personales, § Estrategia de
  tests (`CandidateImportScreen.adversarial.test.tsx`, «`[adversarial]` de los RF Must con web»), § Checklist 3

## Dependencias
- **Depende de:** TASK-07
- **Bloquea:** nada

## Criterios de done
- [x] `npm test -w apps/web -- CandidateImportScreen.adversarial` en verde con **1** fichero y, como mínimo:
  - `EC-01 foto.png y .txt se envían igual: PNG → alert con el message del 400; .txt → informe` (la web no mira
    extensión ni tipo).
  - `EC-04 doble clic → 1 POST`.
  - `EC-05 200 con otra forma → alert BAD_RESPONSE_MESSAGE y sin h2 de informe`.
  - `EC-06 / EC-47 nada en URL, título, history.state ni almacenamiento`: con un fichero llamado
    `candidatos_lucia_ferrer.csv` y un informe con duplicados y errores: URL `/candidates/import`, título «Importar
    candidatos · ATS», `history.state` sin datos, `localStorage` y `sessionStorage` vacíos, y el nombre del fichero
    no aparece en el documento.
  - `EC-11 / EC-16 1 048 576 bytes se envía; 1 048 577 → FILE_TOO_LARGE_MESSAGE sin petición` (0 `POST` y sin leer
    el fichero).
  - `EC-13 fichero ilegible → FILE_UNREADABLE_MESSAGE sin petición; elegir otro lo arregla`.
  - `EC-17 mismo inválido dos veces → mismo alert y 2 POST`.
  - `EC-26 message con <img onerror> → texto literal y 0 img`.
  - `EC-33 duplicate → solo el POST, 0 GET /api/candidates/:id`.
  - `EC-43 500 filas sin truncar; fila 5 con 3 errores → 3 filas de tabla (nombre, email, telefono)`.
  - `EC-48 Importar otro fichero → estado inicial sin fichero ni informe; sin entradas de historial nuevas`.
- [x] `npm test -w apps/web` en verde (toda la web).
- [x] El fichero ≤ 300 líneas tras Prettier.
- [x] `npm run typecheck` sin errores.
- [x] `npx eslint apps/web/test/features/candidates/CandidateImportScreen.adversarial.test.tsx` sin errores.
- [x] Commit único `test(web): adversarial CSV import screen [HU-07 TASK-08]` con el fichero (y el arreglo, si lo hubo).

## Notas de implementación
- Un `File` de 1 048 577 bytes en jsdom: `new File([new Uint8Array(1_048_577)], 'x.csv')`; para no leerlo, espía que
  `arrayBuffer` no se llama (o define uno que falle el test si se llama).
- EC-43 con 500 filas: aserta el número de filas de la tabla (`getAllByRole('row')` dentro de la tabla), no cada una.
- Aserciones negativas del título después del positivo (`QUALITY-GATES.md` §4.12).
- Datos inventados (`@example.com`, `+34 600 000 0xx`).
