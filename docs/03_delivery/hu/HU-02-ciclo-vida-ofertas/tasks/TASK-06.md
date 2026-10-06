# TASK-06 — Edición, borrado y listado en la API frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** test (backend)
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tarea `[adversarial]` de la API para **RF-03 y RF-05**: casos hostiles y de fallo sobre la edición y el borrado según el
estado (TASK-03) y sobre el listado filtrado (TASK-05), por categoría de `docs/07_architecture_principles/QUALITY-GATES.md`
§3. Solo añade tests; si uno destapa un fallo en `src/`, se arregla aquí (techo de 2 ciclos) y, si es de diseño, se para
y se escala.

| RF | Categoría · edge cases |
|---|---|
| RF-03 Editar y borrar según el estado | 1 EC-18 (esquema antes que estado) · 3 EC-20 (fallo de SQLite) · 4 EC-21 (borrar lo que otra pestaña publicó; publicar lo borrado) · 6 EC-23 (despublicar o cambiar la fecha por `PATCH`) · 7 EC-24 (repeticiones) |
| RF-05 Listado | 1 EC-32, EC-33, CA-19, CA-20, CA-21 (parámetros inválidos o desconocidos, controles en `q`) · 6 EC-39 (inyección, comodines) y RNF-06 (`q` fuera de los logs) |

Las demás categorías están en TASK-03/TASK-05 o son N/A (EC-22 en `migration.test.ts`, existe; EC-40 `GET` sin
efectos), según la tabla del ROADMAP.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/status-rules.test.ts` | modificar | + EC-18, EC-20, EC-21, EC-23, EC-24 |
| `apps/api/test/jobs/list-filters-adversarial.test.ts` | crear | Parámetros inválidos, inyección y logs |

Si `status-rules.test.ts` fuera a pasar de 300 líneas, los casos de esta tarea van a un hermano
`apps/api/test/jobs/status-rules-adversarial.test.ts` (crear); el patrón `status-rules` lo recoge.

## Implementa
- RF: RF-03, RF-05 (API) · RNF: RNF-03, RNF-06 · CA: CA-13 (repetición), CA-19, CA-20, CA-21 · Edge cases: EC-18,
  EC-20, EC-21, EC-23, EC-24, EC-32, EC-33, EC-34 (`pageSize` 101, `q` 101), EC-39
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (orden de comprobación; tabla de mensajes de la
  querystring), § Error paths (EC-18 a EC-24, EC-32 a EC-34, EC-39), DD-05, § Estrategia de tests (filas
  `[adversarial]` de RF-03 y RF-05, RNF-06)

## Dependencias
- **Depende de:** TASK-03, TASK-05
- **Bloquea:** nada (va en paralelo con las tareas de la web)

## Criterios de done
- [ ] EC-18: `PATCH` con título de 2 caracteres a una cerrada → 400 en `title` (esquema antes que estado); nada cambia.
- [ ] EC-20: `failWrites(db, 'UPDATE')` al editar una publicada → 500 `INTERNAL_ERROR` sin *stack*; `GET` igual que
      antes.
- [ ] EC-21: `DELETE` de un borrador que otra petición acaba de publicar → 409; publicar un borrador ya borrado → 404.
- [ ] EC-23: `PATCH` de una publicada con `status: "draft"` o con `publishedAt` → 400 (`additionalProperties`); nada
      cambia.
- [ ] CA-13/EC-24: dos `DELETE` de una publicada → 409 las dos veces y sigue existiendo; el mismo `PATCH` válido dos
      veces sobre una publicada → 200 con el mismo cuerpo.
- [ ] EC-32 (`it.each`): `page=0`, `page=-1`, `page=1.5`, `pageSize=0`, `pageSize=abc`, `status=Published`,
      `status=draft&status=closed`, `sort=title` → 400 `VALIDATION_ERROR` con el parámetro en `details[].field` y el
      mensaje de la tabla de TASK-05.
- [ ] CA-19: `pageSize=101` y `pageSize=0` → 400 en `pageSize`. CA-21: `status=archived` → 400 en `status`.
- [ ] CA-20: `q` de 101 puntos de código tras recortar → 400 en `q`; de 100 → 200.
- [ ] CA-20/EC-33: `q=a%09b`, `q=a%0Ab`, `q=a%00` → 400 en `q` «Formato no válido.»; DD-05: `q=%09ab%09` → 200.
- [ ] EC-39: `' OR 1=1 --`, `%` y `_` son literales (0 resultados salvo títulos que los contengan) y la tabla sigue
      intacta.
- [ ] RNF-06/EC-39: con un logger con `stream` (como `apps/api/test/logger.test.ts`), el valor de `q` no aparece en
      ninguna línea de log de `GET /api/jobs?q=…`.
- [ ] `npm test -w apps/api -- status-rules list-filters-adversarial` en verde, con **2** ficheros de test ejecutados
      (3 si se creó el hermano de `status-rules`).
- [ ] `npm test -w apps/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/jobs/status-rules.test.ts apps/api/test/jobs/list-filters-adversarial.test.ts` sin
      errores (más el hermano y los ficheros de `src/` si hubo que arreglar algo).
- [ ] Commit único `test(jobs): adversarial tests for status rules and list filters [HU-02 TASK-06]` nombrando los
      ficheros.

## Notas de implementación
- **Orden de comprobación** (DT-04 + DEC-12): `Sec-Fetch-Site` (403) → JSON Schema (400) → existencia (404) → estado
  (409) → reglas del servicio (400). Por eso EC-18 da 400 y no 409.
- `pageSize=101` responde «Formato no válido.» (tradeoff de DD-05), no «menor o igual que 100».
- `failWrites(db, op)` crea un *trigger* real: créalo **después** de preparar los datos.
- Codifica `q` con `encodeURIComponent` en la URL de `inject`, salvo en EC-33, donde se escribe la secuencia `%09`,
  `%0A`, `%00` a propósito.
- Envelopes comparados **completos** (RNF-03).
- Nombres de los tests (TD): `status-rules.test.ts` › «EC-18 PATCH inválido a una cerrada → 400 (esquema antes que
  estado)», «EC-20 fallo de SQLite al editar una publicada → 500 sin cambios», «EC-21 DELETE tras publicarla → 409;
  publicar tras borrarla → 404», «EC-23 PATCH con status o publishedAt sobre una publicada → 400 sin cambios», «CA-13/EC-24
  dos DELETE de una publicada → 409; el mismo PATCH dos veces → 200 igual»; `list-filters-adversarial.test.ts` › «EC-32
  parámetro inválido o desconocido → 400 con el parámetro», «CA-19 pageSize 101 o 0 → 400 en pageSize», «CA-20 q de 101
  → 400; de 100 → 200», «CA-20/EC-33 q con carácter de control dentro → 400», «DD-05 tabulador al borde de q se recorta»,
  «CA-21 status=archived → 400 en status», «EC-39 inyección, % y _ son literales», «RNF-06/EC-39 el valor de q no
  aparece en los logs».
