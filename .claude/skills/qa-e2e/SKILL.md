---
name: qa-e2e
description: QA end-to-end de un sprint contra la app local (npm run dev), como lo haría una persona en el navegador. Recoge evidencia de cada fallo sin diagnosticarlo y deja un informe HTML con VERDICT.
argument-hint: NN
---

# qa-e2e

Verificación viva del incremento de un sprint, **en local**, hecha como la haría una persona de QA usando el ATS en el navegador. A diferencia de `/reviewer` (código frente a PRD) y `/audit-sprint` (diff del sprint), aquí se **reproduce el uso real** y, cuando algo falla, se **recoge evidencia** para demostrarlo, **sin suponer la causa**.

No es un gate de cierre (eso es `/audit-sprint`): es una herramienta que se lanza cuando se quiere confirmar que lo entregado funciona de verdad.

## Doctrina

- **La web es el camino principal.** Cada criterio se ejercita como lo haría el reclutador: abrir la página, navegar, rellenar, pulsar y mirar la pantalla. La API directa solo para criterios sin pantalla.
- **Probar y mostrar, no diagnosticar.** Un FAIL describe el síntoma observable con evidencia («publicar la oferta devuelve 500 y la lista no cambia»), nunca la línea culpable ni el arreglo.
- **Caja negra.** Los escenarios salen del comportamiento esperado (`hu.md`, PRD) y los contratos, del PRD y del TECHNICAL_DOC; no se lee el código de implementación.
- **Derivar, no inventar.** Si un criterio no se puede ejercitar de punta a punta, va a «No ejercitado» con el test que lo cubre; no se falsea un PASS.
- **Honestidad de bloqueo.** Si falta un dato previo que no se puede preparar, el escenario es **BLOCKED** con la lista exacta de lo que falta.
- **Datos inventados** y creados por la propia corrida; nunca datos de personas reales.

## Entrada

`/qa-e2e NN` (número de sprint). Sin número, pregunta cuál. No hay credenciales: el ATS no tiene login (`DEC-04`).

## Fase 0 — Alcance

1. Lee `docs/01_roadmap/sprints/sprint-NN.md`: objetivo y HU.
2. Para cada HU, su carpeta (`docs/03_delivery/hu/HU-NN-slug/` o en `completadas/`): `hu.md`, `specs/PRD.md` y, si existe, `review/REVIEW.md`.
3. Clasifica cada criterio de aceptación: **UI** (tiene pantalla), **API** (sin pantalla) o **No e2e** (lo cubre un test unitario; va a la sección 6 del informe).
4. Para cada escenario: pasos del usuario, datos previos, si escribe y qué se espera en pantalla, en HTTP y en SQLite.
5. Enseña la tabla de escenarios y **pide OK** antes de ejecutar.

## Fase 1 — Preflight local

Registra cada resultado en la sección 2 del informe:
- La app está levantada: `GET http://127.0.0.1:3001/api/health` responde `{ "status": "ok" }` y `http://127.0.0.1:5173` carga. Si no, pide a la persona que ejecute `npm run dev` en otra terminal (o arráncalo en segundo plano) y repite.
- Rama y commit: `git rev-parse --abbrev-ref HEAD` y `git log -1 --oneline`. Debe ser `main` con el sprint mezclado; si no, avísalo.
- Datos de partida: por defecto se usan los del seed. Para empezar desde cero, `npm run db:reset` **solo con confirmación** (borra los datos locales).
- Navegador: Chromium de Playwright instalado (`npm run check:env` lo comprueba; con la app levantada, el aviso de puertos ocupados es esperado).
- Carpeta de trabajo de la corrida: `test-results/qa-e2e/` (ignorada por git): scripts temporales y capturas.

## Fase 2 — Ejecución (subagente `qa-e2e-runner`)

Por cada escenario aprobado, lanza `qa-e2e-runner` con: el criterio, los pasos del usuario, el resultado esperado, las URL locales, la carpeta de trabajo y los datos que puede crear. Lánzalos **de dos en dos como máximo**, y los que escriben sobre los mismos datos, de uno en uno (comparten la misma base SQLite).

El runner abre `http://127.0.0.1:5173` en Chromium con Playwright (el de `node_modules` del repo), ejecuta los pasos y deja **siempre una captura del estado final**, tanto si pasa como si falla. Cuando algo falla, añade la evidencia:
1. **UI:** capturas de cada paso y del fallo.
2. **HTTP:** la request y la response que dispara la pantalla (método, ruta, estado, cuerpo de error, latencia).
3. **SQLite:** el estado persistido, con una consulta **de solo lectura**:
   ```bash
   node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('data/ats.db', { readOnly: true }); console.log(db.prepare('SELECT id, stage FROM applications WHERE id = ?').all(42));"
   ```
   (tablas y columnas, las del TECHNICAL_DOC de la HU).
4. **Log de la API:** las líneas de la terminal de `npm run dev` en la ventana del fallo, si la persona las comparte.

Cada runner devuelve su bloque de escenario: `PASS`, `FAIL` o `BLOCKED` con la evidencia. Si un runner muere, reintenta una vez; si vuelve a fallar, `BLOCKED`.

## Fase 3 — Limpieza y consolidación

1. Borra por la API lo que haya creado la corrida (si existe la operación) o anótalo como residuo en la sección 5. Nunca borres datos que no creó esta corrida. Alternativa con confirmación: `npm run db:reset`.
2. Veredicto global: **PASS** si todos los escenarios pasan; **FAIL** si falla al menos uno; **BLOCKED** si el preflight falla o ningún escenario se pudo ejecutar.

## Fase 4 — Informe HTML

1. Carpeta de la corrida: `docs/10_audits/qa/sprint-NN-AAAA-MM-DD/` (fecha de hoy; si ya existe, sufijo `-2`, `-3`…).
2. Copia las capturas relevantes como `E{i}-{n}.png`.
3. Copia `docs/_templates/QA-E2E-REPORT.template.html` a `index.html` dentro de esa carpeta y rellena **todos** los marcadores con datos reales: resumen (tiles y tabla de HU), preflight, alcance, un bloque por escenario (pasos, HTTP con latencia, estado de SQLite, captura `<img src="./E{i}-{n}.png">`), limpieza, no ejercitado, hallazgos y anexos. Quita las capas que no apliquen a un escenario (p. ej. la de UI en uno de API).
4. Deja la línea final:
   ```
   VERDICT: PASS | FAIL | BLOCKED — {n} PASS / {f} FAIL / {b} BLOCKED sobre {N} escenarios
   ```
   con un solo literal (PASS, FAIL o BLOCKED) delante del guion.
5. Devuelve: ruta del `index.html`, veredicto, titular y hallazgos. Sugiere seguimientos (una idea con `/anadir-idea`, reabrir una HU) **sin crearlos**.

## Reglas

- Solo contra local; nunca contra otro entorno.
- Nada de leer el código para buscar la causa: eso es de `/reviewer` y de quien implementa.
- Consultas a SQLite siempre de solo lectura; los cambios de datos, por la UI o la API, como el usuario.
- Ningún escenario se entrega sin captura.
- Un FAIL aquí puede cazar un verde falso de la review: se reporta tal cual.

## Cuándo no eres tú

- Revisar código de una HU: `/reviewer`. Auditar el sprint antes de cerrarlo: `/audit-sprint`. Cerrar: `/cerrar-sprint`.
