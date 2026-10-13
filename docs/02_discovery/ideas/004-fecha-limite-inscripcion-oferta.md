---
id: IDEA-004
titulo: "Fecha límite de inscripción en una oferta"
estado: aceptada        # idea | aceptada | descartada | completada
fecha: 2026-10-13
autor: "equipo del taller"
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
Hoy una oferta publicada acepta inscripciones mientras no se cierre. El reclutador quiere poder acotar de antemano
hasta qué día se aceptan candidatos en una oferta, sin tener que acordarse de cerrarla.

## Alcance (grano grueso)
Módulo `ofertas` (dato de la oferta, en su alta y su edición) y módulo `inscripciones` (impedir inscribir pasada la
fecha). API y web.

## Notas
- Dudas iniciales, a cerrar en el shaping (no se asume nada):
  - ¿La fecha es obligatoria u opcional? ¿Es solo un día o día y hora? ¿El propio día límite cuenta como dentro del
    plazo? ¿Con qué zona horaria y qué reloj se decide?
  - ¿Se puede fijar en el pasado? ¿Hay fecha máxima? ¿Qué pasa al publicar un borrador con la fecha ya pasada?
  - ¿Se puede cambiar, ampliar o quitar en una oferta publicada? ¿Y en una cerrada? ¿Ampliarla reabre las
    inscripciones?
  - ¿Se copia al duplicar una oferta?
  - ¿Qué error da la API al inscribir fuera de plazo y cómo convive con los de oferta cerrada o inscripción duplicada?
  - ¿Dónde se ve la fecha en la web (formulario, ficha, listado, pipeline)? ¿Qué pasa con las inscripciones ya
    existentes? ¿La oferta se cierra sola al vencer el plazo?
- Reglas ya validadas que probablemente roza: las de ofertas e inscripciones de
  [reglas-validadas.md](../reglas-validadas.md); fechas y zona horaria en
  [DECISIONS.md](../../07_architecture_principles/DECISIONS.md).
- Depende de [001-gestion-de-ofertas](completadas/001-gestion-de-ofertas.md) y
  [003-inscripciones-y-pipeline](completadas/003-inscripciones-y-pipeline.md).
- Toca UI: principios en [06_design_principles/README.md](../../06_design_principles/README.md) (en especial el 4,
  errores útiles junto al campo, y el 6, fechas en formato `dd/mm/aaaa`).
- La fecha límite no parece un dato personal; se confirmará en el shaping contra [RGPD.md](../../RGPD.md).

## Decisión
Promovida a FEAT-04 el 2026-10-13.
