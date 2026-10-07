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
historial de cada inscripción**, para **llevarlos hasta la contratación o el rechazo con rastro de cada decisión**.

## Contexto
Segunda rebanada de FEAT-03 (`docs/02_discovery/features/FEAT-03-inscripciones/feature.md`): sobre las inscripciones de
HU-04, añade el avance a la etapa siguiente con etapa esperada e idempotencia, el rechazo con motivo y nota, el detalle
de la inscripción con su historial (su API y su pantalla, que antes estaban en HU-04: decisión del responsable del
2026-10-06) y el acceso a él desde cada tarjeta, y el pipeline de solo lectura de las ofertas cerradas. Cada paso a
etapa final invoca el recálculo de retención de `candidatos` en la misma transacción. El rechazo de las inscripciones
activas al cerrar una oferta (UC-19 y UC-04 · A1, con la conexión de `JobApplicationsPort`) ya no está en esta HU: pasó
a HU-06 por decisión del responsable del 2026-10-07, por el techo de 15 tareas. Es atómica porque se entrega sola sobre
HU-04, vertical porque toca reglas de transición, persistencia transaccional entre módulos, API y pantallas (tarjetas,
formulario de rechazo, detalle de la inscripción con su historial y pipeline cerrado), y con valor porque el reclutador
lleva a cada candidato hasta la contratación o el rechazo.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-15 | P, A1, A2, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md` |
| UC-16 | P, A1, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md` |
| UC-17 | P (acciones «Avanzar» y «Rechazar» y acceso al historial del paso 5), A1 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |
| UC-18 | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-17 · P en los pasos 1-4 y la acción «Inscribir candidato» del paso 5, A2, E1 y E2: los cubre HU-04.
- UC-17 · A3 (etiqueta «Candidato anonimizado»): fuera de alcance del núcleo; el estado «anonimizado» lo introduce la
  feature A, y su HU lo cubrirá (S-05).
- UC-19 · P, A1, A2, E1 y E2 (`docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md`) y
  UC-04 · A1 (`docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md`) → **HU-06**. Estaban en esta HU y salieron
  el 2026-10-07 por decisión de la persona responsable («Sí, sprint de 6 HU»): con ellos, HU-05 superaba el techo
  de 15 tareas de `docs/07_architecture_principles/QUALITY-GATES.md` §2, que incluye las adversariales.
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

## Notas y dependencias
- **Enlaces que llegan con el detalle (decisión del responsable, 2026-10-06, por el corte de UC-18):** HU-05 añade (1) el enlace del nombre de cada tarjeta del pipeline a `/applications/:id` y (2) el enlace «Ver la inscripción» en el aviso del 409 de inscripción duplicada («Este candidato ya está inscrito en la oferta.»). En HU-04 ambos van sin enlace (DT-01, DT-02 y DT-04 del PRD de HU-04).
- **Depende de:** HU-04 (y, a través de ella, HU-02 y HU-03).
- **Bloquea:** HU-06 (el rechazo al cerrar una oferta se apoya en el servicio de avanzar y rechazar de esta HU).
- **Mismo UC en dos HU:** UC-17 lo comparte con HU-04; UC-15, UC-16 y UC-18 son enteros de esta HU. Van en secuencia:
  esta HU empieza cuando HU-04 está en `main`.
- **Decisión del responsable (2026-10-07, «Sí, sprint de 6 HU»):** UC-19 y UC-04 · A1, con sus 7 criterios de
  aceptación, pasan a HU-06 (`docs/03_delivery/hu/HU-06-cerrar-oferta-inscripciones-activas/hu.md`) por el techo de 15
  tareas. Las preguntas OQ-08 (avanzar y rechazar no comprueban el estado de la oferta) y OQ-09 (el aviso tras cerrar
  sigue siendo «Oferta cerrada.») del PRD de esta HU las hereda HU-06; la OQ-08 la revisa HU-06 a propósito.
- **Reparto entre módulos** (`docs/02_discovery/reglas-validadas.md`): `inscripciones` avanza y rechaza, y
  `candidatos` recalcula la retención cuando se le pide; nadie duplica la fórmula.
- **La ventana de INV-05 sigue abierta tras el merge de esta HU** (DT-10 de HU-04): `JobApplicationsPort` sigue con el
  stub `noJobApplications`, así que cerrar una oferta con inscripciones activas la cierra sin rechazarlas. La cierra
  HU-06. Ningún test de esta HU cierra ofertas con inscripciones activas.
- UC-18 · A2 con el motivo «oferta cerrada» se prueba con inscripciones rechazadas por cierre que ya escribe el seed (o
  con un `StageChange` de prueba), no con el cierre real, que es de HU-06.
- El motivo «oferta cerrada» solo lo pone el sistema (S-15): rechazar a mano con él da 400 (UC-16 · E1); el historial
  solo crece (INV-03 de FEAT-03).

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
