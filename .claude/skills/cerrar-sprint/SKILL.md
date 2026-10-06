---
name: cerrar-sprint
description: Cierra un sprint con el gate de /audit-sprint y mueve a completadas/ las ideas, features y HU entregadas con su estado al día. Úsala al acabar un sprint, después de /audit-sprint y /module-sync.
---

# cerrar-sprint

## Propósito

Cerrar un sprint **no es solo** poner `estado: completado` en su frontmatter. Es **propagar el cierre por los tres niveles** de cada cosa entregada (idea → feature → HU) y archivar sus artefactos en las carpetas `completadas/`, manteniendo la trazabilidad. El nivel más olvidado son las ideas: se quedan en `ideas/` con `estado: aceptada` aunque ya estén entregadas.

No escribe código ni cierra HU técnicamente (eso es el flujo de la HU: `/reviewer`, merge y `/module-sync`). Solo **comprueba el gate, archiva y actualiza estados** de lo que ya está hecho.

## Idioma

Castellano de España, sin voseo. Identificadores en inglés.

## Uso

```
/cerrar-sprint NN        # p. ej. /cerrar-sprint 01
```

Sin `NN`, usa el sprint `en curso` más reciente de `docs/01_roadmap/sprints/`.

## Pre-flight checks

1. **Localiza** `docs/01_roadmap/sprints/sprint-{NN}.md`. Si no existe → STOP y pregunta.
2. **Lee** el sprint entero: HU y tasks con su estado y el «Resumen de estado».
3. **Qué está entregado.** Una HU cuenta como entregada solo si su estado es `hecha` y cumple la Definition of Done: PRD + diseño + tasks cerradas + review aprobada + merge a `main` + `/module-sync`. Lo demás **no se archiva**.

## Workflow

### Paso 1 — Inventario

Lista las **HU `hecha`** y **tasks `hecha`**. Para cada HU, resuelve su `FEAT-NN` (frontmatter `feature:` del `hu.md` o el `Origen:` del sprint) y la idea origen (frontmatter de la feature). Construye el mapa `idea → FEAT → HU` de cada cadena entregada.

### Paso 2 — Completitud por nivel

Antes de mover nada, confirma para cada cadena:
- **HU**: `hecha`, mergeada en `main` y con `/module-sync` hecho. Una HU con review no aprobada o tasks abiertas **no se mueve**.
- **Feature**: **todas** sus HU están `hecha`. Si queda alguna pendiente, no se mueve.
- **Idea**: todo lo derivado está `hecha`. Si está entregada a medias, no se cierra.

### Paso 3 — GATE de auditoría de sprint (BLOQUEANTE)

Este skill **consume** el veredicto de `/audit-sprint`; **no** vuelve a lanzar auditores.

1. **Localiza** `docs/10_audits/sprints/sprint-{NN}-AUDIT.md`. Si no existe → **STOP**: *«No hay auditoría de sprint. Ejecuta `/audit-sprint {NN}` antes de cerrar.»*
2. **Frescura:** el informe registra el commit auditado (`main` en ese momento). Si `git rev-parse --short main` es otro y el diff entre ambos toca código (`apps/`, `e2e/`), está **desactualizado** → STOP: *«Re-ejecuta `/audit-sprint {NN}`.»*
3. **Veredicto:** `grep '^VERDICT:' docs/10_audits/sprints/sprint-{NN}-AUDIT.md`.
   - `Aprobado` o `Aprobado con observaciones` → **sigue** (las observaciones pasan como deuda al siguiente sprint, en «Notas y decisiones»).
   - `Bloqueado`, o alguna dimensión «no concluida» → mira el override:
     - `audit-override: <razón de 20 caracteres o más>` en el frontmatter del sprint → **sigue**, pero registra el override en el informe (sección «Override») y en «Notas y decisiones» como **deuda heredada** del siguiente sprint.
     - Sin override, o con una razón más corta → **STOP**: lista los bloqueantes del informe (`fichero:línea`) y no archives nada.

El gate es **fail-closed**: sin informe, informe desactualizado, dimensión no concluida o `Bloqueado` sin override válido, el sprint no se cierra.

### Paso 4 — Archivar los tres niveles (checklist OBLIGATORIO)

Las carpetas `completadas/` son espejo de su carpeta padre; los IDs y slugs **no cambian**, solo la ruta y el estado. Usa `git mv` (nunca borres ni recrees). Nada se renumera.

**(1) IDEAS** → `docs/02_discovery/ideas/completadas/` — *el nivel más olvidado; revísalo a propósito.*
- En la idea: `estado: completada`, `completada_en: "sprint-{NN}"` y en «Decisión»: `Completada en sprint-{NN} el AAAA-MM-DD` (con la FEAT y las HU que la cerraron).
- `git mv docs/02_discovery/ideas/{NNN}-slug.md docs/02_discovery/ideas/completadas/`

