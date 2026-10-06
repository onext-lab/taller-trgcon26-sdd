---
id: HU-01
feature: FEAT-01
titulo: "Crear, editar y consultar ofertas en borrador"
estado: en curso         # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [ofertas]
sprint: sprint-01        # sprint-NN
rama: "hu/HU-01-ofertas-borrador"
---

# HU-01 — Crear, editar y consultar ofertas en borrador

## Historia
Como **reclutador**, quiero **crear ofertas como borrador, corregirlas, borrar las que ya no necesito y encontrarlas en
un listado**, para **preparar mis ofertas con calma antes de publicarlas**.

## Contexto
Primera rebanada de FEAT-01 (`docs/02_discovery/features/FEAT-01-ofertas/feature.md`): nace el módulo `ofertas` con su
API, su web, su migración y su seed, pero solo con ofertas en `draft`. El reclutador ya obtiene valor: prepara ofertas,
las corrige, borra las que sobran y las encuentra. Es atómica porque no necesita ningún otro módulo ni ninguna
transición de estado, y vertical porque toca validación, persistencia, API y pantallas (formulario, ficha y listado).
Publicar, cerrar, duplicar, filtrar y paginar llegan en HU-02.

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-01 | P, E1, E2, E3, E4, E5, E6 | `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md` |
| UC-02 | P, A1, E2 | `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md` |
| UC-05 | P, E2 | `docs/05_modules/ofertas/casos-de-uso/UC-05-borrar-borrador.md` |
| UC-07 | P, A2, E4 | `docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` |
| UC-08 | P, E1 | `docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md` |

Flujos de esos UC que **no** cubre esta HU (todos van en HU-02, porque necesitan ofertas `published` o `closed`, o los
filtros y la paginación del listado):
- UC-02 · E1, E3 y E4 (oferta cerrada, vaciar un obligatorio de una publicada, cerrada mientras se editaba).
- UC-05 · E1 (borrar una oferta publicada o cerrada).
- UC-07 · A1, A3, E1, E2 y E3 (filtros por estado y título, cambio de página o de tamaño y sus validaciones).
- UC-08 · A1 (ficha de una oferta cerrada).

## Criterios de aceptación
- [ ] Dado el formulario de nueva oferta, cuando guardo solo el título «Desarrollador/a backend (Node.js)», entonces se
      crea una oferta en `draft` con su fecha de creación, veo su ficha y aparece en el listado _(UC-01 · P)_.
- [ ] Dado el formulario de nueva oferta, cuando guardo «  Técnica/o de selección  », híbrida, Valencia y una banda de
      32 000-40 000 €/año, entonces se guarda en `draft` con el título recortado y todos esos valores _(UC-01 · P)_.
- [ ] Dado el formulario de nueva oferta, cuando el título falta, es solo espacios o tiene 2 o 121 caracteres, entonces
      la API responde 400, veo el error junto al título y no se crea nada; con 3 y con 120 caracteres se crea
      _(UC-01 · E1)_.
- [ ] Dado el formulario de nueva oferta, cuando la descripción tiene 5 001 caracteres, entonces responde 400 junto al
      campo y no se crea nada; con 5 000 se crea _(UC-01 · E2)_.
- [ ] Dado el formulario de nueva oferta, cuando la modalidad es «teletrabajo», entonces responde 400 y no se crea nada;
      `presencial`, `híbrida` y `remota` se aceptan _(UC-01 · E3)_.
- [ ] Dado el formulario de nueva oferta, cuando la ubicación tiene 1 o 121 caracteres tras recortar, entonces responde
      400 y no se crea nada; con 2 y con 120 se crea _(UC-01 · E4)_.
- [ ] Dado el formulario de nueva oferta, cuando el salario mínimo es 0, uno de los extremos no es entero o el mínimo
      (45 000) supera al máximo (40 000), entonces responde 400 y no se crea nada; solo el mínimo, solo el máximo o
      mínimo igual al máximo se aceptan _(UC-01 · E5)_.
- [ ] Dada una petición de alta que trae el estado, una fecha o un campo desconocido, cuando llega a la API, entonces
      responde 400 y no se crea nada _(UC-01 · E6)_.
- [ ] Dado un borrador, cuando cambio su descripción y su ubicación y guardo, entonces la ficha muestra los valores
      nuevos, sigue en `draft` y su fecha de creación no cambia _(UC-02 · P)_.
- [ ] Dado un borrador abierto en dos pestañas, cuando guardo en una y después en la otra, entonces queda lo de la
      última que guardó _(UC-02 · A1)_.
- [ ] Dado un borrador, cuando lo edito con un título de 2 caracteres o la modalidad «teletrabajo», entonces responde
      400, veo el error junto al campo y el borrador queda como estaba _(UC-02 · E2)_.
- [ ] Dado un borrador, cuando pulso «Borrar», entonces deja de existir y vuelvo al listado, donde ya no aparece
      _(UC-05 · P)_.
- [ ] Dado un borrador ya borrado, cuando llega otra petición para borrarlo (segundo clic), entonces responde 404 con el
      envelope de error y no cambia nada _(UC-05 · E2)_.
- [ ] Dados 25 borradores, cuando abro el listado, entonces veo los 20 más recientes por fecha de creación, con
      desempate por ID, cada uno con su estado y su fecha en `dd/mm/aaaa` en Europe/Madrid (uno creado el 06/10/2026 a
      las 22:30 UTC se muestra como 07/10/2026) _(UC-07 · P)_.
- [ ] Dado que no hay ninguna oferta, cuando abro el listado, entonces veo el estado «vacío» _(UC-07 · A2)_.
- [ ] Dado que la API no responde, cuando abro el listado, entonces veo el estado «error», sin datos a medias
      _(UC-07 · E4)_.
- [ ] Dado un borrador, cuando abro su ficha, entonces veo todos sus campos, su estado y su fecha de creación en
      `dd/mm/aaaa`, con el título y la descripción escapados (un `<b>` se ve como texto), y las acciones de borrador
      que existen en esta HU: editar y borrar _(UC-08 · P)_.
- [ ] Dado un ID de oferta que no existe, cuando abro su ficha, entonces la API responde 404 con el envelope de error y
      la pantalla muestra un mensaje, sin ningún dato _(UC-08 · E1)_.

## Notas y dependencias
- **Depende de:** nada.
- **Bloquea:** HU-02.
- **Mismo UC en dos HU:** UC-02, UC-05, UC-07 y UC-08 los comparte con HU-02, que edita esos mismos ficheros y va en
  secuencia: empieza cuando esta HU está en `main`.
- Las acciones «Publicar» y «Duplicar» de la ficha de un borrador (UC-08 · P, paso 3) se añaden en HU-02; aquí la ficha
  solo ofrece las que existen.
- El seed de unas 10 ofertas inventadas (RV-26) está en el alcance de FEAT-01 y solo contiene ofertas que cumplen RN-02
  a RN-04; el PRD de esta HU y el de HU-02 fijan qué parte carga cada una.
- Errores en el envelope de DEC-01, sin *stack traces*; fechas en UTC y mostradas en Europe/Madrid (RN-12).

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [x] Diseño técnico (`plans/TECHNICAL_DOC-backend.md` y `-frontend.md`) — `/tech-design`
- [x] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [x] Implementación + integración — `/implementar-hu`
- [x] Review (`review/REVIEW.md`) — `/reviewer`
- [x] Sync de módulos + merge local a `main` — `/module-sync`
