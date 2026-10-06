---
sprint: NN
objetivo: "<una frase>"
inicio: AAAA-MM-DD
fin: AAAA-MM-DD            # por defecto, inicio + 1 (2 días)
estado: planificado        # planificado | en curso | completado | cerrado
base: <sha>                # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-NN (AAAA-MM-DD - AAAA-MM-DD)

## Objetivo
<Qué queda funcionando al final del sprint.>

## Resumen de estado
- HU: hechas N / total N · bloqueadas N
- Última actualización: AAAA-MM-DD HH:MM

## Historias de usuario

### HU-NN · <título> · estado: pendiente
- **Origen:** FEAT-NN · **Depende de:** <HU-NN o nada> · **Rama:** `hu/HU-NN-slug`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

## Tareas sin HU

### T-NN · <título> · estado: pendiente
- **Tipo:** infraestructura | spike | documentación

## Orden de ejecución
1. HU-NN (sin dependencias)
2. HU-NN (depende de HU-NN)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- …
