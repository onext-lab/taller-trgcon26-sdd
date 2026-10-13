---
id: HU-07
feature: FEAT-04
titulo: "Fecha límite de inscripción en una oferta"
estado: en curso         # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [ofertas, inscripciones]
sprint: null             # sprint-NN
rama: "hu/HU-07-fecha-limite-inscripcion"
---

# HU-07 — Fecha límite de inscripción en una oferta

## Historia
Como **reclutador**, quiero **fijar, al crear o editar una oferta, hasta qué día acepta inscripciones**, para **acotar
de antemano el plazo en que admito candidatos sin tener que acordarme de cerrarla**.

## Contexto
HU única de FEAT-04 (`docs/02_discovery/features/FEAT-04-fecha-limite-inscripcion/feature.md`), por decisión de la
persona (R7: «una sola HU fullstack, pequeña, sin RGPD»). Añade a la oferta un dato opcional, la fecha límite de
inscripción: un día de calendario de Europe/Madrid, inclusivo y sin hora (RN-01, RN-02). Se fija en el alta y la
edición (API y formulario web), se valida solo cuando cambia y nunca al pasado (RN-03, RN-05), impide publicar un
borrador con el plazo vencido (RN-04), no se copia al duplicar (RN-08) y, pasado el plazo, inscribir da 409
`ENROLLMENT_DEADLINE_PASSED` y el pipeline deja de ofrecer «Inscribir candidato» (RN-06, RN-07, RN-09). El vencimiento
no cierra la oferta ni toca las inscripciones existentes (RN-10). El seed lleva una oferta publicada con plazo futuro y
otra con el plazo vencido (R7).

