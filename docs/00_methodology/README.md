# El flujo en una página

**Spec-Driven Development (SDD)**: antes de escribir código se escribe, en este orden, **qué** se quiere (PRD), **cómo**
se hará (diseño técnico) y **en qué pasos** (tareas). El código se escribe contra esas especificaciones y se revisa
contra ellas. El detalle está en [WORKFLOW.md](../WORKFLOW.md).

## Dos carriles

| Discovery — ¿qué merece la pena construir? | Delivery — construirlo bien |
|---|---|
| `/anadir-idea` → `IDEA-NNN` | `/crear-sprint` → `sprint-NN` (2 días) |
| `/feature-shaping` → `FEAT-NN` (sin asunciones: todo lo que falte es una pregunta) | Por cada HU: `/prd-writer` → `/tech-design` → `/task-planner` → `/implementar-hu` → `/reviewer` → `/module-sync` |
| `product-owner` → `HU-NN` (atómicas, verticales y con valor) | `/qa-e2e` (opcional) → `/audit-sprint` → `/cerrar-sprint` |

## Las cinco ideas que sostienen el flujo

1. **La HU es la unidad.** Todo su rastro (PRD, diseño, tareas, review) vive en su carpeta y su código en su rama.
2. **Cero asunciones.** Un agente que rellena huecos inventa; uno que pregunta, no. Toda laguna es una pregunta.
3. **Gates que se pueden comprobar.** Cada artefacto tiene criterios medibles
   ([QUALITY-GATES.md](../07_architecture_principles/QUALITY-GATES.md)) y la review termina en una línea `VERDICT:`.
4. **Ejecutar, no suponer.** Tests, typecheck y lint se ejecutan y su salida real se pega
   ([IMPLEMENTATION-RULE.md](../IMPLEMENTATION-RULE.md)).
5. **Techos.** 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU: después se para y decide una persona.

## Quién hace qué

- **Tú** decides: respondes preguntas, apruebas la feature y el diseño, y das el merge.
- **Claude Code** ejecuta las skills (`/nombre`), lanza los agentes de `.claude/agents/` y respeta los hooks de
  `.claude/hooks/`, que bloquean lo peligroso (secretos, red, push).

## Cuándo no

Infraestructura sin valor de usuario, fixes de una línea y spikes no pasan por el flujo completo. El ejemplo de este
repo es el propio esqueleto del monorepo ([WORKFLOW.md](../WORKFLOW.md) §9).
