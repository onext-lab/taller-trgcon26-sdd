---
id: FEAT-02
titulo: "Gestión de candidatos"
estado: entregada
prioridad: null
idea_origen: IDEA-002
modulos_afectados: [candidatos]
fecha: 2026-10-06
owner: "persona que decide el producto"
---

# FEAT-02 — Gestión de candidatos

> Análisis funcional **sin asunciones**: cada elemento cita su fuente. `RV-NN` y `S-NN` están en
> `docs/02_discovery/reglas-validadas.md` (las `S-NN` son las respuestas del shaping del 2026-10-06);
> `DEC-NN`, en `docs/07_architecture_principles/DECISIONS.md`; RGPD, en `docs/RGPD.md`.

## Qué
El reclutador da de alta, edita, busca y consulta candidatos con sus datos de contacto, su resumen y sus skills, y
registra, retira o renueva su consentimiento para futuros procesos; el sistema calcula y mantiene siempre su fecha de
fin de retención (IDEA-002).

## Por qué
Sin ficha de candidato no hay a quién inscribir en las ofertas. Cada ficha guarda datos personales, así que el
consentimiento y la retención se tratan desde el principio, no después (IDEA-002, RGPD §2 y §3).

## Alcance
- **Dentro:**
  - Alta, edición (incluido el cambio de email), búsqueda y listado, y ficha del candidato, en API y web del módulo
    `candidatos` (IDEA-002).
  - Registro, retirada y renovación del consentimiento para futuros procesos (RV-11, S-07).
  - Fórmula de retención completa y su recálculo, dueño `candidatos`, con el puerto de lectura de procesos del
    candidato (S-06, reparto entre módulos de reglas-validadas.md).
  - Candidatos del seed, con datos inventados y emails `@example.com` (RV-26).
- **Fuera:**
  - Estado «anonimizado», la anonimización (a petición o al vencer la retención), la exclusión de anonimizados de las
    búsquedas (RV-14) y el bloqueo de su inscripción (RV-17): feature A, que modificará los UC de esta feature (S-05,
    RV-16, RGPD §5).
  - Implementación del puerto de procesos del candidato y las llamadas al recálculo al crear o cerrar inscripciones:
    feature de inscripciones (IDEA-003, reparto entre módulos).
  - Exportación de la ficha por derecho de acceso (RGPD §4): no está en IDEA-002.
  - Importación CSV (feature C, RV-27).
  - Borrado físico de candidatos: no existe (RV-16).

## Actores y roles
Un único rol, **reclutador**, sin login (DEC-04). El candidato es el interesado cuyos datos se tratan; no usa la
aplicación. El consentimiento lo marca el reclutador declarando que el candidato lo dio (RV-11). No hay procesos
programados en esta feature: el vencimiento de la retención lo ejecuta la feature A (S-05).

