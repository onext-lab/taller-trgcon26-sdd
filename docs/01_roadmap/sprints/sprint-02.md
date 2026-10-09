---
sprint: 02
objetivo: "Punto de partida del taller (paso-3): deuda de demo, umbral de función, convenciones y lo necesario para publicar, sin features nuevas."
inicio: 2026-10-09
fin: 2026-10-10            # por defecto, inicio + 1 (2 días)
estado: en curso           # planificado | en curso | completado | cerrado
base: 8328116              # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-02 (2026-10-09 - 2026-10-10)

## Objetivo
Al final del sprint, el repo está listo como punto de partida del taller: la integración se puede ejecutar en directo
sin falsos rojos y con un tiempo medido, el umbral de 50 líneas por función se mide con lint, las convenciones del repo
están decididas y el repo cumple lo que pide la publicación (licencias, autoría y ninguna ruta de máquina). Es un sprint
técnico: **sin HU**, solo tareas. Las features en vivo (A y C) no entran.

## Resumen de estado
- HU: 0 · tareas sin HU: hechas 1 / 6 (T-08 a T-13)
- Última actualización: 2026-10-09

## Historias de usuario
_Ninguna: sprint técnico (decisión del responsable técnico, 2026-10-09)._

## Tareas sin HU

### T-08 · Deuda de demo: integración en serie, medida y con logs · estado: hecha
- **Tipo:** infraestructura de tests (auditoría del sprint-01, A-02)
- (a) Un script de integración que ejecute typecheck, lint, unitarios y e2e **en serie**, nunca unitarios y e2e a la
  vez, con los e2e en *workers* acotados. (b) Un *timeout* por test web fijado y justificado, sin subirlo a ciegas.
  (c) La pasada completa medida limitando *workers*, para saber cuánto dura en directo; la medida en una máquina
  modesta de verdad queda para el ensayo del 15/10. (d) Los logs de cada fallo guardados en un fichero ignorado por git.

### T-09 · Umbral de 50 líneas por función medido con lint · estado: pendiente
- **Tipo:** refactor interno sin cambio de contrato (auditoría del sprint-01, A-03 y C-02)
- Partir `createJobsRepository` y las otras factorías de objetos de métodos con el patrón `createXOperations` de
  `applications`, y los plugins de rutas en funciones de registro por grupo. Después, `max-lines-per-function` (50) en
  `npm run lint` sobre `apps/api/src` y `apps/web/src`, sin excepciones.

### T-10 · Convenciones del repo · estado: pendiente
- **Tipo:** documentación (auditoría del sprint-01, A-07)
- Decidir cuáles de las 8 candidatas de la auditoría (§2, info) pasan a «Convenciones del repo», cada una con un ejemplo
  de código. Las decide el responsable técnico sobre una propuesta.

### T-11 · Ninguna ruta de máquina y citas de módulo al día · estado: pendiente
- **Tipo:** publicación (auditoría del sprint-01, A-10; publicación P6)
- Una regla automática contra `/Users/`, `/home/` y `C:\Users\`, con su test, y los briefs de las HU saneados. Además, el
  barrido de las citas `fichero:línea` de `functional.md` y `technical.md` de los tres módulos, como el de los UC
  (`055673b`).

### T-12 · Autoría para publicar: `.mailmap` y `check-clean` de autor, committer y etiquetas · estado: pendiente
- **Tipo:** publicación (P6, decisión del responsable técnico del 2026-10-07)
- `.mailmap` con el titular onext, manteniendo los `Co-Authored-By`. `scripts/check-clean.mjs` revisa también autor,
  committer y etiquetas, con su test.

### T-13 · Licencias y aviso de archivo · estado: pendiente
- **Tipo:** publicación (P6, decisión del responsable técnico del 2026-10-07)
- `LICENSE` (MIT para el código y `.claude/`) y `NOTICE` (titular onext; CC BY 4.0 solo para la prosa de `docs/`; mapa
  de rutas). En el README: «ejemplo archivado, sin soporte», archivo el 2026-12-31 y una frase sobre la relación con el
  otro SDD público de onext. El `git bundle` final se genera más tarde, del 19 al 21/10.

## Orden de ejecución
1. T-08 (sin dependencias)
2. T-09 (sin dependencias; después de T-08 para medir con el script nuevo)
3. T-10 (después de T-09: alguna convención sale del patrón `createXOperations`)
4. T-11 (sin dependencias)
5. T-12 (sin dependencias)
6. T-13 (después de T-12: el README del aviso nombra al titular)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- 2026-10-09 · **Por qué hay sprint-02** (responsable técnico): la frase «no hay sprint-02 antes del taller» del cierre
  del sprint-01 se refería a sprints de features. La deuda de paso-3 va en este sprint técnico, que se cierra con
  `/audit-sprint` para que la etiqueta `paso-3-punto-de-partida` salga auditada como las demás. No se reabre el
  sprint-01.
- Antes de abrir el sprint, y dentro de `base..main`, ya están hechos: el borrador del guion (`6d8073e`), el README y
  `SETUP.md` (`85cc2b6`) y la corrección de 13 citas de test en la trazabilidad de UC-01, UC-09, UC-10 y UC-14
  (`055673b`).
- El sprint se trabaja en la rama de integración `worktree-paso-3-punto-de-partida`, como el sprint-01. El avance de
  `main` y la etiqueta los decide el responsable técnico tras revisar.
- 2026-10-09 · **Briefs de las tareas sin HU:** R1 de `docs/IMPLEMENTATION-RULE.md` guarda el brief en la carpeta de la
  HU, y estas tareas no tienen. Van en `docs/01_roadmap/sprints/sprint-02/T-NN-BRIEF.md`, con la plantilla entera y su
  §7 (integración) rellena por la sesión (decisión de la sesión).
- Tareas de un día cada una como mucho; si alguna pasa de su techo de 2 ciclos de arreglo, se para y se escala.
