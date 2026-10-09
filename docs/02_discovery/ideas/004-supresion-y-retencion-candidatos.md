---
id: IDEA-004
titulo: "Supresión y retención de los datos de candidatos"
estado: idea            # idea | aceptada | descartada | completada
fecha: 2026-10-09
autor: "responsable técnico (feature en vivo A del taller)"
modulos_afectados: [candidatos, inscripciones]
prioridad: null         # alta | media | baja (la fija la persona)
feature: null           # FEAT-NN cuando se acepte
completada_en: null
---

# IDEA-004 — Supresión y retención de los datos de candidatos

## Descripción
Anonimizar los datos personales de un candidato cuando lo pide (derecho de supresión) y cuando vence su plazo de
retención, como ya describe [RGPD.md](../../RGPD.md) §4 y §5. Hoy el ATS calcula y enseña la fecha de fin de retención,
pero no hace nada al llegar, y no hay forma de atender una petición de supresión.

## Problema u oportunidad
El reclutador conserva datos de candidatos más allá de lo que permite la base jurídica del ejemplo, y no puede atender
una petición de supresión sin borrar a mano. Es la pieza que cierra el ciclo de vida de los datos personales del ATS.

## Alcance (grano grueso)
`candidatos` (la ficha, el listado y la búsqueda) e `inscripciones` (los puertos que leen candidatos, el historial y la
nota del rechazo).

## Notas
- Feature en vivo **A** del taller: su shaping se hace en directo, y el material son las 9 cuestiones abiertas de
  [RGPD.md](../../RGPD.md) §7, que salieron de las reviews de HU-04 a HU-06 y de la auditoría del sprint-01. **No se
  resuelven aquí:** son las preguntas del shaping.
- Solución de referencia de la variante mínima (decisión de la persona responsable del 2026-10-09): llega hasta el PRD
  de la HU «Anonimizar a petición», sin implementar.
- Hoy el seed no tiene ningún candidato con la retención vencida (las fechas son relativas al reset): para enseñar el
  problema en la web harán falta datos inventados vencidos (pregunta para el shaping).
- Principios de interfaz que roza: [06_design_principles](../../06_design_principles/README.md), 4 (errores útiles) y
  5 (datos personales con cuidado). Si hace falta confirmar la anonimización, que es irreversible, es una pregunta del
  shaping.

## Decisión
<Se rellena al aceptar (con su FEAT-NN) o al descartar (con el motivo).>
