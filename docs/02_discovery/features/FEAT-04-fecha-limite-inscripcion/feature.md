---
id: FEAT-04
titulo: "Fecha límite de inscripción en una oferta"
estado: priorizada       # shaping | priorizada | en delivery | entregada
prioridad: null          # alta | media | baja (la fija la persona)
idea_origen: IDEA-004
modulos_afectados: [ofertas, inscripciones]
fecha: 2026-10-13
owner: "persona que decide el producto"
---

# FEAT-04 — Fecha límite de inscripción en una oferta

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.

Fuentes: la idea `IDEA-004`; las respuestas de la persona del 2026-10-13 (`R1`-`R7`, en «Respuestas del shaping»); las
reglas validadas `RV-NN` y `S-NN` de `docs/02_discovery/reglas-validadas.md`; `DEC-NN` de
`docs/07_architecture_principles/DECISIONS.md`; `docs/RGPD.md`; y los principios de `docs/06_design_principles/README.md`.

## Qué
El reclutador puede fijar, al crear o editar una oferta, hasta qué día acepta inscripciones; pasado ese día no se puede
inscribir a nadie más en ella _(IDEA-004)_.

## Por qué
Hoy una oferta publicada acepta inscripciones mientras no se cierre. El reclutador quiere acotar de antemano hasta qué
día acepta candidatos sin tener que acordarse de cerrarla _(IDEA-004)_.

## Alcance
- **Dentro:**
  - Un dato opcional de la oferta, la fecha límite de inscripción, en el alta y la edición (API y formulario web)
    _(R1, R6)_.
  - Sus validaciones: fecha de calendario válida, nunca anterior a hoy cuando cambia, sin fecha máxima _(R2)_.
  - Publicar un borrador con el plazo vencido da 400 _(R2)_.
  - Inscribir en una oferta publicada con el plazo vencido da 409 `ENROLLMENT_DEADLINE_PASSED` _(R1, R5)_.
  - En el pipeline, pasado el plazo, no se ofrece «Inscribir candidato» y se explica por qué _(R6)_.
  - Duplicar no copia la fecha _(R4)_.
  - Seed: una oferta publicada con plazo futuro y otra con el plazo vencido _(R7)_.
  - Opcional, sin flujo ni criterio propio: mostrar el dato en la ficha de la oferta si sale gratis del formulario
    _(R6)_. Lo decide `/tech-design`.
- **Fuera** _(R6, R7)_:
  - Columna en el listado de ofertas.
  - Aviso o marca «Plazo vencido» en la ficha.
  - Cierre automático al vencer y estado nuevo de la oferta.
  - Avisos o recordatorios.
  - Filtrar u ordenar por la fecha.
  - Hora de corte.
  - Límite por etapa.
  - Fecha de apertura de inscripciones.
  - Excepciones por candidato (inscribir fuera de plazo).
  - Historial de cambios del plazo.
  - Cambios en las inscripciones existentes.

## Actores y roles
- **Reclutador:** único rol de la aplicación, sin login _(DEC-04)_. Fija el plazo e intenta inscribir.
- **Candidato:** interesado cuyos datos se tratan; no usa la aplicación _(DEC-04)_.
- **No hay procesos programados:** el plazo no cierra la oferta ni dispara nada al vencer. Solo se evalúa cuando alguien
  intenta inscribir, publicar o abre el pipeline _(R6; RN-13 de FEAT-01; `docs/05_modules/ofertas/functional.md`,
  «Actores»)_.

## Casos de uso

Ningún caso de uso nuevo: la feature añade flujos a seis UC existentes y cambia el flujo principal de cuatro de ellos.

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-01 | Crear una oferta como borrador | ofertas | P (cambia), E7 (nuevo) | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` | Modificado |
| UC-02 | Editar una oferta | ofertas | P (cambia), A2, A3, E5 (nuevos) | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` | Modificado |
| UC-03 | Publicar una oferta | ofertas | E3 (nuevo) | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` | Modificado |
| UC-06 | Duplicar una oferta como borrador | ofertas | P (cambia) | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` | Modificado |
| UC-14 | Inscribir un candidato en una oferta | inscripciones | P (cambia), E6 (nuevo) | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` | Modificado |
| UC-17 | Ver el pipeline de una oferta | inscripciones | A4 (nuevo) | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` | Modificado |

UC-08 (consultar una oferta) no cambia: mostrar el dato en la ficha es opcional y no lleva flujo _(R6)_.

## Reglas de negocio
- **RN-01 · Opcional.** La fecha límite de inscripción es opcional; si está vacía, la oferta no tiene límite y admite
  inscripciones mientras esté `published` _(R1, RV-17)_.
