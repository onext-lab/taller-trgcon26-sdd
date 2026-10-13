---
sprint: 03
objetivo: "El reclutador puede fijar una fecha límite de inscripción en una oferta y el ATS no inscribe a nadie más pasado ese día."
inicio: 2026-10-13
fin: 2026-10-14            # por defecto, inicio + 1 (2 días)
estado: planificado        # planificado | en curso | completado | cerrado
base: 8fe07ec              # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-03 (2026-10-13 - 2026-10-14)

## Objetivo
Al final del sprint, el reclutador puede fijar, al crear o editar una oferta, una fecha límite de inscripción opcional
que se ve en la lista de ofertas y en el pipeline; pasado ese día (Europe/Madrid, inclusivo) el ATS no inscribe a nadie
más en ella, sin cerrar la oferta ni tocar las inscripciones que ya existen (FEAT-04).

## Resumen de estado
- HU: hechas 0 / total 1 · bloqueadas 0
- Última actualización: 2026-10-13 11:45

## Historias de usuario

### HU-07 · Fecha límite de inscripción en una oferta · estado: pendiente
- **Origen:** FEAT-04 · **Depende de:** nada · **Rama:** `hu/HU-07-fecha-limite-inscripcion`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

## Tareas sin HU
_Ninguna._

## Orden de ejecución
1. HU-07 (sin dependencias: se apoya en FEAT-01 y FEAT-03, ya entregadas)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- Sprint de práctica del taller, abierto en la rama `practica/fecha-limite-inscripcion` (sale de
  `paso-3-punto-de-partida`), que hace las veces de `main` en esta práctica: `base` es su commit al abrir el sprint.
- HU-07 es la única HU de FEAT-04 por decisión de la persona (R7, 2026-10-13): fullstack y sin RGPD.
- Riesgo anotado en el handoff de FEAT-04: ocho UC modificados en una sola HU pueden acercarse al techo de 15 tareas
  de `/task-planner`; si lo pasa, se para y se escala.
