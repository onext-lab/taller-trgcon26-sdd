---
id: HU-07
feature: FEAT-04
titulo: "Fecha límite de inscripción en una oferta"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [ofertas, inscripciones]
sprint: null             # sprint-NN
rama: "hu/HU-07-fecha-limite-inscripcion"
---

# HU-07 — Fecha límite de inscripción en una oferta

## Historia
Como **reclutador**, quiero **fijar en una oferta hasta qué día acepto inscripciones y que el ATS no inscriba a nadie
más pasado ese día**, para **anunciar y hacer cumplir un plazo sin tener que cerrar la oferta ese día ni rechazar a los
candidatos que ya están en el proceso**.

## Contexto
Única HU de FEAT-04 (`docs/02_discovery/features/FEAT-04-fecha-limite-inscripcion/feature.md`), por decisión de la
persona (R7, 2026-10-13: «una sola HU fullstack, sin RGPD»). Cubre todo el alcance de la feature:
- **`ofertas`:** el dato opcional de la fecha límite al crear y editar, su validación al guardar y al publicar, que no
  se copie al duplicar, y su visualización en la ficha y en el listado (FEAT-04 · RN-01, RN-02, RN-05..RN-09, RN-12).
- **`inscripciones`:** el bloqueo de inscripciones nuevas pasado el plazo con 409 `ENROLLMENT_DEADLINE_PASSED`, el
  orden de errores al inscribir, y el plazo y su aviso en el pipeline, sin «Inscribir candidato» cuando ha vencido
  (FEAT-04 · RN-03, RN-04, RN-10..RN-12).
- **Seed:** al menos una oferta `published` con plazo futuro y otra con plazo vencido, inventadas (P20, RV-26).