- **RN-02 · Día inclusivo.** La fecha límite es un día de calendario, sin hora. Se evalúa como día natural de
  Europe/Madrid con el reloj del servidor y sin margen: el mismo día aún se puede inscribir, y desde el día siguiente
  ya no _(R1, DEC-09, RV-25)_.
- **RN-03 · Nunca en el pasado.** Al crear o editar, una fecha límite anterior a hoy da 400 junto al campo; hoy es
  válido; no hay fecha máxima. Solo se comprueba cuando la fecha cambia _(R2; principio de diseño 4)_. Una fecha que no
  es de calendario válida también da 400 _(recomendación aceptada por la regla de respuesta por defecto)_.
- **RN-04 · Publicar con el plazo vencido.** Publicar un borrador cuya fecha límite ya pasó da 400 y la oferta sigue en
  `draft` _(R2)_.
- **RN-05 · Cambiar el plazo.** En `draft` y `published` el plazo se puede poner, ampliar, reducir o quitar, nunca al
  pasado _(R3, S-09)_. En `closed` no se edita _(RV-04)_. Ampliar o quitar un plazo vencido reabre las inscripciones
  sin cambiar el estado de la oferta _(R3)_.
- **RN-06 · Inscribir fuera de plazo.** Inscribir en una oferta `published` con el plazo vencido da 409
  `ENROLLMENT_DEADLINE_PASSED` con el mensaje «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.» y no crea
  nada _(R1, DEC-07)_.
- **RN-07 · Precedencia.** Si fallan varias cosas al inscribir, gana «oferta no publicada» (409 de UC-14 · E1), luego
  «plazo vencido» (RN-06) y luego «duplicado» (409 `DUPLICATE` de UC-14 · E2) _(R5)_.
- **RN-08 · Duplicar.** Duplicar una oferta no copia su fecha límite: el borrador nuevo nace sin plazo _(R4, S-11)_.
- **RN-09 · Pipeline.** El pipeline de una oferta `published` con el plazo vencido no ofrece «Inscribir candidato» y
  explica por qué. La API decide siempre: si la página se cargó antes del vencimiento, inscribir da el 409 de RN-06, que
  la web muestra con `role="alert"` antes de refrescar el pipeline _(R6; recomendación aceptada por la regla de
  respuesta por defecto; principios de diseño 2 y 4)_.
- **RN-10 · Sin efectos al vencer.** El vencimiento del plazo no cambia el estado de la oferta, no la cierra, no es un
  estado nuevo y no toca las inscripciones existentes, que siguen avanzando y rechazándose como hoy _(R6, IDEA-004;
  RN-13 de FEAT-01)_.

## Invariantes
- **INV-01:** nunca se crea una inscripción en un día de Europe/Madrid posterior a la fecha límite que tiene la oferta
  en ese momento _(RN-02, RN-06)_.
- **INV-02:** al guardarse, una fecha límite que cambia nunca es anterior al día en que se guarda _(RN-03)_.
- **INV-03:** el vencimiento del plazo nunca cambia el estado de la oferta ni el de sus inscripciones _(RN-10)_.
- **INV-04:** la fecha límite de una oferta `closed` nunca cambia _(RV-04)_.
- **INV-05:** un borrador creado al duplicar nunca tiene fecha límite _(RN-08)_.

## Datos y conceptos clave
- **Fecha límite de inscripción:** atributo opcional de la oferta (`JobOpening`), un día de calendario (`AAAA-MM-DD`)
  de Europe/Madrid, que se muestra como `dd/mm/aaaa` _(R1, DEC-09, principio de diseño 6)_. No es un instante: no lleva
  hora.
- **Plazo vencido:** hoy, en Europe/Madrid y con el reloj del servidor, es posterior a la fecha límite _(RN-02)_.
- **Datos personales:** ninguno. La fecha es un dato de la oferta, no del candidato, y no cambia la retención porque no
  cierra inscripciones _(R7, `docs/RGPD.md`)_. No hace falta revisión del `datos-personales-auditor` por esta feature.

## Casos límite
- **Input inválido:**
  - Una fecha que no es de calendario válida (formato distinto o día inexistente, como el 31/02) → 400 junto al campo
    _(RN-03)_.
  - Un campo desconocido sigue dando 400 _(S-03, DEC-11)_.
- **Boundary:**
  - Fecha límite igual a hoy → se guarda, se publica y se inscribe _(R1, R2)_.
  - Fecha límite igual a ayer → 400 al guardarla si cambia, 400 al publicar y 409 al inscribir _(R1, R2)_.
  - Corte a las 00:00 de Europe/Madrid: a las 23:59:59 del día límite se inscribe y a las 00:00:00 del día siguiente
    da 409. Hay que probarlo cuando UTC y Madrid están en días distintos (22:00-24:00 UTC según el horario de verano o
    invierno) y en los días de cambio de hora, con el reloj inyectado _(RN-02, DEC-09)_.
  - Sin fecha límite → comportamiento actual, sin límite _(RN-01)_.
