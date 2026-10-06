# TASK-03 — Alta y ficha de candidato en la API (`POST /api/candidates`, `GET /api/candidates/:id`)

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02, RF-05 parte API, RF-07 recálculo)
- **Complejidad:** L (2–4 h; estimada 4 h)

## Descripción
Primera rebanada vertical del módulo, con el patrón de `jobs` (`docs/05_modules/ofertas/technical.md`): plugin de rutas
con JSON Schema estricto → servicio sin HTTP que lanza `AppError` → repositorio con SQL preparado.

1. **`schemas.ts`**: tipos `Candidate`, `CandidateListItem`, `CandidatePage`, `CandidateInput`, `CandidatePatch`;
   `candidateFieldsSchema`; `createCandidateBodySchema` (con `consent` booleano y `...forbiddenFields(READ_ONLY)`);
   `candidateSchema` de respuesta (11 campos, siempre presentes); `CONSENT_TEXT_VERSION = 'v1'`; `DEFAULT_PAGE*`
   propios (se usan en TASK-05).
2. **`normalize.ts`**: `normalizeCandidateBody(body)` pura, usada en un hook `preValidation` **antes** del esquema
   (DD-03): recorte, email en minúsculas, `""` → `null` en `phone`/`summary`, y skills recortadas, en minúsculas, sin
   vacías y deduplicadas en orden de primera aparición **solo si es un array de textos** (si no, intacto para que Ajv
   dé el 400 de tipo).
3. **`repository.ts`** (`createCandidatesRepository(db)`, llama a `registerTextSearch(db)`): `findById`,
   `findIdByEmail`, `insert(fields, createdAt, consent)`, `setRetention(id, date | null)` e
   `isDuplicateEmailError(error)`. `updateFields`, `setConsent`, `listPage` y `count` llegan en TASK-04 y TASK-05.
4. **`service.ts`** (`createCandidatesService(deps)`): `create`, `get` y `recalculateRetention(id)` (operación interna
   exportada, **único** escritor de `retention_ends_at`; se une a la transacción en curso).
5. **`routes.ts`** (`candidatesRoutes`, prefijo `/api/candidates`): `POST /` (201) y `GET /:id` (200).
6. **`app.ts`**: compone `candidates` con `candidateProcesses = noCandidateProcesses` en `AppOptions`.
7. **Helpers de test**: `createTestApp({ candidateProcesses? })`; `failWrites(db, op, { table, column })` con
   `job_openings` por defecto (los tests de ofertas no cambian); `apps/api/test/helpers/candidates.ts` con
   `createProcessesStub({ processes, fail })` y un `createCandidate(app, body)` que falla si no es 201.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/schemas.ts` | crear | Tipos, esquemas, `CONSENT_TEXT_VERSION`, `DEFAULT_PAGE*` |
| `apps/api/src/modules/candidates/normalize.ts` | crear | `normalizeCandidateBody(body)` pura |
| `apps/api/src/modules/candidates/repository.ts` | crear | `findById`, `findIdByEmail`, `insert`, `setRetention`, `isDuplicateEmailError` |
| `apps/api/src/modules/candidates/service.ts` | crear | `create`, `get`, `recalculateRetention` |
| `apps/api/src/modules/candidates/routes.ts` | crear | `POST /`, `GET /:id` |
| `apps/api/src/app.ts` | modificar | `candidateProcesses?` en `AppOptions` (por defecto `noCandidateProcesses`) y `app.register(candidatesRoutes, …)` |
| `apps/api/test/helpers/test-app.ts` | modificar | `candidateProcesses?` en `createTestApp`; `failWrites(db, op, { table, column })` |
| `apps/api/test/helpers/candidates.ts` | crear | `createProcessesStub`, `createCandidate` |
| `apps/api/test/candidates/normalize.test.ts` | crear | EC-12, EC-18 (`f(f(x)) = f(x)`) |
| `apps/api/test/candidates/create.test.ts` | crear | CA-01, CA-03, CA-04 (aceptados), EC-03, EC-11, EC-12, EC-13 |
| `apps/api/test/candidates/get.test.ts` | crear | CA-22, CA-23, EC-35, EC-36, EC-40, RNF-05 (`DELETE`) |

## Implementa
- RF: RF-01, RF-02, RF-05 (API), RF-07 (recálculo en el alta) · CA: CA-01, CA-03, CA-04 (fronteras aceptadas),
  CA-22, CA-23 · Edge cases: EC-03, EC-11, EC-12, EC-13, EC-18, EC-35, EC-36, EC-40 · RNF-04 (esquema), RNF-05
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico, § Contrato de API (Tipos de respuesta, Reglas por campo,
  Endpoints, Errores específicos, Firmas internas), § Diagrama de secuencia (alta), DD-02, DD-03, DD-04, DD-05, DD-07,
  § Checklist B-03

## Dependencias
- **Depende de:** TASK-01 (`forbiddenFields`, `duplicate`, `details` acotado), TASK-02 (tabla, puerto, fórmula)
- **Bloquea:** TASK-04, TASK-06, TASK-11, TASK-12

## Criterios de done
- [ ] CA-01 (reloj 2026-10-06T09:00:00Z): alta de «Lucía Ferrer Soler» con `Lucia.Ferrer@Example.com ` y skills
      `['TypeScript','sql','typescript','   ']` → 201 con `email: 'lucia.ferrer@example.com'`,
      `skills: ['typescript','sql']`, consentimiento `null` y `retentionEndsAt: '2027-04-06'`.
- [ ] CA-03: con `consent: true` → `consentGivenAt` = el reloj, `consentVersion: 'v1'`, `retentionEndsAt: '2028-10-06'`.
- [ ] EC-03: «Íñigo Núñez Peñalver 🎯» se devuelve igual; `  Inigo.Nunez@Example.com` → `inigo.nunez@example.com`.
- [ ] EC-11 (aceptados): nombre de 2 y 100, resumen de 2 000 y skill de 40 puntos de código (con emoji y tildes) → 201.
- [ ] EC-12: 20 skills → 201; 21 con duplicado que quedan en 20 → 201; ninguna → `[]`.
- [ ] EC-13: `123456`, `+123456`, `+34 (600) 000-001` y 20 caracteres tras el «+» → 201 y se guardan tal cual.
- [ ] `normalize.test.ts`: orden de primera aparición; no-textos en `skills` intactos; `f(f(x)) = f(x)` (EC-18).
- [ ] CA-22 (API): ficha vigente, retirada y nunca dada con sus 11 campos; `<script>`, `<b>` e `<i>x</i>` literales
      (EC-40); `phone`/`summary` `null` y `skills []` (EC-36).
- [ ] CA-23: ID inexistente → 404 `NOT_FOUND` «El candidato no existe.» sin datos. EC-35: `abc` y `1.5` → 400 en `id`.
- [ ] RNF-05: `DELETE /api/candidates/:id` → 404 «El recurso no existe.» en el envelope.
- [ ] Los tests de ofertas que usan `failWrites(db, op)` siguen en verde: `npm test -w @ats/api` completo en verde.
- [ ] `npm test -w @ats/api -- candidates/normalize candidates/create.test candidates/get` en verde, con **3**
      ficheros de test.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/schemas.ts apps/api/src/modules/candidates/normalize.ts apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/modules/candidates/routes.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/helpers/candidates.ts apps/api/test/candidates/normalize.test.ts apps/api/test/candidates/create.test.ts apps/api/test/candidates/get.test.ts`
      sin errores.
