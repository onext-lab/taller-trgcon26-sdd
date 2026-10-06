---
id: FEAT-03
titulo: "Inscripciones y pipeline de selección"
estado: priorizada          # shaping | priorizada | en delivery | entregada
prioridad: null          # alta | media | baja (la fija la persona)
idea_origen: IDEA-003
modulos_afectados: [inscripciones]
fecha: 2026-10-06
owner: "persona que decide el producto"
---

# FEAT-03 — Inscripciones y pipeline de selección

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.

Fuentes: la idea `IDEA-003`; las reglas validadas `RV-NN` y las respuestas del shaping `S-NN` de
`docs/02_discovery/reglas-validadas.md` (incluido su reparto entre módulos); `DEC-NN` de
`docs/07_architecture_principles/DECISIONS.md`; `docs/RGPD.md`; y los principios de `docs/06_design_principles/README.md`.

## Qué
El reclutador inscribe candidatos en ofertas publicadas, los mueve por las etapas del proceso de selección hasta
contratarlos o rechazarlos, ve el pipeline de cada oferta y consulta el historial de cada inscripción _(IDEA-003)_.

## Por qué
Es el corazón del ATS: une ofertas y candidatos y deja rastro inmutable de cada decisión del proceso _(IDEA-003,
RV-21)_. Además, abrir y cerrar procesos es lo que gobierna la retención de los datos del candidato _(RGPD §3, S-06)_.

## Alcance
- **Dentro:**
  - Inscribir un candidato en una oferta `published`, desde el pipeline y uno cada vez _(RV-17, S-19)_.
  - Avanzar etapas, rechazar con motivo y nota, y consultar el historial _(RV-19..RV-23)_.
  - Pipeline por oferta, también en ofertas `closed` en solo lectura _(S-18)_.
  - La operación interna que rechaza las inscripciones activas al cerrar una oferta, invocada por `ofertas` _(RV-05,
    S-10, reparto entre módulos)_.
  - El puerto que expone los procesos del candidato y la invocación del recálculo de retención al crear o cerrar
    inscripciones, en la misma transacción _(S-06, reparto entre módulos)_.
  - API y web del módulo `inscripciones` (`apps/api/src/modules/applications/`, `apps/web/src/features/applications/`)
    _(docs/_modules.md)_.
- **Fuera:**
  - Retroceder de etapa o deshacer un cambio _(RV-19, RV-21)_.
  - Borrar inscripciones _(RV-18: una por pareja «para siempre»)_.
  - Editar el motivo o la nota de un rechazo _(RV-21)_.
  - Notas en los avances de etapa _(S-16)_.
  - Inscribir desde la ficha del candidato o varios candidatos a la vez _(S-19)_.
  - Paginación del pipeline _(S-18)_.
  - La transición de cierre de la oferta, su diálogo de confirmación y la fecha de cierre: son de `ofertas`, UC-04
    _(S-10, reparto entre módulos)_.
  - La fórmula de retención: es de `candidatos` _(RV-12, S-06, reparto entre módulos)_.
  - El estado «anonimizado», el bloqueo de inscripción de anonimizados y el destino de sus inscripciones abiertas:
    los introduce la feature A _(S-05)_.
  - La exportación por derecho de acceso _(RGPD §4, feature A)_ y la importación CSV _(RV-27, feature C)_.
  - Avisos al candidato, que no usa la aplicación, y roles o login _(DEC-04)_.

## Actores y roles
- **Reclutador:** único rol de la aplicación, sin login _(DEC-04)_. Dispara UC-14 a UC-18 y, de forma indirecta al
  cerrar una oferta (UC-04), UC-19.
- **Candidato:** interesado cuyos datos se tratan; no usa la aplicación _(DEC-04, RGPD §2)_.
- No hay procesos programados en esta feature.

