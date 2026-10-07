---
id: HU-06
feature: FEAT-03
titulo: "Cerrar una oferta con inscripciones activas"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [inscripciones, ofertas, candidatos]
sprint: sprint-01        # sprint-NN
rama: "hu/HU-06-cerrar-oferta-inscripciones-activas"
---

# HU-06 — Cerrar una oferta con inscripciones activas

## Historia
Como **reclutador**, quiero **que al cerrar una oferta se rechacen sus inscripciones activas con el motivo «oferta
cerrada», sabiendo antes cuántas son**, para **que ningún candidato se quede en un proceso abierto y su plazo de
retención empiece a contar desde el cierre**.

## Contexto
Tercera rebanada de FEAT-03 (`docs/02_discovery/features/FEAT-03-inscripciones/feature.md`). Sale de HU-05 por
decisión de la persona responsable (2026-10-07, «Sí, sprint de 6 HU»): con UC-19 y UC-04 · A1 dentro, HU-05
superaba el techo de 15 tareas de `docs/07_architecture_principles/QUALITY-GATES.md` §2, que incluye las adversariales.

Conecta el puerto `JobApplicationsPort` (`apps/api/src/modules/jobs/applications-port.ts`), que hoy `buildApp`
inyecta con el stub `noJobApplications`, a una implementación real de `inscripciones`:
- **El recuento:** el diálogo de cierre (`GET /api/jobs/:id/close-preview`, de HU-02) cuenta las inscripciones
  activas de verdad, en vez de 0.
- **El rechazo:** dentro de la misma transacción del cierre, las inscripciones activas pasan a `rejected` con el motivo
  `job_closed`, sin nota y con su `StageChange` en la fecha del cierre; para cada candidato al que no le queda ninguna
  inscripción no final, `candidatos` recalcula la retención en esa transacción.

Con ello se cierra la ventana de INV-05 (DT-10 del PRD de HU-04; nota de HU-02): ninguna oferta `closed` tiene
inscripciones no finales. El test de EC-14 de HU-02 (`apps/api/test/jobs/close.test.ts`, «EC-14 sin puerto de
inscripciones…»), que fija el comportamiento del stub, se sustituye por los tests del cierre real. Tras el merge hay que
hacer `npm run db:reset`, porque una base creada en la ventana puede tener ofertas cerradas con inscripciones abiertas.

Es atómica porque se entrega sola sobre HU-05, vertical porque toca la persistencia transaccional entre tres módulos
(`ofertas` invoca, `inscripciones` rechaza y `candidatos` recalcula), la API del cierre y su diálogo en la web, y con
valor porque el cierre de una oferta deja por fin todos sus procesos terminados y con rastro.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-19 | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` |
| UC-04 | A1 | `docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-04 · P, A2, A3, E1 y E2: los cubre HU-02 (ya en `main`).

## Criterios de aceptación
- [ ] Dada una oferta `published` con inscripciones en `received`, `offer` y `hired`, cuando la cierro y confirmo el
      diálogo, que anuncia 2 inscripciones activas, entonces la oferta queda `closed`, las dos primeras pasan a
      `rejected` con el motivo «oferta cerrada», sin nota y con su `StageChange` con la fecha del cierre, y la de `hired`
      no cambia _(UC-19 · P; UC-04 · A1)_.
- [ ] Dado el cierre del criterio anterior, cuando a un candidato rechazado no le queda ninguna inscripción no final,
      entonces su retención se recalcula desde ese día en la misma transacción _(UC-19 · P)_.
- [ ] Dada una oferta publicada con el diálogo de cierre abierto, cuando se crea una inscripción antes de confirmar,
      entonces el cierre la rechaza igualmente, porque rechaza las activas en el momento de cerrar _(UC-04 · A1)_.
- [ ] Dada una oferta publicada sin inscripciones o con todas en `hired` o `rejected`, cuando la cierro, entonces la
      operación devuelve 0, no se rechaza ni se recalcula nada y la oferta queda `closed` _(UC-19 · A1)_.
- [ ] Dado un candidato con una inscripción en la oferta que se cierra y otra abierta en otra oferta, cuando se cierra
      la primera oferta, entonces su inscripción en ella pasa a `rejected` y él sigue sin fecha de fin de retención
      _(UC-19 · A2)_.
- [ ] Dado que falla una escritura durante el rechazo por cierre, cuando cierro la oferta, entonces la oferta sigue
      `published`, ninguna inscripción cambia y ninguna retención se recalcula _(UC-19 · E1)_.
- [ ] Dada una inscripción en `interview` de una oferta que se está cerrando, cuando llega después del cierre un avance
      con la etapa esperada `interview`, entonces responde 409; y si lo que llega es un rechazo, responde 200 sin cambios
      _(UC-19 · E2)_.

## Notas y dependencias
- **Depende de:** HU-05 (avanzar y rechazar, y el historial donde se ve el rechazo por cierre; a través de ella, HU-04
  y HU-02, que entrega el cierre de UC-04).
- **Bloquea:** nada.
- **Mismo UC en dos HU:** UC-04 lo comparte con HU-02 (ya en `main`). UC-19 es entero de esta HU. Va en secuencia:
  empieza cuando HU-05 está en `main`, porque toca su servicio de inscripciones y las reglas de avanzar y rechazar.
- **Decisiones heredadas de HU-05:**
  - El aviso tras cerrar se mantiene en «Oferta cerrada.», sin el número de inscripciones rechazadas, y `POST /close`
    sigue devolviendo el `Job`; el resultado se ve en el pipeline (OQ-09 del PRD de HU-05, respondida por el responsable técnico el
    2026-10-07: «según recomendación»).
  - HU-05 decide que avanzar y rechazar **no** comprueban el estado de la oferta: la garantía es INV-05 y la web deja
    en solo lectura el pipeline de una oferta `closed` (OQ-08 y EC-49 del PRD de HU-05). **Esta HU debe revisarlo a
    propósito** en su PRD, ahora que INV-05 pasa a cumplirse por construcción: mantenerlo o añadir la guarda, con el
    motivo, y su efecto en UC-19 · E2.
- **Reparto entre módulos** (`docs/02_discovery/reglas-validadas.md`): `inscripciones` expone la operación interna de
  UC-19 e implementa `JobApplicationsPort` por tipado estructural; `ofertas` la invoca dentro de su transacción de
  cierre sin importar `inscripciones` (DEC-06); `candidatos` recalcula la retención cuando se le pide. Nadie duplica la
  fórmula.
- **Cierra la ventana de INV-05** (DT-10 de HU-04; riesgo de FEAT-01): «ninguna oferta `closed` tiene inscripciones en
  etapa no final» se prueba aquí. Tras el merge, `npm run db:reset`, y se actualizan los comentarios que hoy apuntan a
  HU-05 en `apps/api/src/app.ts`, `apps/api/src/modules/jobs/applications-port.ts` y
  `apps/api/test/jobs/close.test.ts`.
- **Avisos que hereda** (review de HU-02, `docs/05_modules/ofertas/technical.md`): un test de que los errores del
  rechazo por cierre no llevan datos del candidato al log, y no copiar `SELECT *`.
- El motivo «oferta cerrada» (`job_closed`) solo lo pone el sistema (S-15); el historial solo crece (INV-03 de FEAT-03).
- El recorrido e2e de cerrar una oferta con inscripciones activas y verlas en el pipeline en solo lectura es de esta HU.

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `plans/TECHNICAL_DOC-frontend.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
