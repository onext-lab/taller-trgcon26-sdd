---
id: IDEA-004
titulo: "Importación CSV de candidatos"
estado: aceptada        # idea | aceptada | descartada | completada
fecha: 2026-10-09
autor: "responsable técnico (feature en vivo C del taller)"
modulos_afectados: [candidatos]
prioridad: null         # alta | media | baja (la fija la persona)
feature: FEAT-04        # FEAT-NN cuando se acepte
completada_en: null
---

# IDEA-004 — Importación CSV de candidatos

## Descripción
Dar de alta muchos candidatos a la vez subiendo un fichero CSV, con validación de cada fila, deduplicación e informe de
los errores. Hoy los candidatos solo se dan de alta de uno en uno, con el formulario.

## Problema u oportunidad
Un reclutador que llega con una lista de candidatos (de una feria de empleo o de otra herramienta) tiene que teclearlos
uno a uno. La importación lo ahorra, pero solo sirve si deja claro qué filas entraron, cuáles no y por qué.

## Alcance (grano grueso)
`candidatos`: el alta ya existe (RV-10, email único) y la importación la reutiliza.

## Notas
- Feature en vivo **C** del taller: enseña los casos límite y los tests guiados por casos (las 7 categorías de
  [QUALITY-GATES.md](../../07_architecture_principles/QUALITY-GATES.md) §3). Solución de referencia completa con
  **1 HU** (decisión de la persona responsable del 2026-10-09).
- Preguntas para el shaping, sin resolver aquí:
  - qué columnas tiene el fichero, si llevan cabecera y en qué orden;
  - codificación y separador;
  - tamaño máximo del fichero y número máximo de filas;
  - si el fichero falla entero ante una fila mala o entran las buenas;
  - qué pasa con un email que ya existe en la base o que se repite dentro del fichero;
  - el consentimiento: si un CSV puede traerlo y con qué prueba.
- Datos personales: el fichero trae nombre, email y quizá teléfono; ver [RGPD.md](../../RGPD.md) (base jurídica, origen
  de los datos y qué se guarda del fichero subido).
- Datos de ejemplo siempre inventados, con email `@example.com` y teléfonos de la serie de ficción.
- Principios de interfaz que roza: [06_design_principles](../../06_design_principles/README.md), 3 (estados
  explícitos), 4 (errores útiles) y 5 (datos personales con cuidado).

## Decisión
Promovida a FEAT-04 el 2026-10-12.