**(2) FEATURES** → `docs/02_discovery/features/completadas/`
- En `feature.md`: `estado: entregada` y una nota de cierre (sprint, HU y commits de merge).
- `git mv docs/02_discovery/features/FEAT-NN-slug docs/02_discovery/features/completadas/`

**(3) HU** → `docs/03_delivery/hu/completadas/`
- En `hu.md`: `estado: hecha` en el frontmatter, sin sufijos. **Es el campo que más se olvida**: la carpeta dice «entregada» y la ficha sigue en `pendiente`. Lo comprueba el self-check (b).
- `git mv docs/03_delivery/hu/HU-NN-slug docs/03_delivery/hu/completadas/` (siempre **después** de `/module-sync`).
- Una HU cerrada **sin** entregarse (descartada o fusionada) no va a `completadas/`: se queda en su sitio con el estado y el motivo en su `hu.md`.

### Paso 5 — Barrido anti-olvido

Barre **todas** las ideas con `estado: aceptada` cuya feature ya tenga todas sus HU `hecha` y archívalas: **ninguna idea entregada se queda en `ideas/`**. Si un sprint anterior se cerró con cosas sin mover, complétalo ahora.

### Paso 6 — Cerrar el sprint

- Frontmatter: `estado: completado` y `cerrado_en: AAAA-MM-DD`.
- «Resumen de estado»: progreso final (X/Y), fecha de cierre e impedimentos resueltos o heredados.
- «Notas y decisiones»: lo que quedó a medias y pasa al siguiente sprint.

### Paso 7 — Reconciliar el detalle por HU (OBLIGATORIO)

El cuerpo del sprint tiene, por cada HU, una cabecera `### HU-NN · … · estado:` y sus subtareas como checkboxes. Marcar el frontmatter no basta:

1. En cada HU entregada: cabecera `· estado: hecha` y todas sus subtareas a `[x]`.
2. **Self-checks deterministas (fail-closed).** Las dos salidas tienen que quedar vacías antes de fijar `cerrado_en`:

   **(a) Cuerpo del sprint**: ningún bloque `hecha` con un `[ ]` dentro.
   ```bash
   awk '/^## / {h=""; next} /^### / {h=$0; next}
        h ~ /estado:[[:space:]]*hecha([[:space:]]|$)/ && /\[ \]/ {print "DRIFT: " FNR ": " h " | " $0}' \
     docs/01_roadmap/sprints/sprint-{NN}.md
   ```

   **(b) `hu.md` archivados**: toda HU del sprint que esté en `completadas/` dice `estado: hecha`.
   ```bash
   for id in $(grep -oE '^### HU-[0-9]+' docs/01_roadmap/sprints/sprint-{NN}.md | cut -c5-); do
     for f in docs/03_delivery/hu/completadas/"$id"-*/hu.md; do
       [ -e "$f" ] || continue
       grep -qE '^estado:[[:space:]]*hecha([[:space:]]|$)' "$f" || echo "DRIFT: $f"
     done
   done
   ```
   Cada línea `DRIFT` se corrige (marca `[x]` o corrige el estado real) antes de cerrar.

### Paso 8 — Integridad tras los `git mv`

- Ajusta los enlaces relativos rotos que importen (handoff feature ↔ HU, enlaces de `docs/MVP-STATUS.md` y `docs/_modules.md`).
- `npm run check:harness` en verde (comprueba los enlaces relativos de `docs/`).
- Nada entregado fuera de `completadas/` y nada parcial dentro.
- Commit en `main` con los movimientos (`chore(sprint-NN): cierre del sprint`) y, si el taller lo pide, la etiqueta local de la fase. Sin push: el repo no tiene remoto.

## Reglas duras

- **Gate de auditoría obligatorio** (Paso 3), fail-closed, con `audit-override` como única válvula (razón de 20 caracteres o más, registrada y heredada como deuda).
- **No te saltes ningún nivel**: ideas, features y HU, siempre los tres.
- **Reconcilia el detalle por HU** (Paso 7) y no fijes `cerrado_en` con drift pendiente.
- **Solo se archiva lo hecho.** Lo parcial se queda con una nota de qué falta.
- **`git mv`, nunca borrar ni renumerar.** `completadas/` y `descartadas/` cuentan para el máximo de IDs.
- **La HU se archiva después de `/module-sync`.**
- **Pide confirmación** antes de los `git mv` si hay dudas de si una cadena está completa.

## Cuándo NO eres tú

- Auditar el sprint → `/audit-sprint`. Planificar o poblar un sprint → `product-owner` y `/crear-sprint`.
- Shaping → `/feature-shaping`. Cerrar técnicamente una HU → `/reviewer` y `/module-sync`.
