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
- HU: 0 · tareas sin HU: hechas 5 / 7 (T-08 a T-14)
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

### T-09 · Umbral de 50 líneas por función medido con lint · estado: hecha
- **Tipo:** refactor interno sin cambio de contrato (auditoría del sprint-01, A-03 y C-02)
- Partir `createJobsRepository` y las otras factorías de objetos de métodos con el patrón `createXOperations` de
  `applications`, y los plugins de rutas en funciones de registro por grupo. Después, `max-lines-per-function` (50) en
  `npm run lint` sobre `apps/api/src` y `apps/web/src`, sin excepciones.

### T-10 · Convenciones del repo · estado: hecha
- **Tipo:** documentación (auditoría del sprint-01, A-07)
- Decidir cuáles de las 8 candidatas de la auditoría (§2, info) pasan a «Convenciones del repo», cada una con un ejemplo
  de código. Las decide el responsable técnico sobre una propuesta.
- 2026-10-09 · **Decidido por el responsable técnico:** pasan la 1 y la 2 juntas («factorías cortas», vigiladas por el
  lint tras T-09), la 3, la 4, la 5, la 7 y la 8; la 6 (`isNotFound` copiada en 5 pantallas) no es convención, sino
  deuda, y va a T-14. Se añade un subapartado «Datos y consistencia» con 5 más del module-sync de HU-04: una sola
  `withTransaction` por operación cruzada; el índice único decide el duplicado, sin `SELECT` previo; los puertos leen con
  columnas explícitas; etapa, fechas y motivo nunca vienen del cliente, y la guarda de estado va en el `WHERE`, con 0
  filas → 409. Todo en `docs/ARCHITECTURE.md` §Convenciones, por capa, con un ejemplo `fichero:línea` en cada una.

### T-14 · Un solo `isNotFound` en la web · estado: pendiente
- **Tipo:** refactor interno de capa web (auditoría del sprint-01, §2 info; decisión del responsable técnico del
  2026-10-09)
- `isNotFound(error)` está copiada en 5 pantallas (`JobDetailScreen`, `CandidateFormScreen`, `CandidateDetailScreen`,
  `ApplicationDetailScreen` y `PipelineScreen`). Se extrae a un único helper común, sin cambio de comportamiento. El
  repo se va a enseñar y a publicar, y 5 copias de lo mismo en las pantallas se ven.

