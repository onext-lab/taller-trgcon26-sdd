---
name: prd-writer
description: Genera el PRD curado de una HU (specs/PRD.md) desde hu.md, feature.md y la doc del módulo. Cada ambigüedad es una Open Question y no deja pasar a diseño hasta resolverlas.
argument-hint: HU-NN
---

# prd-writer

Paso 1 del delivery de una HU (ver `docs/WORKFLOW.md`). Convierte la HU (`hu.md` + su `feature.md`) en un PRD completo y verificable. Aclara el **qué**; el **cómo** es de `/tech-design`.

## Uso

```
/prd-writer HU-NN
```

Si `specs/PRD.md` ya existe, pregunta qué ha cambiado y actualiza solo lo afectado (nota de versión al pie).

## Pre-flight (bloquea si falla)

1. Existe `docs/03_delivery/hu/HU-NN-slug/hu.md`. Si no: «No encuentro la HU-NN. La crea el `product-owner` al descomponer una feature shaped (`/feature-shaping`).» STOP.
2. Resuelve el módulo con `docs/_modules.md` y lee `docs/05_modules/{módulo}/functional.md` y `technical.md`. Si aún no existen (primera HU del módulo), avisa y sigue con el README del módulo.

## Workflow

### Paso 1 — Contexto barato

Lee directamente:
- `docs/03_delivery/hu/HU-NN-slug/hu.md` (historia y criterios de aceptación).
- `docs/02_discovery/features/FEAT-NN-slug/feature.md` (la que cita el frontmatter de la HU).
- La doc del módulo (paso anterior) y `docs/_modules.md`.
- `docs/07_architecture_principles/DECISIONS.md` (decisiones `DEC-NN` vigentes) y `docs/07_architecture_principles/QUALITY-GATES.md`.
- `docs/RGPD.md` si la HU toca datos de candidatos.
- `docs/06_design_principles/README.md` si la HU tiene pantalla.
- PRD de otras HU del mismo módulo (`docs/03_delivery/hu/**/HU-*/specs/PRD.md`), para no contradecir decisiones ya tomadas.
- La plantilla `docs/_templates/PRD.template.md`.

Adjuntos (`docs/03_delivery/hu/HU-NN-slug/attachments/`): léelos con Read y cita la fuente en el RF que salga de ellos.

### Paso 2 — Escaneo del código (subagentes)

Lanza un subagente `Explore` por scope afectado, en paralelo, con un resumen de 2 líneas de la HU:
- **Backend:** `apps/api/src/modules/{módulo}/` y `apps/api/src/db/` → tablas y migraciones, endpoints (método, ruta, JSON Schema), errores, tests. Máximo 300 palabras, sin código.
- **Frontend:** `apps/web/src/features/{módulo}/` y `apps/web/src/components/` → pantallas, componentes, llamadas a la API, formularios, tests. Máximo 300 palabras.

Su contexto no entra en el principal: solo el resumen.

### Paso 3 — Detectar ambigüedades

Relee la HU preguntándote: ¿decisiones de producto sin tomar?, ¿qué pasa si…?, ¿contradicciones con otras HU o con `DECISIONS.md`?, ¿límites sin número (paginación, longitudes, tamaños)?, ¿flujos incompletos?, ¿el scope (backend/frontend/fullstack) es el que la HU pide?

**Cada ambigüedad es una Open Question.** No inventes la respuesta.

### Paso 4 — Escribir `specs/PRD.md`

Desde la plantilla, con estas secciones:
- **Info:** HU, feature, módulo, scope, estado `Draft`.
- **Contexto:** problema, situación actual (de los subagentes), resultado esperado.
- **Requisitos funcionales:** `RF-NN` con prioridad Must/Should/Could, `Scope:` y criterios verificables en checkbox. Cada criterio de aceptación de `hu.md` queda cubierto por al menos un RF.
- **Requisitos no funcionales:** solo con métrica numérica (ver gate 2).
- **Modelo de datos:** tablas y columnas afectadas; datos personales marcados.
- **Endpoints y pantallas:** método, ruta, códigos de respuesta y errores (envelope `{ error: { code, message, details? } }`); rutas de la web.
- **Flujos de usuario** (si hay UI).
- **Edge cases** (gate 3).
- **Decisiones aplicables:** los `DEC-NN` que la HU toca o respeta, con referencia en algún RF o nota (p. ej. `DEC-04` si la HU habla de usuarios o permisos: no hay login, rol único «reclutador»). Si no aplica ninguna: «Sin decisiones aplicables: <motivo>».
- **Datos personales:** qué datos de candidatos toca, finalidad y retención según `docs/RGPD.md`, o «No toca datos personales».
- **Fuera de scope:** obligatorio.
- **Open Questions:** todas, con contexto, recomendación y `Decisión: PENDIENTE`. Si no hay: «No hay preguntas abiertas.»
- **Decisiones tomadas:** vacía al principio.

