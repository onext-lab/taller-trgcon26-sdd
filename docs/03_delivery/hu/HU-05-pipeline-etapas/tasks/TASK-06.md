# TASK-06 — Avanzar y rechazar frente a entradas hostiles y concurrencia [adversarial]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Primera mitad de B-06 del diseño (partido en dos para que cada `[adversarial]` sea S o M, gate 4): todo lo que llega a
los dos `POST` desde fuera con mala forma, desde otro sitio o a la vez. Un único fichero nuevo,
`apps/api/test/applications/stage-change-adversarial.test.ts`, con `createTestApp`, `createTestClock` y los helpers
`advance`/`reject`/`insertApplicationAt` de TASK-02 (no se tocan). Cada caso comprueba el código y el envelope **y que
nada cambia** (etapa, `last_change_at`, número de `StageChange`, retención). Si un caso destapa un bug, se arregla en
el código de producción dentro de esta tarea (sin adaptar el test).

Casos (categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3):
- **Input inválido (EC-01, CA-09):** avance sin `expectedStage`, `toStage: "foo"`, etapa numérica, cuerpo vacío, cuerpo
  no JSON (400 «El cuerpo de la petición no es JSON válido.»), `note` o `reason` de más → 400; las claves no declaradas
  como `{ field: 'body', message: 'Hay campos no permitidos.' }` sin nombrarlas (DEC-11.4).
- **Input inválido (EC-02):** `:id` `abc`, `0`, `01` y 16 dígitos → 400 `{ field: 'id' }`; con `params` y `body` mal a
  la vez, solo sale `{ field: 'id' }`.
- **Input inválido (EC-11, resto):** rechazo con `reason` numérico, `note` no texto (número, objeto) y `toStage` o
  `stage` de más → 400; nada cambia (los casos de CA-15 están en TASK-04).
- **Input inválido (EC-12):** nota con NUL y con U+0007 → 400 sin la nota en el cuerpo; nota con `\n`, `\r` y `\t`
  dentro → 200 y se guardan tal cual (leídos con `listHistory` o el detalle).
- **Seguridad (EC-09, DEC-12):** `Sec-Fetch-Site: cross-site` en avanzar y en rechazar → 403 `CROSS_SITE_REQUEST` y nada
  cambia.
- **Seguridad (EC-17):** nota con `<script>alert(1)</script>`, comillas y `'; DROP TABLE applications; --` → 200, se
  guarda literal y las tablas `applications` y `stage_changes` siguen existiendo con sus filas.
- **Concurrencia (EC-06):** dos pestañas: la primera avanza `screening → interview`; la segunda pide `offer` con
  esperada `screening` → 409 `STAGE_MISMATCH` y nada más cambia.
- **Concurrencia (EC-15):** rechazo y avance con la misma esperada lanzados en paralelo (`Promise.all` de los dos
  `inject`) → un 200 y un 409 `STAGE_MISMATCH`, en cualquier orden; exactamente 1 `StageChange` nuevo.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/stage-change-adversarial.test.ts` | crear | EC-01, EC-02, EC-06, EC-09 (403), EC-11, EC-12, EC-15, EC-17 y CA-09 |
| `apps/api/src/modules/applications/{schemas,service,routes}.ts` | modificar solo si un caso destapa un bug | Arreglo mínimo, citado en el commit |

## Implementa
- RF: RF-01, RF-02 · CA: CA-09 · EC: EC-01, EC-02, EC-06, EC-09 (403), EC-11, EC-12, EC-15, EC-17
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths, § Errores específicos, § Threat modeling, § Estrategia de
  tests (fila «EC-06, EC-15, EC-17, EC-12» y CA-09), § Checklist B-06

## Dependencias
- **Depende de:** TASK-03, TASK-04
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/stage-change-adversarial` en verde con **1** fichero, con estos nombres:
      «CA-09 etapa desconocida, sin esperada, note de más, cuerpo vacío o no JSON, :id inválido → 400 y nada cambia»;
      «EC-02 abc, 0, 01 y 16 dígitos → 400 { field: 'id' }»; «EC-11 reason numérico, note no texto, toStage de más →
      400»; «EC-12 NUL y U+0007 → 400; \n\r\t aceptados»; «EC-09 cross-site → 403 y nada cambia»; «EC-17 nota con HTML
      y SQL guardada literal»; «EC-06 dos pestañas → STAGE_MISMATCH»; «EC-15 rechazo y avance en paralelo → un 200 y un
      409, 1 StageChange».
- [ ] Ningún cuerpo de error contiene la nota enviada ni el valor recibido.
- [ ] `npm test -w @ats/api -- applications/` en verde (sin regresiones).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/stage-change-adversarial.test.ts` (y los de producción si se tocan) sin
      errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); si el test se acercara, `it.each` por tabla.
- [ ] Commit único `test(api): hostile input and concurrency on stage changes [HU-05 TASK-06]`.

## Notas de implementación
- `node:sqlite` es síncrono y la conexión es única: EC-15 se serializa con `BEGIN IMMEDIATE`; el test comprueba el
  resultado (un 200 y un 409), no el orden.
- No uses mocks de módulo; los fallos de escritura y la guarda del `WHERE` (DD-02) son de TASK-07.
- Datos inventados; los textos hostiles son literales de prueba, no datos personales.
