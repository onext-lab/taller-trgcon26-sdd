# TASK-03 — Tras el cierre: DT-01, invariantes de INV-05 y aclaración de DEC-06

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** backend (tests y documentación de arquitectura)
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-03, RF-04); Should (RF-06, DEC-06)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Aplica DT-01 (se mantiene DT-09 de HU-05: avanzar y rechazar **no** miran el estado de la oferta) y fija INV-05 con
dos tests de invariante. **Sin código de producción.** Cuatro piezas:

1. **Renombrar tres tests (CA-13), sin tocar su cuerpo.** `advance.test.ts` y `reject.test.ts` están en **300
   líneas** y deben seguir en 300: solo cambia el texto del `it` (Prettier lo deja en una línea).
   - `apps/api/test/applications/advance.test.ts:283` → `CA-13/EC-23 defensa en profundidad: activa en una closed
     creada por SQL (inalcanzable por la API) → advance 200 y StageChange interview → offer`
   - `apps/api/test/applications/reject.test.ts:265` → `CA-13/EC-23 defensa en profundidad: activa en una closed
     creada por SQL (inalcanzable por la API) → reject 200 y StageChange interview → rejected`
   - `apps/api/test/applications/reject.test.ts:287` → `CA-13 DT-01 (mantiene DT-09) ni advance ni reject llaman al
     puerto de estado: espía sin llamadas`
2. **`apps/api/test/applications/stage-change-after-close.test.ts`** (nuevo), con el puerto real: CA-07, EC-21,
   EC-22 en los dos órdenes y EC-25.
3. **`apps/api/test/applications/close-invariants.test.ts`** (nuevo): CA-15 y CA-16 con **una misma consulta**:
   ```sql
   SELECT COUNT(*) AS open FROM applications a JOIN job_openings j ON j.id = a.job_id
   WHERE j.status = 'closed' AND a.stage NOT IN ('hired', 'rejected')
   ```
   más una comprobación de no vacuidad (≥ 1 oferta `closed` con inscripciones). CA-15 ejecuta **el script real** de
   `npm run db:reset` sobre un fichero temporal (DD-08): `mkdtempSync(join(os.tmpdir(), …))`,
   `execFileSync(process.execPath, ['src/db/reset.ts'], { cwd: <apps/api>, env: { ...process.env, ATS_DB_PATH:
   <tmp>/ats.db } })`, abrir esa base con `openDatabase`, cerrarla y `rmSync(tmp, { recursive: true, force: true })` en
   `afterAll`. **Nunca** toca `data/ats.db`.
