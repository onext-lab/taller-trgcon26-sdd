---
sprint: 03
objetivo: "Supresión y retención de los datos de candidatos (feature en vivo A): de la idea al PRD de «Anonimizar a petición», como solución de referencia del shaping en directo."
inicio: 2026-10-12
fin: 2026-10-14            # calendario aprobado por el responsable técnico (12-14/10), en lugar de los 2 días por defecto
estado: en curso           # planificado | en curso | completado | cerrado
base: 790836c              # sha de main al abrir el sprint (paso-3-punto-de-partida)
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-03 (2026-10-12 - 2026-10-14)

## Objetivo
Al final del sprint, FEAT-04 «Supresión y retención de los datos de candidatos» está shaped, partida en HU-07 a HU-09,
y HU-07 «Anonimizar a petición» tiene su PRD `Ready`. Es la solución de referencia de la feature en vivo A del taller,
en la rama `vivo/A`, con las etiquetas `vivo-A-1-feature` y `vivo-A-2-prd`. **Variante mínima** (decisión de la persona
responsable del 2026-10-09): no se implementa; HU-08 y HU-09 quedan en el backlog.

## Resumen de estado
- HU: hechas 0 / 1 · en curso 1 · bloqueadas 0 (HU-07, hasta el PRD)
- Última actualización: 2026-10-12

## Historias de usuario

### HU-07 · Anonimizar a petición · estado: en curso
- **Origen:** FEAT-04 · **Depende de:** nada · **Rama:** `hu/HU-07-anonimizar-a-peticion`
- [ ] prd-writer
- [ ] tech-design (fuera de la variante mínima)
- [ ] task-planner (fuera de la variante mínima)
- [ ] implementar-hu (fuera de la variante mínima)
- [ ] reviewer (fuera de la variante mínima)
- [ ] merge a main (fuera de la variante mínima)
- [ ] module-sync (fuera de la variante mínima)

## Tareas sin HU
_Ninguna._

## Orden de ejecución
1. HU-07 (sin dependencias), hasta el PRD.

## Backlog
- HU-08 «Anonimizar al vencer la retención» (depende de HU-07).
- HU-09 «Retención vencida pendiente de anonimizar» (depende de HU-07).

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- 2026-10-12 · **Rama y «main» de este sprint:** la solución de referencia vive en `vivo/A`, que sale de
  `paso-3-punto-de-partida` y no se integra en `main` (decisión del responsable técnico del 2026-10-09). Donde el flujo
  dice «`main`», en este sprint es `vivo/A`.
- 2026-10-12 · **Sprint que no se cierra con código:** por la variante mínima, HU-07 se queda en el PRD; el sprint no
  pasa por `/audit-sprint` ni `/cerrar-sprint`, porque no hay incremento de código que auditar. Lo que se enseña en el
  taller son las etiquetas `vivo-A-1-feature` y `vivo-A-2-prd`.
- 2026-10-12 · **Pendiente de ratificar:** las 4 respuestas de producto de FEAT-04 (PA-01 a PA-04) llevan la
  recomendación aplicada; si la persona responsable cambia alguna, se ajustan la feature y el PRD en una sola vuelta.
