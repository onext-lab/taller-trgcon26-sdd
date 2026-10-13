# Changelog — HU-07 Fecha límite de inscripción en una oferta

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer
> ahora el reclutador). Review: `review/REVIEW.md`, `VERDICT: Aprobado con observaciones` (ronda 1).

## Entradas

### 2026-10-13 — TASK-01: la oferta guarda su fecha límite
- **Tipo:** feature
- **Qué se entregó:** la oferta tiene una fecha límite de inscripción opcional que se pone, cambia o quita por la API
  y se devuelve en su detalle; duplicar no la copia.
- **Archivos afectados:**
  - `apps/api/src/db/migrations/004-add-job-enrollment-deadline.sql` — columna nueva con `CHECK` de día real
  - `apps/api/src/modules/jobs/` — esquemas, repositorio, recorte y duplicar
- **Commit:** `5f9f998`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-02: la fecha se valida al crear, editar y publicar
- **Tipo:** feature
- **Qué se entregó:** el reclutador no puede poner una fecha pasada ni un día que no existe (400 junto al campo, solo
  si la fecha cambia), ni publicar un borrador con el plazo vencido.
- **Archivos afectados:**
  - `apps/api/src/calendar.ts` — día natural de Madrid compartido (sale de `candidates/retention.ts`)
  - `apps/api/src/modules/jobs/rules.ts` y `service.ts` — reglas y textos de DT-01
- **Commit:** `d5b319e`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-03: no se inscribe fuera de plazo
- **Tipo:** feature
- **Qué se entregó:** inscribir en una oferta publicada con el plazo vencido da 409 `ENROLLMENT_DEADLINE_PASSED` con
  «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.», después de «oferta no publicada» y antes de
  «duplicado»; no se crea nada.
- **Archivos afectados:**
  - `apps/api/src/modules/applications/service.ts` y `ports.ts` — guarda dentro de la transacción
  - `apps/api/src/modules/jobs/job-status.ts` — el puerto lee la fecha
- **Commit:** `9539899`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-04: el pipeline sabe si el plazo venció; el seed trae plazos
- **Tipo:** feature
- **Qué se entregó:** el pipeline devuelve la fecha límite y si ha vencido (con el reloj del servidor); el seed lleva
  una oferta publicada con plazo a 14 días y otra con el plazo vencido hace 3.
- **Archivos afectados:**
  - `apps/api/src/modules/applications/schemas.ts` y `service.ts` — `job` del pipeline
  - `apps/api/src/db/seed.ts` — plazos relativos al reset
- **Commit:** `f0a0caf`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-05: pruebas hostiles de la API
- **Tipo:** test
- **Qué se entregó:** 20 tests adversariales de RF-01 y RF-02 (formatos hostiles, fallos de escritura y del puerto,
  concurrencia y datos personales en el 409); ninguno encontró un fallo.
- **Archivos afectados:**
  - `apps/api/test/jobs/deadline-adversarial.test.ts`, `apps/api/test/applications/enroll-deadline-adversarial.test.ts`
- **Commit:** `f4d7a08`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-06: la fecha en el formulario y la ficha
- **Tipo:** feature
- **Qué se entregó:** el formulario de oferta tiene el campo «Fecha límite de inscripción»; la ficha la muestra como
  dato; publicar con el plazo vencido explica por qué no se puede.
- **Archivos afectados:**
  - `apps/web/src/features/jobs/` — tipos, cliente, modelo, formulario, ficha y acciones
- **Commit:** `b29dd1a`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-07: el pipeline sin «Inscribir candidato» cuando el plazo venció
- **Tipo:** feature
- **Qué se entregó:** con el plazo vencido, el pipeline no ofrece «Inscribir candidato» y muestra «El plazo de
  inscripción terminó el dd/mm/aaaa: no se pueden inscribir más candidatos.»
- **Archivos afectados:**
  - `apps/web/src/features/applications/` — tipos, cliente, etiquetas y pantalla del pipeline
- **Commit:** `403873f`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-08: fecha a medias y 409 con la página abierta
- **Tipo:** feature
- **Qué se entregó:** una fecha escrita a medias da «Introduce una fecha válida.» sin enviar nada; si el plazo vence
  con el pipeline abierto, el 409 se muestra como alerta y el pipeline se refresca sin el botón.
- **Archivos afectados:**
  - `apps/web/src/components/form-errors.ts`, `apps/web/src/features/jobs/`, `apps/web/src/features/applications/`
- **Commit:** `fd23456`
- **Desviaciones del PRD:** Ninguna

### 2026-10-13 — TASK-09: el recorrido en el navegador
- **Tipo:** test
- **Qué se entregó:** e2e de crear con fecha, verla y quitarla; error de fecha pasada; y las dos ofertas del seed en
  el pipeline.
- **Archivos afectados:**
  - `e2e/jobs-deadline.spec.ts`
- **Commit:** `65e2cdb`
- **Desviaciones del PRD:** Ninguna
