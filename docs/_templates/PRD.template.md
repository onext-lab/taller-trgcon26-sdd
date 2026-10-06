# HU-NN — <título> — PRD

## Info
- **HU:** HU-NN · **Feature:** FEAT-NN
- **Scope:** backend | frontend | fullstack
- **Módulos:** <valores de docs/_modules.md>
- **Fecha:** AAAA-MM-DD
- **Estado:** Draft | Ready

## Contexto

### Problema
<Qué resuelve esta HU y por qué importa al reclutador.>

### Situación actual
<Cómo funciona hoy, con `archivo:línea` si aplica. Qué falta o qué está mal.>

### Resultado esperado
<Cómo se ve el sistema cuando esté hecho.>

## Casos de uso
Los UC y flujos que cubre la HU (de `hu.md`), citados por ID y ruta desde la raíz. **Cada flujo cubierto (P, cada A y
cada E) tiene al menos un criterio de aceptación** en «Criterios de aceptación»; un flujo cubierto sin CA es una Open
Question que bloquea.

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-NN · P | <flujo principal> | CA-01 |
| UC-NN · A1 | <alternativo> | CA-02 |
| UC-NN · E1 | <excepción> | CA-03 |

Fichero de cada UC: `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` (rellena su columna CA de «Trazabilidad»).

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | … | Must / Should / Could | backend / frontend | - [ ] verificable 1<br>- [ ] verificable 2 |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | … | Rendimiento / Seguridad / Accesibilidad / Privacidad | p. ej. respuesta < 200 ms con 1 000 candidatos |

> Cada RNF con número o rango: «rápido» o «seguro» no son métricas.

## Modelo de datos
<Tablas y columnas nuevas o modificadas, índices, restricciones, migración `NNN-descripcion.sql`. «No aplica» si no hay.>

## Interfaces / endpoints / pantallas

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| GET | /api/<recurso> | Nuevo / Modificar | … |
| Pantalla | <nombre> | Nueva / Modificar | … |

## Flujos de usuario
1. …

## Datos personales
<Qué datos personales toca la HU, para qué, base jurídica y cuánto tiempo se conservan (docs/RGPD.md). Qué se devuelve en
cada respuesta y qué NO debe aparecer en logs ni errores. «No aplica — <razón>» si no toca datos personales.>

## Edge cases
> ≥3 por RF **Must**, recorriendo las 7 categorías de QUALITY-GATES.md §3: input inválido, boundary, fallo de
> dependencia, concurrencia, datos corruptos, seguridad, idempotencia. `N/A — razón` permitido por categoría.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | Input inválido | … | 400 `VALIDATION_ERROR` con el campo en `details` |

## Decisiones aplicables
<`DEC-NN` de docs/07_architecture_principles/DECISIONS.md que afectan a esta HU y cómo, o «Ninguna» con la búsqueda hecha.>

## Fuera de scope
- <lo que esta HU NO cubre — obligatorio>

## Open Questions

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | … | por qué importa | … | PENDIENTE | Abierta |

> Un PRD con Open Questions abiertas **no pasa** a diseño. Si no hay: «No hay preguntas abiertas.» (sección obligatoria).

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | … | … | … | AAAA-MM-DD |

## Criterios de aceptación
Uno o más por cada flujo de UC cubierto: los alternativos y las excepciones **son criterios de aceptación**, no solo
edge cases. Formato Dado / Cuando / Entonces, comprobable con un test.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-NN · P / RF-01 | <estado inicial> | <acción del reclutador> | <resultado observable> |
| CA-02 | UC-NN · A1 / RF-01 | … | … | … |
| CA-03 | UC-NN · E1 / RF-01 | … | … | <error que ve; qué NO cambia> |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.
