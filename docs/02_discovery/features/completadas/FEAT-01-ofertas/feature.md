---
id: FEAT-01
titulo: "Gestión de ofertas de empleo"
estado: entregada
prioridad: null
idea_origen: IDEA-001
modulos_afectados: [ofertas]
fecha: 2026-10-06
owner: "persona que decide el producto"
---

# FEAT-01 — Gestión de ofertas de empleo

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.
>
> Fuentes: `RV-NN` y `S-NN` son las reglas validadas y las respuestas del shaping de
> `docs/02_discovery/reglas-validadas.md`; `DEC-NN`, de `docs/07_architecture_principles/DECISIONS.md`; «RGPD», de
> `docs/RGPD.md`; «diseño», de `docs/06_design_principles/README.md`.

## Qué
El reclutador gestiona el ciclo de vida completo de las ofertas de empleo: las prepara como borrador, las publica, las
edita, las cierra, las duplica y las encuentra en un listado con filtros.

## Por qué
Sin ofertas no hay dónde inscribir candidatos: es la base de `inscripciones` y de todo el proceso de selección
(IDEA-001). Beneficia al reclutador, el único rol de la aplicación (DEC-04).

## Alcance
- **Dentro:**
  - Crear, editar, publicar, cerrar, borrar (solo borradores), duplicar, listar con filtros y consultar ofertas, en API
    y web del módulo `ofertas` (IDEA-001, RV-01 a RV-08).
  - La invocación, dentro de la transacción de cierre, de la operación de `inscripciones` que rechaza las inscripciones
    activas (RV-05, S-10, reparto entre módulos de `reglas-validadas.md`).
  - Unas 10 ofertas inventadas en el seed (RV-26).
- **Fuera:**
  - Número de vacantes o puestos por oferta (RV-07).
  - Reabrir una oferta `closed`: se duplica (RV-03).
  - El propio rechazo de inscripciones y su historial: los implementa `inscripciones` en FEAT-03 (UC-19).
  - El recálculo del fin de retención de los candidatos: lo hace `candidatos` (S-06, reparto entre módulos).
  - Publicar en portales de empleo externos, compartir ofertas o cualquier canal fuera del ATS (IDEA-001 no lo pide).
  - Login, roles y permisos (DEC-04).
  - Enlace entre una oferta duplicada y su original (S-11).

## Actores y roles
Un único actor, el **reclutador** (DEC-04). Ninguna capacidad de esta feature la dispara un proceso programado ni el
candidato.

## Casos de uso
Cada caso de uso es un **fichero propio en el catálogo del módulo**, desde `docs/_templates/UC.template.md`
(numeración global: `node scripts/next-id.mjs uc`), con flujo principal **P**, alternativos **A1…** y excepciones
**E1…**. Aquí solo se listan, por ID y ruta desde la raíz (sin enlace relativo: la feature se mueve a `completadas/`).
Si la feature cambia un UC existente, se edita ese fichero y se marca «modificado».

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-01 | Crear una oferta como borrador | ofertas | P, E1-E6 | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` | Nuevo |
| UC-02 | Editar una oferta | ofertas | P, A1, E1-E4 | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` | Nuevo |
| UC-03 | Publicar una oferta | ofertas | P, A1, E1-E2 | `docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md` | Nuevo |
| UC-04 | Cerrar una oferta | ofertas | P, A1-A3, E1-E2 | `docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md` | Nuevo |
| UC-05 | Borrar un borrador | ofertas | P, E1-E2 | `docs/05_modules/ofertas/casos-de-uso/UC-05-borrar-borrador.md` | Nuevo |
| UC-06 | Duplicar una oferta como borrador | ofertas | P | `docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md` | Nuevo |
| UC-07 | Listar y buscar ofertas | ofertas | P, A1-A3, E1-E4 | `docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` | Nuevo |
| UC-08 | Consultar una oferta | ofertas | P, A1, E1 | `docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md` | Nuevo |

UC-04 · A1 delega en UC-19 (`docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md`), del
catálogo de `inscripciones` y de FEAT-03.

## Reglas de negocio
- **RN-01:** si se guarda un borrador, entonces basta con un título válido; el resto de campos son opcionales
  _(RV-02)_.