- [ ] Commit único `feat(api): create and read candidates [HU-03 TASK-03]` nombrando los ficheros.

## Notas de implementación

**Reglas por campo** (`candidateFieldsSchema`; normalización en `preValidation`):

| Campo | Normalización | JSON Schema |
|---|---|---|
| `fullName` | `trim` | `string`, `minLength 2`, `maxLength 100`, `pattern NO_CONTROL_CHARS` |
| `email` | `trim` + `toLowerCase()` | `string`, `maxLength 254`, `format: 'email'`, `pattern NO_CONTROL_CHARS` |
| `phone` | `trim`; `""` → `null` | `['string','null']`, `pattern ^\+?(?=(?:[^0-9]*[0-9]){6})[0-9 ()-]{6,20}$` |
| `summary` | `trim`; `""` → `null` | `['string','null']`, `maxLength 2000`, `pattern NO_CONTROL_CHARS_EXCEPT_WHITESPACE` |
| `skills` | solo si es array de textos: `trim`, `toLowerCase()`, sin vacías, deduplicadas | `array`, `maxItems 20`, `items: string, minLength 1, maxLength 40, pattern NO_CONTROL_CHARS` |
| `consent` (solo alta) | — | `boolean` (sin coerción) |

- `READ_ONLY = ['id','createdAt','consentGivenAt','consentVersion','consentWithdrawnAt','retentionEndsAt']`, declarados
  con `forbiddenFields` (salen con su nombre y «Campo no permitido.»). Cualquier otra clave → un único
  `{ field: 'body', message: 'Hay campos no permitidos.' }` (TASK-01).
- Orden de comprobación: guarda DEC-12 → normalización `preValidation` → esquema → servicio. `format: 'email'` lo trae el
  Ajv de Fastify 5.12.5: sin dependencias nuevas.

**Alta en el servicio** (DD-04, DD-05), todo dentro de `transaction`:

```ts
create(input) {
  return transaction(() => {
    let id: number;
    try { id = repository.insert(fields, now().toISOString(), consent ? { givenAt, version: CONSENT_TEXT_VERSION } : null); }
    catch (error) {
      if (repository.isDuplicateEmailError(error)) throw duplicate({ field: 'email',
        message: 'Ya existe un candidato con este email.', existingId: repository.findIdByEmail(email)! });
      throw error;
    }
    return recalculateRetention(id);   // getProcesses → computeRetentionEndsAt → setRetention → findById
  });
}
```

- `insert` con retención `NULL`; la escribe `recalculateRetention` (un único camino para alta, consentimiento y HU-04).
- `isDuplicateEmailError`: `errcode === 2067` **y** mensaje con `candidates.email` (tras el fallo, la transacción
  sigue abierta en Node 24: la consulta del ID es coherente).
- El 409 nunca lleva el email ni otro dato del existente. Sus tests van en TASK-06.

**Ficha** (`GET /:id`): `idParamsSchema`; 404 «El candidato no existe.». Respuesta con los 11 campos; opcionales sin
valor → `null`, nunca ausentes.

**`get.test.ts`**: los endpoints de consentimiento llegan en TASK-04, así que los estados «vigente» y «retirado» de
CA-22 se preparan con el alta (`consent: true`) y un `UPDATE` directo sobre el `db` de `createTestApp` (cumpliendo los
`CHECK`). **EC-38** («`GET` tras un `PATCH` devuelve lo último») va en `update.test.ts` de TASK-04, porque necesita el
`PATCH`.

**Helpers:** `failWrites(db, op, { table = 'job_openings', column } = {})` crea `BEFORE <op> [OF <column>] ON <table>`
con `RAISE(ABORT, 'fallo simulado')`; nombre del trigger único por tabla, operación y columna. `createProcessesStub({
processes, fail })` → puerto que devuelve `processes` o lanza `new Error('fallo simulado del puerto')` con `fail`. Sin
*mocks* de módulo. Datos inventados con `@example.com`.
