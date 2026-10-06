# TASK-07 — Borrado, listado y ficha en la API frente a entradas hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** test (backend)
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Tests adversariales de `DELETE /api/jobs/:id`, `GET /api/jobs` y `GET /api/jobs/:id` (RF-04, RF-05 y RF-06), aparte
del camino feliz: IDs que no son enteros positivos, IDs inexistentes o ya borrados, segundo `DELETE`, fallo real de
SQLite al borrar, parámetros de query no admitidos, HTML en el título y campos de más en los items del listado.

Si un test destapa un fallo, se corrige el código de producción en esta tarea (techo de 2 ciclos); **nunca** se adapta
el test. Si el fallo es del diseño, se para y se escala.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/delete.test.ts` | modificar | Tests adversariales del borrado |
| `apps/api/test/jobs/list.test.ts` | modificar | Tests adversariales del listado |
| `apps/api/test/jobs/get.test.ts` | modificar | Tests adversariales de la ficha |
| `apps/api/src/modules/jobs/routes.ts` | modificar **solo si** un test destapa un fallo | Esquemas de `params`, `querystring` y `response` |
| `apps/api/src/modules/jobs/service.ts` | modificar **solo si** un test destapa un fallo | `get`, `remove`, `list` |

## Implementa
- RF: RF-04, RF-05, RF-06 (todos Must) · CA: CA-14, CA-20
- Edge cases por categoría (`QUALITY-GATES.md` §3):

| RF | 1 Input inválido | 3 Fallo de dependencia | 4 Concurrencia | 6 Seguridad | 7 Idempotencia |
|---|---|---|---|---|---|
| RF-04 | EC-27 | EC-29 | (EC-30 en TASK-06) | EC-32: sin test (*Threat modeling*: aceptado) | EC-33 |
| RF-05 | EC-34 | (EC-38: 500 en el envelope, TASK-01) | — (EC-39 N/A) | EC-41 + solo campos de lista | — (EC-42 N/A) |
| RF-06 | EC-43 + CA-20 | (EC-45 es de la web) | EC-46 | (EC-48 en TASK-04) | — (EC-49 N/A) |

  Boundary (EC-28, EC-35, EC-36, EC-37, EC-44) está en TASK-04 y TASK-05; datos corruptos (EC-31, EC-40, EC-47) es
  N/A en la API (módulo nuevo y `CHECK` de TASK-02).
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-27 a EC-48), § Threat modeling (Enumeración de IDs, XSS
  almacenado, Exposición de datos), § Estrategia de tests (filas `[adversarial]`)

## Dependencias
- **Depende de:** TASK-05
- **Bloquea:** nada (puede ir en paralelo con TASK-06: no comparten ficheros de test)

## Criterios de done
- [ ] Todos los tests de abajo existen con esos nombres y pasan contra el código real.
- [ ] Cada rechazo comprueba el envelope completo y que nada cambia.
- [ ] `npm test -w apps/api -- delete list get` en verde, con **3** ficheros de test ejecutados.
- [ ] `npm test -w apps/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/jobs/delete.test.ts apps/api/test/jobs/list.test.ts apps/api/test/jobs/get.test.ts`
      (más los de `src` que se toquen) sin errores.
- [ ] Commit único `test(jobs): adversarial tests for delete, list and get [HU-01 TASK-07]` nombrando los ficheros.

## Notas de implementación

Patrón del ID de ruta: `^[1-9][0-9]{0,14}$` (texto, sin ceros a la izquierda, ≤ 15 cifras). Un fallo da 400
`VALIDATION_ERROR` con `details: [{ field: "id", message: "Formato no válido." }]`. Orden: JSON Schema (400) →
existencia (404). `GET` y `DELETE` **sin** `payload` ni `Content-Type`.

**`delete.test.ts`:**
- «EC-27 DELETE /api/jobs/abc → 400»: `abc`, `0`, `007`, `1.5` y un número de 16 cifras → 400 `field: "id"`; la
  oferta existente sigue (`GET` 200).
- «EC-29 fallo de SQLite al borrar → 500 y sigue»: `failWrites(db, 'DELETE')` → 500 `INTERNAL_ERROR` «Error interno.
  Inténtalo de nuevo.», sin «fallo simulado» en el cuerpo; `GET /api/jobs/:id` sigue dando 200.
- «CA-14/EC-33 segundo DELETE → 404 en el envelope»: primer `DELETE` 204, segundo 404
  `{ error: { code: "NOT_FOUND", message: "La oferta no existe." } }`; el resto de ofertas sigue igual.

**`list.test.ts`:**
- «EC-34 cualquier parámetro → 400»: `?page=2` → 400 con `{ field: "page", message: "Campo no permitido." }`;
  `?q=x` → `field: "q"`.
- «EC-41 el título con HTML se devuelve literal»: título `<img src=x onerror=alert(1)>` sale idéntico en `items`.
- «RF-05 los items solo traen id, title, status y referenceDate»: `Object.keys(item).sort()` es exactamente
  `['id', 'referenceDate', 'status', 'title']` (sin descripción, ubicación ni salarios).

**`get.test.ts`:**
- «CA-20 ID inexistente → 404 sin datos»: `GET /api/jobs/999999999` → 404 `NOT_FOUND` «La oferta no existe.»; el
  cuerpo es solo el envelope (ninguna propiedad de oferta).
- «EC-43 ID no entero → 400»: `abc`, `1.5`, `0`, `007` → 400 `field: "id"`.
- «EC-46 GET tras borrado → 404»: crear, `DELETE`, `GET` → 404.