## Casos de uso

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-09 | Dar de alta un candidato | candidatos | P, A1, E1, E2, E3 | `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md` | Nuevo |
| UC-10 | Editar la ficha de un candidato | candidatos | P, A1, A2, A3, E1, E2, E3, E4 | `docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md` | Nuevo |
| UC-11 | Buscar candidatos | candidatos | P, A1, A2, A3, A4, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md` | Nuevo |
| UC-12 | Ver la ficha de un candidato | candidatos | P, A1, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` | Nuevo |
| UC-13 | Registrar, retirar o renovar el consentimiento para futuros procesos | candidatos | P, A1, A2, A3, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md` | Nuevo |

## Reglas de negocio
- **RN-01 · Campos.** Obligatorios: nombre y apellidos, en un solo campo, de 2-100 caracteres, y email. Opcionales:
  teléfono, resumen (≤ 2 000) y skills. Si falta un obligatorio o un campo se sale de límites o formato → 400 junto
  al campo y no se guarda nada _(RV-09, S-03)_.
- **RN-02 · Normalización y esquema estricto.** Se recortan los espacios antes de validar; solo espacios equivale a
  vacío. Email estándar de ≤ 254 caracteres. Teléfono: «+» opcional y 6-20 caracteres entre dígitos, espacios,
  guiones y paréntesis. Un campo desconocido o de solo lectura (p. ej., el fin de retención) → 400. `q`: ≤ 100
  caracteres y sin caracteres de control _(S-03)_.
- **RN-03 · Email único.** Se guarda sin espacios alrededor y en minúsculas. Si ya existe en otro candidato, sin
  distinguir mayúsculas → 409 con el ID del existente. Se puede cambiar manteniendo la unicidad _(RV-10, RV-15)_.
- **RN-04 · Skills.** Se recortan, se pasan a minúsculas, se descartan las vacías y se deduplican antes de contar: de 0
  a 20, cada una de ≤ 40 caracteres; más → 400 _(RV-09, S-03)_.
- **RN-05 · Consentimiento.** Casilla opcional, desmarcada por defecto. Al marcarla se guardan la fecha (la pone el
  sistema) y la versión del texto (constante versionada en el código, mostrada junto a la casilla). Al retirarlo se
  conservan la fecha de otorgamiento y la de retirada. Marcarlo con uno vigente es una renovación (fecha y versión
  nuevas). Retirar uno inexistente → 200 sin cambios _(RV-11, S-07, S-01)_.
- **RN-06 · Retención solo del sistema.** La fecha de fin de retención la calcula siempre el sistema; ni la API ni la
  interfaz la editan _(RV-12)_.
- **RN-07 · Fórmula de retención (dueño: `candidatos`).** Con alguna inscripción no final → sin fecha de fin
  («mientras dure el proceso»). Si no, la **más tardía** de las que apliquen: consentimiento vigente + 24 meses;
  cierre del último proceso + 6 meses (`hired` también cierra); alta + 6 meses si nunca tuvo inscripciones. Si la
  fecha no existe (31/08 + 6 meses), último día del mes. Retirar el consentimiento aplica la fórmula aunque la fecha
  ya haya pasado. Se recalcula al dar de alta, al cambiar el consentimiento y al crear o cerrar inscripciones, en la
  misma transacción que la operación que lo provoca _(S-06, RV-13, RGPD §3)_.
- **RN-08 · Búsqueda y listado.** `q` busca por coincidencia parcial en nombre o email, sin distinguir mayúsculas ni
  tildes; filtro por una sola skill exacta, combinado con `q` en Y. Orden por alta, la más reciente primero;
  20 por página, máximo 100 (más → 400). El listado muestra solo nombre, email y skills _(RV-14, S-04, RV-08)_.
- **RN-09 · Fechas.** Se guardan en UTC (ISO 8601) y se muestran en Europe/Madrid en `dd/mm/aaaa`. Los plazos de
  retención se cuentan por día natural en Europe/Madrid _(RV-25, 06_design_principles §6)_.
- **RN-10 · Editar no recalcula.** Cambiar nombre, email, teléfono, resumen o skills no toca la fecha de fin de
  retención _(RGPD §3, S-06)_.
- **RN-11 · Ediciones concurrentes.** En la edición de la ficha gana la última escritura _(S-02)_.
- **RN-12 · Puerto de procesos del candidato.** `candidatos` lee de cada candidato si tiene alguna inscripción no
  final, si alguna vez tuvo inscripciones y la fecha de cierre de su último proceso a través de un puerto que
  implementará `inscripciones`; y le ofrece la operación interna de recalcular la retención, que `inscripciones`
  invocará al crear o cerrar una inscripción. Hasta que exista esa implementación, el puerto responde «sin
  inscripciones» _(reparto entre módulos de reglas-validadas.md, S-06)_.
- **RN-13 · Sin borrado.** No existe la operación de borrar un candidato _(RV-16)_.

## Invariantes
- **INV-01:** nunca hay dos candidatos con el mismo email normalizado _(RV-10)_.
- **INV-02:** el email siempre está recortado y en minúsculas; las skills siempre están en minúsculas, no vacías, sin
  repetir y son como mucho 20 _(RV-09, RV-10, S-03)_.
- **INV-03:** tras cualquier operación de esta feature, la fecha de fin de retención de un candidato es exactamente la
  que da la fórmula RN-07 con sus datos actuales; nunca la fija una petición _(RV-12, S-06)_.
- **INV-04:** un consentimiento vigente siempre tiene fecha y versión; uno retirado conserva la fecha de otorgamiento y
  la de retirada _(RV-11, S-07)_.
- **INV-05:** ningún candidato se borra físicamente _(RV-16)_.
- **INV-06:** ningún dato personal (nombre, email, teléfono, resumen ni `q`) aparece en logs ni en mensajes de error;
  el listado nunca devuelve más que nombre, email y skills _(RGPD §6, S-04, QUALITY-GATES §4)_.
- **INV-07:** el candidato, su consentimiento y su fecha de fin de retención se escriben en la misma transacción: no
  queda nunca un cambio a medias _(S-06, DEC-01)_.

## Datos y conceptos clave
- **Candidato (`Candidate`):** nombre y apellidos, email, teléfono, resumen, skills, fecha de alta, consentimiento
  (fecha de otorgamiento, versión del texto, fecha de retirada) y fecha de fin de retención _(RV-09, RV-11, RV-12,
  RGPD §1)_.
- **Datos personales:** todos los anteriores, para identificar, contactar y valorar al candidato y acreditar la base
  jurídica de la conservación. Base: medidas precontractuales (6.1.b) y consentimiento (6.1.a). Plazo: el de RN-07
  _(RGPD §1-§3)_. No se recoge ningún otro dato (minimización, RGPD §1).
- **Proceso del candidato:** sus inscripciones, que viven en `inscripciones`; aquí solo se leen por el puerto RN-12.

## Casos límite
- **Input inválido:** email sin `@` o de 255 caracteres → 400 junto al campo (RN-02). Nombre «   » → 400 por
  obligatorio vacío (S-03). Teléfono «abc123» → 400 (RN-02). Petición con `retentionEndsAt` o un campo desconocido →
  400 y no se guarda nada (S-03). Skill «  » → se descarta (RN-04). `q` con caracteres de control → 400 (RN-02).
- **Boundary:** nombre de 2 y de 100 caracteres → se acepta; de 1 y de 101 → 400. Resumen de 2 000 → se acepta; de
  2 001 → 400. 20 skills → se aceptan; 21 distintas → 400; 21 con «TypeScript» y «typescript» → 20 tras deduplicar, se
  aceptan. Skill de 40 → se acepta; de 41 → 400. `q` de 100 → se acepta; de 101 → 400. 100 por página → se acepta; 101
  → 400; página más allá de la última → lista vacía. Alta el 06/10/2026 a las 22:30 UTC → en Madrid es 07/10 y la
  retención vence el 07/04/2027. Alta el 31/08/2026 → vence el 28/02/2027; el 31/08/2027 → 29/02/2028 (S-06, RV-25).
- **Fallo de dependencia:** SQLite ocupada al guardar → error en el envelope, sin datos personales y sin escritura
  parcial (INV-07, DEC-01). La web sin API → estado de error con reintento; el formulario y los filtros se conservan
  (06_design_principles §3).
- **Concurrencia:** dos altas simultáneas con el mismo email → una 201 y otra 409 con el ID de la primera (INV-01).
  Dos ediciones cruzadas de la misma ficha → gana la última escritura (S-02). Dos cambios simultáneos al mismo email
  libre en dos candidatos → uno se guarda y el otro recibe 409 (INV-01).
- **Datos corruptos o legacy:** no hay datos previos al módulo. El seed calcula la retención con la misma fórmula y
  usa solo datos inventados con emails `@example.com` (RV-26); ningún candidato del seed queda sin fecha de fin salvo
  los que tengan una inscripción no final (INV-03).
- **Seguridad:** `q` lleva nombres o emails → no se registra en logs (RGPD §6). `<script>` en el resumen → se guarda
  y se muestra como texto (QUALITY-GATES §3). `q` con `' OR 1=1 --` → búsqueda literal con sentencias preparadas
  (QUALITY-GATES §4). ID inexistente o enumerado → 404 sin datos. El 409 del email devuelve el ID, no el email
  (INV-06). El listado no devuelve teléfono, resumen ni retención (S-04).
