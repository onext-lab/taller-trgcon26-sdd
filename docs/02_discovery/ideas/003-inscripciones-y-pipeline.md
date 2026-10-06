---
id: IDEA-003
titulo: "Inscripciones y pipeline de selección"
estado: aceptada        # idea | aceptada | descartada | completada
fecha: 2026-10-06
autor: "equipo del taller"
modulos_afectados: [inscripciones]
prioridad: null         # alta | media | baja (la fija la persona)
feature: FEAT-03        # FEAT-NN cuando se acepte
completada_en: null
---

# IDEA-003 — Inscripciones y pipeline de selección

## Descripción
El reclutador necesita inscribir candidatos en las ofertas publicadas y moverlos por las etapas del proceso de
selección (recibida, cribado, entrevista, oferta, contratado o rechazado), viendo el pipeline de cada oferta y el
historial de cambios de cada inscripción.

## Problema u oportunidad
Es el corazón del ATS: une ofertas y candidatos y deja rastro de cada decisión del proceso.

## Alcance (grano grueso)
Módulo `inscripciones` (API y web). Lee de `ofertas` (solo publicadas) y de `candidatos` (no anonimizados).

## Notas
- Reglas ya validadas que aplican: RV-05, RV-17 a RV-25 de [reglas-validadas.md](../reglas-validadas.md).
- Depende de [001-gestion-de-ofertas](001-gestion-de-ofertas.md) y [002-gestion-de-candidatos](002-gestion-de-candidatos.md).
- Datos personales: las notas de rechazo pueden acabar llevando datos sensibles ([RGPD.md](../../RGPD.md)).
- Toca UI: principios en [06_design_principles/README.md](../../06_design_principles/README.md).

## Decisión
Promovida a FEAT-03 el 2026-10-06.
