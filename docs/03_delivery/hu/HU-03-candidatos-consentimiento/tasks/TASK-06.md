# TASK-06 — Alta de candidatos en la API frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (gate 4 de RF-01, RF-02 y RF-07 en el alta)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Casos hostiles del alta (`POST /api/candidates`), aparte del camino feliz de TASK-03, en un solo fichero
`apps/api/test/candidates/create-adversarial.test.ts` con tablas `it.each`. Cubre las categorías de
`docs/07_architecture_principles/QUALITY-GATES.md` §3: input inválido, boundary rechazado, fallo de dependencia
(BD y puerto), concurrencia, seguridad (datos personales y `details` acotado) e idempotencia. Si un caso destapa un
fallo de producción, se arregla en el fichero de `apps/api/src/modules/candidates/` que corresponda (como mucho 2
ciclos de arreglo).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/candidates/create-adversarial.test.ts` | crear | CA-04 (rechazos), CA-05, CA-06, EC-01, EC-02, EC-04, EC-05, EC-07, EC-08, EC-09, EC-10, EC-17, EC-53, EC-58, EC-59, RNF-05, RNF-08 |
| `apps/api/src/modules/candidates/{schemas,normalize,service,routes}.ts` | modificar solo si un caso falla | Arreglos que destape el test |

## Implementa
- RF: RF-01, RF-02, RF-07 (EC-53 en el alta) · CA: CA-04 (rechazos), CA-05, CA-06 · Edge cases: EC-01, EC-02, EC-04,
  EC-05, EC-07, EC-08, EC-09, EC-10, EC-11 (rechazados), EC-13 (rechazados), EC-17, EC-53, EC-58, EC-59 · RNF-05,
  RNF-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (filas EC-01 a EC-17, EC-53, EC-58, EC-59), § Threat modeling,
  § Estrategia de tests (CA-04, CA-05, CA-06, RNF-05, RNF-08), § Checklist B-07

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** nada

## Criterios de done
Cada rechazo comprueba además que **no se crea ninguna fila** (`SELECT count(*) FROM candidates`) y que el cuerpo de la
respuesta **no contiene el valor enviado**.
- [ ] EC-01: cuerpo no JSON → 400 «El cuerpo de la petición no es JSON válido.»; `[]` y `"x"` → 400 en `body`.
      RNF-05: todos en el envelope, sin *stack trace*.
- [ ] EC-02: `consent: "sí"` → 400 en `consent` «Debe ser verdadero o falso.»; `retentionEndsAt`, `createdAt`,
      `consentGivenAt`, `consentVersion`, `consentWithdrawnAt` e `id` → 400 con su nombre y «Campo no permitido.».
- [ ] CA-04 / EC-09 / EC-10 / EC-11 / EC-13: nombre de 1 y 101, «   », email `ana.gil`, `ana.gil@` y de 255, teléfono
      `abc123`, `12345`, `------` y 21 tras el «+», 21 skills distintas, skill de 41, skill `42` → 400 en su campo.
- [ ] EC-58: NUL o `\n` en el nombre, `\t` interior en una skill, `\u007F` en email y teléfono → 400 en su campo;
      resumen con `\u0007` → 400; resumen con `\n\r\t` → 201.
- [ ] CA-05 / EC-05 / EC-07: `LUCIA.FERRER@example.com` con `lucia.ferrer@example.com` existente → 409 `DUPLICATE`,
      `details: [{ field: 'email', message: 'Ya existe un candidato con este email.', existingId: <id> }]`; el cuerpo
      no contiene «lucia» ni ningún dato del existente; sigue habiendo 1 fila.
- [ ] EC-08: dos `POST` iguales en `Promise.all` → uno 201 y otro 409 con el ID del primero; 1 fila.
- [ ] CA-06 / EC-04: `failWrites(db, 'INSERT', { table: 'candidates' })` → 500 `INTERNAL_ERROR` «Error interno.
      Inténtalo de nuevo.», sin datos personales; 0 filas.
- [ ] EC-53: `createProcessesStub({ fail: true })` → 500 y 0 filas (`ROLLBACK` del `INSERT`).
- [ ] EC-17: cuerpo > 1 MiB → 413 `PAYLOAD_TOO_LARGE`; resumen de 1 MB (< 1 MiB) → 400 en `summary` sin repetir el
      valor; resumen `<script>alert(1)</script>` → 201 y se devuelve literal.
- [ ] EC-59 / RNF-08: alta con 1 000 claves desconocidas, una `lucia.ferrer@example.com` → 400 con
      `details` exactamente `[{ field: 'body', message: 'Hay campos no permitidos.' }]`; el cuerpo no contiene «lucia»;
      0 filas. Con errores mezclados, `details.length` ≤ propiedades del esquema + 1.
- [ ] `npm test -w @ats/api -- candidates/create-adversarial` en verde, con **1** fichero de test.
- [ ] `npm test -w @ats/api -- candidates` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/candidates/create-adversarial.test.ts` (y los de producción que se toquen) sin errores.
- [ ] Commit único `test(api): adversarial create candidate [HU-03 TASK-06]` nombrando los ficheros.

## Notas de implementación
- Reloj fijo con `createTestClock('2026-10-06T09:00:00.000Z')`; datos inventados con `@example.com`.
- Fallos con dobles reales (triggers de `failWrites`, `createProcessesStub`), sin *mocks* de módulo.
- El 413 depende del `bodyLimit` de 1 MiB de Fastify (DEC-11.5): genera el cuerpo en el test, no lo guardes en disco.
- El fichero debe quedar por debajo de 300 líneas: si no cabe, usa tablas `it.each` con `[descripción, cuerpo, campo,
  mensaje]` en lugar de un `it` por caso.
