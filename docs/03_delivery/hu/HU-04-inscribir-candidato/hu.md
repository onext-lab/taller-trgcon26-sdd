---
id: HU-04
feature: FEAT-03
titulo: "Inscribir en una oferta publicada, sin duplicados"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [inscripciones, candidatos, ofertas]
sprint: null             # sprint-NN
rama: "hu/HU-04-inscribir-candidato"
---

# HU-04 — Inscribir en una oferta publicada, sin duplicados

## Historia
Como **reclutador**, quiero **inscribir candidatos en una oferta publicada desde su pipeline, sin poder repetir la misma
pareja**, para **meterlos en el proceso de selección y ver de un vistazo en qué etapa está cada uno**.

## Contexto
Primera rebanada de FEAT-03 (`docs/02_discovery/features/FEAT-03-inscripciones/feature.md`): nace el módulo
`inscripciones` con su API, su web, su migración y su seed. El reclutador inscribe candidatos, de uno en uno, en ofertas
`published`; cada inscripción nace en `received` con su `StageChange` inicial, y el pipeline de la oferta la muestra en
su columna. Además, `inscripciones` implementa aquí el puerto de procesos del candidato que `candidatos` dejó preparado
en HU-03 y, al inscribir, invoca en la misma transacción el recálculo de la retención, de modo que la ficha del
candidato pasa a mostrar «Mientras dure el proceso» (UC-12 · A1). Es atómica porque se entrega sola sobre HU-02 y
HU-03, vertical porque toca reglas, persistencia transaccional entre módulos, API y pantallas (pipeline, buscador de
candidatos y ficha del candidato), y con valor porque une ofertas y candidatos por primera vez. El detalle de la
inscripción con su historial, avanzar y rechazar llegan en HU-05, y el cierre con inscripciones, en HU-06.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-14 | P, E1, E2, E3, E4, E5 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` |
| UC-17 | P (pasos 1-4 y la acción «Inscribir candidato» del paso 5), A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |
| UC-12 | A1 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-17 · P, las acciones «Avanzar» y «Rechazar» y el acceso al historial desde cada tarjeta (paso 5), y UC-17 · A1
  (pipeline de una oferta cerrada): los cubre HU-05.
- UC-17 · A3 (etiqueta «Candidato anonimizado»): fuera de alcance del núcleo; el estado «anonimizado» lo introduce la
  feature A, y su HU lo cubrirá (S-05).
- UC-18 (`docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md`), todos sus flujos (P, A1, A2, E1
  y E2): los cubre HU-05. P y A1 (la API del detalle de la inscripción y su pantalla) salieron de esta HU por decisión
  del responsable del 2026-10-06, por el techo de 15 tareas; en HU-05 el historial crece con avanzar y rechazar.
- UC-12 · P, E1 y E2: los cubre HU-03.

## Criterios de aceptación
- [ ] Dada una oferta `published` y un candidato sin inscripción en ella, cuando lo busco por nombre o email desde el
      pipeline y lo inscribo, entonces aparece en la columna «recibida» con su nombre, se registra un `StageChange` sin
      origen → `received` con la fecha en UTC y el candidato deja de tener fecha de fin de retención, todo en la misma
      transacción _(UC-14 · P)_.
- [ ] Dado el pipeline de una oferta `published`, cuando inscribo, entonces lo hago con un solo candidato cada vez
      _(UC-14 · P)_.
- [ ] Dada una oferta en `draft` o en `closed`, cuando intento inscribir a un candidato, entonces responde 409 con un
      mensaje que lo explica y no se crea ni la inscripción ni el `StageChange` _(UC-14 · E1)_.
- [ ] Dado un candidato que ya tiene inscripción en la oferta, en cualquier etapa (también `rejected`, del seed), cuando
      intento inscribirlo otra vez, entonces responde 409 con el ID de la inscripción existente y no se crea nada
      _(UC-14 · E2)_.
- [ ] Dadas dos peticiones simultáneas para inscribir la misma pareja candidato-oferta, cuando llegan, entonces una crea
      la inscripción y la otra recibe 409 con su ID _(UC-14 · E2)_.
- [ ] Dado un ID de oferta o de candidato que no existe, cuando intento inscribir, entonces responde 404 sin datos
      personales en el mensaje y no se crea nada _(UC-14 · E3)_.
- [ ] Dada una petición de inscripción sin candidato, con un ID mal formado o con un campo desconocido, cuando llega a
      la API, entonces responde 400 en el envelope de error y no se crea nada _(UC-14 · E4)_.
- [ ] Dado que falla una escritura al inscribir (la inscripción, su `StageChange` o el recálculo de la retención),
      cuando inscribo, entonces no queda inscripción ni `StageChange` y la retención del candidato no cambia
      _(UC-14 · E5)_.
- [ ] Dada una oferta `published` con inscripciones en varias etapas, cuando abro su pipeline, entonces veo una columna
      por etapa (recibida, cribado, entrevista, oferta, contratado y rechazado), cada tarjeta con solo el nombre del
      candidato escapado y la fecha del último cambio en `dd/mm/aaaa` (hora de Europe/Madrid), el motivo en la columna
      «rechazado», cada columna ordenada por la fecha del último cambio, la más reciente primero, sin paginación, y la
      acción «Inscribir candidato» _(UC-17 · P)_.
- [ ] Dado el pipeline de una oferta, cuando reviso lo que devuelve la API, entonces no incluye email, teléfono ni nota
      de rechazo de ningún candidato _(UC-17 · P)_.
- [ ] Dada una oferta `published` sin inscripciones, cuando abro su pipeline, entonces veo el estado vacío con un
      mensaje que lo explica y la acción «Inscribir candidato» _(UC-17 · A2)_.
- [ ] Dado un ID de oferta que no existe, cuando abro su pipeline, entonces responde 404 y la web muestra el estado de
      error _(UC-17 · E1)_.
- [ ] Dado que la API no responde, cuando abro un pipeline, entonces veo el estado de error con un mensaje útil, sin
      *stack trace* _(UC-17 · E2)_.
- [ ] Dado un candidato con una inscripción no final, cuando abro su ficha, entonces el fin de retención aparece como
      «Mientras dure el proceso» _(UC-12 · A1)_.
- [ ] Dado un candidato con una inscripción no final, cuando `candidatos` consulta sus procesos por el puerto, entonces
      sabe que tiene una inscripción no final y que alguna vez tuvo inscripciones; y un candidato sin inscripciones
      sigue respondiendo «sin inscripciones» _(UC-12 · A1)_.

## Notas y dependencias
- **Depende de:** HU-02 (ofertas `published` y `closed`) y HU-03 (candidatos, fórmula de retención, puerto y operación
  interna de recálculo).
- **Bloquea:** HU-05.
- **Puertos (DEC-06):** esta HU implementa los dos. `inscripciones` implementa el de procesos del candidato (lo define
  `candidatos`) y define el de estado de la oferta, que implementa `ofertas` (RV-17, UC-14 · E1, S-18). Así
  `inscripciones` no importa nada de `ofertas` y no hay ciclo. Por eso `ofertas` está entre los módulos afectados:
  `jobs` implementa el puerto y esta HU añade la guarda de estado en su SQL (SEC-02).
- **Mismo UC en dos HU:** UC-12 lo comparte con HU-03, y UC-17 con HU-05. Van en secuencia por las dependencias: esta
  HU empieza cuando HU-03 está en `main`, y HU-05 cuando esta lo está.
- **Reparto entre módulos** (`docs/02_discovery/reglas-validadas.md`): `inscripciones` implementa el puerto que lee
  `candidatos` e invoca su recálculo; no duplica la fórmula de retención.
- El seed de unas 40 inscripciones inventadas (RV-26) cumple INV-04, INV-05 e INV-06 de FEAT-03 y la retención que
  da la fórmula de `candidatos`.

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [x] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `-frontend.md`) — `/tech-design`
- [x] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [x] Implementación + integración — `/implementar-hu`
- [x] Review (`review/REVIEW.md`) — `/reviewer`
- [x] Sync de módulos + merge local a `main` — `/module-sync`
