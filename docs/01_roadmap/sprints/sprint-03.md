---
sprint: 03
objetivo: "Importación CSV de candidatos (feature en vivo C): de la feature al código integrado, con su solución de referencia por etiquetas."
inicio: 2026-10-12
fin: 2026-10-14            # calendario aprobado por el responsable técnico (12-14/10), en lugar de los 2 días por defecto
estado: en curso           # planificado | en curso | completado | cerrado
base: 790836c              # sha de main al abrir el sprint (paso-3-punto-de-partida); /audit-sprint audita base..cabeza
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-03 (2026-10-12 - 2026-10-14)

## Objetivo
Al final del sprint, el reclutador sube un CSV de candidatos y el ATS da de alta las filas válidas, descarta los
duplicados sin tocar a nadie y le enseña un informe con qué entró, qué no y por qué (FEAT-04, UC-20). Es la solución
de referencia de la feature en vivo C del taller, en la rama `vivo/C`, con las etiquetas `vivo-C-1-feature`,
`vivo-C-2-prd`, `vivo-C-3-tareas` y `vivo-C-4-hecho`.

## Resumen de estado
- HU: hechas 1 / 1 · en curso 0 · bloqueadas 0
- Última actualización: 2026-10-12

## Historias de usuario

### HU-07 · Importar candidatos desde un CSV · estado: hecha
- **Origen:** FEAT-04 · **Depende de:** nada · **Rama:** `hu/HU-07-importar-candidatos-csv`
- [x] prd-writer (Ready, con las 5 PA pendientes de ratificar)
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer (Aprobado con observaciones)
- [x] merge a main (a `vivo/C`, `0bd38ac`)
- [x] module-sync (solo factual)

## Tareas sin HU
_Ninguna._

## Orden de ejecución
1. HU-07 (sin dependencias)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- 2026-10-12 · **Rama y «main» de este sprint:** la solución de referencia vive en `vivo/C`, que sale de
  `paso-3-punto-de-partida` y no se integra en `main` (decisión del responsable técnico del 2026-10-09). Donde el flujo
  dice «`main`» (merge de la HU, `/module-sync`, auditoría), en este sprint es `vivo/C`.
- 2026-10-12 · **Pendiente de ratificar:** las 5 respuestas de producto de FEAT-04 (PA-01 a PA-05) llevan la
  recomendación aplicada. Si la persona responsable cambia alguna, se ajusta el PRD en una sola vuelta, antes del
  diseño.
- Presupuesto de la variante mínima (A hasta el PRD + C completa): ~6,6 M tokens; a los 8 M se para y se avisa.
- Modelos: builders, drift y tabla con sonnet; `security-auditor` y `datos-personales-auditor` con el modelo de la
  sesión (decisión del responsable técnico del 2026-10-09).
