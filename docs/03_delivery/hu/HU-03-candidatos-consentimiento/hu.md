---
id: HU-03
feature: FEAT-02
titulo: "Alta, edición y búsqueda de candidatos, con consentimiento"
estado: en curso         # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [candidatos]
sprint: sprint-01        # sprint-NN
rama: "hu/HU-03-candidatos-consentimiento"
---

# HU-03 — Alta, edición y búsqueda de candidatos, con consentimiento

## Historia
Como **reclutador**, quiero **dar de alta candidatos, corregir sus fichas, buscarlos y registrar si consienten que
guardemos sus datos para futuros procesos**, para **tener fichas completas y localizables, con su retención correcta
desde el primer día, listas para inscribirlas en ofertas**.

## Contexto
Toda FEAT-02 (`docs/02_discovery/features/FEAT-02-candidatos/feature.md`) salvo UC-12 · A1: nace el módulo `candidatos`
con su API, su web, su migración y su seed. Incluye la fórmula de retención completa (RN-07 de FEAT-02), cuyo dueño es
`candidatos`, probada con todas las filas de `docs/RGPD.md` §3, y el puerto de lectura de los procesos del candidato
(RN-12) respondiendo «sin inscripciones» hasta que `inscripciones` lo implemente en HU-04. Es atómica porque no
necesita ningún otro módulo, vertical porque toca validación, normalización, fórmula, persistencia transaccional, API y
pantallas (listado, formulario y ficha), y con valor porque deja candidatos listos para inscribir y la retención
cumpliendo RGPD desde el alta.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-09 | P, A1, E1, E2, E3 | `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md` |
| UC-10 | P, A1, A2, A3, E1, E2, E3, E4 | `docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md` |
| UC-11 | P, A1, A2, A3, A4, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md` |
| UC-12 | P, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` |
| UC-13 | P, A1, A2, A3, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-12 · A1 («Mientras dure el proceso»): solo se da con una inscripción no final. Lo cubre HU-04, que implementa el
  puerto de procesos del candidato y dispara el recálculo al inscribir.

## Criterios de aceptación
- [ ] Dado que no existe `lucia.ferrer@example.com`, cuando doy de alta a «Lucía Ferrer Soler» con
      `Lucia.Ferrer@Example.com ` y las skills `TypeScript, sql, typescript,   `, entonces se guardan el email
      `lucia.ferrer@example.com` y las skills `typescript, sql`, el consentimiento queda desmarcado, el fin de retención
      es la fecha de alta + 6 meses y veo su ficha _(UC-09 · P)_.
- [ ] Dado un alta el 06/10/2026 a las 22:30 UTC, cuando se calcula su retención, entonces vence el 07/04/2027
      (día natural en Europe/Madrid); y un alta el 31/08/2026 vence el 28/02/2027 y una el 31/08/2027, el 29/02/2028
      _(UC-09 · P)_.
- [ ] Dado el formulario de alta, cuando marco la casilla de consentimiento, junto a la que veo el texto y su versión,
      entonces se guardan la fecha (la pone el sistema) y la versión, y el fin de retención es la fecha del
      consentimiento + 24 meses _(UC-09 · A1)_.
- [ ] Dado el formulario de alta, cuando envío un nombre de 1 o 101 caracteres, un nombre «   », un email sin `@` o de
      255 caracteres, el teléfono «abc123», 21 skills distintas, una skill de 41 caracteres, el campo de fin de
      retención o un campo desconocido, entonces la API responde 400, veo el error junto al campo, el formulario
      conserva lo escrito y no se guarda nada; con 2 y 100 caracteres de nombre, 20 skills, una skill de 40 o 21 skills
      que tras deduplicar son 20, se guarda _(UC-09 · E1)_.
- [ ] Dado que existe `lucia.ferrer@example.com`, cuando doy de alta otro candidato con `LUCIA.FERRER@example.com`
      (también con doble clic en «Guardar»), entonces recibo 409 con el ID del existente, el mensaje no repite el email
      y no se guarda nada _(UC-09 · E2)_.
- [ ] Dado que la base de datos falla al guardar un alta, cuando envío el formulario, entonces recibo el error en el
      envelope sin datos personales, no queda ningún candidato a medias y el formulario conserva lo escrito
      _(UC-09 · E3)_.
- [ ] Dado un candidato, cuando cambio su teléfono, su resumen y sus skills y guardo, entonces la ficha muestra los
      valores normalizados y el fin de retención y el consentimiento no cambian _(UC-10 · P)_.
- [ ] Dado un candidato, cuando cambio su email por uno que no usa nadie, entonces se guarda recortado y en minúsculas
      _(UC-10 · A1)_.
- [ ] Dado un candidato con `jose.ruiz@example.com`, cuando guardo ` Jose.Ruiz@Example.com`, entonces se normaliza al
      mismo valor y no choca consigo mismo _(UC-10 · A2)_.
- [ ] Dado un candidato, cuando guardo la ficha sin cambiar nada, entonces responde 200 sin cambios ni recálculo de la
      retención _(UC-10 · A3)_.
- [ ] Dado un candidato, cuando lo edito con un resumen de 2 001 caracteres, el nombre vacío o el campo de fin de
      retención, entonces responde 400 junto al campo y la ficha no cambia; un resumen de 2 000 se guarda
      _(UC-10 · E1)_.
- [ ] Dados dos candidatos, cuando le pongo a uno el email del otro, entonces recibo 409 con el ID del otro y la ficha
      no cambia _(UC-10 · E2)_.
- [ ] Dado un ID de candidato que no existe, cuando intento editarlo, entonces responde 404 sin datos _(UC-10 · E3)_.
- [ ] Dado que la base de datos falla al guardar una edición, cuando envío el formulario, entonces recibo el error sin
      datos personales, la ficha no cambia y el formulario conserva lo escrito _(UC-10 · E4)_.
