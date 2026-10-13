---
id: IDEA-004
titulo: "Fecha límite de inscripción en una oferta"
estado: aceptada        # idea | aceptada | descartada | completada
fecha: 2026-10-13
autor: "responsable técnico"
modulos_afectados: [ofertas, inscripciones]
prioridad: null         # alta | media | baja (la fija la persona)
feature: FEAT-04        # FEAT-NN cuando se acepte
completada_en: null
---

# IDEA-004 — Fecha límite de inscripción en una oferta

## Descripción
Fecha límite de inscripción en una oferta: el reclutador puede fijar, al crear o editar una oferta, hasta qué día
acepta inscripciones; pasada esa fecha no se puede inscribir a nadie más en ella.

## Problema u oportunidad
Hoy una oferta publicada acepta inscripciones hasta que el reclutador la cierra a mano. Con una fecha límite, el
reclutador puede anunciar y hacer cumplir un plazo de inscripción sin tener que acordarse de cerrar la oferta ese día.

## Alcance (grano grueso)
Módulo `ofertas` (el dato de la fecha límite al crear y editar) y módulo `inscripciones` (bloquear la inscripción
pasada la fecha). API y web.

## Notas
- Reglas ya validadas que roza: RV-03 y RV-04 (estados y edición de la oferta) y RV-17 (dónde se puede inscribir), en
  [reglas-validadas.md](../reglas-validadas.md).
- Relacionada con [001-gestion-de-ofertas](completadas/001-gestion-de-ofertas.md) y
  [003-inscripciones-y-pipeline](completadas/003-inscripciones-y-pipeline.md).
- Toca UI: principios en [06_design_principles/README.md](../../06_design_principles/README.md) (fechas en
  `dd/mm/aaaa`, errores útiles).
- Dudas iniciales, para el shaping:
  - ¿La fecha límite es obligatoria u opcional? ¿Qué significa dejarla vacía?
  - «Pasada esa fecha»: ¿el mismo día de la fecha límite aún se puede inscribir? ¿En qué zona horaria se cuenta el día?
  - ¿Se puede fijar una fecha en el pasado al crear o al editar?
  - ¿Se puede cambiar en una oferta ya publicada? ¿Y en una cerrada?
  - ¿Se copia al duplicar una oferta?
  - ¿Qué ocurre con las inscripciones que ya existen al pasar la fecha? ¿Se cierra la oferta sola?
  - ¿Dónde se ve la fecha límite (lista de ofertas, pipeline) y qué ve el reclutador al intentar inscribir pasada la
    fecha?

## Decisión
Promovida a FEAT-04 el 2026-10-13 (`docs/02_discovery/features/FEAT-04-fecha-limite-inscripcion/feature.md`).