## Casos de uso

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-14 | Inscribir un candidato en una oferta | inscripciones | P, E1, E2, E3, E4, E5 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` | Nuevo |
| UC-15 | Avanzar una inscripción a la etapa siguiente | inscripciones | P, A1, A2, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md` | Nuevo |
| UC-16 | Rechazar una inscripción | inscripciones | P, A1, E1, E2, E3, E4, E5, E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md` | Nuevo |
| UC-17 | Ver el pipeline de una oferta | inscripciones | P, A1, A2, A3, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` | Nuevo |
| UC-18 | Consultar el historial de una inscripción | inscripciones | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` | Nuevo |
| UC-19 | Rechazar las inscripciones activas al cerrar una oferta | inscripciones | P, A1, A2, E1, E2 | `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` | Nuevo |

UC-19 lo invoca UC-04 (cerrar oferta, módulo `ofertas`, FEAT-01) dentro de su transacción de cierre.

## Reglas de negocio
- **RN-01:** si la oferta no está `published`, entonces no se puede inscribir a nadie en ella _(RV-17)_.
- **RN-02:** si la pareja candidato-oferta ya tiene inscripción, en cualquier etapa, entonces no se crea otra y se
  responde 409 con el ID de la existente _(RV-18, S-14)_.
- **RN-03:** al crear una inscripción, nace en `received` y se registra un `StageChange` sin origen → `received`
  _(RV-19, S-13)_.
- **RN-04:** solo se avanza a la etapa inmediatamente siguiente (`received → screening → interview → offer → hired`);
  `rejected` es posible desde cualquier etapa no final; `hired` y `rejected` son finales. Una transición no permitida
  responde 409 _(RV-19, S-02)_.
- **RN-05:** si se rechaza, entonces el motivo es obligatorio y de la lista cerrada, y la nota es opcional, de 500
  caracteres como máximo tras recortar espacios, con aviso en la interfaz de no usarla para datos sensibles _(RV-20,
  S-03)_.
- **RN-06:** todo cambio de etapa envía la etapa esperada; si la actual es distinta, entonces 409 y no cambia nada
  _(RV-22)_.
- **RN-07:** si se pide la etapa en la que ya está la inscripción, entonces 200 sin crear `StageChange` ni tocar
  fechas; esta regla prevalece sobre RN-06 _(RV-23, S-01)_.
- **RN-08:** contratar no toca las demás inscripciones del candidato ni cierra la oferta, y se admite más de un `hired`
  en la misma oferta _(RV-24, RV-07, S-17)_.
- **RN-09:** si se cierra una oferta, entonces sus inscripciones no finales pasan a `rejected` con el motivo «oferta
  cerrada» y un `StageChange` cada una, en la misma transacción que el cierre; ese motivo solo lo pone el sistema
  _(RV-05, S-10, S-15)_.
- **RN-10:** al crear una inscripción o al pasar una a etapa final (`hired` o `rejected`), `candidatos` recalcula la
  retención del candidato en la misma transacción: sin fecha de fin mientras tenga alguna inscripción no final _(S-06,
  RGPD §3, reparto entre módulos)_.
- **RN-11:** solo los rechazos llevan nota _(S-16)_.
- **RN-12:** el pipeline se ve también en ofertas `closed`, en solo lectura; tiene una columna por etapa (con
  `rejected` y su motivo), cada una ordenada por la fecha del último cambio, la más reciente primero, sin paginación, y
  muestra solo el nombre del candidato _(S-18, RGPD §6.2)_.
- **RN-13:** las fechas se guardan en UTC (ISO 8601) y se muestran en Europe/Madrid como `dd/mm/aaaa` _(RV-25,
  principio de diseño 6)_.

## Invariantes
- **INV-01:** nunca hay dos `Application` para la misma pareja candidato-oferta _(RV-18)_.
- **INV-02:** nunca se crea una `Application` en una oferta que no esté `published` _(RV-17)_.
- **INV-03:** un `StageChange` nunca se modifica ni se borra; el historial solo crece _(RV-21)_.
- **INV-04:** toda transición registrada cumple RV-19; ninguna sale de `hired` ni de `rejected` _(RV-19)_.
- **INV-05:** ninguna oferta `closed` tiene inscripciones en etapa no final _(RV-05, S-10)_.
- **INV-06:** toda `Application` tiene al menos un `StageChange`, y su etapa actual es el destino del último _(RV-21,
  S-13)_.
- **INV-07:** todo `StageChange` a `rejected` tiene un motivo de la lista, y «oferta cerrada» solo aparece en los
  creados por UC-19 _(RV-20, S-15)_.
- **INV-08:** ninguna `Application` se borra _(RV-18)_.
- **INV-09:** un candidato con alguna inscripción no final no tiene fecha de fin de retención _(S-06, RGPD §3)_.
- **INV-10:** solo los `StageChange` a `rejected` llevan nota _(S-16)_.

## Datos y conceptos clave
- **`Application` (inscripción):** une un candidato y una oferta; guarda la etapa actual _(docs/_modules.md, RV-17..RV-19)_.
- **`StageChange` (cambio de etapa):** registro inmutable con etapa origen (vacía en el inicial), destino, fecha y, en
  los rechazos, motivo y nota opcional _(RV-21, S-13, S-16)_.
- **Etapas:** `received`, `screening`, `interview`, `offer`, `hired` (final) y `rejected` (final) _(RV-19)_. En la
  interfaz: recibida, cribado, entrevista, oferta, contratado y rechazado _(IDEA-003)_.
- **Motivos de rechazo:** «no encaja con el perfil», «retirada del candidato», «otro» y, solo del sistema, «oferta
  cerrada» _(RV-20, S-15)_.
- **Inscripción abierta:** la que está en etapa no final; mientras exista, el proceso del candidato está en curso
  _(RGPD §2, S-06)_.
- **Datos personales:**
  - El vínculo candidato-oferta y su historial, para seguir el proceso de selección, con base en medidas
    precontractuales (art. 6.1.b) mientras haya una inscripción abierta _(RGPD §1-§2)_.
  - La nota de rechazo, texto libre que puede identificar a la persona: opcional, de 500 caracteres como máximo y
    con aviso _(RV-20)_. Solo se muestra en el historial, nunca en logs ni errores _(RGPD §6.1-§6.2)_, y se elimina al
    anonimizar _(RGPD §5, feature A)_.
  - La conservación sigue la fórmula de retención de `candidatos`, que esta feature dispara _(RGPD §3, S-06)_.
  - El pipeline muestra solo el nombre _(S-18)_.

## Casos límite
- **Input inválido:**
  - Una etapa desconocida, sin etapa esperada, con un ID mal formado o con un campo desconocido (por ejemplo, una
    nota en un avance) → 400 en el envelope de error _(RV-22, S-03, S-16, DEC-01)_.
  - Un rechazo sin motivo, con un motivo fuera de la lista o con «oferta cerrada» → 400 _(RV-20, S-15)_.
- **Boundary:**
  - Una nota de 500 caracteres se acepta; con 501 → 400; una nota solo de espacios equivale a no poner nota
    _(RV-20, S-03)_.
  - Un pipeline sin inscripciones muestra el estado vacío _(principio de diseño 3)_.
  - Un candidato con dos inscripciones abiertas: cerrar la primera no cambia su retención; cerrar la segunda la
    recalcula desde ese día _(S-06)_.
  - La fecha de fin que cae en un día inexistente se lleva al último día del mes _(S-06; la calcula `candidatos`)_.
- **Fallo de dependencia:**
  - Si falla cualquier escritura de una inscripción, de un cambio de etapa o de su recálculo de retención, se deshace
    la transacción entera _(S-06)_.
  - Si falla el cierre de una oferta, la oferta no se cierra y no se rechaza nada _(S-10)_.
  - Con la API caída, la web muestra el estado de error con un mensaje útil _(principios de diseño 3 y 4)_.
- **Concurrencia:**
  - Dos inscripciones simultáneas de la misma pareja → una se crea y la otra recibe 409 con el ID _(RV-18, S-14)_.
  - Dos cambios de etapa cruzados → el segundo recibe 409 _(RV-22, S-02)_.
  - Un cambio de etapa durante el cierre de la oferta → el que llega después encuentra `rejected` y recibe 409, o 200
    si pedía `rejected` _(RV-22, RV-23)_.
  - Inscribir mientras se cierra la oferta → se rechaza porque ya no está `published` _(RV-17)_.
- **Datos corruptos o legacy:**
  - No puede haber inscripciones en ofertas borradas: solo se borran borradores _(RV-06, S-12)_, que no admiten
    inscripciones _(RV-17)_.
  - No puede haber inscripciones de candidatos borrados _(RV-16)_.
  - Las inscripciones del seed (unas 40) cumplen INV-04, INV-05 e INV-06, con datos inventados y emails
    `@example.com` _(RV-26)_.
- **Seguridad:**
  - El pipeline y los errores no devuelven email, teléfono ni nota _(RGPD §6.1-§6.2, S-18)_.
  - La nota no se registra en logs _(RGPD §6.1)_.
  - La nota y el nombre se muestran escapados (sin inyección HTML), y el SQL va en sentencias preparadas _(QUALITY-GATES
    §4.4)_.
  - La enumeración de IDs no es un riesgo con un único rol y la API en `127.0.0.1` _(DEC-04)_; aun así, los 404 no
    revelan datos.
- **Idempotencia:**
  - Reintentar un avance o un rechazo ya aplicado → 200 sin `StageChange` ni cambios de motivo, nota o fechas
    _(RV-23, S-01)_.
  - Reintentar una inscripción → 409 con el ID de la existente _(RV-18, S-14)_.
  - Cerrar dos veces la misma oferta → 200 sin cambios y sin `StageChange` nuevos _(S-01)_.

## Módulos afectados
- **`inscripciones`:** todo el alcance anterior; es la primera feature del módulo _(docs/_modules.md)_.
- **Contratos con otros módulos (sin cambios en sus catálogos):**
  - `ofertas` invoca, dentro de la transacción de UC-04, la operación interna de UC-19 _(reparto entre módulos)_.
  - `candidatos` lee los procesos del candidato por un puerto que implementa `inscripciones` y recalcula la retención
    cuando esta feature lo invoca _(reparto entre módulos, S-06)_.

## Dependencias, riesgos y supuestos
- **Dependencias:**
  - FEAT-01 (ofertas): ofertas `published` y `closed`, y UC-04 para cerrarlas.
  - FEAT-02 (candidatos): candidatos y la fórmula de retención _(IDEA-003, reparto entre módulos)_.
- **Riesgos:**
  - Si el recálculo de retención de FEAT-02 no está listo, HU-04 no puede cerrar RN-10. La HU de FEAT-02 que
    introduce la fórmula debe ir antes o en el mismo sprint.
  - UC-04 · A1 se prueba en HU-05 y exige que FEAT-01 haya entregado el cierre.
- **Supuestos confirmados:** todas las respuestas del shaping S-01..S-19 (2026-10-06), validadas por la persona «todo
  según recomendación».

## Criterios de aceptación
- [ ] Dado una oferta `published` y un candidato sin inscripción en ella, cuando el reclutador lo inscribe desde el
  pipeline, entonces aparece en «recibida», su historial tiene el `StageChange` sin origen → `received` y el candidato
  no tiene fecha de fin de retención.
- [ ] Dado un candidato ya inscrito en una oferta, aunque esté `rejected`, cuando se intenta inscribir de nuevo,
  entonces se responde 409 con el ID de la inscripción existente y no se crea nada.
- [ ] Dado una oferta en `draft` o `closed`, cuando se intenta inscribir a un candidato, entonces se rechaza y no se
  crea nada.
- [ ] Dado una inscripción en `screening`, cuando se avanza a `interview` con la etapa esperada `screening`, entonces
  cambia de etapa y se añade un `StageChange`; y si se pide `offer`, entonces se responde 409 y nada cambia.
- [ ] Dado una inscripción que ya avanzó de `screening` a `interview`, cuando llega un reintento a `interview` con la
  etapa esperada `screening`, entonces se responde 200 sin `StageChange` nuevo; y cuando llega un rechazo con la etapa
  esperada `screening`, entonces se responde 409 y sigue en `interview`.
- [ ] Dado una inscripción en `interview`, cuando se rechaza sin motivo, con «oferta cerrada» o con una nota de 501
  caracteres, entonces se responde 400; y cuando se rechaza con «no encaja con el perfil» y una nota de 500, entonces
  queda `rejected` con ese motivo y esa nota en su `StageChange`.
- [ ] Dado una oferta con inscripciones en `received`, `offer` y `hired`, cuando el reclutador la cierra, entonces las
  dos primeras pasan a `rejected` con el motivo «oferta cerrada» y su `StageChange`, y la de `hired` no cambia; y si
  falla una escritura, la oferta sigue `published` y ninguna inscripción cambia.
- [ ] Dado un candidato sin consentimiento con una sola inscripción no final, cuando esa inscripción pasa a `hired` o
  `rejected`, entonces su fin de retención es 6 meses desde ese día; y si tiene otra inscripción abierta, sigue sin
  fecha de fin.
- [ ] Dado una oferta `closed`, cuando el reclutador abre su pipeline, entonces ve todas las columnas con solo el nombre
  de cada candidato, sin acciones de inscribir, avanzar ni rechazar.

## Preguntas abiertas
Ninguna. Las preguntas del shaping se respondieron el 2026-10-06 (S-01..S-19). El destino de las inscripciones abiertas
de un candidato anonimizado queda aplazado de forma explícita a la feature A _(S-05)_.

## Handoff a delivery
1. **HU-04 — Inscribir en una oferta publicada, sin duplicados.**
   - **Valor:** el reclutador mete candidatos en el proceso de una oferta y los ve en el pipeline.
   - **Flujos que cubre:**
     - UC-14: P, E1, E2, E3, E4 y E5.
     - UC-17: P en los pasos 1-4 y la acción «Inscribir candidato» del paso 5, más A2, E1 y E2.
     - UC-18: P y A1, para comprobar el `StageChange` inicial.
     - UC-12 · A1 (módulo `candidatos`): la ficha muestra «Mientras dure el proceso» cuando hay una inscripción no
       final. Es esta HU la que implementa el puerto de procesos del candidato y dispara el recálculo al inscribir
       (FEAT-02 lo deja declarado para ella; S-06).
   - **Dependencias:** ofertas `published` (FEAT-01), candidatos y recálculo de retención (FEAT-02).
2. **HU-05 — Pipeline con cambio de etapa e historial.**
   - **Valor:** el reclutador mueve candidatos hasta contratarlos o rechazarlos, con rastro de cada decisión, y el
     cierre de una oferta no deja procesos abiertos.
   - **Flujos que cubre:**
     - UC-15: P, A1, A2, E1, E2, E3, E4, E5 y E6.
     - UC-16: P, A1, E1, E2, E3, E4, E5 y E6.
     - UC-17: P en las acciones «Avanzar» y «Rechazar» y el acceso al historial del paso 5, más A1.
     - UC-18: A2, E1 y E2.
     - UC-19: P, A1, A2, E1 y E2.
     - UC-04 · A1 (cerrar oferta con inscripciones activas, módulo `ofertas`), que se prueba aquí.
   - **Dependencias:** HU-04 y el cierre de ofertas UC-04 (FEAT-01).
3. **Fuera de estas HU:** UC-17 · A3 (etiqueta «Candidato anonimizado»). El estado «anonimizado» lo introduce la
   feature A, y su HU lo cubrirá y probará _(S-05)_.

**HU creadas (2026-10-06):** HU-04 y HU-05.