- **RN-02:** si se publica, entonces son obligatorios el título, la descripción, la ubicación y la modalidad _(RV-01)_.
- **RN-03:** si se informa un campo, entonces se recortan los espacios antes de validar (solo espacios = vacío) y se
  valida: título de 3-120 caracteres, descripción de ≤ 5 000, ubicación de texto libre de 2-120 y modalidad en
  `presencial | híbrida | remota`; un campo desconocido o de solo lectura (estado, fechas) da 400 _(RV-01, S-03)_.
- **RN-04:** si se informa la banda salarial, entonces sus dos extremos, en €/año, son opcionales e independientes,
  enteros > 0, y el mínimo ≤ el máximo solo si vienen los dos _(RV-01, S-08)_.
- **RN-05:** si una oferta está en `draft` o `published`, entonces se puede editar, y una `published` debe seguir
  cumpliendo RN-02 (vaciar un obligatorio da 400); en las ediciones gana la última escritura _(RV-04, S-09, S-02)_.
- **RN-06:** si se pide una transición de estado, entonces solo valen `draft → published → closed`; `closed` es final
  (para reabrir, se duplica) y una transición que el estado actual no permite da 409 _(RV-03, S-02, S-10)_.
- **RN-07:** si se repite una transición ya aplicada (publicar una publicada, cerrar una cerrada), entonces se devuelve
  200 sin cambios, sin tocar fechas ni crear `StageChange` _(S-01)_.
- **RN-08:** si se cierra una oferta, entonces, en una sola transacción, pasa a `closed`, se guarda su fecha de cierre
  y se rechazan sus inscripciones en etapa no final con el motivo «oferta cerrada» mediante UC-19; si algo falla, no
  cambia nada. Antes se pide confirmación mostrando el número de inscripciones activas _(RV-05, S-10, S-15, reparto
  entre módulos)_.
- **RN-09:** si se borra una oferta, entonces debe estar en `draft`, y el borrado es físico _(RV-06, S-12)_.
- **RN-10:** si se duplica una oferta, en cualquier estado, entonces se crea un borrador con sus campos editables
  (título incluido), sin fechas, sin inscripciones y sin enlace a la original _(RV-03, S-11)_.
- **RN-11:** si se lista, entonces se filtra por estado y por texto del título (sin distinguir mayúsculas ni tildes,
  combinados en Y), se ordena por fecha de referencia (la de publicación o, si no hay, la de creación) descendente con
  desempate por ID, y se pagina de 20 en 20, con 100 como máximo (más da 400) _(RV-08, S-04)_.
- **RN-12:** si se guarda una fecha, entonces va en UTC (ISO 8601), y se muestra en Europe/Madrid con formato
  dd/mm/aaaa _(RV-25, diseño §6)_.
- **RN-13:** una oferta es un puesto sin número de vacantes; contratar a uno o más candidatos no la cierra: la cierra
  el reclutador _(RV-07, S-17)_.

## Invariantes
- **INV-01:** el estado de una oferta siempre es `draft`, `published` o `closed`, y nunca cambia salvo por
  `draft → published` o `published → closed` _(RV-03)_.
- **INV-02:** una oferta `closed` nunca vuelve a cambiar, ni de estado ni de campos _(RV-03, RV-04)_.
- **INV-03:** una oferta `published` o `closed` nunca se borra _(RV-06)_.
- **INV-04:** toda oferta `published` o `closed` tiene título, descripción, ubicación y modalidad válidos, y fecha de
  publicación _(RV-01, RV-08, S-09)_.
- **INV-05:** toda oferta `closed` tiene fecha de cierre y ninguna inscripción en etapa no final _(RV-05, S-10)_.
- **INV-06:** cerrar una oferta nunca modifica sus inscripciones en `hired` o `rejected` _(RV-05, RV-19)_.
- **INV-07:** si una oferta tiene los dos extremos de la banda salarial, mínimo ≤ máximo, y cada extremo informado es
  un entero > 0 _(RV-01, S-08)_.
- **INV-08:** repetir una transición ya aplicada nunca altera las fechas de publicación ni de cierre _(S-01)_.

## Datos y conceptos clave
- **`JobOpening` (oferta):** título, descripción, ubicación, modalidad, salario mínimo y máximo en €/año, estado
  (`draft | published | closed`) y fechas de creación, publicación y cierre, que pone el sistema _(RV-01, RV-03,
  RV-08, S-03, S-10)_.
