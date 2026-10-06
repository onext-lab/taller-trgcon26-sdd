# TASK-08 — Listado y consentimiento en la API frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (gate 4 de RF-04, RF-06 y RF-07)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Dos ficheros hostiles, aparte de los caminos felices de TASK-04 y TASK-05:
1. `apps/api/test/candidates/list-adversarial.test.ts`: parámetros inválidos o desconocidos sin repetir `q`, e
   inyección literal.
2. `apps/api/test/candidates/consent-adversarial.test.ts`: cuerpos prohibidos, ID inválido o inexistente, fallo en el
   recálculo (BD y puerto), concurrencia retirar/renovar, 500 sin datos y la guarda DEC-12 sobre las rutas nuevas.

Si un caso destapa un fallo de producción, se arregla en `apps/api/src/modules/candidates/` (como mucho 2 ciclos).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/candidates/list-adversarial.test.ts` | crear | CA-20, EC-27, EC-33 |
| `apps/api/test/candidates/consent-adversarial.test.ts` | crear | CA-29, CA-30, EC-42, EC-45, EC-46, EC-48, EC-53, EC-56, DEC-12 |
| `apps/api/src/modules/candidates/{schemas,service,routes}.ts` | modificar solo si un caso falla | Arreglos que destape el test |

## Implementa
- RF: RF-04, RF-06, RF-07 · CA: CA-20, CA-29, CA-30 · Edge cases: EC-27, EC-33, EC-42, EC-45, EC-46, EC-48, EC-53
  (consentimiento), EC-56
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-27, EC-33, EC-42 a EC-48, EC-53, EC-56), § Threat
  modeling (Suplantación, Manipulación), § Estrategia de tests (CA-20, CA-30), § Checklist B-08

## Dependencias
- **Depende de:** TASK-04 (consentimiento), TASK-05 (listado)
- **Bloquea:** nada

## Criterios de done
- [ ] CA-20 / EC-27: `q` de 101 o con `\u0000`, `pageSize` 0 y 101, `page` 0 y `abc` → 400 en su parámetro; ni el
      `message` ni `details` contienen el texto de `q`. Un parámetro desconocido → `[{ field: 'querystring', message:
      'Hay campos no permitidos.' }]`, sin su nombre.
- [ ] CA-20: `q` de 100 → 200; `q=' OR 1=1 --` → 200 con 0 resultados.
- [ ] EC-33: `q=%` y `q=_` literales (solo coinciden nombres o emails que los contienen); `items` con 4 claves.
- [ ] EC-42: `POST …/consent` y `…/consent/withdrawal` con `{ consentGivenAt }` o `{}` → 400 `body` «Esta acción no
      admite cuerpo.»; ID `abc` → 400 en `id`; consentimiento y retención sin cambios.
- [ ] CA-29 / EC-48: ID inexistente en los dos `POST` → 404 sin datos.
- [ ] CA-30 / EC-45: `failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' })` → registrar y
      retirar dan 500 y **ni el consentimiento ni la retención cambian** (`ROLLBACK`).
- [ ] EC-53: `createProcessesStub({ fail: true })` → registrar da 500 y nada cambia.
- [ ] EC-56: los 500 van en el envelope, sin *stack trace* ni datos personales.
- [ ] EC-46: retirar y renovar en `Promise.all` → estado final de una de las dos y su retención = la de
      `computeRetentionEndsAt` para ese estado (INV-03).
- [ ] DEC-12: `POST …/consent/withdrawal` con `Sec-Fetch-Site: cross-site` → 403 `CROSS_SITE_REQUEST` y nada cambia.
- [ ] `npm test -w @ats/api -- candidates/list-adversarial candidates/consent-adversarial` en verde, con **2**
      ficheros.
- [ ] `npm test -w @ats/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/candidates/list-adversarial.test.ts apps/api/test/candidates/consent-adversarial.test.ts`
      (y los de producción que se toquen) sin errores.
- [ ] Commit único `test(api): adversarial candidate list and consent [HU-03 TASK-08]` nombrando los ficheros.

## Notas de implementación
- El trigger de EC-45 va sobre `UPDATE OF retention_ends_at`: deja pasar el `setConsent` y falla en el `setRetention`
  del recálculo, que es justo el punto entre las dos escrituras (diagrama de secuencia del TD-backend).
- Comprueba «nada cambia» con `GET /:id` antes y después y `toEqual` de la ficha completa.
- DEC-12 ya está probada en general en `apps/api/test/http/cross-site.test.ts`; aquí basta un caso propio de una ruta
  de candidatos (no se toca ese fichero).
- Datos inventados con `@example.com`; reloj con `createTestClock`.