4. **Documentación de arquitectura** (DT-04; texto literal del TD-backend, § Impacto en decisiones):
   - `docs/07_architecture_principles/DECISIONS.md`, DEC-06: **sustituir las líneas 93-101** (viñetas «Una lectura de
     otro módulo…» y «Dirección de dependencias…») por el texto de abajo, con la sangría de la lista de «Decisión» (dos
     espacios por nivel). La viñeta de las claves foráneas (línea 102 en adelante) se queda detrás, igual.
   - Misma DEC-06, línea **Estado** (113): queda exactamente así:
     `- **Estado.** Aceptada (2026-10-06); ampliada con el puerto «estado de la oferta» en la revisión de paso-1; aclarada en el diseño de HU-04 (claves foráneas entre módulos; ningún módulo importa a otro); aclarada en el diseño de HU-06 (tercer puerto, `JobApplicationsPort`, sin cambiar la decisión).`
   - `docs/ARCHITECTURE.md:24`: sustituir «`jobApplications` (de `jobs` hacia `inscripciones`) sigue con su stub hasta
     HU-06; `candidateProcesses` y `jobStatus` usan por defecto los lectores reales y solo se inyectan en tests» por
     «los tres usan por defecto las implementaciones reales (`jobApplications`, de `jobs` hacia `inscripciones`, desde
     HU-06) y solo se inyectan en tests». Sin línea de aclaración (cambio trivial).

   Texto literal para `DECISIONS.md` (sustituye 93-101):

   ```markdown
     - Una lectura de otro módulo va por un **puerto** (interfaz) que define el módulo que la necesita y que implementa el
       dueño de los datos. Hoy hay tres:
       - **Procesos del candidato:** lo define `candidatos` (fórmula de retención, S-06) y lo implementa `inscripciones`.
       - **Estado de la oferta:** lo define `inscripciones` (inscribir solo en `published`, RV-17 y UC-14 · E1; pipeline en
         solo lectura de una oferta `closed`, S-18) y lo implementa `ofertas`.
       - **Inscripciones activas de una oferta** (`JobApplicationsPort`, en `apps/api/src/modules/jobs/applications-port.ts`):
         lo define `ofertas` y lo implementa `inscripciones`, en la dirección de las llamadas (`ofertas → inscripciones`).
         Reúne la lectura del recuento del diálogo de cierre (`countActiveApplications`) y la operación interna de UC-19
         (`rejectActiveApplications`), que `ofertas` invoca dentro de su transacción de cierre. Se conecta en
         `apps/api/src/app.ts`, como los otros dos.
     - Dirección de dependencias, sin ciclos: `ofertas → inscripciones → candidatos` es la dirección de las llamadas que
       compone `apps/api/src/app.ts`. Los puertos de lectura que van contra la dirección de las llamadas (procesos del
       candidato, estado de la oferta) los implementa el módulo de la izquierda; el que va en la dirección de las llamadas
       (`JobApplicationsPort`) lo implementa el de la derecha; todos se conectan allí. **Ningún módulo importa a otro**,
       tampoco sus tipos: la implementación cumple el puerto por tipado estructural y `app.ts` lo comprueba al conectarla.
     - *Aclaración 2026-10-07 (HU-06, DT-04):* cambian dos frases. «Hoy hay dos» pasa a «Hoy hay tres», y «los puertos
       los implementa el módulo de la izquierda» pasa a distinguir el sentido de cada puerto. El motivo es el tercer
       puerto, `JobApplicationsPort`: va en la dirección de las llamadas (`ofertas → inscripciones`), lo define `ofertas` y
       lo implementa `inscripciones`, el módulo de la derecha. La decisión no cambia: ningún módulo importa a otro y los
       puertos se conectan en `apps/api/src/app.ts` por tipado estructural.
   ```

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/advance.test.ts` | modificar | Solo el nombre del `it` de la línea 283; sigue en 300 líneas |
| `apps/api/test/applications/reject.test.ts` | modificar | Solo los nombres de los `it` de las líneas 265 y 287; sigue en 300 líneas |
| `apps/api/test/applications/stage-change-after-close.test.ts` | crear | CA-07, EC-21, EC-22 (dos órdenes), EC-25 |
| `apps/api/test/applications/close-invariants.test.ts` | crear | CA-15 (script real de `db:reset` en un temporal) y CA-16 |
| `docs/07_architecture_principles/DECISIONS.md` | modificar | DEC-06: líneas 93-101 por el texto literal + aclaración; coletilla de «Estado» |
| `docs/ARCHITECTURE.md` | modificar | Línea 24: el stub deja de ser el valor por defecto |

## Implementa
- RF: RF-04 (completo), RF-03 (INV-05, DT-01), RF-06 (aclaración de DEC-06, DT-04; umbrales) · Edge cases: EC-18
  (base regenerada), EC-21, EC-22, EC-23, EC-25 · CA-07, CA-13, CA-15, CA-16 · DD-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (4), DD-08, § Impacto en decisiones (aclaración de DEC-06
  y `docs/ARCHITECTURE.md:24`), § Estrategia de tests (`stage-change-after-close.test.ts`, `close-invariants.test.ts`,
  CA-13), § Checklist 3

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- applications/stage-change-after-close applications/close-invariants applications/advance applications/reject`
      en verde, con:
  - `CA-07 tras el cierre: advance 409 STAGE_MISMATCH; reject 200 sin cambios con job_closed y nota null` (inscripción
    en `interview`; avance a `offer` con esperada `interview` → 409 y nada cambia; rechazo con `not_a_fit`, una nota y
    esperada `interview` → 200, sin `StageChange` nuevo, conserva `job_closed` y nota `null`: cubre EC-25).
  - `EC-21 offer rechazada por cierre → avanzar a hired 409`.
  - `EC-22 avance antes del cierre → StageChange offer → rejected con job_closed` y, en el otro orden, `EC-22 cierre
    antes del avance → 409 STAGE_MISMATCH y la inscripción sigue rejected`; en ninguno queda abierta.
  - `CA-15 INV-05 tras npm run db:reset: 0 inscripciones no finales en ofertas closed` (con la no vacuidad).
  - `CA-16 INV-05 tras POST /close: 0 no finales en la oferta (received, screening, interview, offer)`.
  - Los tres renombrados de CA-13 en verde con sus aserciones de siempre.
- [ ] **Mutación M1 de la review** (quitar la llamada a `rejectActiveApplications` del cierre): la detecta
      `close-invariants.test.ts › CA-16 …` (quedan 4 no finales). Comprobación manual del builder, sin commitear:
      aplicarla, ver el rojo y deshacerla; el diff final no toca `apps/api/src/`.
- [ ] `grep -n 'HU-06 lo revisa' apps/api/test/applications/` sin resultados.
- [ ] `wc -l apps/api/test/applications/advance.test.ts apps/api/test/applications/reject.test.ts` → **300** y
      **300** tras Prettier. Ningún fichero tocado pasa de 300 líneas ni ninguna función nueva de 50.
- [ ] `docs/07_architecture_principles/DECISIONS.md` contiene «Hoy hay tres», la línea «*Aclaración 2026-10-07 (HU-06,
      DT-04):*» debajo de «Dirección de dependencias» y la coletilla de «Estado»; DEC-06 no gana ni pierde otras viñetas.
      `docs/ARCHITECTURE.md` ya no contiene «sigue con su stub hasta HU-06».
- [ ] `data/ats.db` no cambia (CA-15 trabaja en `os.tmpdir()`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/advance.test.ts apps/api/test/applications/reject.test.ts apps/api/test/applications/stage-change-after-close.test.ts apps/api/test/applications/close-invariants.test.ts`
      sin errores.
- [ ] Commit único `test(api): post-close stage changes and INV-05 invariants; clarify DEC-06 [HU-06 TASK-03]` con los
      6 ficheros.

## Notas de implementación
- **No se añade ninguna guarda** de estado de la oferta en `advance`/`reject` (DT-01): si un test la pidiera, el test
  está mal.
- Los tests renombrados siguen creando la oferta `closed` **vacía** por la API y la inscripción por SQL después
  (`seedAt`/DD-09 de HU-05): con el puerto real no hay nada que rechazar al cerrar, así que no cambian de resultado.
- CA-15: `reset.ts` borra `${path}`, `-wal` y `-shm` y respeta `ATS_DB_PATH`; Node 24 ejecuta `.ts` sin compilar. El
  test añade ~1 s a la suite (DD-08).
- La consulta de invariante en los tests puede hacer `JOIN` entre tablas de módulos distintos: `module-boundaries`
  vigila `apps/api/src/`, no los tests.
- El hook `sensitive-files` bloquea escribir `data/*.db`: si salta, el test está apuntando a la base real.
