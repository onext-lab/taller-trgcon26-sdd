# TASK-05 — Datos personales y minimización en el cierre, la previa y el 409 posterior [adversarial]

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** test (backend)
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02, RF-04); Should (RF-06)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Seguridad y privacidad del cierre con el puerto real (RNF-03, RNF-04). **Sin código de producción**: si un test
destapa una fuga, se arregla dentro de esta tarea (techo de 2 ciclos) y se avisa.

Crea `apps/api/test/applications/close-reject-privacy.test.ts`. La app se compone con `buildApp({ db, now, logger: {
...loggerOptions, stream } })` sobre `:memory:` migrada, con el log capturado en un `Writable` que guarda cada línea,
como `apps/api/test/applications/privacy-logs.test.ts:69-80` (`createTestApp` no admite `logger`). Sin
`jobApplications`: puerto real.

Datos marcados e inventados para buscarlos en la salida: un candidato con `fullName` «Marcador Privacidad», email
`marcador.privacidad@example.com` y teléfono `+34 600 000 042`, inscrito y activo en la oferta que se cierra.

Los fallos de CA-11 se provocan con `failWrites` **sin** `whenNew` (fallo en la primera escritura de cada tipo),
instalado **después** de preparar los datos: así esta tarea no depende de TASK-04 y puede ir en paralelo.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/close-reject-privacy.test.ts` | crear | CA-11/EC-06 con log capturado en 3 puntos de fallo; EC-13, EC-24, RNF-04 |

## Implementa
- RF: RF-01 (seguridad, EC-06), RF-02 (seguridad, EC-13), RF-04 (seguridad, EC-24), RF-06 (test de datos personales)
  · RNF-03, RNF-04 · CA-11
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Datos personales, § Threat modeling (exposición de datos), § Error paths
  (EC-06, EC-13, EC-24), § Estrategia de tests (`close-reject-privacy.test.ts`), § Checklist 5

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- applications/close-reject-privacy` en verde con **1** fichero y estos tests:
  - `CA-11 fallo en %s: ni el 500 ni el log llevan nombre, email ni teléfono` (`it.each` sobre `UPDATE` de
    `applications`, `INSERT` de `stage_changes` y `UPDATE OF retention_ends_at` de `candidates`): 500 con el envelope
    `INTERNAL_ERROR` exacto; **el log no está vacío** (hay al menos la línea del error, para que el test no sea vacuo) y
    ni el cuerpo ni ninguna línea contienen el nombre, el email ni el teléfono marcados.
  - `EC-13 previa con 1 clave y 404 sin datos`: `Object.keys` de la previa = `['activeApplications']`; previa de
    `999999` → 404 con el envelope exacto «La oferta no existe.» y sin marcadores.
  - `EC-24 409 tras el cierre sin datos; reject con job_closed → 400`: tras cerrar, avanzar la inscripción del
    candidato marcado con la etapa esperada anterior → 409 `STAGE_MISMATCH` con el envelope exacto y sin marcadores;
    `POST /api/applications/:id/reject` con `reason: 'job_closed'` → 400 `VALIDATION_ERROR`.
  - `RNF-04 POST /close con las claves del Job`: las claves de la respuesta del cierre son las del `Job` de HU-02 (las
    mismas que `GET /api/jobs/:id`), sin campos nuevos ni el número de rechazadas, y el cuerpo no contiene marcadores.
- [ ] `npm test -w apps/api -- applications/privacy-logs applications/close-reject-privacy` en verde (mismo patrón de
      captura sin romper el existente).
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función nueva de 50 (`wc -l` tras Prettier).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/close-reject-privacy.test.ts` sin errores.
- [ ] Commit único `test(api): personal data and minimisation on job close [HU-06 TASK-05]` con el fichero.

## Notas de implementación
- `loggerOptions` (`apps/api/src/logger.ts`) ya quita cuerpo y query del log: el test lo comprueba, no lo cambia.
- Los errores de `job-closing.ts` son textos fijos (TASK-01) y los de SQLite no llevan valores: si un marcador aparece,
  es una fuga real; para y avisa antes de tocar `src/`.
- Busca los marcadores con `includes` sobre el cuerpo crudo (`response.body`) y sobre cada línea del log; el teléfono,
  también sin espacios (`600000042`).
- Datos inventados (RGPD §6.3): nada de nombres ni emails reales.