Es atómica porque se entrega sola sobre FEAT-01 y FEAT-03, ya en `main`; vertical porque toca el esquema y la
validación de la oferta, la regla de inscribir en `inscripciones` (que lee la fecha de `ofertas` por el puerto
«estado de la oferta», DEC-06), la API, el formulario, el pipeline y el seed; y con valor porque el reclutador acota el
plazo de una oferta sin intervención manual al vencer.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-01 | P (lo que añade FEAT-04: la fecha límite), E7 | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` |
| UC-02 | P (lo que añade FEAT-04: poner, ampliar, reducir o quitar la fecha límite), A2, A3, E5 | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` |
| UC-03 | E3 | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` |
| UC-06 | P (lo que añade FEAT-04: sin fecha límite) | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` |
| UC-14 | P (lo que añade FEAT-04: la comprobación del plazo), E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` |
| UC-17 | A4 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |

Flujos de esos UC que **no** cubre esta HU:
- El resto de los flujos de UC-01, UC-02, UC-03, UC-06, UC-14 y UC-17 ya están en `main` (HU-01, HU-02, HU-04 y
  HU-05) y FEAT-04 no los cambia; esta HU solo debe mantenerlos en verde. La precedencia de UC-14 · E6 sobre E1 y E2
  se prueba aquí, en E6.
- UC-17 · A3 (candidato anonimizado): sigue fuera de alcance; lo cubrirá la HU de la feature A (S-05).
- UC-08 (consultar una oferta) no cambia: mostrar la fecha en la ficha es opcional, sin flujo ni criterio, y lo decide
  `/tech-design` (R6).

## Criterios de aceptación
- [ ] Dado el formulario de nueva oferta, cuando el reclutador crea una con fecha límite igual a hoy en Europe/Madrid o
      posterior, sin fecha máxima, entonces se guarda en `draft` con esa fecha; y sin fecha límite, entonces se guarda
      sin plazo, como hoy _(UC-01 · P)_.
- [ ] Dado el alta de una oferta, cuando la fecha límite es anterior a hoy en Europe/Madrid o no es un día de
      calendario válido (otro formato o un día inexistente, como el 31/02), entonces responde 400 con el mensaje junto
      al campo y no se crea nada _(UC-01 · E7)_.
- [ ] Dada una oferta en `draft` o `published`, cuando el reclutador pone, amplía, reduce o quita su fecha límite (a
      hoy o a una fecha futura), entonces se guarda sin cambiar el estado ni las fechas de la oferta _(UC-02 · P)_.
- [ ] Dada una oferta en `draft` o `published`, cuando la edición cambia la fecha límite a una anterior a hoy en
      Europe/Madrid o a un valor que no es un día de calendario válido, entonces responde 400 junto al campo y la
      oferta queda como estaba _(UC-02 · E5)_.
- [ ] Dada una oferta `published` con el plazo vencido, cuando el reclutador edita su descripción sin tocar la fecha
      límite (también si la petición reenvía la misma fecha), entonces se guarda sin error por ella _(UC-02 · A2)_.
- [ ] Dada una oferta `published` con el plazo vencido, cuando el reclutador amplía la fecha límite a hoy o a una fecha
      futura, o la quita, entonces la oferta sigue `published`, se puede volver a inscribir candidatos y su pipeline
      vuelve a ofrecer «Inscribir candidato» _(UC-02 · A3)_.
- [ ] Dado un borrador completo con una fecha límite anterior a hoy, cuando el reclutador lo publica, entonces responde
      400 con la fecha límite entre los campos con error y la oferta sigue en `draft`; y con fecha límite igual a hoy,
      entonces se publica _(UC-03 · E3)_.
- [ ] Dada una oferta con fecha límite, cuando el reclutador la duplica, entonces el borrador nuevo no tiene fecha
      límite y la original no cambia _(UC-06 · P)_.
- [ ] Dada una oferta `published` con fecha límite hoy, cuando se inscribe a un candidato a las 23:59:59 de
      Europe/Madrid, entonces se crea la inscripción; y sin fecha límite, entonces se inscribe como hoy. Se prueba con
      el reloj inyectado cuando UTC y Europe/Madrid están en días distintos y en los días de cambio de hora
      _(UC-14 · P)_.
- [ ] Dada la misma oferta, cuando se intenta inscribir a las 00:00:00 de Europe/Madrid del día siguiente, entonces
      responde 409 `ENROLLMENT_DEADLINE_PASSED` con «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.» y no
      se crea ni la inscripción ni el `StageChange` ni se recalcula la retención; reintentarlo da el mismo 409. En la
      web, si el pipeline se cargó antes del vencimiento, el mensaje se muestra con `role="alert"` y el pipeline se
      refresca sin «Inscribir candidato» _(UC-14 · E6)_.
- [ ] Dada una oferta `published` con el plazo vencido y un candidato ya inscrito en ella, cuando se intenta
      inscribirlo, entonces responde 409 `ENROLLMENT_DEADLINE_PASSED`; y dada una oferta `closed` con el plazo vencido,
      entonces responde el 409 de oferta no publicada _(UC-14 · E6)_.
- [ ] Dada una oferta `published` con el plazo vencido, con inscripciones o sin ninguna, cuando el reclutador abre su
      pipeline, entonces no ve «Inscribir candidato» y lee que el plazo de inscripción terminó y en qué fecha
      (`dd/mm/aaaa`), mientras «Avanzar», «Rechazar» y el historial siguen disponibles como antes _(UC-17 · A4)_.
- [ ] Dado el seed regenerado con `npm run db:reset`, cuando el reclutador lista las ofertas publicadas, entonces hay
      una con plazo futuro y otra con el plazo vencido, ambas relativas al día del reset _(FEAT-04 · R7)_.

## Notas y dependencias
- **Depende de:** nada pendiente (FEAT-01 y FEAT-03 entregadas; HU-01 a HU-06 en `main`).
- **Bloquea:** nada.
- **Mismo UC en otras HU:** los seis UC los comparte con HU ya cerradas (HU-01, HU-02, HU-04 y HU-05). No hay otra HU
  abierta que los edite, así que no hay secuencia que respetar.
- **Reglas que hereda del repo:** el día se evalúa en Europe/Madrid con el reloj del servidor, inyectado en los tests
  (DEC-09, RV-25); el error sigue el envelope de DEC-07; añadir el campo al esquema estricto de la oferta obliga a
  actualizar los tests de campo desconocido y del esquema (DEC-11); `inscripciones` lee la fecha de `ofertas` por el
  puerto «estado de la oferta», sin importar el módulo (DEC-06). Cómo se amplía el puerto lo decide `/tech-design`.
- **Concurrencia:** la inscripción se evalúa con el plazo vigente al procesarla (DEC-08); dos ediciones del plazo, gana
  la última (S-02). Son casos límite del PRD, sin criterio propio aquí.
- **Sin datos personales nuevos** (R7): no hace falta revisión del `datos-personales-auditor`. El mensaje del 409 solo
  lleva la fecha.
- **Seed:** las fechas del seed son relativas al día del `db:reset`; los e2e usan `data/e2e.db`, que se regenera en
  cada pasada (DEC-03).
- **Fuera de alcance** (R6, R7): columna en el listado, aviso «Plazo vencido» en la ficha, cierre automático o estado
  nuevo, avisos, filtros u orden por la fecha, hora de corte, límite por etapa, fecha de apertura, excepciones por
  candidato, historial del plazo y cambios en las inscripciones existentes.
- **Tamaño:** la persona la quiere en una sola HU. Si `/task-planner` supera las 15 tasks del techo
  (`docs/07_architecture_principles/QUALITY-GATES.md`), se para y se escala antes de dividirla.

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [x] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `plans/TECHNICAL_DOC-frontend.md`) — `/tech-design`
- [x] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [x] Implementación + integración — `/implementar-hu`
- [x] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