- **Idempotencia:** doble clic en el alta → la segunda petición da 409 con el ID del primero (RN-03) y el botón se
  desactiva mientras se envía. Guardar la ficha sin cambios → 200 sin cambios (S-01). Retirar dos veces el
  consentimiento → la segunda es 200 sin tocar fechas (S-01). Marcarlo con uno vigente → renovación, no error (S-07).

## Módulos afectados
- **`candidatos`:** entidad `Candidate`, su API (alta, edición, listado y búsqueda, ficha y consentimiento), sus
  pantallas (listado, formulario y ficha), la fórmula de retención, el puerto de procesos del candidato y la operación
  interna de recálculo (RN-07, RN-12), y los candidatos del seed.

## Dependencias, riesgos y supuestos
- **Dependencias:** ninguna previa. La feature de inscripciones (IDEA-003) depende de esta: implementa el puerto RN-12
  e invoca el recálculo. La feature A modificará UC-09..13 para el estado «anonimizado» (S-05).
- **Riesgos:** que la fórmula de retención quede duplicada en `inscripciones` en vez de invocar la de `candidatos`
  (mitigación: RN-12 y una prueba de la fórmula con todas las filas de RGPD §3 a nivel de función); errores de
  aritmética de meses y zona horaria (mitigación: los casos boundary de arriba como tests).
