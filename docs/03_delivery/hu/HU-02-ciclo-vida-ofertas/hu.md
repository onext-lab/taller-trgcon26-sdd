---
id: HU-02
feature: FEAT-01
titulo: "Publicar, cerrar, duplicar y listar ofertas con filtros"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [ofertas]
sprint: null             # sprint-NN
rama: "hu/HU-02-ciclo-vida-ofertas"
---

# HU-02 — Publicar, cerrar, duplicar y listar ofertas con filtros

## Historia
Como **reclutador**, quiero **publicar mis ofertas, cerrarlas cuando termina el proceso, duplicarlas y encontrarlas por
estado y por título**, para **llevar cada oferta por todo su ciclo de vida sin perderla de vista**.

## Contexto
Segunda rebanada de FEAT-01 (`docs/02_discovery/features/FEAT-01-ofertas/feature.md`): sobre los borradores de HU-01,
añade las transiciones `draft → published → closed` con sus reglas (idempotencia, 409 en las no permitidas, cierre en
una sola transacción con confirmación), la duplicación como forma de «reabrir», lo que cambia al editar o borrar una
oferta publicada o cerrada, y los filtros y la paginación del listado. Es atómica porque se entrega sola sobre HU-01,
vertical porque toca reglas de estado, API y pantallas (ficha, diálogo de cierre y listado), y con valor porque deja
ofertas publicadas, que son las únicas que admiten inscripciones (RV-17).

