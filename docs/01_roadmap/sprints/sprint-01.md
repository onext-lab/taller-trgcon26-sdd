---
sprint: 01
objetivo: "Núcleo del ATS funcionando de principio a fin: ofertas con su ciclo de vida, candidatos con su consentimiento y retención, e inscripciones con su pipeline e historial."
inicio: 2026-10-06
fin: 2026-10-07            # por defecto, inicio + 1 (2 días)
estado: planificado        # planificado | en curso | completado | cerrado
base: 2cd8752              # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-01 (2026-10-06 - 2026-10-07)

## Objetivo
Al final del sprint, el reclutador crea, publica, cierra y duplica ofertas; da de alta, edita y busca candidatos con su
consentimiento y su fin de retención calculado; y los inscribe en ofertas publicadas y los lleva por el pipeline
(avance, rechazo e historial), con el cierre de una oferta rechazando sus inscripciones activas.

## Resumen de estado
- HU: hechas 0 / total 5 · bloqueadas 0
- Última actualización: 2026-10-06 15:45

## Historias de usuario

### HU-01 · Crear, editar y consultar ofertas en borrador · estado: pendiente
- **Origen:** FEAT-01 · **Depende de:** nada · **Rama:** `hu/HU-01-ofertas-borrador`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

### HU-02 · Publicar, cerrar, duplicar y listar ofertas con filtros · estado: pendiente
- **Origen:** FEAT-01 · **Depende de:** HU-01 · **Rama:** `hu/HU-02-ciclo-vida-ofertas`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

### HU-03 · Alta, edición y búsqueda de candidatos, con consentimiento · estado: pendiente
- **Origen:** FEAT-02 · **Depende de:** nada · **Rama:** `hu/HU-03-candidatos-consentimiento`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

### HU-04 · Inscribir en una oferta publicada, sin duplicados · estado: pendiente
- **Origen:** FEAT-03 · **Depende de:** HU-02 y HU-03 · **Rama:** `hu/HU-04-inscribir-candidato`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

### HU-05 · Pipeline con cambio de etapa e historial · estado: pendiente
- **Origen:** FEAT-03 · **Depende de:** HU-04 · **Rama:** `hu/HU-05-pipeline-etapas`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

## Tareas sin HU

### T-01 · `engine-strict` para exigir Node 24 en `npm ci` · estado: hecha
- **Tipo:** infraestructura
- `.npmrc` con `engine-strict=true` y nota en `docs/SETUP.md`. Con Node 20, `npm ci` se para con `EBADENGINE`;
  con Node 24, instala. Origen: al empezar `/implementar-hu HU-01`, una terminal con Node 20 hacía fallar los
  tests de la API con «No such built-in module: node:sqlite».

## Orden de ejecución
1. HU-01 (sin dependencias)
2. HU-02 (depende de HU-01)
3. HU-03 (sin dependencias; puede solaparse con HU-02 si no comparten ficheros)
4. HU-04 (depende de HU-02 y HU-03)
5. HU-05 (depende de HU-04)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- Ventana tolerada en `main` (HU-02): entre el merge de HU-04 y el de HU-05, cerrar una oferta con inscripciones
  activas la cierra sin rechazarlas; INV-05 se cumple al entrar HU-05.
