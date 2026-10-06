# TASK-03 — Editar y borrar según el estado en la API

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
RF-03 en el servicio (review de HU-01 §9, DEC-08): `update` y `remove` comprueban el estado **dentro** de la
transacción con `checkAction` (tabla de `rules.ts`, TASK-02); `remove` pasa a `withTransaction`; editar una
`published` exige que título, descripción, ubicación y modalidad sigan informados tras la fusión. Con los tests de los
flujos de UC (CA-10 a CA-13), la edición válida de una publicada (EC-19) y la tabla completa de acciones × estados
(DD-02) en `status-rules.test.ts`.

Los casos hostiles de RF-03 (esquema antes que estado, fallo de SQLite, concurrencia entre borrar y publicar, intento de
despublicar, repeticiones) los prueba la tarea `[adversarial]` TASK-06.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/jobs/service.ts` | modificar | `update` y `remove` con `checkAction`; obligatorios en una `published`; `remove` en `withTransaction` |
| `apps/api/test/jobs/status-rules.test.ts` | crear | Flujos de RF-03 y tabla DD-02 |

## Implementa
- RF: RF-03 (API) · CA: CA-10, CA-11, CA-12, CA-13 · Edge cases: EC-17, EC-19, EC-44 (API)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (tabla de errores y orden de comprobación), § Endpoints
  (`PATCH`, `DELETE`), § Diagrama de secuencia RF-03, DD-02, DD-07, § Error paths (EC-17, EC-19, EC-21, EC-24, EC-44),
  § Checklist paso 3

## Dependencias
- **Depende de:** TASK-02 (`rules.ts` y los *helpers* `publishJob`, `closeJob`, `createPublishedJob`)
- **Bloquea:** TASK-05, TASK-06, TASK-11

## Criterios de done
- [ ] CA-10: `PATCH` válido a una `closed` → 409 con el cuerpo exacto `{ "error": { "code": "INVALID_TRANSITION", "message": "Una oferta cerrada no se puede editar." } }`
      (sin `details`) y nada cambia.
- [ ] CA-11/EC-17 (`it.each`): `PATCH` de una publicada con `description: "   "`, `location: null` o `workMode: null` →
      400 `VALIDATION_ERROR` con ese campo y «Obligatorio en una oferta publicada.»; la oferta no cambia.
- [ ] CA-12/EC-21/EC-44: oferta publicada que se cierra y después recibe un `PATCH` válido → 409 y nada cambia.
- [ ] CA-13: `DELETE` de una publicada → 409 «Una oferta publicada no se puede borrar.»; de una cerrada → 409 «Una oferta
      cerrada no se puede borrar.»; las dos siguen existiendo sin cambios.
- [ ] EC-19: cambiar o vaciar la banda de una publicada → 200; `status` y `publishedAt` iguales.
- [ ] DD-02: `it.each` sobre la API que recorre la tabla acción × estado entera (12 celdas: `apply`, `noop` o 409).
- [ ] `npm test -w apps/api -- status-rules` en verde, con **1** fichero de test ejecutado.
- [ ] `npm test -w apps/api` completo en verde: `update.test.ts` y `delete.test.ts` de HU-01 siguen igual (solo usan
      borradores, que `checkAction` permite).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs/service.ts apps/api/test/jobs/status-rules.test.ts` sin errores.
- [ ] Commit único `feat(jobs): enforce job status on edit and delete [HU-02 TASK-03]` nombrando los ficheros.

## Notas de implementación

**Orden de comprobación** (DT-04 + DEC-12): `Sec-Fetch-Site` (403) → JSON Schema (400) → existencia (404) → estado
(409) → reglas del servicio (400). Los 409 no llevan `details`, ID ni datos de la oferta.

**Servicio:**

```ts
update(id, patch) → transaction(() => {
  const current = repository.findById(id);            // 404
  checkAction('update', current.status);              // closed → 409
  const merged = { ...editableFields(current), ...patch };
  const details = current.status === 'published'
    ? missingRequiredDetails(merged, 'Obligatorio en una oferta publicada.')
    : [];
  assertNoDetails([...details, ...salaryRangeDetails(merged.salaryMin, merged.salaryMax)]); // un único 400 (DD-07)
  return repository.update(id, merged);               // UPDATE de 6 columnas fijas: status y fechas intactos
})
remove(id) → transaction(() => {
  const current = repository.findById(id);            // 404
  checkAction('remove', current.status);              // published/closed → 409
  repository.deleteById(id);
})
```

- La edición sigue siendo «última escritura» (DEC-08). `status`, `publishedAt` y `closedAt` no están en el esquema del
  `PATCH` (`additionalProperties: false`).
- Si además falla la banda, `salaryMin` va en el mismo `details`, detrás de los obligatorios.

**Contrato:**

| Método y ruta | Cambio |
|---|---|
| `PATCH /api/jobs/:id` | + 409 `INVALID_TRANSITION` «Una oferta cerrada no se puede editar.» si `closed` · + 400 «Obligatorio en una oferta publicada.» por campo vacío tras la fusión si `published`. En una `published`, 200 con `status` y fechas intactos |
| `DELETE /api/jobs/:id` | 204 solo si `draft` · + 409 «Una oferta publicada no se puede borrar.» / «Una oferta cerrada no se puede borrar.» |

**Tests** (`createTestApp({ now })`, `createPublishedJob`, `publishJob`, `closeJob`; envelopes comparados **completos**,
RNF-03), con los nombres del TD: «CA-10 PATCH válido a una cerrada → 409 y nada cambia», «CA-11/EC-17 vaciar un
obligatorio de una publicada → 400 sin cambios», «CA-12/EC-21 PATCH tras cerrarla → 409 y nada cambia», «CA-13 DELETE
de una publicada y de una cerrada → 409» (primera parte de «CA-13/EC-24» del TD; la repetición va en TASK-06), «EC-19
cambiar o vaciar la banda de una publicada → 200 sin tocar estado ni fechas» y «DD-02 tabla de acciones × estados».
Comprueba con un `GET` que la oferta no cambió.
