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

Fuentes: la idea `IDEA-004`; las respuestas de la persona del 2026-10-13 (`R1`..`R7` y las respuestas a `P1`..`P24`,
en [Preguntas y respuestas del shaping](#preguntas-y-respuestas-del-shaping)); las reglas validadas `RV-NN` y las
respuestas `S-NN` de `docs/02_discovery/reglas-validadas.md`; `DEC-NN` de
`docs/07_architecture_principles/DECISIONS.md`; y los principios de `docs/06_design_principles/README.md`. Las reglas
de esta feature se citan como `FEAT-04 · RN-NN` fuera de este documento, para no confundirlas con las de FEAT-01 y
FEAT-03.

## Qué
El reclutador puede fijar, al crear o editar una oferta, hasta qué día acepta inscripciones; pasado ese día no se
inscribe a nadie más en ella, sin que la oferta se cierre _(IDEA-004, R1, R6)_.

## Por qué
Hoy una oferta publicada acepta inscripciones hasta que el reclutador la cierra a mano. Con una fecha límite puede
anunciar y hacer cumplir un plazo sin acordarse de cerrar la oferta ese día _(IDEA-004)_, y sin el efecto del cierre,
que rechaza las inscripciones activas _(RV-05)_.

## Alcance
- **Dentro:**
  - Un dato opcional de la oferta, la fecha límite de inscripción, que se fija, cambia o quita al crear y al editar
    _(R1, R2, R3)_.
  - Su validación al guardar y al publicar _(R2, P8, P10, P21)_.
  - El bloqueo de inscripciones nuevas pasado el plazo, con su error propio _(R1, R5, P15, P16)_.
  - Su visualización en la ficha, en el listado de ofertas y en el pipeline, donde, vencido el plazo, no se ofrece
    «Inscribir candidato» y se explica por qué _(R6, P17, P18, P19)_.
  - Ofertas de ejemplo con plazo en el seed _(P20)_.
  - API y web de `ofertas` (`apps/api/src/modules/jobs/`, `apps/web/src/features/jobs/`) e `inscripciones`
    (`apps/api/src/modules/applications/`, `apps/web/src/features/applications/`) _(IDEA-004, docs/_modules.md)_.
- **Fuera:**
  - Que la oferta se cierre sola al vencer el plazo _(R6, P1)_.
  - Cambiar las inscripciones existentes al vencer el plazo _(R6, P2)_.
  - Un plazo con hora, o por etapa _(R1, P4, P24)_.
  - Cortar las inscripciones hoy mismo sin cerrar la oferta: el plazo más corto posible es hoy, inclusive _(R1, R2,
    P12)_.
  - Inscribir de forma excepcional fuera de plazo: para una excepción, se amplía o se quita el plazo _(P24)_.
  - Avisos o notificaciones del vencimiento _(P24)_.
  - Filtrar u ordenar el listado de ofertas por el plazo _(P18, P24)_.
  - Un historial de cambios del plazo _(P24)_.
  - Mostrar el plazo fuera del ATS: el candidato no usa la aplicación _(P24, DEC-04)_.
  - Copiar el plazo al duplicar una oferta _(R4, S-11)_.
  - Un estado nuevo de la oferta: `draft → published → closed` no cambia _(P14, RV-03)_.

## Actores y roles
- **Reclutador:** único rol de la aplicación, sin login _(DEC-04)_. Fija el plazo (UC-01, UC-02), publica (UC-03),
  duplica (UC-06), consulta (UC-07, UC-08), inscribe (UC-14) y ve el pipeline (UC-17).
- **Candidato:** interesado cuyos datos se tratan; no usa la aplicación ni ve el plazo _(DEC-04, P24)_.
- No hay procesos programados: el vencimiento no dispara nada; solo se comprueba al inscribir _(R6, P1)_.

## Casos de uso
La feature no crea casos de uso: el plazo es un dato y una condición de flujos que ya existen, así que **modifica**
ocho UC del catálogo _(propuesta del análisis aceptada por la persona, 2026-10-13)_. Cada UC modificado pasa a
`feature: FEAT-04` (la última feature que lo cambió, según `docs/_templates/UC.template.md`), conserva su feature de
origen en una línea «Origen» y en la columna «Feature» del índice, y marca sus flujos nuevos o cambiados con
«(FEAT-04)».

| UC | Título | Módulo | Flujos que cambia | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-01 | Crear una oferta como borrador | ofertas | P (pasos 1-2), E7 nueva | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` | Modificado |
| UC-02 | Editar una oferta | ofertas | P (pasos 2-3), A2 y A3 nuevos, E5 nueva | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` | Modificado |
| UC-03 | Publicar una oferta | ofertas | P (paso 2), E3 nueva | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` | Modificado |
| UC-06 | Duplicar una oferta como borrador | ofertas | P (paso 2) | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` | Modificado |
| UC-07 | Listar y buscar ofertas | ofertas | P (paso 3) | `docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` | Modificado |
| UC-08 | Consultar una oferta | ofertas | P (paso 2), A1, A2 nuevo | `docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md` | Modificado |
| UC-14 | Inscribir un candidato en una oferta | inscripciones | P (paso 2), E1 y E2 (orden de errores), E6 nueva | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` | Modificado |
| UC-17 | Ver el pipeline de una oferta | inscripciones | P (paso 2), A1, A2, A4 nuevo | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` | Modificado |

No cambian UC-04 (cerrar), UC-05 (borrar un borrador), UC-15 (avanzar), UC-16 (rechazar), UC-18 (historial) ni UC-19
(rechazo al cerrar): el plazo no cierra la oferta ni toca las inscripciones existentes _(R6, P1, P2)_.

## Reglas de negocio
- **RN-01:** la fecha límite de inscripción es opcional; vacía, o solo con espacios, significa sin plazo, y la oferta
  admite inscripciones como hoy _(R1, P3, S-03, DEC-11.3)_.
- **RN-02:** la fecha límite es un día de calendario (`AAAA-MM-DD`), sin hora, de Europe/Madrid _(R1, P4, DEC-09)_.
- **RN-03:** el plazo es inclusivo: se puede inscribir durante todo el día de la fecha límite, hora de Europe/Madrid;
  desde las 00:00 del día siguiente (Madrid), inscribir da 409 `ENROLLMENT_DEADLINE_PASSED` y no se crea nada _(R1, P5,
  P6)_.
- **RN-04:** decide el reloj inyectado del servidor en el momento de inscribir, dentro de la transacción de la
  inscripción y contra el plazo vigente, sin margen de gracia _(R1, P6, P22, P23, DEC-06, DEC-09)_.
- **RN-05:** al crear una oferta, o al cambiar su fecha límite en una edición, la fecha no puede ser anterior a hoy
  (Europe/Madrid): 400 junto al campo; hoy sí vale _(R2, P7)_. Si una edición no cambia la fecha límite, no se
  comprueba, aunque ya haya vencido _(P8)_.
- **RN-06:** la fecha límite debe ser una fecha `AAAA-MM-DD` que exista; un formato distinto, una fecha inexistente
  (30/02), una fecha con hora o un número dan 400 junto al campo _(P21, S-03, DEC-07, DEC-11)_. No hay fecha máxima de
  negocio _(P9)_.
- **RN-07:** la fecha límite se fija, amplía, reduce (nunca al pasado) o quita en una oferta `draft` o `published`; en
  una `closed` no se edita (409, como cualquier edición de una cerrada) _(R3, P11, RV-04, S-09)_. Ampliar o quitar un
  plazo vencido vuelve a abrir las inscripciones _(R3, P11)_.
- **RN-08:** publicar un borrador cuya fecha límite ya ha vencido da 400 junto al campo, y la oferta sigue en `draft`;
  con la fecha límite de hoy o posterior, o sin ella, se publica como hoy _(P10, RV-02)_.
- **RN-09:** duplicar una oferta no copia su fecha límite: el borrador nuevo nace sin plazo _(R4, P13, S-11)_.
- **RN-10:** al inscribir, si fallan varias condiciones a la vez, el error es el de la primera, en este orden: oferta
  no publicada (`draft` o `closed`, 409 `INVALID_TRANSITION`), plazo vencido (409 `ENROLLMENT_DEADLINE_PASSED`) e
  inscripción duplicada (409 `DUPLICATE`) _(R5, P16, RV-17, RV-18)_.
- **RN-11:** el plazo no cambia el estado de la oferta ni la cierra, y no toca las inscripciones existentes, que se
  siguen avanzando, rechazando y contratando como hoy _(R6, P1, P2, P14, RV-03, RV-07)_.
- **RN-12:** la fecha límite se muestra en Europe/Madrid como `dd/mm/aaaa`: en la ficha (o «Sin fecha límite»), con un
  aviso de plazo vencido salvo en una oferta `closed`, donde es solo informativa; en una columna del listado; y en el
  pipeline, donde, vencido el plazo de una oferta `published`, no se ofrece «Inscribir candidato» y se explica por qué
  _(R5, R6, P17, P18, P19, principio de diseño 6)_.

## Invariantes
- **INV-01:** nunca se crea una inscripción después del final del día límite de su oferta, hora de Europe/Madrid
  _(R1, RN-03)_.
- **INV-02:** el plazo nunca cambia el estado de una oferta ni la etapa de sus inscripciones _(R6, RV-03)_.
- **INV-03:** ninguna creación, edición que cambie la fecha límite ni publicación deja una fecha límite anterior al día
  (Europe/Madrid) en que se hace _(R2, P10)_.
- **INV-04:** la fecha límite de una oferta `closed` nunca cambia _(R3, RV-04)_.
- **INV-05:** un borrador creado al duplicar nunca tiene fecha límite _(R4, S-11)_.

## Datos y conceptos clave
- **Fecha límite de inscripción:** dato opcional de la oferta (`JobOpening`); un día de calendario de Europe/Madrid,
  último día, inclusive, en que se admiten inscripciones _(R1, docs/_modules.md)_.
- **Plazo vencido:** condición calculada, no un estado. Una oferta tiene el plazo vencido cuando tiene fecha límite y
  hoy (Europe/Madrid) es posterior a ella _(R1, P14)_.
- **Datos personales:** ninguno. La fecha límite es un dato de la oferta, no del candidato, y la feature no cambia la
  retención porque no crea ni cierra procesos _(R7, docs/RGPD.md §3)_.

## Casos límite
- **Input inválido:**
  - Una fecha con formato distinto de `AAAA-MM-DD`, inexistente (30/02/2027), con hora o un número → 400 junto al
    campo _(RN-06)_.
  - Una cadena vacía o solo de espacios → sin plazo _(RN-01)_.
  - Fijar la fecha límite en una petición de inscripción o de publicación → 400 por campo desconocido _(S-03, DEC-11)_.
- **Boundary:**
  - Inscribir el mismo día límite a las 23:59 (Madrid) → se admite; a las 00:00 del día siguiente → 409 _(RN-03)_.
  - Con la fecha límite del 20/10/2026 (horario de verano, UTC+2), se admite hasta las 21:59:59.999 UTC; con la del
    25/10/2026, día del cambio de hora (UTC+1 desde las 03:00), se admite hasta las 22:59:59.999 UTC _(RN-03,
    DEC-09)_.
  - Crear o editar con la fecha límite de hoy → se admite; con la de ayer → 400 _(RN-05)_.
  - Publicar con la fecha límite de hoy → se publica; con la de ayer → 400 _(RN-08)_.
  - Una oferta sin fecha límite → admite inscripciones como hoy _(RN-01)_.
- **Fallo de dependencia:**
  - Con la API caída, la web muestra el estado de error en la ficha, el listado y el pipeline _(principio de diseño 3)_.
  - Si falla la escritura de una inscripción, no se crea nada, como hoy (UC-14 · E5) _(S-06)_.
- **Concurrencia:**
  - El reclutador abre la inscripción antes de la medianoche y confirma después → 409 `ENROLLMENT_DEADLINE_PASSED`,
    y la web muestra el mensaje _(RN-04, P22)_.
  - Se recorta el plazo en una pestaña mientras se inscribe en otra → la inscripción comprueba el plazo vigente en su
    transacción _(RN-04, P23)_.
  - Dos ediciones del plazo a la vez → gana la última escritura _(S-02, DEC-08)_.
- **Datos corruptos o legacy:**
  - Las ofertas que ya existen no tienen fecha límite → admiten inscripciones como hoy _(RN-01)_.
  - Una oferta `published` o `draft` cuyo plazo ya venció se puede seguir editando sin tocar la fecha _(RN-05)_.
  - Las inscripciones existentes no cambian al vencer el plazo _(RN-11)_.
- **Seguridad:**
  - El error de plazo vencido no lleva datos del candidato; solo la fecha límite de la oferta _(QUALITY-GATES §4.3,
    docs/RGPD.md §6.1)_.
  - Esquema estricto y SQL en sentencias preparadas, como en el resto de la API _(DEC-11, QUALITY-GATES §4.4)_.
  - La enumeración de IDs no es un riesgo nuevo: un único rol y la API en `127.0.0.1` _(DEC-04)_.
- **Idempotencia:**
  - Guardar la misma fecha límite → edición sin efecto, 200 _(S-02)_.
  - Reintentar una inscripción ya creada → 409 `DUPLICATE` mientras el plazo siga abierto; si el reintento llega con
    el plazo ya vencido, gana `ENROLLMENT_DEADLINE_PASSED` (aceptado por la persona) _(RN-10, P16)_.

## Módulos afectados
- **`ofertas`:** el dato de la fecha límite en crear, editar y publicar, y su visualización en la ficha y el listado;
  duplicar no la copia (UC-01, UC-02, UC-03, UC-06, UC-07, UC-08) _(IDEA-004)_.
- **`inscripciones`:** el bloqueo y el orden de errores al inscribir, y el plazo y su aviso en el pipeline (UC-14,
  UC-17). Lee el plazo de la oferta de `ofertas` sin importar el módulo _(IDEA-004, DEC-06)_.
- **`candidatos`:** sin cambios.

## Dependencias, riesgos y supuestos
- **Dependencias:** FEAT-01 (ofertas y su ciclo de vida) y FEAT-03 (inscribir y el pipeline), ya entregadas.
- **Riesgos:**
  - Las fechas fijas del seed envejecen: una oferta con «plazo futuro» deja de serlo con el tiempo. El cómo lo decide
    `/tech-design` _(P20)_.
  - Una sola HU fullstack que toca ocho UC en dos módulos puede rozar el techo de 15 tareas por HU (QUALITY-GATES §2):
    si `/task-planner` lo supera, se para y se escala _(R7)_.
- **Supuestos confirmados:** todas las respuestas de la persona del 2026-10-13 (R1..R7 y P1..P24).

## Criterios de aceptación
- [ ] Dado una oferta `published` con la fecha límite del 31/10/2026, cuando el reclutador inscribe a un candidato el
  31/10/2026 a las 23:59 (Madrid), entonces se crea la inscripción; y cuando lo intenta el 01/11/2026 a las 00:00,
  entonces recibe 409 `ENROLLMENT_DEADLINE_PASSED` con un mensaje que dice la fecha, y no se crea nada.
- [ ] Dado hoy 13/10/2026, cuando el reclutador crea o edita una oferta con la fecha límite del 12/10/2026, entonces
  recibe 400 junto al campo; y con la del 13/10/2026, se guarda.
- [ ] Dado una oferta `published` con el plazo vencido, cuando el reclutador edita su descripción sin tocar la fecha
  límite, entonces se guarda; y cuando amplía la fecha límite a una futura, entonces vuelve a admitir inscripciones.
- [ ] Dado un borrador con el plazo vencido, cuando el reclutador lo publica, entonces recibe 400 junto al campo y la
  oferta sigue en `draft`.
- [ ] Dado una oferta con fecha límite, cuando el reclutador la duplica, entonces el borrador nuevo no tiene fecha
  límite.
- [ ] Dado una oferta `closed` con el plazo vencido, cuando se intenta inscribir a un candidato, entonces recibe el 409
  de oferta no publicada, no el de plazo vencido.
- [ ] Dado una oferta `published` con el plazo vencido, cuando el reclutador abre su pipeline, entonces no ve
  «Inscribir candidato» y ve «El plazo de inscripción terminó el dd/mm/aaaa»; sus inscripciones se pueden seguir
  avanzando y rechazando, y la oferta sigue `published`.
- [ ] Dado ofertas con y sin fecha límite, cuando el reclutador abre el listado o la ficha, entonces ve la fecha límite
  en `dd/mm/aaaa`, o que no tiene.

## Preguntas abiertas
Ninguna. Todas las preguntas del shaping se respondieron el 2026-10-13; ver la sección siguiente.

## Preguntas y respuestas del shaping
Respuestas de la persona del 2026-10-13. «Según recomendación» significa que la persona aceptó la recomendación del
análisis, que se transcribe.

**Respuestas canónicas**
- **R1.** La fecha límite es opcional; vacía = sin límite. Es inclusiva: el mismo día de la fecha límite aún se puede
  inscribir (día natural de Europe/Madrid, DEC-09); al día siguiente, inscribir da 409 `ENROLLMENT_DEADLINE_PASSED`.
- **R2.** No se puede poner en el pasado al crear ni al editar (400); hoy sí vale.
- **R3.** Sí se puede cambiar en una oferta publicada (S-09), ampliarla o reducirla, pero nunca al pasado. En una
  cerrada no se edita (RV-04).
- **R4.** No se copia al duplicar (S-11, «sin fechas»).
- **R5.** En una oferta cerrada se muestra como dato informativo; inscribir da el 409 de oferta cerrada, que prevalece
  sobre el de la fecha.
- **R6.** Se ve en la lista de ofertas y en el pipeline; en el pipeline, pasada la fecha, no se ofrece «Inscribir
  candidato» y se explica por qué. Las inscripciones que ya existen no cambian y la oferta no se cierra sola.
- **R7.** Alcance: una sola HU fullstack, sin RGPD (la fecha no es un dato personal).

**Preguntas**

| P | Pregunta | Respuesta |
|---|---|---|
| P1 | ¿La oferta se cierra sola al vencer el plazo? | No (R6). |
| P2 | ¿Las inscripciones existentes se siguen gestionando pasado el plazo? | Sí, no cambian; UC-15, UC-16 y UC-19 tampoco (R6, RV-19). |
| P3 | ¿Obligatoria u opcional? | Opcional; vacía = sin límite (R1). |
| P4 | ¿Día o día con hora? | Solo el día, fecha de calendario (R1; idea: «hasta qué día»). |
| P5 | ¿El mismo día aún se inscribe? | Sí, inclusiva (R1). |
| P6 | ¿Zona horaria e instante que decide? | Europe/Madrid (R1, DEC-09); el reloj inyectado del servidor al inscribir, sin margen de gracia. |
| P7 | ¿Fecha pasada al crear o editar? | No, 400; hoy sí vale (R2). |
| P8 | ¿«Hoy o después» también si la fecha no cambia? | Según recomendación: solo se comprueba cuando la fecha cambia. |
| P9 | ¿Fecha máxima? | Según recomendación: sin fecha máxima de negocio. |
| P10 | ¿Publicar un borrador con el plazo vencido? | Según recomendación: 400 junto al campo; sigue en `draft`. |
| P11 | ¿Ampliar, reducir y quitar en una publicada? | Sí, nunca al pasado; quitar = dejarla vacía; ampliar un plazo vencido reabre las inscripciones (R3, R1). |
| P12 | ¿Cortar las inscripciones hoy sin cerrar? | No; fuera de alcance (consecuencia de R1 y R2). |
| P13 | ¿Se copia al duplicar? | No (R4, S-11). |
| P14 | ¿«Plazo vencido» es un estado nuevo? | No; RV-03 no cambia (RV-03, R6). |
| P15 | ¿Qué error da inscribir con el plazo vencido? | 409 `ENROLLMENT_DEADLINE_PASSED` (R1), con mensaje propio que dice la fecha; según recomendación: «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.» |
| P16 | ¿Qué error gana si fallan varias cosas? | No publicada > plazo vencido (R5, RV-17) > duplicado (según recomendación), aceptando que un reintento tras la medianoche vea «plazo vencido». |
| P17 | ¿Qué muestra la ficha? | Según recomendación: la fecha o «Sin fecha límite», y el aviso de plazo vencido; en una cerrada, solo informativa (R5). |
| P18 | ¿Y el listado? | Una columna (R6); sin filtro ni orden por ella (según recomendación). |
| P19 | ¿Y el pipeline? | Pasado el plazo, sin «Inscribir candidato» y con la explicación, también en el pipeline vacío (R6). |
| P20 | ¿Seed? | Según recomendación: al menos una oferta `published` con plazo futuro y otra con plazo vencido, inventadas (RV-26); el cómo, en `/tech-design`. |
| P21 | ¿Formatos inválidos? | 400 junto al campo; vacío o solo espacios = sin plazo (S-03, DEC-07, DEC-11, R1). |
| P22 | ¿Inscripción que cruza la medianoche? | 409 de R1 y la web muestra el mensaje; tests de frontera de medianoche y del cambio de hora (R1, DEC-09). |
| P23 | ¿Recortar el plazo mientras se inscribe? | La inscripción comprueba el plazo vigente en su transacción; en las ediciones gana la última escritura (S-02, DEC-08, DEC-06). |
| P24 | ¿Confirmas lo que queda fuera? | Sí, todo (cierre automático: R6; el resto, según recomendación). |

## Handoff a delivery
1. **HU única — Fecha límite de inscripción en una oferta (fullstack, `ofertas` e `inscripciones`)** _(R7)_.
   - **Valor:** el reclutador anuncia un plazo de inscripción y el ATS lo hace cumplir sin que tenga que cerrar la
     oferta ese día.
   - **Flujos que cubre:**
     - UC-01: P (fecha límite en el alta) y E7.
     - UC-02: P (fecha límite en la edición), A2, A3 y E5.
     - UC-03: P (fecha límite en la comprobación) y E3.
     - UC-06: P (el plazo no se copia).
     - UC-07: P (columna de fecha límite).
     - UC-08: P (fecha límite en la ficha), A1 (informativa en una cerrada) y A2.
     - UC-14: P (comprobación del plazo), E1 y E2 (orden de errores de RN-10) y E6.
     - UC-17: P (fecha límite en el pipeline), A1 (informativa en una cerrada), A2 (vacío con el plazo vencido) y A4.
   - **Dependencias:** ninguna pendiente; FEAT-01 y FEAT-03 están entregadas.
   - **Datos personales:** ninguno _(R7)_. La feature no añade invariantes de RGPD; el `datos-personales-auditor` de
     `/reviewer` solo tiene que confirmar que el error de plazo vencido no expone datos del candidato.
   - **Nota para el `product-owner`:** si `/task-planner` supera el techo de 15 tareas, se para y se escala antes de
     partirla.

**HU creadas (2026-10-13):** HU-07 (`docs/03_delivery/hu/HU-07-fecha-limite-inscripcion/hu.md`), con todos los flujos
del punto 1.
