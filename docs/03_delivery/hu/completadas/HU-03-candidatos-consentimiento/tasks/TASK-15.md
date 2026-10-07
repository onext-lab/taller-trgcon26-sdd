# TASK-15 — Recorridos e2e de candidatos [e2e]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (recorridos de RF-01 a RF-06 de punta a punta)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Dos specs de Playwright (solo Chromium, `workers: 1`, base `data/e2e.db` regenerada con el seed en cada ejecución):
1. `e2e/candidates.spec.ts`: alta (CA-01) con la ficha resultante, alta con consentimiento (CA-03), duplicado con
   enlace (CA-05), edición (CA-07) con el fin de retención sin cambios, título y URL de la ficha (CA-22) y el ciclo de
   consentimiento: marcar → renovar → retirar, con `Escape` primero (sigue vigente) y la trampa de foco del diálogo.
2. `e2e/candidates-list.spec.ts`: búsqueda por apellido único + skill (CA-17); sin filtros, 20 filas y «Siguiente» con
   el seed; ida a la ficha y vuelta con la búsqueda restaurada y la URL `/candidates` sin query (DD-01, RNF-09); API
   abortada con `page.route` → «Reintentar» (CA-21).

**Datos propios** (DD-11): cada prueba crea sus candidatos (por la API o por la interfaz si es el flujo probado) con
nombres inventados únicos y `@example.com`; el seed solo se usa para «hay ≥ 30». Las fechas del seed son relativas al
reset (DD-10): ninguna aserción fija fechas absolutas del seed.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/candidates.spec.ts` | crear | CA-01, CA-03, CA-05, CA-07, CA-22, CA-25 a CA-27 de punta a punta; DD-04 |
| `e2e/candidates-list.spec.ts` | crear | CA-17, CA-21, paginación con el seed, DD-01 y RNF-09 |

## Implementa
- RF: RF-01 a RF-06 (recorridos) · CA: CA-01, CA-03, CA-05, CA-07, CA-17, CA-21, CA-22, CA-25 a CA-27 · DD-01, DD-04,
  DD-11 · RNF-07 (teclado), RNF-09
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests (columna Playwright), DD-04, DD-11, § Checklist W6

## Dependencias
- **Depende de:** TASK-05 (todas las rutas de la API y el seed de 30), TASK-10, TASK-11, TASK-12
- **Bloquea:** nada

## Criterios de done
- [ ] CA-01: alta por la interfaz con email en mayúsculas y skills «TypeScript, sql, typescript» → la ficha muestra el
      email en minúsculas, «typescript, sql» y el fin de retención = fecha de alta + 6 meses (calculada en el test a
      partir de la `createdAt` que devuelve la API, en Europe/Madrid).
- [ ] CA-03 y DD-04: con la casilla marcada, la versión mostrada junto a la casilla del alta coincide con la
      `consentVersion` que devuelve la API.
- [ ] CA-05: email ya usado → «Ya existe un candidato con este email.» y el enlace «Ver el candidato existente» abre la
      ficha del existente.
- [ ] CA-07: editar teléfono, resumen y skills → ficha con los valores normalizados y el mismo fin de retención.
- [ ] CA-22 / RNF-09: título «Ficha de candidato · ATS» y URL `/candidates/{id}`, sin nombre ni email.
- [ ] CA-25 a CA-27: marcar → «Consentimiento registrado.»; «Renovar consentimiento» → «Consentimiento renovado.»;
      desmarcar → diálogo; `Escape` → sigue vigente; `Tab` no sale del diálogo; «Retirar» → «Consentimiento
      retirado.».
- [ ] CA-17: apellido único + skill → solo el candidato esperado.
- [ ] Sin filtros (seed ≥ 30): 20 filas y «Siguiente».
- [ ] DD-01: buscar → abrir una ficha → «Volver a los candidatos» → los campos y resultados restaurados y la URL es
      `/candidates` sin query.
- [ ] CA-21: `page.route('**/api/candidates?**', route => route.abort())` → «Reintentar»; al quitar la ruta y pulsar,
      vuelven los resultados con los filtros escritos.
- [ ] `npx playwright test e2e/candidates.spec.ts e2e/candidates-list.spec.ts` en verde.
- [ ] `npm run e2e` completo en verde (los e2e de ofertas siguen igual con el seed nuevo).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/candidates.spec.ts e2e/candidates-list.spec.ts` sin errores.
- [ ] Commit único `test(e2e): candidate create, edit, search and consent journeys [HU-03 TASK-15]` nombrando los
      ficheros.

## Notas de implementación
- Nombres únicos con un sufijo por ejecución (p. ej., `Date.now()` en base 36) para no chocar con el seed ni con otras
  pruebas en la misma base; cada aserción del listado va filtrada por ese texto, salvo la de paginación sin filtros.
- Consultas por rol y nombre accesible (las de § Accesibilidad que usan los tests del TD-frontend).
- Crear candidatos por la API con `page.request.post('/api/candidates', { data })` (por el *proxy* de la web, como
  `e2e/jobs-list.spec.ts`) cuando no es el flujo probado.
- Si el cálculo de «alta + 6 meses» en el test complica el spec, compara con la `retentionEndsAt` que devuelve
  `GET /api/candidates/{id}` formateada a `dd/mm/aaaa`: la fórmula ya la prueban TASK-02 y TASK-03.