- **Fecha de referencia:** la de publicación o, si no hay, la de creación; ordena el listado _(S-04)_.
- **Inscripción activa:** una inscripción en etapa no final (`received`, `screening`, `interview`, `offer`)
  _(RV-19)_.
- **Datos personales:** la oferta no contiene ninguno. El cierre escribe en `Application` y `StageChange` mediante
  UC-19 (datos del proceso de selección, base 6.1.b, RGPD §1-2) y desencadena el recálculo del fin de retención de los
  candidatos afectados (RGPD §3, S-06), que hace `candidatos`.

## Casos límite
- **Input inválido:** modalidad fuera del enum, banda salarial no entera o ≤ 0, título de solo espacios, campo
  desconocido o de solo lectura (estado, fechas) en la petición, estado de filtro inexistente, o `q` con caracteres de
  control → 400 con el envelope de DEC-01, junto al campo en la web, sin cambios _(RV-01, S-03, S-08, diseño §4)_.
- **Boundary:** título de 2/3/120/121 caracteres → se aceptan los de 3 y 120; descripción de 5 000/5 001 → se acepta
  la de 5 000; ubicación de 1/2/120/121 → se aceptan las de 2 y 120; mínimo = máximo → válido; 0 ofertas o página más
  allá de la última → lista vacía; exactamente 20 ofertas → una sola página; tamaño de página 100 → válido y 101 → 400;
  `q` de 100/101 caracteres → 101 da 400 _(RV-01, RV-08, S-03, S-04, S-08)_.
- **Fallo de dependencia:** la base de datos falla a mitad del cierre → no se cierra la oferta ni se rechaza ninguna
  inscripción _(S-10)_; la API no responde a la web → estado «error», sin datos a medias _(diseño §3)_.
- **Concurrencia:** dos ediciones simultáneas → gana la última escritura _(S-02)_; edición que llega después de un
  cierre → 409 _(RV-04, S-02)_; doble clic en «Cerrar» o «Publicar» → la segunda petición devuelve 200 sin cambios
  _(S-01)_; doble clic en «Borrar» → la segunda da 404 _(S-12)_; una inscripción creada entre el diálogo y la
  confirmación del cierre → se rechaza igualmente, porque el cierre rechaza las activas en el momento de cerrar
  _(RV-05)_.
- **Datos corruptos o legacy:** una inscripción en una oferta borrada es imposible, porque solo se borran borradores y
  solo se inscribe en ofertas publicadas _(RV-06, RV-17)_; el seed solo contiene ofertas que cumplen RN-02 a RN-04
  _(RV-26)_. No hay datos previos: el módulo nace con esta feature.
- **Seguridad:** la descripción y el título son texto libre → se muestran escapados (sin HTML interpretado) y se
  guardan con sentencias preparadas _(QUALITY-GATES §4.4)_; los tamaños máximos acotan el abuso _(RV-01)_; la
  enumeración de IDs no expone datos personales, porque la oferta no los tiene y la API solo escucha en `127.0.0.1`
  _(DEC-04)_; los errores no devuelven *stack traces* _(QUALITY-GATES §4.6)_.
- **Idempotencia:** publicar una oferta ya publicada o cerrar una ya cerrada → 200 sin cambios ni `StageChange`
  _(S-01)_; borrar un borrador ya borrado → 404 _(S-12)_; publicar una cerrada o cerrar un borrador → 409 _(S-02,
  S-10)_.

## Módulos afectados
- **`ofertas`** (`jobs`): todo el módulo nace con esta feature (API, web, migración y seed).
- **`inscripciones`** (`applications`): no se modifica aquí. `ofertas` invoca, dentro de la transacción de cierre, la
  operación interna que FEAT-03 define en UC-19.

## Dependencias, riesgos y supuestos
- **Dependencias:** ninguna para HU-01 y HU-02. UC-04 · A1 depende de UC-19 (FEAT-03, IDEA-003).
- **Riesgos:**
  - Mientras no exista UC-19, el cierre no tiene inscripciones que rechazar; hay que conectar la invocación cuando
    FEAT-03 lo entregue, o INV-05 quedaría sin probar.
  - El borrado de un borrador es físico e irreversible (S-12): el PRD decide cómo se presenta la acción en la web.
  - El recálculo de retención al cerrar (S-06) cruza `ofertas`, `inscripciones` y `candidatos` en una misma
    transacción; el diseño técnico debe respetar el reparto entre módulos.