- **Fallo de dependencia:**
  - Si falla la lectura de la oferta o una escritura al inscribir, la transacción se deshace entera y no se crea nada,
    como hoy _(UC-14 · E5)_.
  - Con la API caída, el pipeline muestra su estado de error _(UC-17 · E2)_.
- **Concurrencia:**
  - El reclutador cambia el plazo en una pestaña mientras inscribe en otra → la inscripción se evalúa con el plazo
    vigente al procesarla _(DEC-08)_.
  - Dos ediciones del plazo → gana la última escritura _(S-02)_.
  - El pipeline se abrió antes del vencimiento y se pulsa «Inscribir» después → 409 de RN-06, mensaje con
    `role="alert"` y refresco del pipeline _(RN-09)_.
- **Datos corruptos o legacy:**
  - Las ofertas existentes no tienen fecha límite, así que no cambian _(RN-01)_.
  - Una oferta `published` con el plazo vencido es un estado legítimo, no corrupto: el seed tiene una a propósito
    _(R7)_.
- **Seguridad:**
  - Sin datos personales nuevos _(R7)_.
  - El mensaje del 409 solo contiene la fecha _(RN-06)_.
  - Las escrituras siguen protegidas por DEC-12.
- **Idempotencia:**
  - Volver a guardar la oferta con la misma fecha límite, aunque esté vencida, no la valida contra hoy y no da error
    _(RN-03)_.
  - Reintentar una inscripción fuera de plazo da el mismo 409 sin crear nada _(RN-06)_.

## Módulos afectados
- **`ofertas`:** nuevo dato opcional en el alta, la edición y el formulario. Validación de RN-03 y RN-05, guarda de
  RN-04 al publicar, exclusión del dato al duplicar (RN-08) y las dos ofertas del seed (R7). UC-01, UC-02, UC-03 y
  UC-06.
- **`inscripciones`:** inscribir comprueba el plazo con la precedencia de RN-07 (UC-14), y el pipeline oculta
  «Inscribir candidato» y explica el motivo (UC-17). La fecha límite la lee de `ofertas` por el puerto existente
  «estado de la oferta» _(DEC-06)_. Cómo se amplía es cosa de `/tech-design`.
- **`candidatos`:** no cambia.

## Dependencias, riesgos y supuestos
- **Dependencias:** FEAT-01 (ofertas) y FEAT-03 (inscripciones y pipeline), ya entregadas _(IDEA-004)_.
- **Riesgos:**
  - El corte de día entre UTC y Europe/Madrid es fácil de implementar mal; exige tests de frontera con el reloj
    inyectado _(DEC-09)_.
  - El seed con plazos relativos al día del `db:reset` puede desfasarse si la base se regenera y se usa días después;
    para los e2e, la base `data/e2e.db` se regenera en cada pasada _(DEC-03)_.
  - Añadir un campo al esquema estricto de la oferta exige actualizar los tests de «campo desconocido» y del esquema
    _(DEC-11)_.
- **Supuestos confirmados:** las respuestas `R1`-`R7` de la persona (2026-10-13). Para lo no cubierto, la persona fijó
  «la regla del repo (RV, S, DEC) si la hay; si no, la recomendación del analista».

## Criterios de aceptación
- [ ] Dado una oferta nueva sin fecha límite, cuando el reclutador la crea y la publica, entonces admite inscripciones
  como hoy, sin límite.
- [ ] Dado el día de hoy, cuando el reclutador crea o edita una oferta con fecha límite hoy, entonces se guarda; y con
  ayer, entonces da 400 junto al campo y no se guarda.
- [ ] Dado una oferta `published` con el plazo vencido, cuando el reclutador edita su descripción sin tocar la fecha,
  entonces se guarda sin error.
- [ ] Dado un borrador completo con el plazo vencido, cuando el reclutador lo publica, entonces da 400 y sigue en
  `draft`.
- [ ] Dado una oferta `published` con fecha límite hoy, cuando se inscribe a un candidato a las 23:59:59 de
  Europe/Madrid, entonces se crea la inscripción; y a las 00:00:00 del día siguiente, entonces da 409
  `ENROLLMENT_DEADLINE_PASSED` con «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.» y no se crea nada.
- [ ] Dado una oferta `published` con el plazo vencido y un candidato ya inscrito en ella, cuando se intenta
  inscribirlo, entonces da 409 `ENROLLMENT_DEADLINE_PASSED`; y dado una oferta `closed` con el plazo vencido, entonces
  da el 409 de oferta no publicada.
