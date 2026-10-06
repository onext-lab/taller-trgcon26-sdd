# TASK-NN — <título> <[adversarial] si aplica>

## Metadata
- **HU:** HU-NN · **Feature:** FEAT-NN
- **Scope:** backend | frontend | test
- **Capa:** api | web — decide el builder (`api-builder` | `web-builder`). Una `[e2e]` o `[adversarial]` que toca las
  dos va a la capa principal (la del fichero de producción o de test principal); una `[e2e]` de Playwright, `web`.
- **Estado:** Pendiente | Completada | Bloqueada
- **Complejidad:** S (< 1 h) | M (1–2 h) | L (2–4 h)

## Descripción
<Qué hay que hacer, como rebanada vertical (p. ej. un endpoint con su JSON Schema, servicio, repositorio y test).>

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `apps/api/src/modules/<módulo>/<fichero>.ts` | crear / modificar |
| `apps/api/test/<módulo>/<fichero>.test.ts` | crear |

> Ficheros concretos. «Investigar» no es una task.

## Implementa
- RF: RF-01 · Edge cases: EC-01, EC-02
- Diseño: `plans/TECHNICAL_DOC.md` § <ancla>

## Dependencias
- **Depende de:** TASK-NN o nada
- **Bloquea:** TASK-NN o nada

## Criterios de done
- [ ] <verificable>
- [ ] `npm test -w apps/<app> -- <patrón>` en verde, con el número de ficheros de test esperado.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint <ficheros tocados>` sin errores.
- [ ] Commit único `<tipo>(<scope>): … [HU-NN TASK-NN]` nombrando los ficheros.

## Notas de implementación
- …