- **Supuestos confirmados:** todas las respuestas del shaping, S-01 a S-19, según la recomendación de ingeniería,
  validadas por la persona el 2026-10-06.

## Criterios de aceptación
- [ ] Dado el formulario de nueva oferta, cuando guardo solo el título «Desarrollador/a backend (Node.js)», entonces
      se crea en `draft` y aparece en el listado.
- [ ] Dado un borrador sin descripción, cuando pulso «Publicar», entonces veo qué campos faltan y la oferta sigue en
      `draft`.
- [ ] Dado un borrador completo (híbrida, Valencia, 32 000-40 000 €/año), cuando lo publico, entonces pasa a
      `published` con su fecha de publicación en formato dd/mm/aaaa; y si vuelvo a publicarla, nada cambia.
- [ ] Dada una oferta publicada, cuando vacío su descripción y guardo, entonces veo un error junto al campo y la oferta
      no cambia.
- [ ] Dada una oferta publicada con una inscripción en `interview` y otra en `hired`, cuando la cierro y confirmo el
      diálogo, que anuncia 1 inscripción activa, entonces la oferta queda `closed` con su fecha de cierre, la primera
      inscripción pasa a `rejected` con el motivo «oferta cerrada» y la segunda no cambia.
- [ ] Dada una oferta `closed`, cuando la abro, entonces la veo en solo lectura, la API rechaza editarla o borrarla y
      solo puedo duplicarla; al duplicarla, obtengo un borrador nuevo sin inscripciones y la original no cambia.
- [ ] Dado un borrador, cuando lo borro, entonces deja de aparecer; dada una oferta publicada, cuando intento borrarla,
      entonces la API lo rechaza.
- [ ] Dadas 25 ofertas, cuando abro el listado, entonces veo 20 ordenadas por fecha de referencia y una segunda página
      con 5; y al buscar «desarrollador» encuentro la oferta «Desarrollador/a backend (Node.js)».

## Preguntas abiertas
Ninguna. Las 9 preguntas del análisis se respondieron el 2026-10-06 como S-01, S-02, S-03, S-04, S-08, S-09, S-10,
S-11 y S-12 (`docs/02_discovery/reglas-validadas.md`).

## Handoff a delivery
Las HU las crea el `product-owner` con `node scripts/next-id.mjs hu`; `/crear-sprint` las mete en un sprint.

1. **HU-01 — Crear, editar y consultar ofertas en borrador.** Valor: el reclutador prepara sus ofertas y las
   encuentra. Dependencias: ninguna.
   - UC-01: P, E1, E2, E3, E4, E5, E6.
   - UC-02: P, A1, E2.
   - UC-05: P, E2.
   - UC-07: P, A2, E4.
   - UC-08: P, E1.
2. **HU-02 — Publicar, cerrar, duplicar y listar ofertas con filtros.** Valor: el reclutador lleva la oferta por todo
   su ciclo de vida y la encuentra por estado y por título. Dependencias: HU-01.
   - UC-02: E1, E3, E4.
   - UC-03: P, A1, E1, E2.
   - UC-04: P, A2, A3, E1, E2.
   - UC-05: E1.
   - UC-06: P.
   - UC-07: A1, A3, E1, E2, E3.
   - UC-08: A1.
3. **UC-04 · A1 (rechazo de las inscripciones activas al cerrar)** no se puede probar hasta que exista UC-19: lo
   cubre la HU de FEAT-03 que implemente UC-19, y esa HU conecta la invocación desde el cierre de `ofertas`. Queda
   declarado aquí para que la cobertura de flujos de FEAT-01 esté completa.

**HU creadas (2026-10-06):** HU-01 y HU-02; UC-04 · A1 lo cubre HU-06 (FEAT-03; era HU-05 hasta la decisión del 2026-10-07).

## Cierre
Entregada en sprint-01 el 2026-10-07: HU-01 (`e852e04`) y HU-02 (`a96a1b2`); UC-04 · A1 lo entregó HU-06 (`47211a8`) de FEAT-03. Review «Aprobado con observaciones» en cada HU y auditoría del
sprint «Aprobado con observaciones» (`docs/10_audits/sprints/sprint-01-AUDIT.md`).
