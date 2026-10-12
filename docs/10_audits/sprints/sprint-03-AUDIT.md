# Auditoría del sprint-03

## Resumen
- **Fecha:** 2026-10-12 · **HU auditadas:** HU-07 (importar candidatos desde un CSV, FEAT-04, UC-20)
- **Rango auditado:** `790836c..3792b89` (`base` del frontmatter → cabeza de `vivo/C`, que hace de `main` en este
  sprint) · **Commit auditado:** `3792b89`
- **Commits:** 24 · **Ficheros tocados:** 80 (45 de `apps/` y `e2e/`, 4 461 líneas; el resto, docs)
- **Hallazgos confirmados:** críticos 0 · altos 0 · medios 5 · bajos 6 · info 6

**Pre-flight, anotado:**
- *«Estás en `main`»:* la solución de referencia de la feature en vivo C vive en `vivo/C` y no se integra en `main`
  (notas del sprint, decisión del responsable técnico del 2026-10-09). Se audita `vivo/C`.
- *«HU cerradas: las de estado `hecha`»:* el cuerpo del sprint seguía con HU-07 «en curso» aunque todos sus pasos
  estaban marcados, incluidos el merge (`0bd38ac`) y `/module-sync` (`ef730fc`). Se reconcilia en este mismo commit
  (cabecera `estado: hecha` y «hechas 1 / 1»), como estaba el sprint-01 al auditarse. El `estado:` de `hu.md` lo pone
  `/cerrar-sprint`. Es el hallazgo DD-04.
- Todos los commits del rango mapean a FEAT-04, HU-07 o sus pasos; ninguno está fuera de alcance.

## 1. Suite completa

`npm run integrate` (en serie, Node 24.21.0) sobre el árbol de `3792b89`:

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | verde | 3,2 s |
| `npm run lint` | verde | 3,0 s |
| `npm test` | verde | API 1 193 tests en 88 ficheros (15,9 s) · web 860 tests en 65 ficheros (12,2 s) |
| `npm run e2e` | verde | 49 tests en Chromium (34,4 s) |
| `npm run check:harness` | verde | 3,3 s; aviso de los 2 marcadores de publicación pendientes, a propósito |

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,2
lint           verde            3,0
test-api       verde           15,9
test-web       verde           12,2
e2e            verde           34,4
check-harness  verde            3,3
-----------------------------------
Total                          72,0
✔ Integración en verde.
 Test Files  88 passed (88)
      Tests  1193 passed (1193)
 Test Files  65 passed (65)
      Tests  860 passed (860)
  49 passed (33.9s)
  ⚠ publicación: quedan 2 marcadores (los revisa check-clean --publish)
