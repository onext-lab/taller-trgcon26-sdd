# TASK-06 — Alta y edición en la API frente a entradas hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** test (backend)
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tests adversariales de `POST /api/jobs` y `PATCH /api/jobs/:id` (RF-01, RF-02 y RF-03), aparte del camino feliz:
cuerpos que no son JSON u objeto, campos de solo lectura o desconocidos (*mass assignment*), salarios que no son enteros
o vienen como texto, cuerpos enormes, inyección SQL, fallos reales de SQLite (con `failWrites`), la regla de banda con
el valor ya guardado, y la oferta borrada mientras se editaba.

El objetivo es **romper** la implementación de TASK-03 y TASK-05. Si un test destapa un fallo, se corrige el código de
producción en esta misma tarea (dentro del techo de 2 ciclos de arreglo); **nunca** se adapta el test al fallo. Si el
fallo es del diseño, se para y se escala.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/create.test.ts` | modificar | Tests adversariales del alta |
| `apps/api/test/jobs/update.test.ts` | modificar | Tests adversariales de la edición |
| `apps/api/src/http/error-handler.ts` | modificar **solo si** un test destapa un fallo | Traducción al envelope |
| `apps/api/src/modules/jobs/service.ts` | modificar **solo si** un test destapa un fallo | Reglas y transacción |
| `apps/api/src/modules/jobs/routes.ts` | modificar **solo si** un test destapa un fallo | Esquemas y `preValidation` |

## Implementa
- RF: RF-01, RF-02, RF-03 (todos Must) · CA: CA-07 (salario 0 o no entero), CA-08, CA-12
- Edge cases por categoría (`QUALITY-GATES.md` §3):

| RF | 1 Input inválido | 3 Fallo de dependencia | 5 Datos corruptos | 6 Seguridad |
|---|---|---|---|---|
| RF-01 | EC-01, EC-02 | EC-05 | — (EC-07 N/A) | EC-08 |
| RF-02 | EC-11 | — (EC-14 N/A) | (EC-16 en TASK-02) | EC-17 |
| RF-03 | EC-20 + regla de banda fusionada | EC-22 | EC-24 (y EC-30) | EC-25 |

  Las demás categorías están en el camino feliz: boundary (EC-03, EC-04, EC-12, EC-13 en TASK-03; EC-21 en TASK-05),
  concurrencia (EC-06 en TASK-03 y TASK-14; EC-23 en TASK-05) e idempotencia (EC-09 en TASK-03; EC-26 en TASK-05).
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-01 a EC-25), § Threat modeling (Manipulación, Exposición
  de datos, Denegación de servicio), § Estrategia de tests (filas `[adversarial]`)

## Dependencias
- **Depende de:** TASK-05
- **Bloquea:** nada (puede ir en paralelo con TASK-07: no comparten ficheros de test)

## Criterios de done
- [ ] Todos los tests de abajo existen con esos nombres y pasan contra el código real (sin *mocks* de SQLite ni de
      Fastify).
- [ ] Cada caso de rechazo comprueba el envelope completo y que **no se crea ni cambia nada** (cuenta de filas o `GET`
      posterior).
- [ ] Ninguna respuesta de error contiene el valor recibido, SQL, *stack* ni rutas de fichero.
- [ ] `npm test -w apps/api -- create update` en verde, con **2** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/jobs/create.test.ts apps/api/test/jobs/update.test.ts` (más los de `src` que se toquen)
      sin errores.
- [ ] Commit único `test(jobs): adversarial tests for create and update [HU-01 TASK-06]` nombrando los ficheros (si se
      corrige código, `fix(jobs): …` en el mismo commit y explicado en el cuerpo).

## Notas de implementación

**Tests de `create.test.ts`** (nombres del diseño):
- «EC-01 cuerpo no JSON, [] o "x" → 400 sin filas»: `payload: 'no es json'` con `content-type: application/json` →
  400 `VALIDATION_ERROR` «El cuerpo de la petición no es JSON válido.» con
  `details: [{ field: "body", message: "Debe ser un objeto JSON." }]`; `[]` y `"x"` →
  400 con `field: "body"` («Debe ser un objeto JSON.»); cuerpo vacío con `Content-Type: application/json` → 400.
- «CA-08/EC-02 campos de solo lectura o desconocidos → 400 con el campo en details»: `status: "published"`,
  `createdAt`, `id` y un campo inventado (`foo`), cada uno → 400 con `{ field: <campo>, message: "Campo no
  permitido." }`; 0 filas. (Prueba que `removeAdditional` está desactivado: con el valor por defecto se crearía.)
- «EC-05 fallo de SQLite al insertar → 500 sin stack y sin filas»: `failWrites(db, 'INSERT')` → 500
  `{ error: { code: "INTERNAL_ERROR", message: "Error interno. Inténtalo de nuevo." } }`, sin `details`, sin «fallo
  simulado» ni «SQLITE» en el cuerpo; 0 filas.
- «EC-08 inyección SQL se guarda literal y la tabla sigue»: título `'); DROP TABLE job_openings; --` → 201 con el
  texto literal; `GET /api/jobs` sigue respondiendo 200.
- «CA-07/EC-11 banda inválida → 400» (`it.each` sobre `salaryMin` y `salaryMax`): `"40000"` (texto: prueba que
  `coerceTypes` está desactivado, DEC-11), `40000.5`, `0`, `-1` y `1e300` (DD-12) → 400 con ese extremo en `details`;
  0 filas.
- «EC-17 descripción de 1 MB → 400; > 1 MiB → 413»: descripción de 1 000 000 caracteres (cuerpo < 1 MiB) → 400 en
  `description`; cuerpo de más de 1 048 576 bytes → 413 `PAYLOAD_TOO_LARGE` «El cuerpo de la petición es demasiado
  grande.»; 0 filas.

**Tests de `update.test.ts`** (parte de un borrador creado con `createJob`; «sin cambios» = `GET` posterior igual al
original):
- «CA-12/EC-20 título vacío, de 2 o modalidad inválida → 400 sin cambios»: `title: ""`, `"   "`, `"ab"`,
  `title: null` y `workMode: "teletrabajo"` → 400 con el campo en `details`.
- «RF-02 mínimo nuevo mayor que el máximo guardado → 400 en salaryMin»: borrador con 32 000-40 000 y `PATCH
  { salaryMin: 45000 }` → 400 `{ field: "salaryMin", message: "El salario mínimo no puede ser mayor que el máximo." }`.
- «EC-22 fallo de SQLite al editar → 500 sin cambios»: `failWrites(db, 'UPDATE')` → 500 `INTERNAL_ERROR`; el `GET`
  devuelve lo de antes (el `ROLLBACK` de `withTransaction` funciona).
- «EC-24/EC-30 PATCH de una oferta borrada → 404»: crear, `DELETE`, `PATCH` → 404 `NOT_FOUND` «La oferta no existe.».
- «EC-25 PATCH con status, createdAt o id → 400 sin cambios».
- Orden de comprobación: `PATCH { title: "ab" }` a un ID inexistente → **400** (no 404).

Recuerda: `GET` y `DELETE` sin `payload` ni `Content-Type`.