### Paso 5 — Resolver Open Questions (bucle bloqueante)

1. Muestra todas las OQ en una tabla numerada, con tu recomendación.
2. **STOP y espera** las respuestas (pueden llegar juntas o de una en una).
3. Por cada respuesta: actualiza la sección afectada, mueve la OQ a «Decisiones tomadas» con fecha y añade las OQ nuevas que salgan.
4. Repite hasta «No hay preguntas abiertas.»

### Paso 6 — Gates de calidad (bloqueantes)

1. **Rutas citadas:** cada ruta del repo que cite el PRD existe (compruébalo con Glob/Read) o va marcada como «nueva». Nada inventado.
2. **RNF con número:** valor o rango numérico (`p95 < 300 ms en local`, `≤ 500 filas por importación`). «Rápido», «suficiente» o «razonable» no valen: si no hay número, es una OQ.
3. **Edge cases por RF Must:** mínimo 3 por RF Must, cada uno etiquetado con una de las **7 categorías** de `QUALITY-GATES.md`, y las 7 evaluadas de forma explícita (`Categoría N — N/A: <motivo verificable>` si no aplica). Ejemplos del ATS:
   1. Input inválido: email sin `@` en el alta de un candidato.
   2. Boundary: lista vacía, nombre de 1 o de 200 caracteres, acentos y emojis.
   3. Fallo de dependencia: la escritura en SQLite falla o la API no responde a la web.
   4. Concurrencia: dos reclutadores cambian a la vez la etapa de la misma inscripción.
   5. Datos corruptos: una fila antigua con un campo nulo que la migración no rellenó.
   6. Seguridad: HTML en el resumen del candidato (XSS), `q` con comillas (inyección SQL), datos personales en logs o errores.
   7. Idempotencia: doble clic en «Inscribir» no crea dos inscripciones.
4. **Decisiones aplicables** presente y no vacía (o con el motivo de «sin decisiones»).

Si falla alguno, corrige o abre una OQ y vuelve al paso 5.

### Paso 7 — Contradicciones

Compara RF y RNF con las «Decisiones tomadas» de los PRD anteriores del módulo y con `DECISIONS.md`. Si chocan, repórtalo antes de cerrar.

### Paso 8 — Validación humana (obligatoria)

Resume: HU, título, scope, RF por prioridad, RNF, ruta del PRD. Y pregunta:

> «PRD en `{ruta}`. **Léelo entero**: los arquitectos parten de él. Responde `aprobado`, los ajustes concretos que quieras o `abortar`.»

**STOP.** Aprobado → `Estado: Ready`. Ajustes → aplícalos y repite el gate. Abortar → se queda en `Draft`.

### Paso 9 — Cierre

Resumen (RF, RNF, OQ resueltas, estado) y siguiente paso:

> «PRD listo. Ejecuta `/tech-design HU-NN`; si es fullstack, lanzará `backend-architect` y `frontend-architect` en paralelo.»

## Reglas duras

- Nunca inventes requisitos ni rellenes huecos de la HU suponiendo: se pregunta.
- Criterios de aceptación comprobables con un test («el reclutador ve…», no «funciona bien»).
- «Fuera de scope» y «Open Questions» siempre presentes.
- Más de 15 RF: propón partir la HU.
- No avances a `/tech-design` con OQ abiertas: `tech-design` lo comprueba.
- Datos inventados en ejemplos; nunca datos de personas reales.

## Cuándo no eres tú

- Idea → feature: `/feature-shaping`. Feature → HU: `product-owner`.
- Diseño técnico: `/tech-design`. Tareas: `/task-planner`. Revisión: `/reviewer`.