El rechazo de las inscripciones activas al cerrar (UC-04 · A1) no está en esta HU: aún no existe el módulo
`inscripciones`. Aquí el cierre ya es una transacción única y el diálogo ya muestra el número de inscripciones
activas, que hoy es siempre 0; HU-05 conecta la invocación de UC-19 dentro de esa transacción.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-02 | E1, E3, E4 | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` |
| UC-03 | P, A1, E1, E2 | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` |
| UC-04 | P, A2, A3, E1, E2 | `docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md` |
| UC-05 | E1 | `docs/05_modules/ofertas/casos-de-uso/UC-05-borrar-borrador.md` |
| UC-06 | P | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` |
| UC-07 | A1, A3, E1, E2, E3 | `docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` |
| UC-08 | A1 | `docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md` |

Flujos de esos UC que **no** cubre esta HU:
- UC-02 · P, A1 y E2; UC-05 · P y E2; UC-07 · P, A2 y E4; UC-08 · P y E1: los cubre HU-01.
- UC-04 · A1 (rechazo de las inscripciones activas al cerrar): lo cubre HU-05, que implementa UC-19 y conecta su
  invocación desde el cierre; no se puede probar hasta que existan inscripciones.

## Criterios de aceptación
- [ ] Dado un borrador completo (híbrida, Valencia, 32 000-40 000 €/año), cuando pulso «Publicar», entonces pasa a
      `published`, veo su fecha de publicación en `dd/mm/aaaa` y la ficha ofrece editar, cerrar y duplicar
      _(UC-03 · P)_.
- [ ] Dada una oferta ya publicada, cuando llega otra petición de publicarla (doble clic), entonces responde 200 sin
      cambios y la fecha de publicación es la misma _(UC-03 · A1)_.
- [ ] Dado un borrador sin descripción ni modalidad, cuando pulso «Publicar», entonces responde 400 con la lista de
      campos pendientes, la veo en la pantalla y la oferta sigue en `draft` _(UC-03 · E1)_.
- [ ] Dada una oferta `closed`, cuando llega una petición de publicarla, entonces responde 409 y no cambia nada
      _(UC-03 · E2)_.
- [ ] Dada una oferta publicada, cuando pulso «Cerrar», entonces veo un diálogo con el número de inscripciones activas
      que se rechazarán; y al confirmarlo, la oferta pasa a `closed`, se guarda su fecha de cierre y la veo en solo
      lectura con esa fecha en `dd/mm/aaaa` _(UC-04 · P)_.
- [ ] Dada una oferta publicada con el diálogo de cierre abierto, cuando lo cancelo, entonces sigue en `published` y
      sigo en su ficha _(UC-04 · A2)_.
- [ ] Dada una oferta ya cerrada, cuando llega otra petición de cerrarla (doble clic), entonces responde 200 sin cambios
      y la fecha de cierre es la misma _(UC-04 · A3)_.
- [ ] Dado un borrador, cuando llega una petición de cerrarlo, entonces responde 409 y sigue en `draft` _(UC-04 · E1)_.
- [ ] Dada una oferta publicada, cuando falla una escritura de la transacción de cierre, entonces recibo el error en el
      envelope de DEC-01 y la oferta sigue en `published`, sin fecha de cierre _(UC-04 · E2)_.
- [ ] Dada una oferta `closed`, cuando abro su ficha, entonces no ofrece «Editar»; y si llega a la API una petición de
      editarla, responde 409 y no cambia nada _(UC-02 · E1)_.
- [ ] Dada una oferta publicada, cuando vacío su descripción (o la dejo solo con espacios) y guardo, entonces responde
      400, veo el error junto al campo y la oferta no cambia _(UC-02 · E3)_.
- [ ] Dada una oferta publicada con el formulario de edición abierto, cuando otra pestaña la cierra y después guardo,
      entonces responde 409 y la oferta cerrada no cambia _(UC-02 · E4)_.
- [ ] Dada una oferta publicada o cerrada, cuando abro su ficha, entonces no ofrece «Borrar»; y si llega a la API una
      petición de borrarla, responde 409 y no cambia nada _(UC-05 · E1)_.
- [ ] Dada una oferta `closed`, cuando pulso «Duplicar», entonces se crea un borrador nuevo con su título, descripción,
      ubicación, modalidad y banda salarial, sin fechas de publicación ni de cierre, con la fecha de creación del
      momento y sin inscripciones, y veo su ficha; la original no cambia _(UC-06 · P)_.
- [ ] Dadas ofertas en los tres estados, cuando filtro por `published` y por el texto «gestion», entonces veo solo las
      publicadas cuyo título contiene «Gestión», sin distinguir mayúsculas ni tildes, en el orden del listado
      _(UC-07 · A1)_.
- [ ] Dadas 25 ofertas, cuando pido la segunda página, entonces veo las 5 restantes en el mismo orden y con los mismos
      filtros; con exactamente 20 hay una sola página; un tamaño de página de 100 es válido; y una página más allá de
      la última da la lista vacía _(UC-07 · A3)_.
- [ ] Dado el listado, cuando pido 101 ofertas por página, entonces responde 400 _(UC-07 · E1)_.
- [ ] Dado el listado, cuando busco un texto de 101 caracteres o con caracteres de control, entonces responde 400; con
      100 caracteres responde 200 _(UC-07 · E2)_.
- [ ] Dado el listado, cuando filtro por un estado que no es `draft`, `published` ni `closed`, entonces responde 400
      _(UC-07 · E3)_.
- [ ] Dada una oferta `closed`, cuando abro su ficha, entonces la veo en solo lectura con su fecha de cierre y la única
      acción es «Duplicar» _(UC-08 · A1)_.

## Notas y dependencias
- **Depende de:** HU-01.
- **Bloquea:** HU-04 (inscribir exige ofertas `published`) y, por UC-04, HU-05.
- **Mismo UC en dos HU:** UC-02, UC-05, UC-07 y UC-08 los comparte con HU-01, y UC-04 con HU-05. Van en secuencia: esta
  HU empieza cuando HU-01 está en `main`, y HU-05 llega después (depende de HU-04, que depende de esta).
- **Riesgo heredado de FEAT-01:** INV-05 («ninguna oferta `closed` tiene inscripciones en etapa no final») solo se
  puede probar cuando HU-05 conecte UC-19 en el cierre.
- Las fechas de publicación y de cierre las pone el sistema en UTC y no cambian al repetir la transición (INV-08).

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
