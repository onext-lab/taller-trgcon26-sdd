# Review — HU-07 Importar candidatos desde un CSV

## 1. Resumen ejecutivo
La importación CSV de candidatos (UC-20, feature en vivo C, rama `vivo/C`) cumple el PRD v1.3 y los dos TECHNICAL_DOC:
los 10 criterios de `hu.md`, los 19 CA, los 8 flujos de UC-20 y los 43 edge cases con comportamiento tienen test, y la
integración completa está en verde. La ronda 1 encontró, antes del veredicto, un edge case de RF Must cubierto solo en
su efecto (EC-30), una función nueva por encima del umbral de complejidad, una laguna del test de «nada a disco»
(`data/`) y dos contradicciones de documentación que dejó la introducción de DT-08 (EC-08 del PRD y un criterio de
`hu.md`). Todo se curó en esta misma ronda (`db8d59a`) y se volvió a integrar. Las tres mutaciones pedidas por el
responsable técnico (M1, M2 y M3) las tumban los tests previstos. Quedan observaciones de severidad baja y las cinco
respuestas de producto pendientes de ratificar por la persona responsable.

## 2. Veredicto
**Aprobado con observaciones.** Ningún gate crítico abierto tras el curado; quedan observaciones bajas (§9).

## 3. Decisiones aplicables
| DEC | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | Fastify con JSON Schema por ruta; sin librerías nuevas | Sí: la ruta declara `schema.response` con `additionalProperties: false`; sin dependencias nuevas |
| DEC-03 | Sin migración | Sí: no hay migración ni `.db` en git |
| DEC-04 | Rol único, sin login | Sí |
| DEC-06 | Fronteras entre módulos y transacciones | Sí: todo en `candidates`; una sola transacción para las filas válidas (`apps/api/src/modules/candidates/import.ts`) |
| DEC-07 (aclaración 2026-10-12) | 200 con informe, también con 0 creados | Sí |
| DEC-08 (aclaración 2026-10-12) | En un lote, el choque del índice es una fila «duplicado» | Sí: `existingIdOnDuplicate` tras el `UNIQUE`, sin `SELECT` previo |
| DEC-11 (y 11.4 aclarada) | Envelope, `details` del fichero `[{ field: 'file' }]`, sin controles | Sí |
| DEC-12 | 403 entre sitios | Sí: la guarda `onRequest` se hereda en el plugin hijo (test EC-06) |
| DEC-13 | Cuerpo crudo `text/csv` en un plugin aislado con `bodyLimit` 1 048 576 | Sí: `apps/api/src/modules/candidates/import-routes.ts`; 415 para el resto de tipos y `text/csv` sigue en 415 fuera de la ruta |

## 4. Hallazgos por auditor
### security-auditor
0 críticos, 0 altos, 0 medios, 1 bajo (VERDICT del auditor: HALLAZGOS).
- **SEC-01 · bajo** — `apps/api/src/modules/candidates/csv.ts:38-46`: `parseCsv` sigue contando registros después de
  `maxKept`; coste lineal y acotado por el límite de 1 MiB. **Observación** (no se cura).
- INF-01 (informativo): fórmulas CSV guardadas tal cual, riesgo aceptado por RN-16 para una exportación futura.

### datos-personales-auditor
0 críticos, 0 altos, 0 medios, 2 bajos (VERDICT del auditor: HALLAZGOS).
- **DP-01 · bajo** — el test de «nada a disco» no miraba `data/` (RNF-03, CA-17). **Curado** en `db8d59a`:
  `apps/api/test/candidates/import-privacy-disk.test.ts`.
- **DP-02 · bajo** — `apps/api/src/http/error-handler.ts:21`: el 500 registra el objeto de error entero; hoy sin datos
  personales (lo comprueba `import-privacy.test.ts`), riesgo latente. **Observación.**