```

Sin fallos, ni atribuibles ni previos. Frente a la base: API 78 → 88 ficheros (1 097 → 1 193 tests), web 59 → 65
(762 → 860), e2e 47 → 49.

**SUITE_VERDICT: VERDE**

## 2. Dimensión código

### Revisión de calidad de la sesión (sobre el agregado)
- **Líneas por fichero ≤ 300:** ninguno de los 45 ficheros añadidos o modificados en `apps/` y `e2e/` pasa de 300. El
  más largo es `apps/web/test/features/candidates/CandidateImportScreen.adversarial.test.tsx`, con 298.
- **Complejidad ≤ 10:** `npx eslint --rule 'complexity: [error, 10]'` sobre los ficheros `src` del diff: 0 errores.
- **Líneas por función ≤ 50:** `npm run lint` en verde con la regla del proyecto, que no cuenta líneas en blanco ni
  comentarios (`eslint.config.js:41`).
- **Interacciones entre HU:** el sprint tiene una sola HU. Lo transversal es `error-handler.ts` (413 por ruta,
  `toValidationDetails`), `existingIdOnDuplicate` (alta y edición) y `postBytes` y `ErrorMessage` en la web. Los
  auditores de D2 lo revisaron (§3) y lo cubren los tests de alta y edición, que siguen en verde.
- **Duplicación entre módulos:** ninguna. La importación reutiliza el esquema, la normalización y la retención del alta.
- **Deuda nueva sin registrar:** ninguna en código. SEC-01 y DP-02 de la review de HU-07 están en la tabla de deuda de
  `docs/05_modules/candidatos/technical.md`.

### doc-code-drift-checker (VERDICT del auditor: HALLAZGOS)
La sesión comprobó cada medio contra el fichero y el código.

| ID | Sev. | Dónde | Evidencia | Propuesta |
|---|---|---|---|---|
| DD-01 | medio | `docs/ARCHITECTURE.md:105` | Cita `apps/api/src/modules/candidates/service.ts:84` como ejemplo de `requireX`. En `790836c` la línea 84 era `requireCandidate`; tras HU-07 está en la 92 y la 84 es `mergeFields`. La cita la desplazó el sprint | Actualizar la cita |
| DD-02 | medio | `docs/05_modules/candidatos/technical.md:288` | La deuda DP-02 cita `error-handler.ts:21`, pero el `request.log.error({ err: error }, …)` está en la línea 23. Viene de `review/REVIEW.md:40,136` de HU-07, que no se toca porque es un registro histórico | Corregir la cita del módulo |
| DD-03 | medio | `docs/05_modules/candidatos/technical.md:187-190` | Entre quienes llaman a `recalculateRetention` faltan la importación (`service.ts:199`) y su llamada por fila (`import.ts:87`) | Añadir `importCsv` |
| DD-04 | medio | `docs/01_roadmap/sprints/sprint-03.md:21,26` | HU-07 seguía «en curso», con el merge y `/module-sync` hechos | **Curado** en el commit de esta auditoría (pre-flight) |
| DD-05 | bajo | `technical.md:33` | `import-fixtures.ts` aparece dentro de la lista de `apps/web/test/helpers/`, pero está en `apps/web/test/features/candidates/` | Corregir la ruta |
| DD-06 | bajo | `technical.md:106-107,234-237` | «Mismos mensajes que el alta» tiene una excepción, el nombre vacío («Es obligatorio.»), que solo recoge `import-contract.test.ts:120-123` | Anotar la excepción |
| DD-07 | bajo | `technical.md:285` | La deuda del `SELECT *` de `recalculateRetention` no menciona la importación: 2 lecturas por fila creada, hasta 500 | Añadir la importación |

Info: DD-08 (FEAT-04 e IDEA-004 se cierran en `/cerrar-sprint`, como corresponde), DD-09 (UC-20 y `functional.md` no
recogen RN-16, «valores tal cual», que sí cubre el test EC-26) y DD-10 (`ARCHITECTURE.md` y `_modules.md` no mencionan
DEC-13; nada de lo que dicen es falso).

Sin drift en: estados y recuentos (UC-20 implementado, 6/6, 100 %), las 12 citas `fichero:línea` de la trazabilidad de
UC-20, las rutas de `technical.md`, el mecanismo descrito de la API y la web, DEC-13 con sus aclaraciones, los enlaces
relativos y `docs/_modules.md`.

## 3. Dimensión seguridad y datos personales

### security-auditor (VERDICT del auditor: OK)
0 críticos, 0 altos, 0 medios, 0 bajos, 3 info.
- **SEC-S03-01 · info.** `existingIdOnDuplicate` permite saber si un email existe y obtener su ID en el alta, la edición
  y la importación (hasta 500 por petición). Sin login (DEC-04), y el listado ya filtra por email: no abre nada nuevo.
- **SEC-S03-02 · info.** `import-routes.ts:30-36` no declara `schema.body`, coherente con un cuerpo crudo: lo acotan
  `bodyLimit` y el Ajv estricto de cada fila.
- **SEC-S03-03 · info, previo al sprint.** La guarda de DEC-12 se apoya en `Sec-Fetch-Site` sin validar `Host`. Un DNS
  rebinding contra `127.0.0.1:3001` la saltaría. Es el modelo de amenazas de DEC-12: la API solo escucha en loopback.

Comprobado a escala de sprint, sin hallazgos:
- **Plugin hijo:** `removeAllContentTypeParsers` y el parser `text/csv` no se filtran al padre; las rutas antiguas siguen
  en 415 con `text/csv` (`import-adversarial.test.ts:196`).
- **DEC-12:** el hook `onRequest` de la raíz cubre `/import` antes de leer el cuerpo; un cross-site con un cuerpo enorme
  recibe 403, no 413.
- **413 por ruta:** el texto sale de la configuración de la ruta, nunca del input.
- **`toValidationDetails`:** no nombra claves ajenas.
- **SQL:** parametrizado en `writeUniqueEmail`.
- **Web:** en `postBytes`, `ErrorMessage` y el enlace «Ver candidato» (`rel="noopener noreferrer"`), sin `innerHTML` ni
  datos en `localStorage`.

### datos-personales-auditor (VERDICT del auditor: HALLAZGOS)

| ID | Sev. | Dónde | Evidencia | Propuesta |
|---|---|---|---|---|
| DP-S3-01 | medio | `docs/05_modules/candidatos/functional.md:43-46,103-104` | Cada fichero puede dejar hasta 500 fichas sin consentimiento ni inscripción, con retención de alta + 6 meses. Sin la feature A, nada las anonimiza al vencer. El módulo documenta el hueco de los vencidos, pero no que la importación lo multiplica. Comprobado por la sesión: `import.ts:75-88` recalcula por fila y «Cuestiones abiertas» no lo enlaza | Una línea en «Cuestiones abiertas» que enlace la importación con la feature A, con dueño en su backlog |
| DP-S3-02 | bajo | `technical.md:189` | El mismo hallazgo que DD-03 | Con DD-03 |
| DP-S3-03 | bajo | `technical.md:288` | El mismo hallazgo que DD-02 | Con DD-02 |
| DP-S3-04 | bajo | `technical.md:77-85,195` | El inventario no dice qué campos llena una ficha importada: `fullName`, `email` y `phone`, con `summary` a `null` y `skills` a `[]` (`import.ts:58-62`) | Anotarlo |

Comprobado sin hallazgos:
- **Inventario y retención:** los importados entran sin consentimiento, con alta + 6 meses y sin origen.
- **Alta y edición:** el 409 sigue devolviendo solo el ID.
- **500 transversal:** no expone datos en ninguna ruta.
- **Tests:** P8 con datos inventados.
- **Nada a disco:** P9 se comprueba en `os.tmpdir()` y en `data/`.

Info: DP-02 de HU-07 sigue siendo un riesgo latente (ningún test de 500 usa un error no SQLite con datos); ya está en
la deuda.

**Sin decidir en `docs/RGPD.md`** (para la persona responsable; no son hallazgos del código):
1. La base jurídica del candidato importado sin inscripción ni consentimiento.
2. El art. 14 y el origen del dato: hoy figura solo en UC-20 y en `functional.md` como supuesto didáctico (PA-05).
3. Qué hacer al reimportar a alguien anonimizado cuando exista la feature A.
4. El `existingId` del duplicado y del 409, que `RGPD.md` §6.1 no recoge.

## 4. Dimensiones no concluidas
Ninguna. Los tres informes llegaron completos, con `<<FIN-INFORME>>`.

## 5. Override
No aplica.

## 6. Acciones
- [x] DD-04: reconciliar el estado de HU-07 en el cuerpo del sprint (en el commit de esta auditoría).
- [ ] DD-01, DD-02 y DP-S3-03, DD-03 y DP-S3-02, DD-05, DD-06, DD-07, DP-S3-01, DP-S3-04 y DD-09: corregir los docs
      del módulo `candidatos`, `docs/ARCHITECTURE.md` y UC-20 antes de `/cerrar-sprint`. Solo documentación: no toca
      `apps/` ni `e2e/`, así que no hace falta reauditar.
- [ ] «Sin decidir en `docs/RGPD.md`» 1 a 4: a la persona responsable, junto con la ratificación de PA-01 a PA-05.
- [ ] Deuda heredada sin cambios: SEC-01 y DP-02 de HU-07.

VERDICT: Aprobado con observaciones
