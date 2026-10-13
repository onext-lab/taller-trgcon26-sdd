---
sprint: 03
objetivo: "Fecha límite de inscripción en una oferta (práctica del taller): de la idea al código revisado en una sola HU."
inicio: 2026-10-13
fin: 2026-10-14            # por defecto, inicio + 1 (2 días)
estado: planificado        # planificado | en curso | completado | cerrado
base: 2b12ab0              # sha de la rama de la práctica al abrir el sprint (hace de main); /audit-sprint audita base..rama
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-03 (2026-10-13 - 2026-10-14)

## Objetivo
Al final del sprint, el reclutador puede fijar una fecha límite de inscripción opcional al crear o editar una oferta,
la API rechaza inscribir pasada esa fecha con 409 `ENROLLMENT_DEADLINE_PASSED` y el pipeline no ofrece «Inscribir
candidato» cuando el plazo ha vencido (FEAT-04).

## Resumen de estado
- HU: hechas 0 / 1 · bloqueadas 0
- Última actualización: 2026-10-13 11:59

## Historias de usuario

### HU-07 · Fecha límite de inscripción en una oferta · estado: en curso
- **Origen:** FEAT-04 · **Depende de:** nada · **Rama:** `hu/HU-07-fecha-limite-inscripcion`
- [x] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

## Tareas sin HU
_Ninguna._

## Orden de ejecución
1. HU-07 (sin dependencias)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- 2026-10-13 · **Rama de la práctica:** este sprint vive en la rama `practica/fecha-limite-inscripcion`, que sale de
  `paso-3-punto-de-partida` y no se integra en `main`. Donde el flujo dice «`main`» o «`hu/HU-07-…`», en la práctica
  es esa rama. Sus puntos de control son las etiquetas `taller-1-feature` a `taller-5-hecho`.
