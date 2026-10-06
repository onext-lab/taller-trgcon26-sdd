---
id: IDEA-001
titulo: "Gestión de ofertas de empleo"
estado: aceptada        # idea | aceptada | descartada | completada
fecha: 2026-10-06
autor: "equipo del taller"
modulos_afectados: [ofertas]
prioridad: null         # alta | media | baja (la fija la persona)
feature: FEAT-01        # FEAT-NN cuando se acepte
completada_en: null
---

# IDEA-001 — Gestión de ofertas de empleo

## Descripción
El reclutador necesita dar de alta las ofertas de empleo de la empresa, prepararlas como borrador, publicarlas cuando
estén listas, cerrarlas cuando termine el proceso y encontrarlas después en un listado.

## Problema u oportunidad
Hoy el ATS no tiene nada: sin ofertas no hay dónde inscribir candidatos. Es la base de los otros dos módulos.

## Alcance (grano grueso)
Módulo `ofertas` (API y web). Toca a `inscripciones` en un punto: qué pasa con las inscripciones al cerrar una oferta.

## Notas
- Reglas ya validadas que aplican: RV-01 a RV-08 y RV-25 de
  [reglas-validadas.md](../reglas-validadas.md).
- Toca UI: principios en [06_design_principles/README.md](../../06_design_principles/README.md).
- Ejemplo inventado: «Desarrollador/a backend (Node.js)», híbrida, Valencia, 32 000-40 000 €/año.

## Decisión
Promovida a FEAT-01 el 2026-10-06.