- «Sin decidir en RGPD.md» (escalado a la persona responsable, no son hallazgos del código): base jurídica del
  importado sin inscripción ni consentimiento y art. 14 (PA-05, pendiente de ratificar); reimportar a alguien
  anonimizado cuando exista la feature A; el `existingId` del duplicado, mismo supuesto que el 409 del alta.

### doc-code-drift-checker
0 críticos, 2 altos, 2 medios, 5 bajos (VERDICT del auditor: HALLAZGOS). Confirmados por la sesión y **curados** en
`db8d59a`:
- **DD-01 · alto** — `specs/PRD.md` EC-08 contradecía DT-08 (el «;» da el mensaje del separador, no el de cabecera).
- **DD-02 · alto** — `hu.md` decía lo mismo en un criterio; y OQ-03 del PRD, en su recomendación.
- **DD-03 · medio** — `tasks/ROADMAP.md` decía que el TD-frontend no estaba alineado con DT-08 (lo estaba desde `ddcfc8b`).
- **DD-04 · medio** — `tasks/ROADMAP.md` dejaba como pendiente la decisión de partir `import.test.ts`.
- **DD-05 a DD-08 · bajos** — tests en hermanos, `useImportActions(refs)` y `hasFile`, `ArrayBuffer` frente a
  `body: file` en DEC-13 y en el TD-backend, PRD v1.1 citado, orden de DT-03 y frase repetida en DT-05: notas de la
  review en los dos TD, DEC-13 corregida y PRD ajustado.
- **DD-09 · bajo** — referencias de línea anteriores al cambio en los TD (**observación**, anotada en la nota del
  TD-backend) y criterios de done de las tareas sin marcar (**curado**: marcados; la evidencia está en los briefs §7).

### Revisión de calidad de la sesión
- **C-01 · medio** — `apps/api/src/http/error-handler.ts:38`: `toAppError` pasó de complejidad ≤ 10 a 11 con el texto
  del 413 por ruta. **Curado** en `db8d59a` (el texto se resuelve en el manejador; complejidad 10).

## 5. Criterio → test
Tabla completa (10 criterios de `hu.md`, CA-01 a CA-19 y EC-01 a EC-50) elaborada en la ronda 1, leyendo los tests:
**0 huérfanos.** Un parcial, **EC-30** (RF-04 Must: falla la lectura de los emails existentes), cubierto solo en su
efecto por otra ruta de fallo; **curado** con el test «EC-30 falla la lectura del existente tras el choque del índice
→ 500 y 0 creados» (`apps/api/test/candidates/import-failures-adversarial.test.ts`). Los N/A del PRD (EC-14, 23, 24, 35,
42, 44 y 45) llevan su motivo en el PRD.

| UC · flujo | CA | Test principal | Estado |
|---|---|---|---|
| UC-20 · P | CA-01, CA-02, CA-03, CA-17 | `apps/api/test/candidates/import.test.ts:57` · `e2e/candidates-import.spec.ts:77` | Cubierto |
| UC-20 · A1 | CA-04, CA-05, CA-06, CA-18 | `apps/api/test/candidates/import.test.ts:101` · `apps/web/test/features/candidates/CandidateImportScreen.test.tsx:115` | Cubierto |
| UC-20 · A2 | CA-07 | `apps/api/test/candidates/import.test.ts:196` | Cubierto |
| UC-20 · A3 | CA-08, CA-09, CA-10 | `apps/api/test/candidates/import-rows.test.ts:51` | Cubierto |
| UC-20 · E1 | CA-11, CA-12, CA-17, CA-19 | `apps/api/test/candidates/import-adversarial.test.ts:70` · `e2e/candidates-import.spec.ts:126` | Cubierto |
| UC-20 · E2 | CA-13, CA-17 | `apps/api/test/candidates/import-adversarial.test.ts:104` | Cubierto |
| UC-20 · E3 | CA-14, CA-17 | `apps/api/test/candidates/import-adversarial.test.ts:121` | Cubierto |
| UC-20 · E4 | CA-15, CA-16, CA-17 | `apps/api/test/candidates/import-failures-adversarial.test.ts:85` · `apps/web/test/features/candidates/CandidateImportScreen.errors.test.tsx:105` | Cubierto |

