# Changelog — HU-06 Cerrar una oferta con inscripciones activas

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 1, `review/REVIEW.md`).
**Endpoints:** ninguno nuevo ni con contrato distinto. `GET /api/jobs/:id/close-preview` cuenta las inscripciones activas
reales y `POST /api/jobs/:id/close` las rechaza en su misma transacción. `JobApplicationsPort` pasa de stub a real.
**Pantallas:** sin cambios de código: el diálogo de cierre muestra ya el número real.
**Migraciones:** ninguna. **Tras el merge:** `npm run db:reset`, porque las bases creadas durante la ventana de INV-05
pueden tener ofertas cerradas con inscripciones abiertas.
**Decisiones:** DEC-06 aclarado (tercer puerto) sin cambiar la decisión.

## Entradas

### 2026-10-07 — TASK-01 a TASK-03: el cierre rechaza las inscripciones activas
- **Tipo:** feature y test
- **Qué se entregó:** al cerrar una oferta, sus inscripciones en curso pasan a «Rechazado» con el motivo «oferta
  cerrada», sin nota y con la fecha del cierre, en la misma operación. Si al candidato no le queda otro proceso abierto,
  su plazo de conservación empieza a contar desde el cierre. Las contratadas y las ya rechazadas no cambian. El diálogo
  de cierre dice cuántas se rechazarán. Ninguna oferta cerrada queda con procesos abiertos, ni en la base regenerada
  ni tras cerrar. Avanzar o rechazar una inscripción de una oferta ya cerrada da «ha cambiado de etapa» o un 200 sin
  cambios.
- **Archivos afectados:** `apps/api/src/modules/applications/{job-closing,repository,service}.ts`, `apps/api/src/app.ts`,
  `apps/api/src/modules/jobs/applications-port.ts`, `docs/07_architecture_principles/DECISIONS.md` (DEC-06),
  `docs/ARCHITECTURE.md` y sus tests
- **Commit:** `25614d7`, `5ffc0a3`, `9542027` · después: `2bb43fe`, `e10ebab`
- **Desviaciones del PRD:** ninguna (DT-01: avanzar y rechazar siguen sin mirar el estado de la oferta)

### 2026-10-07 — TASK-04 a TASK-06: fallos, privacidad y rendimiento
- **Tipo:** test
- **Qué se entregó:**
  - Un fallo en mitad del cierre deja la oferta publicada y nada a medias.
  - Dos cierres a la vez no duplican nada.
  - Ni los errores ni el log del cierre llevan datos del candidato.
  - Cerrar una oferta con 200 inscripciones activas tarda unos 20 ms.
- **Archivos afectados:** `apps/api/test/applications/{close-reject-adversarial,close-reject-privacy,close-performance}.test.ts`,
  `apps/api/test/helpers/test-app.ts` (`failWrites` con `whenNew`)
- **Commit:** `7758f6c`, `f6a1675`, `c733a01` · después: `e10ebab`
- **Desviaciones del PRD:** ninguna

### 2026-10-07 — TASK-07 y TASK-08: recorridos e2e
- **Tipo:** test
- **Qué se entregó:** dos recorridos. En el primero, se cierra una oferta con dos procesos abiertos y uno contratado y se
  ven rechazados con «Oferta cerrada» en el pipeline en solo lectura y en el detalle. En el segundo, una inscripción
  creada con el diálogo abierto también se rechaza.
- **Archivos afectados:** `e2e/jobs-close-applications.spec.ts`, `e2e/support/applications.ts` (`advanceByApi`),
  comentarios de `e2e/pipeline-closed.spec.ts` y `e2e/applications.spec.ts`
- **Commit:** `acbcc2b`, `54af6e7`
- **Desviaciones del PRD:** ninguna
