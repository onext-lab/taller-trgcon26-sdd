# TASK-09 — Recorrido e2e de la fecha límite [e2e]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-03, RF-04) · Should (RF-05)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Recorrido de Playwright (Chromium) contra la API y la web reales sobre `data/e2e.db`, que `playwright.config.ts`
regenera en cada pasada con el seed de TASK-04. `workers: 1`, sin IDs fijos, aserciones *web-first*, títulos con
*token* único y datos inventados. Nada simulado.

`e2e/jobs-deadline.spec.ts` (**crear**):

| Test | Criterio | Pasos y aserciones |
|---|---|---|
| E1 «CA-01 y CA-03 crear con fecha límite, verla en la ficha y quitarla» | CA-01, CA-03, EC-18, RF-06 | `/jobs/new` → título con *token* → `getByLabel('Fecha límite de inscripción').fill('2036-10-13')` → «Guardar» → «Oferta creada.» y `definition` «13/10/2036» → «Editar» → el campo vale `2036-10-13` → `fill('')` → «Guardar» → «Cambios guardados.» y 0 `term` «Fecha límite de inscripción» |
| E2 «CA-02 una fecha pasada da el error junto al campo» | CA-02 (web), RNF-02 | `/jobs/new` → título → `fill('2020-01-01')` → «Guardar» → la URL sigue en `/jobs/new`; el campo tiene `aria-invalid="true"` y su descripción contiene «La fecha límite no puede ser anterior a hoy.»; el título se conserva |
| E3 «CA-12, CA-13 y EC-25 seed: la vencida sin botón y con el texto; la de plazo futuro con botón» | CA-12, CA-13, EC-25, EC-30 | Por la API: `GET /api/jobs?status=published&pageSize=100` y el pipeline de cada una → la de `enrollmentDeadlinePassed: true` y la de fecha futura (no por título ni ID). Vencida: 0 `button` «Inscribir candidato» y `status` con «El plazo de inscripción terminó el {dd/mm/aaaa}: no se pueden inscribir más candidatos.» (la fecha de la API reordenada en el test); si tiene tarjetas no finales, ≥1 `button` `/^Avanzar a/` y `/^Rechazar/`; `page.reload()` → igual. Futura: `button` «Inscribir candidato» y 0 texto de vencido |

CA-06, CA-07 y CA-10 no se reproducen en el e2e sin manipular el reloj o el seed: los cubren Vitest (TASK-06 a TASK-08)
y la API (TASK-02 a TASK-05).

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `e2e/jobs-deadline.spec.ts` | Crear | E1, E2, E3 |

## Implementa
- RF: RF-03, RF-04, RF-05, RF-06 (recorrido) · CA: CA-01, CA-02, CA-03, CA-12, CA-13 · Edge cases: EC-18, EC-25, EC-30
  · RNF-02
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests («Playwright · `e2e/jobs-deadline.spec.ts`»),
  § Dependencias (S6), § Checklist de implementación (puntos 5 y 6)

## Dependencias
- **Depende de:** TASK-04 (seed), TASK-06 (formulario y ficha), TASK-07 (pipeline)
- **Bloquea:** nada

## Criterios de done
- [ ] `npx playwright test e2e/jobs-deadline.spec.ts` en verde (3 tests).
- [ ] `npm run e2e` **completo** en verde (el seed nuevo no rompe otros specs).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/jobs-deadline.spec.ts` sin errores.
- [ ] Commit único `test(e2e): enrollment deadline journey [HU-07 TASK-09]`.

## Notas de implementación
- Reutiliza los ayudantes de `e2e/support/applications.ts` si encajan (petición por la API desde `page.request`).
- E3 no fija el día: lo deduce de la API, así que sigue en verde cualquier día que se ejecute (las fechas del seed son
  relativas al reset).
- El e2e no escribe una fecha a medias en el control (DD-02): depende del orden de segmentos del locale; queda cubierto
  en Vitest (TASK-08).
