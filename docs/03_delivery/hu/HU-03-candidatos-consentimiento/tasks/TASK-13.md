# TASK-13 — Formulario de candidatos en la web frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (gate 4 de RF-01, RF-02 y RF-03 en la web)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Primera mitad de la fila W5 del TD-frontend (ver ROADMAP, «Ajustes respecto a los TD»): casos hostiles del formulario
de alta y edición, aparte de su camino feliz (TASK-11), en
`apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx`. Si un caso destapa un fallo, se arregla
en el fichero de `apps/web/src/features/candidates/` que corresponda (como mucho 2 ciclos).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx` | crear | CA-05 (web), EC-02, EC-07, EC-08, EC-17, EC-19, EC-25, EC-58, EC-59, 403, 413 |
| `apps/web/src/features/candidates/{candidate-form-model,candidate-form-errors,CandidateForm,CandidateFormScreen}.ts(x)` | modificar solo si un caso falla | Arreglos que destape el test |

## Implementa
- RF: RF-01, RF-02, RF-03 (web) · CA: CA-05 (web) · Edge cases: EC-02, EC-07, EC-08, EC-17 (> 2 000), EC-19, EC-25,
  EC-58, EC-59 · DEC-12 (403 en la web) · RNF-09 (formulario)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths (EC-02/EC-19/EC-59, EC-07, EC-08, EC-17, EC-25, EC-58, 403),
  § Threat modeling, § Estrategia de tests (RF-01 a RF-03 `[adversarial]`), § Checklist W5

## Dependencias
- **Depende de:** TASK-11
- **Bloquea:** nada

## Criterios de done
- [ ] CA-05 / EC-07: 409 con `existingId` → mensaje junto al email y enlace «Ver el candidato existente»; **ninguna
      petición** a `/api/candidates/{existingId}` hasta pulsar el enlace y ningún dato del existente en pantalla.
      Con `existingId` no válido (ausente, `0`, `"42"`) → mensaje sin enlace.
- [ ] EC-08: doble clic en «Guardar» → **un solo** `POST` (también en la edición, un solo `PATCH`).
- [ ] EC-58: NUL en el nombre, `\t` en una skill y `\u007F` en email o teléfono → error junto al campo sin petición; el
      resumen con salto de línea pasa.
- [ ] EC-02 / EC-19 / EC-59: el cuerpo del alta solo lleva claves de S2 y el de la edición solo de S4 (nunca `id`,
      fechas, versión, `retentionEndsAt` ni, en la edición, `consent`); un 400 con `field` que no es del formulario
      (`body`, `retentionEndsAt`) → en la alerta del formulario.
- [ ] EC-17: resumen de 2 001 → error junto al campo sin petición.
- [ ] 403 `CROSS_SITE_REQUEST` y 413 `PAYLOAD_TOO_LARGE` → alerta con su `message` y lo escrito conservado.
- [ ] EC-25 / RNF-09: en la edición, `document.title` es «Editar candidato · ATS» y no contiene el nombre; la URL solo
      lleva el ID.
- [ ] `npm test -w @ats/web -- CandidateFormScreen.adversarial` en verde, con **1** fichero de test.
- [ ] `npm test -w @ats/web -- candidates` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx` (y los de producción que se
      toquen) sin errores.
- [ ] Commit único `test(web): adversarial candidate form [HU-03 TASK-13]` nombrando los ficheros.

## Notas de implementación
- `mockFetch` (`apps/web/test/helpers/fetch.ts`) con URL exacta: una petición inesperada queda en `unmatched`, y así se
  comprueba «ninguna petición a `/api/candidates/{existingId}`».
- Doble clic: dos `user.click` seguidos sin esperar y `{ hang: true }` en la respuesta para que la primera siga en
  curso.
- Datos inventados con `@example.com`.
