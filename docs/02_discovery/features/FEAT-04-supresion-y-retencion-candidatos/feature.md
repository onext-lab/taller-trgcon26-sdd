---
id: FEAT-04
titulo: "Supresión y retención de los datos de candidatos"
estado: priorizada       # shaping | priorizada | en delivery | entregada
prioridad: null          # alta | media | baja (la fija la persona)
idea_origen: IDEA-004
modulos_afectados: [candidatos, inscripciones]
fecha: 2026-10-12
owner: "persona responsable (ratifica PA-01..PA-04); responsable técnico (respuestas del shaping)"
---

# FEAT-04 — Supresión y retención de los datos de candidatos

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.

Fuentes: la idea `IDEA-004`; las reglas validadas `RV-NN` y las respuestas `S-NN` de
`docs/02_discovery/reglas-validadas.md`; `DEC-NN` de `docs/07_architecture_principles/DECISIONS.md`; `docs/RGPD.md`
(sobre todo §3, §4, §5 y las 9 cuestiones de §7); los principios de `docs/06_design_principles/README.md`; y las
respuestas del shaping de la tabla [Respuestas del shaping](#respuestas-del-shaping) (`Q01`..`Q33`), dadas por el
**responsable técnico el 2026-10-12**. Cuatro de ellas (Q01, Q03, Q11 y Q22) llevaban la recomendación aplicada a la
espera de la persona responsable (PA-01..PA-04) y se **ratificaron el 2026-10-13** tal como estaban.

## Qué
El reclutador anonimiza a un candidato cuando este pide la supresión de sus datos, y el sistema anonimiza solo a los
candidatos cuya retención ha vencido. En los dos casos, el candidato anonimizado queda coherente en toda la aplicación:
no se encuentra, no se inscribe, no se edita y se rotula «Candidato anonimizado» donde aparezca _(IDEA-004; RGPD §3,
§4 y §5)_.

## Por qué
Hoy el ATS calcula y enseña la fecha de fin de retención, pero no hace nada al llegar, y no hay forma de atender una
petición de supresión sin borrar a mano _(IDEA-004)_. Es la pieza que cierra el ciclo de vida de los datos personales
del ATS y resuelve las 9 cuestiones abiertas de RGPD §7, que salieron de las reviews de HU-04 a HU-06 y de la
auditoría del sprint-01.

## Alcance
- **Dentro:**
  - Anonimizar a petición desde la ficha, con confirmación: UC-20 _(RGPD §4 y §5; Q04, Q06)_.
  - Anonimizar al vencer la retención con una pasada automática: UC-21 _(RGPD §3; Q01)_.
  - El estado «anonimizado» con su fecha y su motivo, y su efecto en alta, edición, búsqueda, ficha, consentimiento,
    inscripción, avance, rechazo, pipeline, historial y cierre de oferta: UC-09 a UC-19 modificados _(S-05; RGPD §5 y
    §7)_.
  - El tratamiento de los candidatos con la retención vencida aún no anonimizados: UC-12 · A3, UC-13 · A4 y
    UC-14 · E7 _(RGPD §7.1 y §7.4; Q22-Q25)_.
  - Que el dato anterior no se pueda recuperar de los ficheros de la base _(RGPD §5 y §7.8; Q13)_.
  - Datos inventados de demostración en el seed _(IDEA-004, notas; Q31)_.
- **Fuera:**
  - La exportación de la ficha por derecho de acceso (art. 15) _(`docs/05_modules/candidatos/functional.md`; Q32)_.
  - El borrado físico _(RV-16)_ y la reversión de una anonimización _(RGPD §5: irreversible)_.
  - Un registro o listado global de anonimizaciones y una pantalla con el resultado de la pasada _(Q28, Q32)_.
  - Guardar quién o por qué canal pidió la supresión _(RGPD §5; Q07)_.
  - Avisos al candidato, que no usa la aplicación _(DEC-04; Q32)_.
  - Plazos de retención configurables y bloqueo legal de la supresión _(Q32)_.
  - Un filtro para ver a los anonimizados en el listado _(RV-14; Q14)_.
  - El mecanismo técnico contra los residuos y la forma de la guarda de estado: son de `/tech-design` _(Q13, Q21)_.
  - La importación CSV _(RV-27, feature C)_ y los roles o el login _(DEC-04)_.

## Actores y roles
- **Reclutador:** único rol de la aplicación, sin login _(DEC-04)_. Registra la petición de supresión declarando que
  el candidato la hizo, igual que el consentimiento _(Q02; RV-11)_. Dispara UC-20 y los UC modificados.
- **Proceso programado de la API:** actor nuevo; lanza la pasada de UC-21 al arrancar la API y una vez al día mientras
  siga en marcha _(Q01; ratificada el 2026-10-13, PA-02)_.
- **Candidato:** interesado cuyos datos se tratan; no usa la aplicación _(DEC-04, RGPD §2)_.

## Casos de uso

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-20 | Anonimizar a un candidato a petición | candidatos | P, A1, A2, A3, E1, E2, E3, E4, E5 | `docs/05_modules/candidatos/casos-de-uso/UC-20-anonimizar-a-peticion.md` | Nuevo |
| UC-21 | Anonimizar a los candidatos con la retención vencida | candidatos | P, A1, A2, A3, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-21-anonimizar-al-vencer-retencion.md` | Nuevo |
| UC-09 | Dar de alta un candidato | candidatos | E4 | `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md` | Modificado |
| UC-10 | Editar la ficha de un candidato | candidatos | E5, E6 | `docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md` | Modificado |
| UC-11 | Buscar candidatos | candidatos | A5 | `docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md` | Modificado |
| UC-12 | Ver la ficha de un candidato | candidatos | A2, A3, A4 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` | Modificado |
| UC-13 | Registrar, retirar o renovar el consentimiento | candidatos | A4, E3 | `docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md` | Modificado |
| UC-14 | Inscribir un candidato en una oferta | inscripciones | E6, E7 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` | Modificado |
| UC-15 | Avanzar una inscripción a la etapa siguiente | inscripciones | E7 | `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md` | Modificado |
| UC-16 | Rechazar una inscripción | inscripciones | A2 | `docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md` | Modificado |
| UC-17 | Ver el pipeline de una oferta | inscripciones | A3 (entra en alcance) | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` | Modificado |
| UC-18 | Consultar el historial de una inscripción | inscripciones | A3 | `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` | Modificado |
| UC-19 | Rechazar las inscripciones activas al cerrar una oferta | inscripciones | A3 | `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` | Modificado |

En los UC modificados, la columna «Flujos» lista solo los flujos que añade o cambia esta feature; el resto sigue como
estaba y su `estado:` no cambia.

## Reglas de negocio
Las `RN-NN` de esta feature se citan en los UC como «FEAT-04 RN-NN», para no confundirlas con las de los módulos.

**Qué es anonimizar**
- **RN-01:** si se pide suprimir a un candidato o vence su retención, entonces se anonimiza; nunca se borra ninguna
  fila _(RV-16, RGPD §5)_.
- **RN-02:** al anonimizar, el nombre pasa a «Candidato anonimizado» y el teléfono, el resumen y las skills quedan
  vacíos _(RGPD §5, RV-09; Q09)_.
- **RN-03:** al anonimizar, el email pasa a uno generado a partir del ID del candidato en un dominio reservado y no
  enrutable (por ejemplo, `anonimizado-0042@anonimizado.invalid`, con `.invalid` reservado por RFC 2606): único por
  construcción y sin derivar del email original. El alta y la edición rechazan con 400 los emails de ese dominio
  _(RGPD §7.9c, RV-10; Q10)_.
- **RN-04:** al anonimizar, se conservan el ID, las inscripciones con su etapa y el historial de cambios de etapa, y se
  vacía la nota de todos sus rechazos, sea la anonimización a petición o por vencimiento _(RGPD §5 y §7.3; UC-16,
  «Datos personales»; Q08)_.
- **RN-05:** al anonimizar, se conservan las fechas y la versión del consentimiento (otorgamiento, versión y retirada)
  y la fecha de alta, como prueba del art. 7.1 _(RGPD §2 y §7.9a; Q11; ratificada el 2026-10-13, PA-04)_.
- **RN-06:** al anonimizar, se registran la fecha y el motivo («petición» o «vencimiento»), sin guardar los datos
  borrados ni quién o por qué canal pidió la supresión _(RGPD §5; Q07)_.
- **RN-07:** al anonimizar, el fin de retención queda vacío y ningún recálculo posterior lo cambia; la ficha de un
  anonimizado no lo muestra como «Mientras dure el proceso» _(RGPD §5 y §7.9b; Q12)_.

**Anonimizar a petición**
- **RN-08:** si el candidato tiene inscripciones en etapa no final, entonces, en la misma transacción de la
  anonimización, cada una pasa a `rejected` con el motivo «retirada del candidato», sin nota y con su `StageChange`
  _(RV-20, RV-21, S-15; Q03; ratificada el 2026-10-13, PA-01)_.
- **RN-09:** antes de anonimizar, la web pide confirmación con un aviso de que es irreversible y, si las hay, el número
  de inscripciones activas que se rechazarán _(patrón de S-10; IDEA-004, notas; Q04)_.
- **RN-10:** anonimizar a un candidato ya anonimizado devuelve 200 sin cambios _(RGPD §5, S-01, DEC-08; Q19)_.

**El anonimizado en el resto de la aplicación**
- **RN-11:** cualquier otra escritura sobre un anonimizado (editar la ficha; registrar, renovar o retirar el
  consentimiento; inscribirlo) responde 409, por precondición de estado no permitida; no 410, que DEC-07 no recoge
  _(DEC-07, RV-17; Q15, Q19)_.
- **RN-12:** el listado y la búsqueda excluyen siempre a los anonimizados, sin filtro para verlos _(RV-14, RGPD §5;
  Q14)_.
- **RN-13:** el pipeline, el detalle de una inscripción y la ficha muestran «Candidato anonimizado»; el detalle y la
  ficha responden 200, nunca 404, 410 ni un error interno _(UC-17 · A3, S-05, RGPD §5 y §7.5; Q16, Q17, Q18)_.

**Anonimizar al vencer la retención**
- **RN-14:** un candidato vence el mismo día de su fecha de fin de retención, por día natural de Europe/Madrid; la
  pasada anonimiza a los no anonimizados con la fecha igual o anterior a hoy _(RGPD §3, RV-25, DEC-09; Q26)_.
- **RN-15:** la pasada la lanza la propia API al arrancar y una vez al día mientras siga en marcha, sin intervención
  del reclutador _(Q01; ratificada el 2026-10-13, PA-02)_.
- **RN-16:** la pasada anonimiza a cada candidato en su propia transacción; si uno falla, queda como estaba, la pasada
  sigue y se reintenta en la siguiente; los logs no llevan datos personales _(RGPD §6.1; Q27)_.
- **RN-17:** si un candidato tiene la fecha vencida y alguna inscripción no final (dato legacy que la fórmula no
  produce), la pasada lo salta y lo registra en el log sin datos personales _(S-06; Q29)_.

**Retención vencida aún no anonimizada**
- **RN-18:** un candidato con la retención vencida y aún no anonimizado no se puede inscribir: 409 con un mensaje que
  lo explica _(RGPD §2 y §7.1; Q22; ratificada el 2026-10-13, PA-03)_. Por eso contratar, rechazar o cerrar la oferta
  solo pueden llevar a «cierre + 6 meses» a candidatos cuyo proceso se abrió con una retención vigente, lo que es
  correcto según la fórmula _(S-06, RGPD §7.4; Q25)_.
- **RN-19:** un candidato con la retención vencida y aún no anonimizado sigue en el listado sin marca; su ficha muestra
  «Vencida el dd/mm/aaaa · pendiente de anonimizar»; se puede editar (rectificación) y registrar un consentimiento
  nuevo, que recalcula la retención _(RGPD §2 y §4, S-06, S-07; Q23, Q24)_.

**Transversales**
- **RN-20:** todos los efectos de una anonimización van en una sola transacción, y el estado del candidato se comprueba
  dentro de la transacción de cada escritura _(DEC-06, DEC-08; Q21, Q30)_.
- **RN-21:** tras anonimizar, ni el fichero de la base ni sus ficheros auxiliares conservan el dato anterior, y un test
  lo comprueba buscando el dato antiguo en los ficheros; el mecanismo lo decide `/tech-design` _(RGPD §5 y §7.8;
  Q13)_.

## Invariantes
- **INV-01:** un candidato anonimizado nunca vuelve a tener nombre, email, teléfono, resumen ni skills reales
  _(RGPD §5; RN-02, RN-03, RN-11)_.
- **INV-02:** ningún `StageChange` de un candidato anonimizado tiene nota _(RGPD §5; RN-04)_.
- **INV-03:** ningún candidato anonimizado tiene inscripciones en etapa no final _(RV-17; RN-08, RN-11;
  ratificada el 2026-10-13, PA-01)_.
- **INV-04:** la fecha y el motivo de una anonimización, una vez registrados, nunca se borran ni cambian _(RGPD §5;
  RN-06, RN-10)_.
- **INV-05:** anonimizar no borra ninguna inscripción ni ningún `StageChange`: se conservan las estadísticas de las
  ofertas _(RGPD §5; RN-04)_.
- **INV-06:** ningún candidato con una inscripción no final tiene fecha de fin de retención _(S-06; ya vigente)_.
- **INV-07:** tras una pasada sin fallos, no queda ningún candidato sin anonimizar con la fecha de fin igual o anterior
  a hoy en Europe/Madrid, salvo los legacy de RN-17 _(RGPD §3; RN-14, RN-17)_.
- **INV-08:** el email de un anonimizado es único y no deriva del email original _(RGPD §7.9c, RV-10; RN-03)_.
- **INV-09:** un candidato anonimizado nunca aparece en el listado ni en la búsqueda _(RV-14; RN-12)_.
- **INV-10:** el dato anterior a una anonimización no se puede recuperar de los ficheros de la base _(RGPD §5 y §7.8;
  RN-21)_.

Toca datos personales: el agente `datos-personales-auditor` lo revisará en `/reviewer` de cada HU.

## Datos y conceptos clave
- **Candidato anonimizado:** `Candidate` con la marca de anonimizado (fecha y motivo), los valores neutros de RN-02 y
  RN-03 y el fin de retención vacío. El esquema concreto lo decide `/tech-design` (con una migración nueva, DEC-03).
- **Motivo de anonimización:** «petición» o «vencimiento» _(RGPD §5)_.
- **Retención vencida pendiente de anonimizar:** candidato no anonimizado con la fecha de fin igual o anterior a hoy
  en Europe/Madrid _(RGPD §3, RV-25)_.
- **Datos personales:**
  - **Qué:** nombre y apellidos, email, teléfono, resumen, skills y notas de rechazo; se sustituyen o se vacían.
    Consentimiento (fechas y versión) y fecha de alta: se conservan _(RGPD §1 y §5; RN-05, pendiente)_.
  - **Para qué:** cumplir el derecho de supresión (art. 17) y la retención de RGPD §3.
  - **Cuánto tiempo:** los datos identificativos, hasta la anonimización; tras ella no queda ninguno _(RGPD §3 y §5)_.

## Casos límite
- **Input inválido:** ID no válido o anonimización con cuerpo → 400 _(S-03, DEC-11)_; ID inexistente → 404 sin datos
  _(DEC-07)_; email del dominio reservado en el alta o la edición → 400 _(RN-03)_.
- **Boundary:** la fecha de fin es hoy → se anonimiza; era ayer → también; es mañana → no _(RN-14)_; el cambio de día
  entre UTC y Madrid _(DEC-09)_; anonimizar con 0 inscripciones activas o con varias _(RN-08)_; la API apagada varios
  días _(UC-21 · A2)_.
- **Fallo de dependencia:** falla una escritura → no cambia nada _(DEC-06; UC-20 · E3)_; falla un candidato en la
  pasada → solo ese queda como estaba _(RN-16)_; la API no responde a la web → estado de error con reintento seguro
  _(06_design_principles §3; UC-20 · E4)_.
- **Concurrencia:** doble clic en «Anonimizar» → 200 idempotente _(RN-10)_; editar, cambiar el consentimiento o
  inscribir a la vez que se anonimiza → lo que llega después recibe 409 _(RN-11, RN-20)_; la pasada frente a una
  renovación o una anonimización a petición simultáneas → se salta al candidato _(UC-21 · A3)_.
- **Datos corruptos o legacy:** fecha vencida con inscripción abierta → la pasada lo salta _(RN-17)_; candidatos
  creados antes de la migración → no anonimizados _(DEC-03)_; el detalle de una inscripción cuyo candidato no tiene
  nombre real → 200 con «Candidato anonimizado», nunca 500 _(RN-13, RGPD §7.5)_.
- **Seguridad:** ningún dato personal en logs, errores ni respuestas que no lo necesiten _(RGPD §6.1)_; residuos en
  los ficheros de la base _(RN-21)_; el email anonimizado no permite recuperar el original _(RN-03)_; los 404 y 409 no
  revelan datos _(DEC-07)_; anonimizar desde otro sitio → 403 _(DEC-12)_.
- **Idempotencia:** pedir dos veces la supresión → 200 sin cambios _(RN-10; QUALITY-GATES §3)_; repetir la pasada no
  toca a quien ya está anonimizado _(UC-21 · A3)_.

## Módulos afectados
- **`candidatos`:** UC-20 y UC-21 nuevos; marca de anonimizado; alta y edición (dominio reservado, 409 sobre
  anonimizados); listado y búsqueda (exclusión); ficha (anonimizado y vencido pendiente); consentimiento (409 sobre
  anonimizados, renovación de vencidos); el recálculo de la retención no toca a los anonimizados; seed.
- **`inscripciones`:** inscribir (409 para anonimizados y vencidos); el rechazo de las activas al anonimizar (operación
  interna que pide `candidatos`, DEC-06); el vaciado de las notas; pipeline, detalle, avance, rechazo y cierre con
  anonimizados; los puertos que leen candidatos distinguen a los anonimizados _(RGPD §7.2)_.
- **`ofertas`:** sin cambios funcionales; el cierre (UC-19) ya no encuentra activas de anonimizados.

## Dependencias, riesgos y supuestos
- **Dependencias:** FEAT-02 y FEAT-03 entregadas (fórmula de retención, puertos entre módulos, historial que admite
  vaciar la nota: DT-12 de HU-04).
- **Riesgos:**
  - HU-07 es grande porque tiene que ser vertical: en cuanto exista un anonimizado, el detalle de una inscripción podría
    dar 500 si no se rotula _(RGPD §7.5)_.
  - El mecanismo contra los residuos puede encarecer las escrituras _(RGPD §7.8)_.
  - Si la pasada corre al arrancar, los vencidos del seed se anonimizan en cuanto se arranca la API _(Q31)_.
- **Supuestos confirmados:** las respuestas Q02, Q04-Q10, Q12-Q21 y Q23-Q33 _(responsable técnico, 2026-10-12)_.
  Q01, Q03, Q11 y Q22, ratificadas el 2026-10-13 según la recomendación (PA-01..PA-04).

## Criterios de aceptación
- [ ] Dado un candidato con dos inscripciones activas, cuando el reclutador lo anonimiza a petición y confirma,
      entonces su ficha muestra «Candidato anonimizado» con fecha y motivo «petición», y sus dos inscripciones están
      en «Rechazado» con el motivo «retirada del candidato» (UC-20 · P, A2).
- [ ] Dado un candidato anonimizado, cuando se pide anonimizarlo otra vez, entonces la respuesta es 200 y nada cambia
      (UC-20 · A1).
- [ ] Dado un candidato con una nota de rechazo, cuando se anonimiza, entonces su historial conserva etapas y motivos y
      no tiene ninguna nota (RN-04).
- [ ] Dado un candidato anonimizado, cuando se busca por su antiguo nombre o email o se lista sin filtros, entonces no
      aparece (UC-11 · A5).
- [ ] Dado un candidato anonimizado, cuando se intenta editarlo, cambiar su consentimiento o inscribirlo, entonces la
      respuesta es 409 y nada cambia (UC-10 · E5, UC-13 · E3, UC-14 · E6).
- [ ] Dado un candidato anonimizado con inscripciones, cuando se abre el pipeline o el detalle de una inscripción,
      entonces se ve «Candidato anonimizado» y el historial sin notas, nunca un error (UC-17 · A3, UC-18 · A3).
- [ ] Dado un candidato anonimizado, cuando se busca su nombre, email o teléfono anteriores en los ficheros de la base,
      entonces no se encuentran (RN-21).
- [ ] Dados tres candidatos cuya fecha de fin fue ayer, es hoy y es mañana, cuando corre la pasada, entonces los dos
      primeros quedan anonimizados con motivo «vencimiento» y el tercero no (UC-21 · P, RN-14).
- [ ] Dado que falla la anonimización de un candidato durante la pasada, entonces ese queda como estaba y los demás se
      anonimizan (UC-21 · E1).
- [ ] Dado un candidato con la retención vencida y sin anonimizar, cuando se intenta inscribirlo, entonces la respuesta
      es 409; y cuando se le registra un consentimiento nuevo, entonces deja de estar vencido (UC-14 · E7, UC-13 · A4).

## Preguntas abiertas
- **PA-01:** ¿se puede anonimizar a petición a un candidato con inscripciones abiertas? Recomendación aplicada: sí; en
  la misma transacción se rechazan sus activas con el motivo «retirada del candidato», sin nota (RN-08, INV-03,
  UC-20 · A2). Así no se bloquea el art. 17 y avanzar, rechazar y cerrar oferta nunca encuentran activas de un
  anonimizado _(Q03)_. — _Estado: ratificada el 2026-10-13 según la recomendación_
- **PA-02:** ¿quién lanza la anonimización por vencimiento? Recomendación aplicada: un proceso de la propia API, al
  arrancar y una vez al día mientras siga en marcha, sin botón (RN-15, UC-21). RGPD §3 dice «al vencer: anonimizar»
  y no puede depender de que el reclutador se acuerde _(Q01)_. — _Estado: ratificada el 2026-10-13 según la recomendación_
- **PA-03:** ¿se puede inscribir a un candidato con la retención vencida aún no anonimizado? Recomendación aplicada:
  no, 409, hasta que se anonimice o se registre un consentimiento nuevo (RN-18, UC-14 · E7). Inscribirlo alargaría la
  conservación sin una base jurídica nueva _(RGPD §2 y §7.1; Q22)_. — _Estado: ratificada el 2026-10-13 según la recomendación_
- **PA-04:** ¿se conservan al anonimizar las fechas y la versión del consentimiento y la fecha de alta? Recomendación
  aplicada: sí (RN-05). Sin nombre ni email no identifican a nadie y son la prueba del art. 7.1 de que el tratamiento
  previo tenía base _(RGPD §2 y §7.9a; Q11)_. — _Estado: ratificada el 2026-10-13 según la recomendación_

## Respuestas del shaping
Clase **R**: se responde con una fuente existente; clase **P**: decisión de producto nueva. Fuente de todas:
«responsable técnico, 2026-10-12», salvo las cuatro marcadas «Ratificada el 2026-10-13», que eran PA-01..PA-04.

| Q | Clase | Pregunta | Respuesta | Fuente | RGPD §7 |
|---|---|---|---|---|---|
| Q01 | P | ¿Quién lanza la pasada por vencimiento? | Proceso de la API, al arrancar y una vez al día | Ratificada el 2026-10-13, PA-02 | — |
| Q02 | R | ¿Quién registra la petición? | El reclutador, declarando que el candidato la hizo | DEC-04, RV-11 | — |
| Q03 | P | ¿Anonimizar con inscripciones abiertas? | Sí; se rechazan con «retirada del candidato» | Ratificada el 2026-10-13, PA-01 | 2, 5 |
| Q04 | P | ¿Confirmación previa? | Sí: irreversible y número de activas | responsable técnico | — |
| Q05 | R | ¿También con consentimiento vigente o contratado? | Sí, sin excepciones | RGPD §4 y §5 | — |
| Q06 | P | ¿Desde dónde y qué se ve después? | Botón en la ficha; queda la ficha anonimizada con mensaje de estado | responsable técnico | — |
| Q07 | R | ¿Se guarda quién la pidió o por qué canal? | No: solo fecha y motivo | RGPD §5 y §1 | — |
| Q08 | R | ¿Se vacía siempre la nota del rechazo? | Sí, en toda anonimización | RGPD §5, UC-16, DT-12 de HU-04 | 3, 6 |
| Q09 | R | ¿Valores neutros? | «Candidato anonimizado»; teléfono, resumen y skills vacíos | RGPD §5, RV-09 | — |
| Q10 | P | ¿Cómo se genera el email? | Desde el ID en dominio `.invalid`; alta y edición rechazan ese dominio | responsable técnico | 9c |
| Q11 | P | ¿Se conservan consentimiento y alta? | Sí | Ratificada el 2026-10-13, PA-04 | 9a |
| Q12 | P | ¿Valor final del fin de retención? | Vacío y sin recálculos | responsable técnico | 9b |
| Q13 | R | ¿Residuos en los ficheros? | Prohibidos; test que lo compruebe; mecanismo en `/tech-design` | RGPD §5 | 8 |
| Q14 | R | ¿Listado y búsqueda? | Excluyen siempre a los anonimizados | RV-14 | 7c |
| Q15 | R | ¿Inscribir a un anonimizado? | 409 | RV-17, DEC-07 | 2 |
| Q16 | R | ¿Pipeline? | «Candidato anonimizado» | UC-17 · A3, S-05 | 2 |
| Q17 | P | ¿Detalle de una inscripción? | 200 con «Candidato anonimizado» e historial sin notas | responsable técnico | 5 |
| Q18 | P | ¿Ficha de un anonimizado? | 200 con fecha y motivo, sin acciones | responsable técnico | 7a |
| Q19 | R | ¿Escrituras sobre un anonimizado? | 409, no 410; repetir anonimizar, 200 | DEC-07, RGPD §5, S-01 | 7a |
| Q20 | R | ¿Avanzar, rechazar y cerrar oferta? | Sin activas: 409, 200 o sin efecto; sin recálculo | RV-19, RV-23, RV-05, RGPD §5 | 2, 5 |
| Q21 | R | ¿Guarda en el `WHERE` o comprobación previa? | Técnica, de `/tech-design`; estado comprobado en la transacción | DEC-08 | 7b |
| Q22 | P | ¿Inscribir a un vencido? | No, 409 | Ratificada el 2026-10-13, PA-03 | 1 |
| Q23 | P | ¿Se ocultan los vencidos? | No; marca solo en la ficha | responsable técnico | 1 |
| Q24 | P | ¿Editar o renovar a un vencido? | Sí a las dos | responsable técnico | 1 |
| Q25 | R | ¿Cerrar un proceso alarga la conservación? | «Cierre + 6 meses» es correcto con Q22 | S-06, RGPD §2 | 4 |
| Q26 | R | ¿Frontera del vencimiento? | Fecha igual o anterior a hoy en Madrid | RGPD §3, RV-25, DEC-09 | — |
| Q27 | P | ¿Fallo de un candidato en la pasada? | Una transacción por candidato; reintento | responsable técnico | — |
| Q28 | P | ¿Resultado de la pasada visible? | No; queda en cada ficha | responsable técnico | — |
| Q29 | P | ¿Legacy vencido con inscripción abierta? | Se salta con log sin datos | responsable técnico | — |
| Q30 | R | ¿Pasada frente a una escritura simultánea? | Se vuelve a comprobar en la transacción y se salta | DEC-08 | — |
| Q31 | P | ¿Datos de demo? | Tres inventados: vencido ayer, vence hoy y anonimizado con inscripción rechazada | responsable técnico | — |
| Q32 | P | ¿Qué queda fuera? | Lo de «Alcance · Fuera» | responsable técnico | — |
| Q33 | P | ¿Partición en HU? | HU-07, HU-08 y HU-09 (abajo) | responsable técnico | — |

## Handoff a delivery
HU propuestas, en orden de dependencias (los números definitivos los asigna `scripts/next-id.mjs hu` al crearlas):

1. **HU-07 «Anonimizar a petición».** UC-20 completo; UC-09 · E4, UC-10 · E5 y E6, UC-11 · A5, UC-12 · A2 y A4,
   UC-13 · E3, UC-14 · E6, UC-15 · E7, UC-16 · A2, UC-17 · A3, UC-18 · A3 y UC-19 · A3; RN-01 a RN-13, RN-20 y
   RN-21; el anonimizado del seed. **Valor:** el reclutador atiende una petición de supresión y el anonimizado es
   coherente en toda la aplicación. Tiene que ser vertical: partirla dejaría alcanzable el 500 del detalle
   _(RGPD §7.5)_. **Depende de:** nada.
2. **HU-08 «Anonimizar al vencer la retención».** UC-21 completo; RN-14 a RN-17; los dos vencidos del seed.
   **Valor:** ningún dato se conserva más allá de su plazo. **Depende de:** HU-07 (reutiliza la anonimización con el
   motivo «vencimiento»).
3. **HU-09 «Retención vencida pendiente de anonimizar».** UC-12 · A3, UC-13 · A4 y UC-14 · E7; RN-18 y RN-19.
   **Valor:** ningún vencido alarga su conservación sin una base nueva. **Depende de:** HU-07; se puede fusionar con
   HU-08 si la ventana entre el vencimiento y la pasada se considera despreciable.

**Variante mínima del taller (decisión de la persona responsable del 2026-10-09, IDEA-004):** la solución de
referencia de la feature en vivo A solo llega hasta el PRD de HU-07 «Anonimizar a petición», sin implementar. HU-08 y
HU-09 quedan en el backlog.
