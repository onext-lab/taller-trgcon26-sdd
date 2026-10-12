---
id: HU-07
feature: FEAT-04
titulo: "Importar candidatos desde un CSV"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [candidatos]
sprint: sprint-03        # sprint-NN
rama: "hu/HU-07-importar-candidatos-csv"
---

# HU-07 — Importar candidatos desde un CSV

## Historia
Como **reclutador**, quiero **subir un fichero CSV con una lista de candidatos y ver qué filas entraron, cuáles no y
por qué**, para **dar de alta de golpe a los candidatos de una feria de empleo o de otra herramienta sin teclearlos uno
a uno**.

## Contexto
Única HU de FEAT-04 (`docs/02_discovery/features/FEAT-04-importacion-csv-candidatos/feature.md`), por decisión de la
persona responsable del 2026-10-09 (feature en vivo C del taller, completa con 1 HU). Es vertical: API (lectura y
validación del fichero, deduplicación y alta en una transacción) y web (pantalla de importación e informe), con un e2e.
Reutiliza la validación, la normalización del email y el cálculo de la retención del alta (UC-09). El shaping estima
unas 11 tareas, por debajo del techo de 15 de `docs/07_architecture_principles/QUALITY-GATES.md` §2.

Cinco respuestas de producto están **pendientes de ratificar** por la persona responsable (FEAT-04, PA-01 a PA-05):
importación parcial, columnas y cabecera, separador y codificación, límites, y consentimiento y origen. El contenido ya
aplica la recomendación; si alguna cambia, se ajusta el PRD antes del diseño.

## Casos de uso

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-20 | P, A1, A2, A3, E1, E2, E3, E4 | `docs/05_modules/candidatos/casos-de-uso/UC-20-importar-candidatos-csv.md` |

Cubre UC-20 entero. UC-09 no se modifica.

## Criterios de aceptación
- [ ] Un CSV válido con 3 candidatos nuevos crea 3 candidatos sin consentimiento, con fin de retención a alta + 6
      meses, y el informe muestra «3 creados». _(UC-20 · P)_
- [ ] Una fila cuyo email ya existe, en otra capitalización, sale como «duplicado» con enlace a la ficha existente y el
      candidato existente no cambia. _(UC-20 · A1)_
- [ ] Dos filas válidas con el mismo email: entra la primera y la segunda sale como «repetido en el fichero (fila N)».
      _(UC-20 · A2)_
- [ ] Una fila con el email mal formado y el nombre vacío sale con su número de fila y los dos errores, sin repetir los
      valores; las válidas entran. _(UC-20 · A3)_
- [ ] Una cabecera separada por `;`, en otro orden o con una columna de más rechaza el fichero entero con la cabecera
      esperada; un fichero que no es UTF-8 o con comillas sin cerrar, también. _(UC-20 · E1)_
- [ ] Un fichero vacío o solo con la cabecera muestra «El fichero no tiene candidatos». _(UC-20 · E2)_
- [ ] Con 501 filas de datos o más de 1 MiB se rechaza el fichero entero; con 500 filas se importa. _(UC-20 · E3)_
- [ ] Un fallo de la base al guardar no crea ningún candidato y el error no contiene datos personales. _(UC-20 · E4)_
- [ ] Reimportar el mismo CSV da 0 creados y todas esas filas como «duplicado». _(UC-20 · A1, idempotencia)_
- [ ] Ningún log, mensaje de error ni respuesta contiene nombres, emails ni teléfonos del fichero. _(FEAT-04 INV-06)_

## Notas y dependencias
- **Depende de:** nada (FEAT-02 ya está entregada en `main`).
- **Bloquea:** nada.
- Transporte del fichero entre web y API: hoy la API responde 415 a `multipart/form-data` (DEC-11.5); lo decide
  `/tech-design`, con un `DEC-NN` nuevo si cambia la convención (nota de FEAT-04).
- Datos personales: la revisa el agente `datos-personales-auditor` en `/reviewer`.

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [x] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `-frontend.md`) — `/tech-design`
- [x] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [x] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