La columna «Test» de la Trazabilidad de UC-20 está rellena con esta tabla.

**Prueba de mutación** (pedida por el responsable técnico; sobre `8b0bf31`, cada mutación aplicada a mano y revertida con
`git checkout --`, en serie, sin ningún builder trabajando):

| Mutación | Tests que fallan |
|---|---|
| M1 · una fila cuyo email ya existe crea igualmente un registro (`import.ts`, `insertRow`: reinsertar con el email alterado) | 10: CA-04 ×2, CA-05, CA-06/EC-31, EC-31, EC-34, CA-15, EC-17/27, EC-43/46, RNF-04/EC-33/EC-47 |
| M2 · quitar la guarda de 500 filas (`import-file.ts`) | 3: CA-14 ×2 y «500 y 500 + 30 blancos pasan; 501 no» |
| M3 · aceptar cualquier `Content-Type` en la ruta (`import-routes.ts`: parser `*`) | 7: el `it.each` «415 con un CSV válido como cuerpo» entero |

## 6. Gates de QUALITY-GATES
| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | Máx. `apps/web/test/features/candidates/CandidateImportScreen.adversarial.test.tsx` 298; `src` máx. `apps/web/src/components/http.ts` 194 | Sí |
| Líneas por función ≤ 50 | `npm run lint` (`max-lines-per-function` sobre `apps/*/src`) en verde | Sí |
| Complejidad ≤ 10 | `npx eslint --rule 'complexity: [error, 10]'` sobre el diff de `src`: 0 errores (tras el curado de C-01) | Sí |
| 1 test por RF, flujo y EC Must | 7/7 RF, 8/8 flujos, 43/43 EC con comportamiento | Sí |
| Tasks por HU ≤ 15 | 9 | Sí |
| typecheck, lint, test, e2e, check:harness | En verde (§7) | Sí |

## 7. Integración
Ejecutada por la review sobre el árbol de `db8d59a` (con el curado), con Node 24.21.0 y en serie (`npm run integrate`):

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,0
lint           verde            2,7
test-api       verde            5,8
test-web       verde            8,0
e2e            verde           26,1
check-harness  verde            2,2
-----------------------------------
Total                          47,8
✔ Integración en verde.
 Test Files  88 passed (88)
      Tests  1193 passed (1193)
 Test Files  65 passed (65)
      Tests  860 passed (860)
  49 passed (25.8s)
```

## 8. Limitaciones
- Sin Safari, Windows ni Linux; RNF-01 medido en el portátil de la sesión (55 ms para 500 filas con 1 000 candidatos).
- CA-06 y EC-31 corren con `Promise.all` sobre una conexión síncrona: se ejercita la vía UNIQUE → «duplicado», sin
  entrelazado real de hilos.
- EC-16 (50 MiB) se simula con la cabecera `content-length`, no con un cuerpo real.
- Los auditores trabajaron sobre el árbol final, sin ejecutar `git diff`; la sesión cubrió el contraste con la
  integración por tarea y la de esta review.

## 9. Acciones requeridas
Ninguna bloqueante. Observaciones para el backlog o para antes de publicar:
1. **SEC-01** — salida anticipada de `parseCsv` al pasar de `maxKept` (`apps/api/src/modules/candidates/csv.ts:38-46`).
2. **DP-02** — registrar solo `code`, `message` y `errcode` en el 500 (`apps/api/src/http/error-handler.ts:21`), o un
   test con un error no SQLite en la importación.
3. **PA-01 a PA-05** — ratificación de la persona responsable; si cambia alguna, se ajusta lo afectado.

Ronda: 1 · «Requiere cambios» previos: 0

VERDICT: Aprobado con observaciones