- **Supuestos confirmados:** todos los de S-01..S-07 y el reparto entre módulos, respondidos por la persona el
  2026-10-06 («todo según recomendación»).

## Criterios de aceptación
- [ ] Dado que no existe `lucia.ferrer@example.com`, cuando doy de alta a «Lucía Ferrer Soler» con
      `Lucia.Ferrer@Example.com ` y las skills `TypeScript, sql, typescript`, entonces se guardan el email
      `lucia.ferrer@example.com` y las skills `typescript, sql`, y el fin de retención es la fecha de alta + 6 meses
      (UC-09 P).
- [ ] Dado que ese candidato existe, cuando doy de alta otro con `LUCIA.FERRER@example.com` o le pongo ese email a
      otro candidato, entonces recibo 409 con el ID existente y no cambia nada (UC-09 E2, UC-10 E2).
- [ ] Dado un formulario con un nombre de 101 caracteres, 21 skills distintas o el campo de fin de retención, cuando
      lo envío, entonces la API responde 400, veo el error junto al campo y no se guarda nada (UC-09 E1, UC-10 E1).
- [ ] Dado un candidato sin consentimiento, cuando lo marco, entonces se guardan la fecha y la versión del texto y el
      fin de retención pasa a ser esa fecha + 24 meses; y si lo vuelvo a marcar más tarde, se renueva desde la nueva
      fecha (UC-13 P, A2).
- [ ] Dado un candidato sin inscripciones, dado de alta hace 8 meses y con consentimiento, cuando lo retiro, entonces
      se conservan las fechas de otorgamiento y de retirada y el fin de retención es alta + 6 meses aunque ya haya
      pasado; y retirarlo otra vez devuelve 200 sin cambios (UC-13 A1, A3).
- [ ] Dado el candidato «José Ruiz» con la skill `sql`, cuando busco `q=jose` con el filtro `sql`, entonces aparece en
      el listado, que solo muestra nombre, email y skills, ordenado por alta, la más reciente primero (UC-11 P, A2).
- [ ] Dado un candidato, cuando abro su ficha, entonces veo todos sus datos, el consentimiento y el fin de retención
      en `dd/mm/aaaa` sin poder editarlo (UC-12 P).
- [ ] Dado cualquier alta, edición, búsqueda o error, cuando reviso los logs y los mensajes de error, entonces no
      contienen nombre, email, teléfono, resumen ni el texto de `q` (INV-06).

## Preguntas abiertas
Ninguna. Las preguntas del shaping se respondieron el 2026-10-06 y están en reglas-validadas.md como S-01..S-07.

## Handoff a delivery
- **HU-03 — Alta, edición y búsqueda de candidatos, con consentimiento** (propuesta).
  - **Valor:** el reclutador tiene fichas de candidatos completas, buscables y con su consentimiento y su retención
    correctos desde el primer día, listas para inscribirlas en ofertas.
  - **Cubre:** UC-09 (P, A1, E1, E2, E3); UC-10 (P, A1, A2, A3, E1, E2, E3, E4); UC-11 (P, A1, A2, A3, A4, E1, E2);
    UC-12 (P, E1, E2); UC-13 (P, A1, A2, A3, E1, E2). Incluye la fórmula completa de RN-07, probada con todas las
    filas de RGPD §3, y el puerto RN-12 con la respuesta «sin inscripciones».
  - **Fuera de HU-03, con motivo:** UC-12 A1 («Mientras dure el proceso») solo puede darse con una inscripción no
    final; lo cubre HU-04 (FEAT-03), que implementa el puerto RN-12 y su llamada al recálculo.
  - **Dependencias:** ninguna.

**HU creadas (2026-10-06):** HU-03; UC-12 · A1 lo cubre HU-04 (FEAT-03).

## Cierre
Entregada en sprint-01 el 2026-10-07: HU-03 (`cda892e`). Review «Aprobado con observaciones» en cada HU y auditoría del
sprint «Aprobado con observaciones» (`docs/10_audits/sprints/sprint-01-AUDIT.md`).
