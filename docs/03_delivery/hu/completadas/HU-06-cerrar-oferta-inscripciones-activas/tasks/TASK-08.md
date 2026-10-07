# TASK-08 — Recorrido e2e: inscripción creada con el diálogo de cierre abierto [e2e] [adversarial]

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** frontend (e2e)
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-05)
- **Complejidad:** S (< 1 h; estimada 1 h)

## Descripción
Adversarial de RF-05 (concurrencia con datos reales, EC-28): el recuento del diálogo queda viejo y el cierre rechaza
también la inscripción que llega con el diálogo abierto. **Sin cambios en `apps/web/src/`** (DT-03: el texto del
diálogo no se recalcula; el aviso sigue siendo «Oferta cerrada.», DT-10 de HU-05).

Añade el test **T2** a `e2e/jobs-close-applications.spec.ts` (lo crea TASK-07), reutilizando sus *helpers* locales y los
de `e2e/support/applications.ts`:

**T2** · `EC-28 y EC-11 una inscripción creada con el diálogo abierto también se rechaza`:
- **Preparación (API):** oferta publicada (`createJobByApi(page, 'published')`) con A inscrito en `received`; B creado
  con `createCandidateByApi` **sin inscribir**.
- **UI y API intercaladas:** `/jobs/:id` → «Cerrar» → en el `dialog`, `status` con «Se rechazará 1 inscripción
  activa.» → **con el diálogo abierto**, `enrollByApi(page, job.id, B.id)` (201) → «Cerrar oferta» → «Oferta cerrada.»
  → «Ver pipeline» → A **y B** en la `region` «Rechazado» con «Motivo: Oferta cerrada»; 0 tarjetas en «Recibida».

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/jobs-close-applications.spec.ts` | modificar | Test T2 (EC-28, EC-11, EC-04 visible, CA-03 en la UI) |

## Implementa
- RF: RF-05 (concurrencia) · Edge cases: EC-28, EC-11 (en la UI), EC-04 (parte visible), EC-26 (1 real) · CA-03 en la
  UI
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Diagrama de secuencia (EC-28 / EC-11), § Error paths (EC-28), § Estrategia
  de tests (T2 y «`[adversarial]` de RF-05»), § Checklist de implementación 2

## Dependencias
- **Depende de:** TASK-07 (crea el spec y `advanceByApi`; mismo fichero)
- **Bloquea:** nada

## Criterios de done
- [ ] `npx playwright test e2e/jobs-close-applications.spec.ts e2e/pipeline-closed.spec.ts` en verde, con T1 y T2.
- [ ] T2 comprueba el diálogo con **1** antes de inscribir a B y el pipeline con **2** rechazadas después: si el
      cierre rechazara solo lo contado en la previa, T2 falla.
- [ ] Sin cambios en `apps/web/` (diff vacío en esa carpeta).
- [ ] Aserciones *web-first* (`await expect(locator)…`), que esperan solas; ningún `textContent()` leído una vez ni
      `waitForTimeout`. La inscripción de B se hace **después** de ver el texto «Se rechazará 1 inscripción activa.»
      (aserción con `await`), nunca tras una espera fija.
- [ ] Spec ≤ 300 líneas, cada `test` y *helper* ≤ 50. Ningún fichero tocado pasa de 300 líneas ni ninguna función de 50
      (`wc -l` tras Prettier).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/jobs-close-applications.spec.ts` sin errores.
- [ ] Commit único `test(e2e): application enrolled while the close dialog is open is also rejected [HU-06 TASK-08]`
      con el fichero.

## Notas de implementación
- `enrollByApi` usa `page.request`, como los demás *helpers* de preparación que ya usan otros specs: la guarda DEC-12
  lo deja pasar.
- No se recalcula la previa ni se espera otro texto en el diálogo (DT-03): lo único que cambia es el pipeline.
- Datos inventados con *token* único; sin IDs fijos.
