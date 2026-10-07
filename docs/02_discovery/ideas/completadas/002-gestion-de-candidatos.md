---
id: IDEA-002
titulo: "Gestión de candidatos"
estado: completada        # idea | aceptada | descartada | completada
fecha: 2026-10-06
autor: "equipo del taller"
modulos_afectados: [candidatos]
prioridad: null         # alta | media | baja (la fija la persona)
feature: FEAT-02        # FEAT-NN cuando se acepte
completada_en: "sprint-01"
---

# IDEA-002 — Gestión de candidatos

## Descripción
El reclutador necesita dar de alta candidatos con sus datos de contacto, un resumen y sus skills, editarlos, buscarlos
por nombre, email o skill, y registrar si el candidato consiente que se guarden sus datos para futuros procesos.

## Problema u oportunidad
Sin una ficha de candidato no hay a quién inscribir en las ofertas. Además, cada ficha guarda datos personales: hay
que tratarlos bien desde el principio (consentimiento y retención), no añadirlo después.

## Alcance (grano grueso)
Módulo `candidatos` (API y web).

## Notas
- Reglas ya validadas que aplican: RV-09 a RV-16 y RV-25 de [reglas-validadas.md](../../reglas-validadas.md).
- Datos personales: [RGPD.md](../../../RGPD.md) (minimización, base jurídica, retención). La anonimización es la feature A
  en vivo; aquí solo se registran el consentimiento y la fecha de fin de retención.
- Toca UI: principios en [06_design_principles/README.md](../../../06_design_principles/README.md).
- Ejemplo inventado: «Lucía Ferrer Soler», `lucia.ferrer@example.com`, skills `typescript`, `sql`.

## Decisión
Promovida a FEAT-02 el 2026-10-06.
Completada en sprint-01 el 2026-10-07 (FEAT-02: HU-03).