Es atómica porque se entrega sola sobre FEAT-01 y FEAT-03, ya en `main`; vertical porque va del esquema y la API de
`ofertas` e `inscripciones` a sus pantallas; y con valor porque el reclutador puede anunciar un plazo y el ATS lo hace
cumplir sin cerrar la oferta.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-01 | P (FEAT-04), E7 | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` |
| UC-02 | P (FEAT-04), A2, A3, E5 | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` |
| UC-03 | P (FEAT-04), E3 | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` |
| UC-06 | P (FEAT-04) | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` |
| UC-07 | P (FEAT-04) | `docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` |
| UC-08 | P (FEAT-04), A1 (FEAT-04), A2 | `docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md` |
| UC-14 | P (FEAT-04), E1 (FEAT-04), E2 (FEAT-04), E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` |
| UC-17 | P (FEAT-04), A1 (FEAT-04), A2 (FEAT-04), A4 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |

«(FEAT-04)» es la parte del flujo que la feature añade o cambia, como la marcan el UC y su tabla de Trazabilidad.

Flujos de esos UC que **no** cubre esta HU: el resto de los flujos de los ocho UC no cambia con FEAT-04 y conserva su
cobertura de HU-01, HU-02, HU-04 y HU-05, ya en `main` (tabla «Casos de uso» de la feature). UC-02 · E1 y E3 llevan
una nota «(FEAT-04)» que no añade comportamiento: la de E1 recuerda que en una oferta `closed` tampoco cambia la fecha
límite, porque toda edición de una `closed` da 409 (HU-02; FEAT-04 · INV-04), y la de E3, que quitarla está permitido (UC-02 · A2). UC-17 · A3 sigue pendiente de
la feature A, como antes.

## Criterios de aceptación
- [ ] Dado hoy 13/10/2026 (Europe/Madrid), cuando el reclutador crea una oferta con la fecha límite del 13/10/2026 o
      posterior, entonces se guarda con ella; y cuando la crea con el campo vacío o solo con espacios, entonces se
      guarda sin plazo _(UC-01 · P)_.
- [ ] Dado hoy 13/10/2026, cuando el reclutador crea una oferta con la fecha límite del 12/10/2026, con un formato
      distinto de `AAAA-MM-DD`, con una fecha inexistente (30/02/2027), con hora o con un número, entonces recibe 400
      junto al campo y no se crea nada _(UC-01 · E7)_.
- [ ] Dada una oferta `draft` o `published`, cuando el reclutador fija, amplía, reduce a hoy o posterior, o quita su
      fecha límite y guarda, entonces se guarda, sin cambiar el estado ni las fechas de la oferta; y guardar la misma
      fecha límite es una edición sin efecto que responde 200 _(UC-02 · P)_.
- [ ] Dada una oferta `published` con el plazo vencido, cuando el reclutador amplía la fecha límite a hoy o después, o
      la quita, entonces se guarda y la oferta vuelve a admitir inscripciones _(UC-02 · A2)_.
- [ ] Dada una oferta `published` con el plazo vencido, cuando el reclutador edita su descripción sin tocar la fecha
      límite, entonces se guarda y el plazo sigue vencido _(UC-02 · A3)_.
- [ ] Dado hoy 13/10/2026, cuando una edición cambia la fecha límite al 12/10/2026 o a un valor que no es un día
      `AAAA-MM-DD` existente, entonces recibe 400 junto al campo y la oferta queda como estaba _(UC-02 · E5)_.
- [ ] Dado un borrador con la fecha límite de hoy o posterior, o sin ella, cuando el reclutador lo publica, entonces
      se publica como hoy _(UC-03 · P)_.
- [ ] Dado un borrador con el plazo vencido, cuando el reclutador lo publica, entonces recibe 400 junto al campo, que
      pide ampliarla o quitarla, y la oferta sigue en `draft` _(UC-03 · E3)_.
- [ ] Dada una oferta con fecha límite, cuando el reclutador la duplica, entonces el borrador nuevo no tiene fecha
      límite _(UC-06 · P)_.
- [ ] Dado ofertas con y sin fecha límite, cuando el reclutador abre el listado, entonces ve una columna con la fecha
      límite en `dd/mm/aaaa`, vacía si no tiene, sin filtro ni orden por ella _(UC-07 · P)_.
- [ ] Dada una oferta, cuando el reclutador abre su ficha, entonces ve la fecha límite en `dd/mm/aaaa` o «Sin fecha
      límite» _(UC-08 · P)_.
- [ ] Dada una oferta `closed` con el plazo vencido, cuando el reclutador abre su ficha, entonces ve la fecha límite
      como dato informativo, sin aviso de plazo vencido _(UC-08 · A1)_.
- [ ] Dada una oferta `draft` o `published` con el plazo vencido, cuando el reclutador abre su ficha, entonces ve
      «Plazo de inscripción vencido» junto a la fecha, y las acciones no cambian _(UC-08 · A2)_.
- [ ] Dada una oferta `published` con la fecha límite del 31/10/2026, cuando el reclutador inscribe a un candidato el
      31/10/2026 a las 23:59 (Madrid), entonces se crea la inscripción en `received` _(UC-14 · P)_.
- [ ] Dada esa oferta, cuando el reclutador intenta inscribir el 01/11/2026 a las 00:00 (Madrid), también si abrió la
      inscripción antes de la medianoche, entonces recibe 409 `ENROLLMENT_DEADLINE_PASSED` con el mensaje «El plazo
      de inscripción de esta oferta terminó el 31/10/2026.», sin datos del candidato, que la web muestra; y no se crea
      la `Application` ni el `StageChange` ni cambia la retención _(UC-14 · E6)_.
- [ ] Dadas ofertas `published` con la fecha límite del 20/10/2026 (UTC+2) y del 25/10/2026 (día del cambio de hora,
      UTC+1), cuando se inscribe a las 21:59:59.999 UTC y a las 22:59:59.999 UTC de ese día, respectivamente, entonces
      se crea la inscripción; y un milisegundo después, 409 `ENROLLMENT_DEADLINE_PASSED` _(UC-14 · P, E6)_.
- [ ] Dada una oferta `published` cuyo plazo se recorta a ayer mientras se inscribe en otra pestaña, cuando se
      confirma la inscripción, entonces se comprueba contra el plazo vigente en la transacción y recibe 409
      `ENROLLMENT_DEADLINE_PASSED` _(UC-14 · E6)_.
- [ ] Dada una oferta `closed` con el plazo vencido, cuando se intenta inscribir a un candidato, entonces recibe el
      409 de oferta no publicada, no el de plazo vencido _(UC-14 · E1)_.
- [ ] Dada una oferta `published` con el plazo vencido y un candidato ya inscrito en ella, cuando se reintenta su
      inscripción, entonces recibe 409 `ENROLLMENT_DEADLINE_PASSED`, no `DUPLICATE`; y con el plazo abierto, recibe
      `DUPLICATE` como hoy _(UC-14 · E2)_.
- [ ] Dada una oferta `published` con fecha límite, cuando el reclutador abre su pipeline, entonces ve la fecha límite
      en `dd/mm/aaaa` _(UC-17 · P)_.
- [ ] Dada una oferta `closed` con el plazo vencido, cuando el reclutador abre su pipeline, entonces ve la fecha
      límite como dato informativo, sin aviso de plazo vencido, en el pipeline de solo lectura _(UC-17 · A1)_.
- [ ] Dada una oferta `published` sin inscripciones y con el plazo vencido, cuando el reclutador abre su pipeline,
      entonces ve el estado vacío sin «Inscribir candidato» y con «El plazo de inscripción terminó el dd/mm/aaaa.»
      _(UC-17 · A2)_.
- [ ] Dada una oferta `published` con inscripciones y el plazo vencido, cuando el reclutador abre su pipeline,
      entonces no ve «Inscribir candidato», ve «El plazo de inscripción terminó el dd/mm/aaaa.» (`role="status"`), sus
      inscripciones se pueden seguir avanzando y rechazando, y la oferta sigue `published` _(UC-17 · A4)_.

## Notas y dependencias
- **Depende de:** nada pendiente; FEAT-01 (HU-01, HU-02) y FEAT-03 (HU-04, HU-05, HU-06) están en `main`.
- **Bloquea:** nada.
- **Mismo UC en varias HU:** los ocho UC los comparte con HU-01, HU-02, HU-04 y HU-05, todas ya en `main`; no hay
  paralelismo que resolver.
- **Sin RGPD** (R7): la fecha límite es un dato de la oferta, no del candidato, y no cambia la retención. El
  `datos-personales-auditor` de `/reviewer` solo confirma que el error de plazo vencido no expone datos del candidato
  (QUALITY-GATES §4.3, `docs/RGPD.md` §6.1).
- **Reloj y zona horaria:** decide el reloj inyectado del servidor, en Europe/Madrid, dentro de la transacción de la
  inscripción (FEAT-04 · RN-04, DEC-09, DEC-06). Los tests de frontera de medianoche y del cambio de hora del
  25/10/2026 son obligatorios (P22).
- **Entre módulos:** `inscripciones` lee el plazo de la oferta de `ofertas` sin importar el módulo (DEC-06).
- **Seed:** las fechas fijas envejecen; cómo mantener una oferta con plazo futuro y otra con plazo vencido lo decide
  `/tech-design` (P20).
- **Techo de tareas:** es una HU fullstack que toca ocho UC en dos módulos; si `/task-planner` supera las 15 tareas de
  QUALITY-GATES §2, se para y se escala a la persona antes de partirla (R7, Handoff de FEAT-04).
- **Fuera de alcance** (FEAT-04 · Alcance): cierre automático al vencer, cambios en las inscripciones existentes, plazo
  con hora o por etapa, inscripción excepcional fuera de plazo, avisos, filtrar u ordenar por el plazo, historial del
  plazo y un estado nuevo de la oferta.

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `plans/TECHNICAL_DOC-frontend.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