- [ ] Dado una oferta `published` con el plazo vencido, cuando el reclutador lo amplía a una fecha futura o lo quita,
  entonces puede volver a inscribir candidatos y la oferta sigue `published`.
- [ ] Dado una oferta con fecha límite, cuando el reclutador la duplica, entonces el borrador nuevo no tiene fecha
  límite.
- [ ] Dado una oferta `published` con el plazo vencido, cuando el reclutador abre su pipeline, entonces no ve
  «Inscribir candidato» y lee por qué, mientras «Avanzar» y «Rechazar» siguen disponibles en las tarjetas no finales.
- [ ] Dado el seed regenerado, cuando el reclutador lista las ofertas publicadas, entonces hay una con plazo futuro y
  otra con el plazo vencido.

## Respuestas del shaping (2026-10-13)
Respuestas de la persona a las 12 preguntas del analista, tal cual:

- **R1.** La fecha límite es opcional; vacía = sin límite. Es solo un día (sin hora) e inclusiva: el mismo día aún se
  puede inscribir (día natural de Europe/Madrid, DEC-09, con el reloj del servidor y sin margen); al día siguiente,
  inscribir da 409 `ENROLLMENT_DEADLINE_PASSED`, con el mensaje «El plazo de inscripción de esta oferta terminó el
  dd/mm/aaaa.».
- **R2.** No se puede poner en el pasado al crear ni al editar (400 junto al campo); hoy sí vale. Solo se comprueba
  cuando la fecha cambia. No hay fecha máxima. Publicar un borrador con el plazo ya vencido da 400 y sigue en
  borrador.
- **R3.** Se puede cambiar en una oferta publicada (S-09): ampliarla, reducirla o quitarla, nunca al pasado. Ampliar un
  plazo vencido reabre las inscripciones. En una cerrada no se edita (RV-04).
- **R4.** No se copia al duplicar (S-11, «sin fechas»).
- **R5.** En una oferta cerrada, inscribir da el 409 de oferta cerrada. Si fallan varias cosas al inscribir, gana
  «oferta no publicada», luego «plazo vencido» y luego «duplicado».
- **R6.** Dónde se ve: en el formulario de alta y edición de la oferta (campo opcional) y en el pipeline, donde, pasado
  el plazo, no se ofrece «Inscribir candidato» y se explica por qué. En la ficha de la oferta, como mucho el dato, si
  sale gratis del formulario. NO hay columna en el listado ni aviso en la ficha. Las inscripciones existentes no
  cambian, la oferta no se cierra sola y no es un estado nuevo.
- **R7.** Alcance: una sola HU fullstack, pequeña, sin RGPD (la fecha no es un dato personal). El seed lleva una
  oferta publicada con plazo futuro y otra con el plazo vencido. Fuera de alcance: columna en el listado, aviso en la
  ficha, avisos, filtros u orden por la fecha, hora o límite por etapa, excepciones por candidato e historial de
  cambios del plazo.
- **Por defecto.** Cualquier otra pregunta: si la respuesta está en una regla del repo (RV, S, DEC), la que diga esa
  regla; si no, según la recomendación del analista.

Correspondencia con las preguntas del analista:

| Pregunta | Respuesta | Pregunta | Respuesta |
|---|---|---|---|
| 1 | R1 | 7 | R4 |
| 2 | R1 | 8 | R1 y R5 |
| 3 | R2 | 9 | Recomendación: la API manda, `role="alert"` y refresco del pipeline |
| 4 | R2 | 10 | R6: formulario y pipeline; en la ficha solo el dato, sin «Plazo vencido»; sin columna |
| 5 | R2 | 11 | R7 |
| 6 | R3 | 12 | R7, más la columna del listado, el aviso de la ficha y la fecha de apertura |

## Preguntas abiertas
Ninguna.

## Handoff a delivery
1. **HU única — Fecha límite de inscripción en una oferta** (fullstack: `ofertas` e `inscripciones`, API y web)
   _(R7)_.
   - **Valor:** el reclutador acota de antemano hasta qué día admite candidatos en una oferta, sin tener que cerrarla.
   - **Flujos que cubre:**
     - UC-01: P y E7.
     - UC-02: P, A2, A3 y E5.
     - UC-03: E3.
     - UC-06: P.
     - UC-14: P y E6.
     - UC-17: A4.
   - **Además:** el seed con dos ofertas publicadas, una con plazo futuro y otra vencido _(R7)_.
   - **Dependencias:** ninguna pendiente (FEAT-01 y FEAT-03 entregadas).
   - **Secuencia:** a 2026-10-13 no hay HU abiertas (todas están en `docs/03_delivery/hu/completadas/`), así que
     ninguna otra edita estos UC a la vez.

**HU creadas (2026-10-13):** HU-07 (`docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/hu.md`), con todos los flujos
del handoff y el seed.
