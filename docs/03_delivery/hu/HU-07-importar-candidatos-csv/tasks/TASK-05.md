# TASK-05 — Fallos de la base, concurrencia, reintento y datos personales de la importación [adversarial]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-04, RF-05, RF-06; RNF-02, RNF-03, RNF-04, RNF-06)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Adversarial de UC-20 · E4 (todo o nada), de la unicidad bajo concurrencia y de los datos personales. **Solo tests**,
sin mocks de módulo: fallos con `failWrites` (trigger real de SQLite, `apps/api/test/helpers/test-app.ts`) y
`createProcessesStub({ fail: true })` (`apps/api/test/helpers/candidates.ts`). Si destapan un fallo en
`apps/api/src/`, el arreglo va aquí (techo de 2 ciclos).

1. **`apps/api/test/candidates/import-failures-adversarial.test.ts`** (**nuevo**): transacción, concurrencia,
   idempotencia.
2. **`apps/api/test/candidates/import-privacy.test.ts`** (**nuevo**): logger capturado con el patrón de
   `apps/api/test/candidates/privacy-logs.test.ts`; los ficheros de CA-01, CA-04, CA-08, CA-11 (incluido
   `excelSpanishCsv()`), CA-12, CA-13, CA-14 y CA-15.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/candidates/import-failures-adversarial.test.ts` | crear | CA-06, CA-15, EC-30, EC-31, EC-37 a EC-41 |
| `apps/api/test/candidates/import-privacy.test.ts` | crear | CA-17, RNF-02, RNF-03 (API), RNF-04, RNF-06 |

## Implementa
- RF: RF-04 (concurrencia), RF-05 (todo o nada, reintento), RF-06 (sin datos personales) · CA-06, CA-15, CA-17 · Edge
  cases: EC-30, EC-31, EC-37, EC-38, EC-39, EC-40 (500), EC-41, EC-47 · RNF-02, RNF-03 (parte API), RNF-04, RNF-06
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-30 a EC-41, EC-47), § Threat modeling, § Datos
  personales, § Estrategia de tests (`import-failures-adversarial.test.ts`, `import-privacy.test.ts`), § Orden de
  implementación 4 y 5 (reparto en «Ajustes» del ROADMAP)

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- candidates/import-failures-adversarial candidates/import-privacy` en verde con **2**
      ficheros y, como mínimo:
  - `CA-15 falla el recálculo de la 2.ª fila (UPDATE OF retention_ends_at, id = 2) → 500 y 0 creados; sin el trigger,
    3 creados una vez` (EC-41: un segundo reintento da 3 `duplicate`).
  - `EC-37 falla el INSERT → 500, 0 creados; fila 250 de 500 → 0 creados` (EC-39: recuento igual al de antes).
  - `EC-30 puerto de procesos que falla → 500` (`INTERNAL_ERROR`, «Error interno. Inténtalo de nuevo.», 0 creados).
  - **`CA-06/EC-31 dos importaciones a la vez → 1 creado y 1 duplicate, ninguna 500`** (también **tumba M1**): un
    solo candidato con `pau.roig@example.com`; un informe lo da creado y el otro `duplicate` con su `existingId`.
  - `EC-31 importación y alta a la vez → duplicate o 409`.
  - `EC-38 recuento intacto tras un fallo` (otra conexión con el cerrojo: `BEGIN` falla → 500 sin cambios y el
    reintento crea).
  - `ni logs, ni message/details, ni informe contienen valores de CA-01/CA-04 en la importación y en los errores de
    CA-08, CA-11 a CA-15` (CA-17; incluye el fixture `excelSpanishCsv()`: ni `Lucía Ferrer Prat`, ni
    `lucia.ferrer@example.com`, ni `+34 600 000 012`, ni la cabecera recibida `nombre;email;telefono`).
  - `el informe solo tiene claves del esquema y existingId de los existentes` (RNF-04, EC-33, EC-47).
  - `ningún fichero nuevo de os.tmpdir() contiene el marcador del CSV` (RNF-03).
  - `ningún fichero de apps/api/src/modules/candidates/ importa node:fs`.
  - `500 sin stack trace` (RNF-06; el log lleva el error de SQLite, sin valores del fichero).
- [ ] `npm test -w apps/api` en verde (toda la API).
- [ ] Los dos ficheros ≤ 300 líneas tras Prettier.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/candidates/import-failures-adversarial.test.ts apps/api/test/candidates/import-privacy.test.ts`
      sin errores.
- [ ] Commit único `test(api): import rollback, concurrency and personal data [HU-07 TASK-05]` con los ficheros.

## Notas de implementación
- **Instala los triggers de `failWrites` después de preparar los datos**: si no, falla la preparación y no la
  importación. Para «la 2.ª de 3», `whenNew: { column: 'id', equals: 2 }` sobre `candidates` en una base vacía (los
  ID empiezan en 1); en «fila 250 de 500», `equals: 250`.
- «A la vez» con `node:sqlite` síncrono: dos `inject` lanzados con `Promise.all` (CA-06, EC-31) se serializan dentro
  de `BEGIN IMMEDIATE` porque el manejador es síncrono (EC-38): el segundo llega al `INSERT` y choca con el índice.
  Lo que se aserta es el resultado (1 candidato, un creado y un `duplicate`, ninguna 500, DD-05), no el
  entrelazado. El caso de EC-38 «otra conexión con el cerrojo» sí necesita **una segunda conexión** a la misma base
  en fichero temporal (directorio propio de `os.tmpdir()`, `rmSync` en `afterAll`) que abra `BEGIN IMMEDIATE` antes
  de la importación.
- La comprobación de `os.tmpdir()` compara una foto antes y después y busca un marcador inventado único del CSV en los
  ficheros nuevos.
- `node:fs` en el test es legítimo (se lee el código fuente); la regla es para `apps/api/src/modules/candidates/`.
- Datos inventados (`@example.com`, `+34 600 000 0xx`); el agente `datos-personales-auditor` lo revisa en
  `/reviewer`.