- [ ] Dado el candidato «José Ruiz», cuando busco `q=jose` o parte de su email, entonces aparece en el listado, que solo
      muestra nombre, email y skills, ordenado por alta, la más reciente primero, de 20 en 20 _(UC-11 · P)_.
- [ ] Dados 25 candidatos, cuando abro el listado sin filtros, entonces veo los 20 dados de alta más recientemente
      _(UC-11 · A1)_.
- [ ] Dado «José Ruiz» con la skill `sql` y «José Martín» sin ella, cuando busco `q=jose` con el filtro de skill `SQL`,
      entonces solo aparece «José Ruiz» _(UC-11 · A2)_.
- [ ] Dado que ningún candidato coincide con la búsqueda, cuando busco, entonces veo el estado vacío con un mensaje
      _(UC-11 · A3)_.
- [ ] Dados 25 candidatos, cuando pido la segunda página, entonces veo los 5 restantes; un tamaño de página de 100 es
      válido; y una página más allá de la última da la lista vacía _(UC-11 · A4)_.
- [ ] Dado el listado, cuando busco con un `q` de 101 caracteres o con caracteres de control, o pido 101 por página,
      entonces responde 400 en el envelope sin repetir `q` en el mensaje; un `q` de 100 caracteres se acepta y
      `' OR 1=1 --` se busca de forma literal _(UC-11 · E1)_.
- [ ] Dado que la API no responde, cuando busco candidatos, entonces veo el estado de error con la opción de reintentar
      y los filtros se conservan _(UC-11 · E2)_.
- [ ] Dado un candidato con consentimiento vigente, otro con el consentimiento retirado y otro que nunca lo dio, cuando
      abro sus fichas, entonces veo todos sus datos, el resumen escapado (un `<script>` se ve como texto), el
      consentimiento (fecha y versión; fechas de otorgamiento y de retirada; o que no hay) y el fin de retención en
      `dd/mm/aaaa`, en solo lectura _(UC-12 · P)_.
- [ ] Dado un ID de candidato que no existe, cuando abro su ficha, entonces la API responde 404 sin datos y veo
      «Candidato no encontrado» _(UC-12 · E1)_.
- [ ] Dado que la API no responde, cuando abro una ficha, entonces veo el estado de error con la opción de reintentar
      _(UC-12 · E2)_.
- [ ] Dado un candidato sin consentimiento, cuando marco la casilla, entonces se guardan la fecha y la versión del texto
      y el fin de retención pasa a ser esa fecha + 24 meses, en la misma transacción _(UC-13 · P)_.
- [ ] Dado un candidato sin inscripciones, dado de alta hace 8 meses y con consentimiento, cuando lo retiro, entonces se
      conservan las fechas de otorgamiento y de retirada y el fin de retención es alta + 6 meses aunque ya haya pasado
      _(UC-13 · A1)_.
- [ ] Dado un candidato con consentimiento vigente, cuando lo vuelvo a marcar más tarde, entonces se guardan fecha y
      versión nuevas y el fin de retención es la nueva fecha + 24 meses _(UC-13 · A2)_.
- [ ] Dado un candidato sin consentimiento vigente (nunca lo dio o ya lo retiró), cuando pido retirarlo, entonces
      responde 200 sin cambios y no se toca ninguna fecha _(UC-13 · A3)_.
- [ ] Dado un ID de candidato que no existe, cuando cambio su consentimiento, entonces responde 404 sin datos
      _(UC-13 · E1)_.
- [ ] Dado que falla una escritura al cambiar el consentimiento, cuando lo marco o lo retiro, entonces recibo el error
      en el envelope y ni el consentimiento ni el fin de retención cambian _(UC-13 · E2)_.
- [ ] Dada la fórmula de retención, cuando se evalúa con cada fila de `docs/RGPD.md` §3 (inscripción abierta → sin
      fecha de fin; proceso cerrado sin consentimiento → cierre + 6 meses; consentimiento vigente → consentimiento + 24
      meses; sin inscripciones ni consentimiento → alta + 6 meses) y con varias a la vez, entonces da la más tardía; y
      el puerto de procesos del candidato responde «sin inscripciones» mientras `inscripciones` no lo implemente
      _(UC-13 · P, A1)_.
- [ ] Dado cualquier alta, edición, búsqueda, cambio de consentimiento o error, cuando reviso los logs y los mensajes de
      error, entonces no contienen nombre, email, teléfono, resumen ni el texto de `q` _(UC-09 · E1, E2, E3;
      UC-11 · E1)_.

## Notas y dependencias
- **Depende de:** nada.
- **Bloquea:** HU-04.
- **Mismo UC en dos HU:** UC-12 lo comparte con HU-04, que edita ese mismo fichero y va en secuencia: empieza cuando
  esta HU está en `main`.
- **Reparto entre módulos** (`docs/02_discovery/reglas-validadas.md`): `candidatos` es el único dueño de la fórmula y de
  la operación interna de recálculo; HU-04 y HU-05 la invocan, nunca la duplican (riesgo señalado en FEAT-02).
- No existe borrar un candidato (RV-16). El estado «anonimizado» y su exclusión de las búsquedas son de la feature A
  (S-05).
- El seed de candidatos usa solo datos inventados y emails `@example.com`, con la retención calculada por la misma
  fórmula (RV-26).

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [x] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `-frontend.md`) — `/tech-design`
- [x] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [x] Implementación + integración — `/implementar-hu`
- [x] Review (`review/REVIEW.md`) — `/reviewer`
- [x] Sync de módulos + merge local a `main` — `/module-sync`