### T-11 · Ninguna ruta de máquina y citas de módulo al día · estado: hecha
- **Tipo:** publicación (auditoría del sprint-01, A-10; publicación P6)
- Una regla automática contra `/Users/`, `/home/` y `C:\Users\`, con su test, y los briefs de las HU saneados. Además, el
  barrido de las citas `fichero:línea` de `functional.md` y `technical.md` de los tres módulos, como el de los UC
  (`055673b`).
- 2026-10-09 · Hechos: `scripts/check-machine-paths.mjs` (con autoprueba y `--history`), la causa cerrada en la
  plantilla del brief y en `/implementar-hu`, y el barrido de módulo (6 citas, todas correctas). **Bloqueado:** el
  saneado de los 59 + 1 briefs, que el clasificador de permisos denegó al builder; escalado a la persona responsable.
  Hasta entonces, el script no se encadena en `check:harness`. Detalle en `sprint-02/T-11-BRIEF.md` §7.
- 2026-10-09 · **Desbloqueada y cerrada:** la persona responsable ejecutó el saneado (59 ficheros, 60 líneas); la regla
  ya va en `check:harness`, con 0 coincidencias.

### T-12 · Autoría para publicar: `check-clean` de identidades y puerta `--publish` · estado: hecha
- **Tipo:** publicación (P6, decisión del responsable técnico del 2026-10-07)
- `.mailmap` con el titular onext, manteniendo los `Co-Authored-By`. `scripts/check-clean.mjs` revisa también autor,
  committer y etiquetas, con su test.
- 2026-10-09 · **Alcance decidido por el responsable técnico:** `check-clean` revisa identidades en bruto contra la
  denylist; `check-clean --publish --mailmap <ruta>` es la puerta de publicación (identidades fuera de la lista
  permitida y marcadores de publicación pendientes), y `check:harness` solo avisa de los marcadores. **El `.mailmap` no
  se versiona:** el responsable técnico decidió reescribir las identidades del historial de publicación («Reescribir identidades»), así
  que el `.mailmap` es la entrada de esa reescritura y vive fuera del repo, como la denylist (un `.mailmap` versionado
  publicaría los emails que mapea).

### T-13 · Licencias y aviso de archivo · estado: pendiente
- **Tipo:** publicación (P6, decisión del responsable técnico del 2026-10-07)
- `LICENSE` (MIT para el código y `.claude/`) y `NOTICE` (titular onext; CC BY 4.0 solo para la prosa de `docs/`; mapa
  de rutas). En el README: «ejemplo archivado, sin soporte», archivo el 2026-12-31 y una frase sobre la relación con el
  otro SDD público de onext. El `git bundle` final se genera más tarde, del 19 al 21/10.
- 2026-10-09 · **Decidido por el responsable técnico:** las plantillas de `docs/_templates/` y los bloques de código
  copiables, bajo MIT; el resto de la prosa de `docs/`, bajo CC BY 4.0. El titular y la razón social, con marcadores
  hasta que el responsable técnico los dé. La frase del README: «Este kit es un ejemplo didáctico derivado del flujo SDD de onext; el
  plugin SDD de onext para uso general está en su propio repositorio», con la URL como marcador.

## Orden de ejecución
1. T-08 (sin dependencias)
2. T-09 (sin dependencias; después de T-08 para medir con el script nuevo)
3. T-10 (después de T-09: alguna convención sale del patrón `createXOperations`)
4. T-11 (sin dependencias)
5. T-12 (sin dependencias)
6. T-13 (después de T-12: el README del aviso nombra al titular)
7. T-14 (después de T-10)

## Backlog (pendiente, fuera de paso-3)

### T-15 · Copia de publicación con el historial reescrito y la trazabilidad intacta · estado: pendiente (ventana del 19 al 21/10)
- **Tipo:** publicación (decisión del responsable técnico del 2026-10-09, «Reescribir identidades»). **No entra en paso-3** ni en su
  auditoría; se diseña aquí para que la ventana no empiece de cero.
- **Dónde:** siempre sobre una **copia de publicación** (`git clone --no-local` del repo de trabajo en una carpeta
  fuera de él), nunca en el repo de trabajo. Herramienta: `git filter-repo`, ya instalado en el portátil del
  responsable.
- **Entradas que viven fuera del repo:** el `.mailmap` (lo crea el responsable técnico con el titular) y la denylist.
- **Pasos:**
  1. En el repo de trabajo: `check-clean` normal en verde y T-11 cerrada (`check-machine-paths` en 0 en el árbol).
  2. Identidades: `git filter-repo --mailmap <ruta>` en la copia. Reescribe autor, committer y tagger; los
     `Co-Authored-By` son texto del mensaje y se conservan (se comprueba contando los trailers antes y después).
  3. Rutas de máquina en el historial: las versiones antiguas de los briefs las llevan (`check-machine-paths
     --history`: 59 commits). Se limpian en la misma pasada, con la sustitución de T-11 aplicada a cada blob.
  4. **Hashes citados en el contenido** (113 citas entre comillas invertidas en 28 ficheros de `docs/`, más las que van
     sin comillas, como `base:` de los sprints y los `REVIEW.md`): `filter-repo` traduce solo los de los mensajes. Para
     los del contenido, una sola pasada en orden de commits, con `filter-repo` como librería: al procesar cada commit,
     sus blobs se reescriben con el mapa viejo→nuevo de los commits **anteriores**, que ya es definitivo porque cada
     doc cita commits previos al suyo. Solo se traducen las cadenas que están en el mapa, para no tocar palabras
     hexadecimales que no son hashes. Si un doc citara un commit posterior al suyo, se para y se informa.
  5. **Verificación en la copia:**
     - un script `check-cited-hashes` comprueba que cada hash citado en `docs/` (y en `base:`) resuelve a un commit
       del historial nuevo y que el número de citas coincide con el del repo de trabajo;
     - `/audit-sprint 01` y `/audit-sprint 02` arrancan (su `base` resuelve);
     - `check-clean --publish --mailmap <ruta>` y `check-machine-paths --history` en verde;
     - `npm run integrate` en verde en cada etiqueta.
  6. `git bundle create` desde la copia, con todas las etiquetas.
- **Riesgos:** colisión de hashes cortos en el historial nuevo (se usa la longitud mínima sin ambigüedad); citas de
  hashes en formatos no previstos (se buscan con una regex amplia antes de reescribir y se revisa la lista).

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
