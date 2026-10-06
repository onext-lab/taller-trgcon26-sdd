---
name: crear-sprint
description: Crea docs/01_roadmap/sprints/sprint-NN.md de 2 días (hoy y mañana) con numeración global de HU-NN y T-NN de scripts/next-id.mjs. Úsala para abrir un sprint; es simétrica de /cerrar-sprint.
---

# crear-sprint

## Propósito

Crear un sprint con la convención del proyecto de forma **determinista**: nombre `sprint-NN`, duración estándar de **2 días** y **numeración global** de `HU-NN` y `T-NN`, que continúa del último número usado en cualquier sprint o carpeta de HU. Es el verbo de **apertura**, simétrico de `/cerrar-sprint`.

No ejecuta el flujo de las HU (eso pasa dentro de cada carpeta de HU) ni cierra nada.

## Idioma

Castellano de España, sin voseo. Identificadores en inglés.

## Uso

```
/crear-sprint                          # 2 días desde hoy; pregunta objetivo y contenido
/crear-sprint "objetivo del sprint"    # con objetivo
```

Otra duración **solo si se pide explícitamente** («sprint de una semana»).

## Pre-flight checks

1. **Consulta la fecha real de hoy** (`date +%F`); nunca la asumas.
2. **Estás en la raíz del repo**, en `main` y con el árbol limpio (`git status --short` vacío). Si no, avisa: el sprint se abre desde `main`.

## Workflow

### Paso 1 — Número de sprint

```bash
node scripts/next-id.mjs sprint    # imprime p. ej. sprint-01
```

### Paso 2 — Siguientes `HU-NN` y `T-NN` globales

```bash
node scripts/next-id.mjs hu        # máximo entre docs/03_delivery/hu/**/HU-NN-* y los «### HU-NN» de los sprints, +1
node scripts/next-id.mjs task      # máximo de los «### T-NN» de los sprints, +1
```

Son **globales y secuenciales entre sprints**: no se reinician por sprint, y una HU en `completadas/` tiene su número igual de tomado. Si el sprint lleva varias HU, numéralas de forma consecutiva a partir del valor devuelto.

### Paso 3 — Fechas

- `inicio` = **hoy** (fecha real).
- `fin` = **hoy + 1** (2 días). Otra duración solo si se pidió.

### Paso 4 — Objetivo y contenido (interactivo)

Si no se pasaron, **pregunta** el objetivo (1-3 frases) y qué HU o tasks entran, cada una con su `Origen: FEAT-NN` y sus dependencias. No inventes HU: lo que entra lo decide el usuario (o el `product-owner` con su aprobación). Si solo se quiere el esqueleto, créalo vacío.

Ejemplo del ATS: objetivo «Gestionar ofertas de principio a fin»; HU «Crear y editar ofertas en borrador» (`Origen: FEAT-01`) y «Publicar o cerrar ofertas y listarlas con filtros» (`Origen: FEAT-01`, depende de la anterior).

### Paso 5 — Escribir el fichero

Crea `docs/01_roadmap/sprints/sprint-{NN}.md` desde `docs/_templates/SPRINT.template.md`:

- Título: `# sprint-{NN} ({inicio} - {fin})`, con fechas `AAAA-MM-DD`.
- Frontmatter: `sprint: {NN}`, `objetivo`, `inicio`, `fin`, `estado: planificado`, `base: <sha>` con la salida de `git rev-parse --short main` (el commit de partida; `/audit-sprint` audita el diff `base..main`).
- Cuerpo: Objetivo · Resumen de estado (progreso 0/N y fecha) · Historias de usuario · Tasks · Notas y decisiones.
- Cada HU es una sección `### HU-{NN} · {título} · estado: pendiente`, con `Origen: FEAT-NN`, `Depende de:`, la rama `hu/HU-{NN}-slug` y las subtareas del flujo como checkboxes, una por línea: `/prd-writer`, `/tech-design`, `/task-planner`, `/implementar-hu`, `/reviewer`, merge a `main`, `/module-sync`.
- Cada task sin HU es una sección `### T-{NN} · {título} · estado: pendiente`.

### Paso 6 — Commit en `main` y confirmar

`git add -- docs/01_roadmap/sprints/sprint-{NN}.md` y `git commit -m "docs(sprint-{NN}): open sprint"`. Sin push.

Muestra la ruta creada, el número, las fechas y los `HU-NN` y `T-NN` asignados. Sugiere: *«Cada HU arranca su flujo con `/prd-writer HU-NN`, que crea su rama `hu/HU-NN-slug` desde `main`.»*

## Reglas duras

- **Duración estándar de 2 días** (`inicio` = hoy, `fin` = hoy + 1). Fecha real, nunca supuesta.
- **Numeración con `scripts/next-id.mjs`**, global y secuencial; los IDs no se reutilizan ni se renumeran.
- **Nombre canónico** `sprint-NN.md` (2 dígitos) y fechas en el título.
- **Estado inicial `planificado`.** Mantener el estado y el progreso al día es tarea del `product-owner`.
- **No inventes HU ni tasks**: pregunta qué entra.

## Cuándo NO eres tú

- Cerrar y archivar un sprint → `/cerrar-sprint` (antes, `/audit-sprint`).
- Registrar una idea → `/anadir-idea`.
- Ejecutar el flujo de una HU → `/prd-writer` → `/tech-design` → `/task-planner` → `/implementar-hu` → `/reviewer` → `/module-sync`.

## Contexto

Los sprints agrupan HU con fechas; ver `docs/WORKFLOW.md`. Plantilla: `docs/_templates/SPRINT.template.md`. Convención completa en `.claude/agents/product-owner.md`.
