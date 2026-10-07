---
id: HU-05
feature: FEAT-03
titulo: "Pipeline con cambio de etapa e historial"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [inscripciones, ofertas]
sprint: null             # sprint-NN
rama: "hu/HU-05-pipeline-etapas"
---

# HU-05 — Pipeline con cambio de etapa e historial

## Historia
Como **reclutador**, quiero **avanzar o rechazar a los candidatos desde el pipeline de la oferta y consultar el
historial de cada inscripción**, para **llevarlos hasta la contratación o el rechazo con rastro de cada decisión, sin
que el cierre de una oferta deje procesos abiertos**.

## Contexto
Segunda rebanada de FEAT-03 (`docs/02_discovery/features/FEAT-03-inscripciones/feature.md`): sobre las inscripciones de
HU-04, añade el avance a la etapa siguiente con etapa esperada e idempotencia, el rechazo con motivo y nota, el detalle
de la inscripción con su historial (su API y su pantalla, que antes estaban en HU-04: decisión del responsable del
2026-10-06) y el acceso a él desde cada tarjeta, el pipeline de solo lectura de las ofertas cerradas y la operación
interna que rechaza las inscripciones activas al cerrar una oferta (UC-19). Conecta esa operación dentro de la transacción de cierre de
`ofertas` (UC-04 · A1), que HU-02 dejó preparada. Cada paso a etapa final invoca el recálculo de retención de
`candidatos` en la misma transacción. Es atómica porque se entrega sola sobre HU-04, vertical porque toca reglas de
transición, persistencia transaccional entre tres módulos, API y pantallas (tarjetas, formulario de rechazo, detalle
de la inscripción con su historial y pipeline cerrado), y con valor porque completa el proceso de selección de punta a punta.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-15 | P, A1, A2, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md` |
| UC-16 | P, A1, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md` |
| UC-17 | P (acciones «Avanzar» y «Rechazar» y acceso al historial del paso 5), A1 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |
| UC-18 | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` |
| UC-19 | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` |
| UC-04 | A1 | `docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-17 · P en los pasos 1-4 y la acción «Inscribir candidato» del paso 5, A2, E1 y E2: los cubre HU-04.
- UC-17 · A3 (etiqueta «Candidato anonimizado»): fuera de alcance del núcleo; el estado «anonimizado» lo introduce la
  feature A, y su HU lo cubrirá (S-05).
- UC-04 · P, A2, A3, E1 y E2: los cubre HU-02.

## Criterios de aceptación
- [ ] Dada una inscripción en `screening` en una oferta `published`, cuando pulso «Avanzar» con la etapa esperada
      `screening` y destino `interview`, entonces pasa a `interview`, se añade un `StageChange` con origen, destino y
      fecha en UTC, sin motivo ni nota, y el pipeline la muestra en «entrevista» _(UC-15 · P)_.
- [ ] Dada una inscripción que ya avanzó de `screening` a `interview`, cuando llega un reintento a `interview` con la
      etapa esperada `screening`, entonces responde 200 sin `StageChange` nuevo ni cambios de fecha _(UC-15 · A1)_.
- [ ] Dada una inscripción en `offer` de un candidato sin consentimiento y sin otras inscripciones abiertas, cuando la
      avanzo a `hired`, entonces queda en etapa final, la oferta sigue `published`, y el fin de retención del candidato
      pasa a ser ese día + 6 meses en la misma transacción _(UC-15 · A2)_.
- [ ] Dado un candidato con otra inscripción abierta en otra oferta, cuando una de sus inscripciones pasa a `hired`,
      entonces la otra inscripción no cambia y el candidato sigue sin fecha de fin; y una segunda inscripción de la
      misma oferta también puede pasar a `hired` _(UC-15 · A2)_.
- [ ] Dada una inscripción en `interview`, cuando llega un avance a `offer` con la etapa esperada `screening`, entonces
      responde 409 y la etapa y el historial no cambian _(UC-15 · E1)_.
- [ ] Dada una inscripción en `screening`, cuando pido avanzar a `offer` (salta una etapa), a `received` (retrocede) o a
      `rejected` por esta vía, entonces responde 409 y no cambia nada _(UC-15 · E2)_.
- [ ] Dada una inscripción en `hired` o en `rejected`, cuando pido avanzarla a otra etapa, entonces responde 409 y no
      cambia nada _(UC-15 · E3)_.
- [ ] Dado un avance con una etapa desconocida, sin etapa esperada o con un campo desconocido (por ejemplo, una nota),
      cuando llega a la API, entonces responde 400 en el envelope de error y no cambia nada _(UC-15 · E4)_.
- [ ] Dado un ID de inscripción que no existe, cuando pido avanzarla, entonces responde 404 y no cambia nada
      _(UC-15 · E5)_.
- [ ] Dado que falla una escritura al avanzar (la etapa, el `StageChange` o el recálculo de la retención), cuando
      avanzo, entonces no cambian ni la etapa, ni el historial, ni la retención _(UC-15 · E6)_.
- [ ] Dada una inscripción en `interview`, cuando pulso «Rechazar», elijo «no encaja con el perfil» y escribo una nota de
      500 caracteres, junto a la que veo el aviso de no usarla para datos sensibles, entonces queda `rejected` con un
      `StageChange` que guarda ese motivo y esa nota, el pipeline la muestra en «rechazado» con el motivo y, si era la
      última inscripción abierta del candidato, su retención se recalcula desde ese día _(UC-16 · P)_.
- [ ] Dada una inscripción ya `rejected`, cuando llega un reintento del rechazo con otro motivo u otra nota, entonces
      responde 200 sin `StageChange` nuevo y conserva el motivo y la nota originales _(UC-16 · A1)_.
- [ ] Dada una inscripción en `interview`, cuando la rechazo sin motivo, con un motivo fuera de la lista o con «oferta
      cerrada», entonces responde 400 y no cambia nada _(UC-16 · E1)_.
- [ ] Dada una inscripción en `interview`, cuando la rechazo con una nota de 501 caracteres tras recortar, entonces
      responde 400 y no cambia nada; y una nota solo de espacios se guarda como sin nota _(UC-16 · E2)_.
- [ ] Dada una inscripción en `interview`, cuando llega un rechazo con la etapa esperada `screening`, entonces responde
      409 y sigue en `interview` _(UC-16 · E3)_.
- [ ] Dada una inscripción en `hired`, cuando intento rechazarla, entonces responde 409 y no cambia nada
      _(UC-16 · E4)_.
- [ ] Dado un ID de inscripción que no existe, cuando intento rechazarla, entonces responde 404 y no cambia nada
      _(UC-16 · E5)_.
- [ ] Dado que falla una escritura al rechazar (la etapa, el `StageChange` o el recálculo de la retención), cuando
      rechazo, entonces no cambian ni la etapa, ni el historial, ni la retención _(UC-16 · E6)_.
- [ ] Dado cualquier rechazo o error, cuando reviso los logs, los mensajes de error y el pipeline, entonces la nota no
      aparece en ninguno: solo se ve en el historial _(UC-16 · P, E2)_.
- [ ] Dado el pipeline de una oferta `published`, cuando lo abro, entonces las tarjetas en etapa no final ofrecen
      «Avanzar» y «Rechazar», las de `hired` y `rejected` no, y toda tarjeta abre su historial _(UC-17 · P)_.
- [ ] Dada una oferta `closed`, cuando abro su pipeline, entonces veo todas las columnas con solo el nombre de cada
      candidato, sin «Avanzar», «Rechazar» ni «Inscribir candidato», y puedo abrir el historial de cualquier tarjeta
      _(UC-17 · A1)_.
- [ ] Dada una inscripción que avanzó de `received` a `screening` y luego a `interview`, cuando abro su detalle desde
      su tarjeta del pipeline, entonces veo la etapa actual `interview` y sus tres `StageChange` del más antiguo al más
      reciente, cada uno con etapa origen, etapa destino y fecha en `dd/mm/aaaa` (hora de Europe/Madrid) _(UC-18 · P)_.
- [ ] Dada una inscripción recién creada, cuando abro su detalle, entonces veo la etapa actual `received` y un único
      `StageChange`, sin origen → `received`, con la fecha de inscripción en `dd/mm/aaaa` (hora de Europe/Madrid)
      _(UC-18 · A1)_.
- [ ] Dada una inscripción rechazada a mano, cuando abro su historial, entonces veo los `StageChange` del más antiguo al
      más reciente y, en el de rechazo, el motivo y la nota; y en una rechazada por el cierre de la oferta, el motivo
      «oferta cerrada» y ninguna nota _(UC-18 · A2)_.
- [ ] Dado un ID de inscripción que no existe, cuando abro su historial, entonces responde 404 y la web muestra el
      estado de error _(UC-18 · E1)_.
- [ ] Dado que la API no responde, cuando abro un historial, entonces veo el estado de error con un mensaje útil
      _(UC-18 · E2)_.
- [ ] Dada una oferta `published` con inscripciones en `received`, `offer` y `hired`, cuando la cierro y confirmo el
      diálogo, que anuncia 2 inscripciones activas, entonces la oferta queda `closed`, las dos primeras pasan a
      `rejected` con el motivo «oferta cerrada», sin nota y con su `StageChange` con la fecha del cierre, y la de `hired`
      no cambia _(UC-19 · P; UC-04 · A1)_.
- [ ] Dado el cierre del criterio anterior, cuando a un candidato rechazado no le queda ninguna inscripción no final,
      entonces su retención se recalcula desde ese día en la misma transacción _(UC-19 · P)_.
- [ ] Dada una oferta publicada con el diálogo de cierre abierto, cuando se crea una inscripción antes de confirmar,
      entonces el cierre la rechaza igualmente, porque rechaza las activas en el momento de cerrar _(UC-04 · A1)_.
- [ ] Dada una oferta publicada sin inscripciones o con todas en `hired` o `rejected`, cuando la cierro, entonces la
      operación devuelve 0, no se rechaza ni se recalcula nada y la oferta queda `closed` _(UC-19 · A1)_.
- [ ] Dado un candidato con una inscripción en la oferta que se cierra y otra abierta en otra oferta, cuando se cierra
      la primera oferta, entonces su inscripción en ella pasa a `rejected` y él sigue sin fecha de fin de retención
      _(UC-19 · A2)_.
- [ ] Dado que falla una escritura durante el rechazo por cierre, cuando cierro la oferta, entonces la oferta sigue
      `published`, ninguna inscripción cambia y ninguna retención se recalcula _(UC-19 · E1)_.
- [ ] Dada una inscripción en `interview` de una oferta que se está cerrando, cuando llega después del cierre un avance
      con la etapa esperada `interview`, entonces responde 409; y si lo que llega es un rechazo, responde 200 sin cambios
      _(UC-19 · E2)_.

## Notas y dependencias
- **Enlaces que llegan con el detalle (decisión del responsable, 2026-10-06, por el corte de UC-18):** HU-05 añade (1) el enlace del nombre de cada tarjeta del pipeline a `/applications/:id` y (2) el enlace «Ver la inscripción» en el aviso del 409 de inscripción duplicada («Este candidato ya está inscrito en la oferta.»). En HU-04 ambos van sin enlace (DT-01, DT-02 y DT-04 del PRD de HU-04).
- **Depende de:** HU-04 (y, a través de ella, HU-02, que entrega el cierre de ofertas de UC-04).
- **Bloquea:** nada.
- **Mismo UC en dos HU:** UC-17 lo comparte con HU-04, y UC-04 con HU-02; UC-18 es entero de esta HU. Van en
  secuencia: esta HU empieza cuando HU-04 está en `main`, y HU-02 ya lo está para entonces.
- **Reparto entre módulos** (`docs/02_discovery/reglas-validadas.md`): `inscripciones` expone la operación interna de
  UC-19, `ofertas` la invoca dentro de su transacción de cierre y `candidatos` recalcula la retención cuando se le pide;
  nadie duplica la fórmula.
- Esta HU cierra el riesgo de FEAT-01 sobre INV-05: «ninguna oferta `closed` tiene inscripciones en etapa no final» se
  prueba aquí.
- El motivo «oferta cerrada» solo lo pone el sistema (S-15); el historial solo crece (INV-03 de FEAT-03).

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
