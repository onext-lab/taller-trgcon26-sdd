---
name: anadir-idea
description: Registra una idea en docs/02_discovery/ideas/NNN-slug.md con el siguiente IDEA-NNN de scripts/next-id.mjs. Úsala con «añade una idea» o /anadir-idea. Solo captura; el shaping es /feature-shaping.
---

# anadir-idea

## Propósito

Registrar de forma **determinista** una idea cruda en el inbox de discovery. La numeración `IDEA-NNN` no se hace a mano ni de memoria: la calcula `node scripts/next-id.mjs idea`, que toma el máximo global sobre `docs/02_discovery/ideas/` **y todas sus subcarpetas** (`completadas/`, `descartadas/`) y suma uno.

**Solo registra la captura cruda** (`estado: idea`). No hace shaping (eso es `/feature-shaping`) ni abre una HU.

## Idioma

Castellano de España, sin voseo. Identificadores de código en inglés.

## Uso

```
/anadir-idea "<título de la idea>"
```

Ejemplos del ATS: «Importar candidatos desde un CSV», «Anonimizar candidatos al vencer la retención», «Valorar entrevistas con una scorecard».

## Pre-flight checks (bloquean)

1. **Hay un título.** Si no se dio, pídelo; no lo inventes. Un título vacío o solo con símbolos no vale.
2. **Estás en la raíz del repo** (existe `scripts/next-id.mjs`). Si no, STOP.

El repo del taller no tiene remoto: **no hay que sincronizar** antes de numerar. La colisión posible es local (otra sesión o rama que creó una idea entre medias), y la cubre el guardarraíl del Paso 4.

## Workflow

### Paso 1 — Calcular el siguiente `IDEA-NNN`

```bash
node scripts/next-id.mjs idea      # imprime p. ej. IDEA-004
```

El número son los dígitos de la salida (`004`). Se rellena a 3 dígitos; a partir de 1000 se escribe tal cual. **Una idea descartada tiene su número igual de tomado que una completada**: el script ya recorre las dos carpetas.

### Paso 2 — Normalizar el slug

Del título: minúsculas, kebab-case, **sin tildes ni eñes** (á→a, ñ→n), sin signos, longitud razonable. Ej.: `«Importación CSV de candidatos»` → `importacion-csv-candidatos`.

### Paso 3 — Redactar el fichero

`docs/02_discovery/ideas/{NNN}-{slug}.md` desde `docs/_templates/IDEA.template.md`, con frontmatter:

- `id: IDEA-{NNN}` — **igual** que el `{NNN}` del nombre de fichero.
- `titulo: "<título>"`, `estado: idea`, `fecha: <hoy>` (consulta la fecha real), `autor: "<usuario>"`, `modulos_afectados: [...]`, `feature: null`, `completada_en: null`.
- **`modulos_afectados` solo admite módulos de `docs/_modules.md`** (hoy: `candidatos`, `ofertas`, `inscripciones`). No inventes módulos ni uses genéricos (`backend`, `frontend`, `infra`). Si dudas, acota a lo seguro o pregunta.
- Cuerpo: Descripción · Problema u oportunidad · Alcance (módulos) · Notas · Decisión. Con lo que aporte el usuario; **sin inventar reglas ni umbrales** (lo que falte va como pregunta en Notas).
- Si la idea toca UI, revisa `docs/06_design_principles/README.md` y cita en Notas el principio que roce. No dupliques la regla: enlázala.
- Si la idea toca datos personales de candidatos, enlaza `docs/RGPD.md` en Notas.

### Paso 4 — Guardarraíl anti-colisión (OBLIGATORIO)

**Justo antes de escribir**, vuelve a ejecutar `node scripts/next-id.mjs idea`. Si ya no devuelve el mismo número (alguien lo tomó entre medias), **vuelve al Paso 1** con el nuevo valor. Comprueba también que no existe ningún `{NNN}-*.md` en `ideas/` ni en sus subcarpetas. **Nunca sobrescribas ni reutilices un número.**

### Paso 5 — Confirmar

Muestra la ruta creada y el `id: IDEA-{NNN}`. Sugiere el siguiente paso: *«Cuando la idea cualifique, `/feature-shaping {NNN}` la convierte en feature.»*

## Reglas duras

- **El número sale de `scripts/next-id.mjs`**, nunca de la última idea que recuerdes ni de un `ls` a ojo.
- **Fichero `NNN-slug.md` == frontmatter `id: IDEA-NNN`.**
- **Los IDs no se reutilizan ni se renumeran.** `completadas/` y `descartadas/` cuentan para el máximo.
- **`estado: idea`**: captura cruda. No hagas shaping ni cierres preguntas abiertas aquí.
- **Cero asunciones** sobre reglas o umbrales: lo que no diga el usuario va como pregunta.
- **Datos inventados** en los ejemplos: nunca personas ni CVs reales.

## Cuándo NO eres tú

- Convertir la idea en feature → `/feature-shaping NNN`.
- Priorizar ideas o planificar un sprint → agente `product-owner` y `/crear-sprint`.

## Contexto

Discovery: `ideas/` (este skill) → `/feature-shaping` → `features/FEAT-NN-slug/feature.md` → HU en un sprint. Flujo completo en `docs/WORKFLOW.md`.
