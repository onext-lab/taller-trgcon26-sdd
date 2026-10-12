# HU-07 — Importar candidatos desde un CSV — PRD

## Info
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** fullstack
- **Módulos:** `candidatos` (código `candidates`)
- **Fecha:** 2026-10-12
- **Estado:** Draft

## Contexto

### Problema
Un reclutador que vuelve de una feria de empleo, o que trae una lista de otra herramienta, hoy tiene que teclear los
candidatos uno a uno con el formulario del alta (UC-09). Quiere subir un CSV y saber qué filas entraron, cuáles no y
por qué (IDEA-004, FEAT-04). Cada fila son datos personales: los importados tienen que entrar con la misma validación,
el mismo email normalizado y la misma retención que un alta por formulario, sin consentimiento, sin tocar a nadie que
ya exista y sin dejar rastro del fichero (RGPD §2, §3 y §6.5).

### Situación actual
El módulo `candidatos` está completo para FEAT-02 (`docs/05_modules/candidatos/functional.md`, 5/5 capacidades) y no
tiene nada de importación (`functional.md`, «Alcance no implementado»).
- **API** (`apps/api/src/modules/candidates/`): `routes.ts` (alta `POST /api/candidates` con 201, edición, listado,
  ficha y consentimiento), `service.ts` (el alta inserta con la retención vacía y llama a `recalculateRetention` en la
  misma transacción; `writeUniqueEmail` traduce el `UNIQUE` a 409 `DUPLICATE`), `repository.ts` (`findIdByEmail` de un
  solo email e `isDuplicateEmailError`), `normalize.ts` (`normalizeCandidateBody`, pura; no hay un `normalizeEmail`
  suelto), `schemas.ts` (`candidateFieldsSchema`: las reglas del alta solo existen como JSON Schema de la ruta; **no
  hay un validador de fila reutilizable en código**) y `retention.ts` (`computeRetentionEndsAt`, pura: sin procesos,
  alta + 6 meses). **No existe** ningún alta de varios candidatos a la vez ni búsqueda de varios emails.
- **Transversal API:** `withTransaction` (`apps/api/src/db/transaction.ts`, `BEGIN IMMEDIATE`, se une a una en curso);
  manejador de errores con el envelope (`apps/api/src/http/error-handler.ts`); guarda entre sitios
  (`apps/api/src/http/cross-site.ts`, 403); Fastify solo acepta JSON y `text/plain` (este da 400) y responde 415 a lo
  demás, **sin soporte multipart** (DEC-11.5, DEC-12); `bodyLimit` **sin configurar** en `apps/api/src/app.ts`, así que
  rige el de Fastify, 1 048 576 bytes para todo el cuerpo (lo fija `apps/api/test/http/error-handler.test.ts`). Los logs
  solo llevan método, ruta sin query e ID de petición, nunca cuerpos (`apps/api/src/logger.ts`).
- **Web** (`apps/web/src/features/candidates/`): rutas en `paths.ts` y tabla `ROUTES` de `apps/web/src/App.tsx` (las
  literales antes de `/candidates/:id`); el listado (`CandidateListScreen.tsx`) tiene el enlace «Nuevo candidato» en un
  `<p>` antes de los filtros. El cliente `requestJson` (`apps/web/src/components/http.ts`) solo envía JSON
  (`JSON.stringify`) con un tiempo de espera de 10 s. Estados con `LoadingMessage` (`role="status"`), `ErrorMessage`
  (`role="alert"`, con «Reintentar») y `Notice` en `apps/web/src/components/StatusMessages.tsx`. **No existe** ningún
  `input type="file"`, `FormData` ni envío de `text/csv` en la web, la API ni los e2e.
- **Tests:** `apps/api/test/candidates/` (entre ellos `privacy-logs.test.ts`), `apps/api/test/helpers/test-app.ts`
  (`createTestApp` en memoria, `failWrites` con *trigger* real de SQLite, `createTestClock`),
  `apps/api/test/helpers/candidates.ts`; web con `apps/web/test/helpers/fetch.ts`; e2e en `e2e/candidates.spec.ts` y
  `e2e/candidates-list.spec.ts` con `e2e/support/`, sobre `data/e2e.db`. **No existen** fixtures CSV.

### Resultado esperado
Desde el listado de candidatos, «Importar CSV» abre una pantalla con la cabecera esperada (`nombre,email,telefono`) y un
selector de fichero. El reclutador elige un CSV y pulsa «Importar»: el sistema rechaza el fichero entero si su formato,
su cabecera o su tamaño no valen, o si no trae filas; si vale, valida cada fila como el alta, descarta los duplicados
(contra la base y dentro del fichero) sin tocar a nadie y crea los válidos sin consentimiento y con el fin de retención
a alta + 6 meses, todos en una sola transacción. La pantalla muestra un informe con los recuentos y las filas no
importadas (número de fila, campo y motivo, sin repetir valores), que no se guarda en ningún sitio. Del fichero no
queda nada: ni copia, ni contenido en logs, errores o respuestas. Un e2e con CSV inventados recorre el flujo de la demo.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-20 · P | Importar un CSV válido: crea los candidatos sin consentimiento, con retención alta + 6 meses, e informe | CA-01, CA-02, CA-03 |
| UC-20 · A1 | Email que ya existe en la base (sin distinguir mayúsculas): «duplicado» con «Ver candidato»; reimportar; choque simultáneo | CA-04, CA-05, CA-06 |
| UC-20 · A2 | Email repetido dentro del fichero: entra la primera fila válida, el resto «repetido en el fichero (fila N)» | CA-07 |
| UC-20 · A3 | Filas inválidas con todos sus errores sin valores; ninguna válida → informe con 0 creados; numeración física | CA-08, CA-09, CA-10 |
| UC-20 · E1 | Fichero ilegible: no UTF-8 o binario, comillas sin cerrar, cabecera que no es exactamente la esperada | CA-11, CA-12 |
| UC-20 · E2 | Fichero vacío o solo con la cabecera: «El fichero no tiene candidatos» | CA-13 |
| UC-20 · E3 | Más de 500 filas de datos o más de 1 MiB: se rechaza entero | CA-14 |
| UC-20 · E4 | Fallo al guardar: no se crea nada, error sin datos personales, reintento seguro; API caída vista desde la web | CA-15, CA-16 |

Fichero del UC: `docs/05_modules/candidatos/casos-de-uso/UC-20-importar-candidatos-csv.md` (Trazabilidad rellenada con
estos CA). CA-17 es transversal a P y E1-E4 (datos personales, RNF-02). UC-09 no se modifica: UC-20 reutiliza sus
reglas por cita.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **Entrada y pantalla de importación.** En el listado de candidatos, «Importar CSV» junto a «Nuevo candidato» lleva a una pantalla propia (RN-15). La pantalla muestra la cabecera esperada como texto (`nombre,email,telefono`), un selector de fichero con `<label>` que filtra `.csv` y el botón «Importar», que se deshabilita mientras se importa (RN-11). Siempre está en un estado explícito: inicial, importando, error del fichero o informe, y cada cambio se anuncia con `role="status"` o `role="alert"` (INV-07). Un error (del fichero, de la base o de red) deja reintentar sin salir de la pantalla. Ningún dato del fichero ni del informe va a la URL, al título del documento, a `history.state` ni al almacenamiento del navegador. Detalles de la pantalla: OQ-09. | Must | frontend | - [ ] CA-02, CA-16<br>- [ ] RNF-03, RNF-07 |
| RF-02 | **Validación del fichero entero.** Antes de mirar ninguna fila se comprueba: tamaño ≤ 1 MiB (RN-03); UTF-8, con un BOM inicial que se acepta y se ignora (RN-01); CSV con separador coma, comillas dobles RFC 4180 y finales de línea LF o CRLF (RN-01); cabecera obligatoria y exacta `nombre,email,telefono`, en ese orden, comparando cada nombre recortado y sin distinguir mayúsculas (RN-02); al menos una fila de datos (RN-04); y como mucho 500 filas de datos, sin contar las líneas totalmente vacías (RN-03, RN-04). Se valida el contenido, no la extensión (RN-15). Si algo falla, se rechaza el fichero entero, no se crea ningún candidato (INV-05) y el mensaje es útil (con la línea, si aplica; la cabecera esperada, si es la cabecera; el límite, si es el tamaño) y no contiene nada del fichero (INV-06). Textos y precedencia: OQ-08; códigos HTTP: OQ-10; medida del límite: OQ-11. | Must | backend + frontend | - [ ] CA-03, CA-11, CA-12, CA-13, CA-14 |
| RF-03 | **Validación de cada fila y numeración.** Cada fila de datos se valida con las reglas del alta (UC-09): nombre y apellidos de 2 a 100 caracteres (puntos de código) y email obligatorios; email estándar de ≤ 254; teléfono opcional (vacío = sin teléfono) con «+» opcional y 6-20 caracteres entre dígitos, espacios, guiones y paréntesis con al menos 6 dígitos; recorte previo (solo espacios = vacío); sin caracteres de control C0 ni DEL (RN-05; RV-09, S-03, DEC-11.8). Una fila con un número de campos distinto de 3 es un error de esa fila, «número de columnas incorrecto» (RN-05). Se informan todos los errores de la fila, uno por campo, sin repetir el valor (RN-05, DEC-11.4). Las líneas totalmente vacías se ignoran y no cuentan; la «fila N» es la línea física, con la cabecera como línea 1 (RN-04; registros de varias líneas y filas solo con comas: OQ-07). La validación es la misma que la del alta (misma fuente de reglas), no una copia que pueda divergir. | Must | backend | - [ ] CA-08, CA-09, CA-10 |
| RF-04 | **Deduplicación.** El email se normaliza (recortado y en minúsculas) antes de comparar (RN-07). Una fila válida cuyo email ya tiene un candidato no se importa ni lo modifica (INV-01): sale como «duplicado» con el ID del existente y, en la web, un enlace «Ver candidato» a su ficha, sin mostrar ningún dato suyo (RN-07; RV-27, RV-10). Entre filas válidas con el mismo email normalizado entra la primera; las siguientes salen como «repetido en el fichero (fila N)», con N la fila de la primera (RN-08); una fila inválida no cuenta como «primera». Fila válida cuyo email existe en la base y además se repite en el fichero: OQ-06. Reimportar el mismo CSV da 0 creados. La unicidad la garantiza el índice único `candidates_email_uq`: un choque con otra escritura simultánea sale como «duplicado», nunca como error interno (RN-11, INV-02, DEC-08). | Must | backend | - [ ] CA-04, CA-05, CA-06, CA-07 |
| RF-05 | **Alta de las filas válidas, todo o nada.** Las filas válidas y no duplicadas se crean todas en una sola transacción con `withTransaction` (RN-11, DEC-06, DEC-11.7): si la base falla, no se crea ninguna y la API responde con un error genérico en el envelope, sin datos personales (UC-20 · E4, INV-05). Cada candidato entra sin consentimiento (fecha, versión y retirada vacías; RN-09) y con el fin de retención calculado por el sistema, alta + 6 meses por día natural de Europe/Madrid, en la misma transacción, con la misma fórmula que el alta (`recalculateRetention`, RN-10, INV-04). La fecha de alta la pone el reloj inyectado (DEC-09). El CSV no puede fijar consentimiento, retención, resumen, skills ni origen: no hay columna para ellos (RN-02, RN-14). Los valores se guardan como texto tal cual tras recortar, también los que empiezan por `=`, `+`, `-` o `@` (RN-16). Si ninguna fila es válida, no es un error: informe con 0 creados (RN-06). Reintentar tras un fallo es seguro. | Must | backend | - [ ] CA-01, CA-06, CA-09, CA-15 |
| RF-06 | **Informe de la importación.** La respuesta y la pantalla dan: número de creados, de duplicados (incluidos los «repetido en el fichero») y de filas con error, que suman las filas de datos del fichero (INV-03); y la lista de filas no importadas con su número de fila, el campo y el motivo en castellano, sin repetir el valor recibido, más el ID del existente en los duplicados (RN-12). No lista las filas creadas. Solo vive en pantalla: no se persiste ni se puede descargar (RN-12). Al final ofrece «Importar otro fichero» (vuelve al estado inicial) e «Ir al listado». Ninguna respuesta, log ni mensaje de error de la importación contiene nombres, emails ni teléfonos del fichero, y no queda copia del fichero (RN-13, INV-06, RGPD §6.1 y §6.5). | Must | backend + frontend | - [ ] CA-01, CA-04, CA-07, CA-08, CA-09, CA-17<br>- [ ] RNF-02, RNF-04 |
| RF-07 | **Fixtures y e2e.** Ficheros CSV de prueba inventados (emails `@example.com` o `@example.org`, teléfonos de la serie `+34 600 000 0xx`; RGPD §6.3, RV-26) y un e2e de Playwright sobre `data/e2e.db` que recorre el flujo de la demo: listado → «Importar CSV» → fichero con filas nuevas, un duplicado y una fila inválida → informe → «Ir al listado». | Should | e2e | - [ ] el e2e pasa en `npm run e2e` y comprueba los recuentos del informe y que los creados aparecen en el listado<br>- [ ] 0 datos reales en los fixtures |

Cobertura de los criterios de `hu.md`: 1 → RF-05, RF-06 · 2 → RF-04 · 3 → RF-04 · 4 → RF-03 · 5 → RF-02 · 6 → RF-02 ·
7 → RF-02 · 8 → RF-05 · 9 → RF-04 · 10 → RF-06 y RNF-02.

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Importación de la API | Rendimiento | Importar un CSV de 500 filas válidas y nuevas < 500 ms por petición con 1 000 candidatos en la base, con `fastify.inject` en local (umbral de «acción» de `QUALITY-GATES.md` §2) |
| RNF-02 | Sin datos personales del fichero en logs, errores ni respuestas | Privacidad | 0 apariciones de los nombres, emails y teléfonos del fichero en las líneas de log capturadas, en `message` y `details` de cada error y en el cuerpo del informe, con los ficheros de CA-17 (INV-06) |
| RNF-03 | Nada del fichero se queda | Privacidad | 0 ficheros creados en el directorio temporal del sistema y en `data/` por una importación; 0 apariciones de datos del fichero o del informe en la URL, `document.title`, `history.state`, `localStorage` y `sessionStorage` de la web (RN-13) |
| RNF-04 | Minimización del informe | Privacidad | El informe contiene 0 valores de los campos del fichero, 0 entradas de filas creadas y, de un candidato existente, solo su ID |
| RNF-05 | Límites del fichero | Seguridad | ≤ 500 filas de datos y ≤ 1 048 576 bytes (1 MiB) por fichero; con 501 filas o 1 048 577 bytes, rechazo con 0 candidatos creados (RN-03) |
| RNF-06 | Errores sin detalles internos | Seguridad | 0 respuestas de error de la importación fuera del envelope `{ error: { code, message, details? } }` y 0 con *stack trace*, también con un fichero binario, uno de 50 MiB y un fallo de la base |
| RNF-07 | Accesibilidad de la pantalla | Accesibilidad | 100 % de los controles (selector de fichero, «Importar», «Importar otro fichero», «Ir al listado», «Ver candidato») con `<label>` o nombre accesible y localizables por rol y nombre en Testing Library; 100 % de los cambios de estado (importando, error, informe) anunciados con `role="status"` o `role="alert"` |

## Modelo de datos
No aplica: **sin migración ni columnas nuevas** (RN-14, FEAT-04 «Módulos afectados»). La importación escribe en la tabla
`candidates` de `apps/api/src/db/migrations/002-create-candidates.sql` lo mismo que el alta: `full_name`, `email`
(normalizado; `CHECK` de minúsculas e índice único `candidates_email_uq`), `phone` (o `NULL`), `skills` = `[]`,
`summary` = `NULL`, `created_at` (reloj), consentimiento vacío (`consent_given_at`, `consent_version` y
`consent_withdrawn_at` a `NULL`) y `retention_ends_at` calculado. No se guarda ningún campo de origen ni el fichero ni
el informe. Todas esas columnas son datos personales o ligados a una persona (§Datos personales).

## Interfaces / endpoints / pantallas

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/candidates/import` (propuesta, OQ-10) | Nuevo | Recibe el fichero (transporte en `/tech-design`, OQ-11) y responde con el informe: recuentos y filas no importadas (fila, campo, motivo y, en los duplicados, el ID del existente). Propuesta de OQ-10: 200 con el informe (también con 0 creados) · 400 `VALIDATION_ERROR` (E1, E2 y más de 500 filas) · 413 `PAYLOAD_TOO_LARGE` (más de 1 MiB) · 403 `CROSS_SITE_REQUEST` (DEC-12) · 415 `UNSUPPORTED_MEDIA_TYPE` · 500 `INTERNAL_ERROR` (E4) |
| Pantalla | Listado de candidatos (`apps/web/src/features/candidates/CandidateListScreen.tsx`) | Modificar | «Importar CSV» junto a «Nuevo candidato» |
| Pantalla | Importar candidatos, `/candidates/import` (nueva; propuesta, OQ-09) | Nueva | Cabecera esperada como texto, selector `.csv`, «Importar»; estados inicial, importando, error e informe; informe con recuentos, filas no importadas, «Ver candidato» en los duplicados, «Importar otro fichero» e «Ir al listado» |

La ruta web va en la tabla `ROUTES` de `apps/web/src/App.tsx` antes de `/candidates/:id`. El nombre exacto de la ruta
de la API y la forma del JSON del informe los puede ajustar `/tech-design` sin cambiar comportamiento ni códigos.

## Flujos de usuario
1. **Importar:** listado → «Importar CSV» → pantalla con la cabecera esperada → elige el fichero → «Importar» (se
   deshabilita; «Importando…») → informe: «N creados, M duplicados, K filas con error» y la lista de filas no
   importadas → «Ir al listado» (los creados aparecen en el listado) o «Importar otro fichero» (estado inicial).
2. **Duplicado:** en el informe, la fila «duplicado» lleva «Ver candidato», que abre la ficha del existente por su ID
   (pestaña: OQ-09).
3. **Fichero rechazado:** «Importar» → mensaje de error con `role="alert"` (formato, cabecera esperada, límite o «El
   fichero no tiene candidatos»), sin informe → elige otro fichero (o corrige este) → «Importar».
4. **Fallo de la base o de red:** «Importar» → error genérico con `role="alert"`; el fichero sigue elegido (OQ-09) →
   «Importar» de nuevo.

## Datos personales
- **Qué:** del fichero, nombre y apellidos, email y teléfono (RGPD §1); el sistema añade la fecha de alta y el fin de
  retención. No se guarda ningún otro dato: ni origen («importado por CSV»), ni el fichero, ni el informe (RN-13,
  RN-14; minimización).
- **Para qué:** dar de alta al candidato igual que con el formulario, para identificarlo y contactarlo en procesos de
  selección (RGPD §1); el email además detecta duplicados.
- **Base jurídica y plazo:** los del alta sin inscripción ni consentimiento: los importados entran **sin
  consentimiento** (RN-09, INV-04; el CSV no prueba qué versión del texto vio el candidato, RGPD §2) y se conservan
  **6 meses desde el alta** (RV-13, RGPD §3), salvo que después se inscriban o den el consentimiento (UC-13). El deber
  de informar del art. 14 RGPD (datos no obtenidos del interesado) queda fuera del ATS como supuesto didáctico
  declarado (RN-14; pendiente de ratificar, OQ-05).
- **Qué devuelve la respuesta:** solo recuentos y, por fila no importada, número de fila, campo, motivo y, si es
  duplicado, el ID del existente (RNF-04). Ningún valor del fichero ni dato del existente.
- **Qué no aparece nunca:** nombres, emails ni teléfonos del fichero en logs (los logs no registran cuerpos,
  `apps/api/src/logger.ts`), en mensajes o `details` de error, en el informe, en la URL, en el título del documento,
  en `history.state` ni en el almacenamiento del navegador (RNF-02, RNF-03). No queda copia temporal del fichero
  (RGPD §6.5).
- **Fixtures y tests:** solo datos inventados (`@example.com`, `+34 600 000 0xx`; RGPD §6.3). Lo revisa el agente
  `datos-personales-auditor` en `/reviewer`.

## Edge cases

Las 7 categorías de `QUALITY-GATES.md` §3, evaluadas por cada RF Must (RF-01 a RF-06). RF-07 (Should) no las exige.
Datos inventados.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | El reclutador quita el filtro del selector y elige `foto.png`, o un `.txt` con contenido CSV válido | La web lo envía igual: decide el contenido, no la extensión (RN-15). El PNG → error «Formato CSV inválido» con `role="alert"` y 0 creados; el `.txt` válido se importa |
| EC-02 | RF-01 | 2 Boundary | Pulsar «Importar» sin haber elegido fichero | No sale ninguna petición; «Importar» está deshabilitado hasta elegir uno (propuesta de OQ-09) |
| EC-03 | RF-01 | 3 Fallo de dependencia | La API no responde o pasan los 10 s de espera del cliente | Estado de error con `role="alert"`; el fichero sigue elegido y «Importar» permite reintentar (INV-07, UC-20 · E4) |
| EC-04 | RF-01 | 4 Concurrencia | Doble clic en «Importar» | «Importar» se deshabilita en el primer clic: sale una sola petición (RN-11) |
| EC-05 | RF-01 | 5 Datos corruptos | La API responde 200 con un cuerpo que no tiene la forma del informe | La web no pinta un informe a medias: muestra el error genérico del cliente con `role="alert"` |
| EC-06 | RF-01 | 6 Seguridad | Fichero llamado `candidatos_lucia_ferrer.csv`; la petición llega desde otra web | El nombre del fichero no va al título (siempre el mismo, OQ-09), a la URL, a `history.state` ni al almacenamiento (RNF-03); desde otra web → 403 `CROSS_SITE_REQUEST` (DEC-12) |
| EC-07 | RF-01 | 7 Idempotencia | Tras el informe, «Importar otro fichero» y se vuelve a elegir el mismo fichero | Nueva importación: 0 creados y las filas que entraron, «duplicado» (UC-20 · A1, CA-05) |
| EC-08 | RF-02 | 1 Input inválido | Cabecera `nombre;email;telefono` (Excel en español) | Fichero rechazado entero con la cabecera esperada; 0 creados (RN-02, PA-03) |
| EC-09 | RF-02 | 1 Input inválido | «Muñoz» en Latin-1 (byte `0xF1`); un PNG renombrado a `.csv`; unas comillas sin cerrar que empiezan en la línea 4 | «Formato CSV inválido» (con «línea 4» en el tercero); 0 creados (RN-01) |
| EC-10 | RF-02 | 1 Input inválido | Cabeceras ` Nombre , EMAIL,Telefono`; `nombre,email`; `nombre,email,telefono,resumen`; `email,nombre,telefono`; `nombre,email,email`; `nombre,email,telefono,` | La primera se acepta (recorte y mayúsculas); las demás rechazan el fichero entero con la cabecera esperada (RN-02) |
| EC-11 | RF-02 | 2 Boundary | 500 filas; 501; 500 filas más 30 líneas en blanco; fichero de 1 048 576 bytes; de 1 048 577 bytes | 500 y 500 + blancos → se procesan; 501 → rechazo por el límite de filas; 1 048 576 bytes → no se rechaza por tamaño (sigue la validación); 1 048 577 → rechazo por el límite de tamaño; en los rechazos, 0 creados (RN-03, RN-04) |
| EC-12 | RF-02 | 2 Boundary | Fichero de 0 bytes; solo BOM; solo cabecera; cabecera y líneas en blanco; BOM + cabecera + filas con CRLF; última fila sin salto de línea final | Los cuatro primeros → «El fichero no tiene candidatos» (RN-04); el BOM se ignora y CRLF vale (RN-01); la última fila cuenta |
| EC-13 | RF-02 | 3 Fallo de dependencia | El fichero elegido se borra o se mueve antes de pulsar «Importar» y el navegador no lo puede leer | Error en la pantalla con `role="alert"`, sin petición a la API; se puede elegir otro |
| EC-14 | RF-02 | 4 Concurrencia | — | N/A — validar el fichero es una función pura sobre los bytes recibidos: sin base ni estado compartido |
| EC-15 | RF-02 | 5 Datos corruptos | Exportación cortada a mitad de un campo entrecomillado | «Formato CSV inválido» con la línea donde empieza el campo; 0 creados (INV-05) |
| EC-16 | RF-02 | 6 Seguridad | Fichero de 50 MiB; cabecera inválida con un email real en ella | 50 MiB → rechazo por tamaño (413 de la propuesta de OQ-10) sin procesarlo; ningún mensaje repite la cabecera recibida ni ninguna línea del fichero, solo la esperada (INV-06, DEC-11.5) |
| EC-17 | RF-02 | 7 Idempotencia | El mismo fichero inválido se envía dos veces | El mismo error las dos veces y 0 creados en total |
| EC-18 | RF-03 | 1 Input inválido | Fila `,ana.gil@,+34 600 000 030` (nombre vacío y email mal formado); fila con teléfono `abc123` | Error de la fila con un elemento por campo: nombre y email en la primera, teléfono en la segunda; ningún valor repetido (RN-05) |
| EC-19 | RF-03 | 1 Input inválido | Fila con 2 o 4 campos; fila `"Ferrer, Lucía",lucia.ferrer@example.com,` | 2 o 4 campos → «número de columnas incorrecto»; la coma entrecomillada no separa: 3 campos, fila válida sin teléfono |
| EC-20 | RF-03 | 1 Input inválido | NUL o tabulador en un nombre; salto de línea entrecomillado dentro del nombre | Error de ese campo por carácter de control (DEC-11.8); la fila no entra |
| EC-21 | RF-03 | 2 Boundary | Nombre de 1, 2, 100 y 101 caracteres («Íñigo Núñez 🎯» cuenta puntos de código); email de 254 y 255; teléfono de 5, 6, 20 y 21 caracteres tras el «+»; nombre «   »; teléfono «  » | Valen 2, 100, 254, 6 y 20; los demás, error del campo; «   » → nombre obligatorio; teléfono solo con espacios → sin teléfono (S-03) |
| EC-22 | RF-03 | 2 Boundary | Líneas 3 y 6 en blanco entre filas de datos | Se ignoran sin desplazar la numeración: la fila de la línea 7 sale como «fila 7» (RN-04) |
| EC-23 | RF-03 | 3 Fallo de dependencia | — | N/A — la validación de fila es pura (las reglas del alta en memoria) y no usa la base |
| EC-24 | RF-03 | 4 Concurrencia | — | N/A — sin estado compartido; la unicidad, que sí lo tiene, es de RF-04 (EC-31) |
| EC-25 | RF-03 | 5 Datos corruptos | Exportación de otra herramienta con filas finales `,,` (solo separadores) | No son líneas totalmente vacías: filas con nombre y email obligatorios vacíos (propuesta de OQ-07) |
| EC-26 | RF-03 | 6 Seguridad | Nombre `<script>alert(1)</script>`; nombre `=HYPERLINK("http://x")`; teléfono `+34 600 000 031` | Válidos: se guardan como texto tal cual y la web los pinta como texto (RN-16); el «+» del teléfono no se toca; ningún error repite el valor |
| EC-27 | RF-03 | 7 Idempotencia | La misma fila validada dos veces (en dos importaciones) | Los mismos errores, en el mismo orden: la validación es determinista |
| EC-28 | RF-04 | 1 Input inválido | Fila con ` Ana.Gil@Example.COM ` y existe `ana.gil@example.com` | Se normaliza antes de comparar: «duplicado» con el ID de Ana (RN-07) |
| EC-29 | RF-04 | 2 Boundary | 500 filas válidas con el mismo email nuevo; fila 2 inválida y fila 3 válida con el mismo email | 1 creado y 499 «repetido en el fichero (fila 2)»; en el segundo caso entra la fila 3, porque la 2 no es válida (RN-08) |
| EC-30 | RF-04 | 3 Fallo de dependencia | Falla la lectura de la base al comprobar los emails existentes | 500 `INTERNAL_ERROR` sin datos; 0 creados (UC-20 · E4) |
| EC-31 | RF-04 | 4 Concurrencia | Dos importaciones simultáneas (o una importación y un alta por formulario) con el mismo email nuevo | Un solo candidato con ese email; la otra importación lo da como «duplicado» (o el alta, 409 `DUPLICATE`); ninguna 500 (RN-11, DEC-08, índice único) |
| EC-32 | RF-04 | 5 Datos corruptos | Emails existentes del seed o de altas anteriores | Ya están en minúsculas y recortados por el `CHECK` de la migración 002: la comparación vale sin migrar nada (FEAT-04, casos límite) |
| EC-33 | RF-04 | 6 Seguridad | Fila con el email de un candidato existente | El informe lleva solo su ID; la web muestra «duplicado» y «Ver candidato» sin cargar ni mostrar su nombre, email ni teléfono (RN-07). Revelar el ID por email es aceptado como en el 409 del alta (DEC-04, DEC-07) |
| EC-34 | RF-04 | 7 Idempotencia | Reimportar el mismo CSV | 0 creados; las filas que entraron, «duplicado»; nada cambia (INV-01; filas que antes fueron «repetido en el fichero»: OQ-06) |
| EC-35 | RF-05 | 1 Input inválido | — | N/A — RF-05 solo recibe filas ya validadas por RF-03; la entrada inválida la cubren EC-18 a EC-21 |
| EC-36 | RF-05 | 2 Boundary | 0 filas válidas; 1; 500. Importar el 2026-10-12T22:30:00Z; importar el 2026-08-31T09:00:00Z | 0 → informe con 0 creados, sin error (RN-06); 1 y 500 → se crean todas; retención 2027-04-13 (en Madrid ya es 13/10) y 2027-02-28 (último día del mes) (RN-10, DEC-09) |
| EC-37 | RF-05 | 3 Fallo de dependencia | La escritura falla en la fila 250 de 500 (*trigger* de fallo) o falla el recálculo de la retención | 500 `INTERNAL_ERROR` en el envelope, `ROLLBACK` y 0 creados (UC-20 · E4, INV-05) |
| EC-38 | RF-05 | 4 Concurrencia | Una importación y otra operación de escritura sobre candidatos a la vez | `withTransaction` con `BEGIN IMMEDIATE` las serializa; cada una ve un estado completo de la otra |
| EC-39 | RF-05 | 5 Datos corruptos | Importación a medio guardar | Imposible: tras un fallo, el número de candidatos es el de antes (INV-05) |
| EC-40 | RF-05 | 6 Seguridad | El 500 de E4 llega al cliente; un CSV con una columna `consentimiento` | El 500 va sin datos del fichero ni *stack trace* (el log registra el error de SQLite, con nombres de columna, no valores); la columna de más rechaza el fichero por la cabecera: el CSV no puede dar consentimiento (RN-02, RN-09) |
| EC-41 | RF-05 | 7 Idempotencia | Reintentar tras un fallo de la base | Seguro: no quedó nada, así que se crean las mismas filas una sola vez; un segundo reintento ya da «duplicado» |
| EC-42 | RF-06 | 1 Input inválido | — | N/A — el informe lo construye el servidor con el resultado de RF-02 a RF-05, no con entrada del usuario |
| EC-43 | RF-06 | 2 Boundary | Todas las filas inválidas; 500 filas no importadas; una fila con 3 errores | 0 creados y 500 filas listadas, sin truncar; la fila con 3 errores aparece con los 3 (uno por campo); los recuentos suman las filas de datos (INV-03) |
| EC-44 | RF-06 | 3 Fallo de dependencia | — | N/A — el informe es la respuesta de la petición; si no llega, aplica EC-03 |
| EC-45 | RF-06 | 4 Concurrencia | — | N/A — cada informe es el de su petición y no se guarda: dos pestañas que importan ven cada una el suyo |
| EC-46 | RF-06 | 5 Datos corruptos | Fichero que mezcla creadas, duplicados de la base, repetidos, filas con error y líneas en blanco | creados + duplicados + filas con error = filas de datos; las líneas en blanco no cuentan (INV-03) |
| EC-47 | RF-06 | 6 Seguridad | Informe con duplicados y filas con error de un fichero con datos de «Lucía Ferrer Prat» | 0 valores del fichero y 0 filas creadas en el informe (RNF-04); nada en la URL, el título, `history.state` ni el almacenamiento (RNF-03); recargar la pantalla vuelve al estado inicial |
| EC-48 | RF-06 | 7 Idempotencia | «Importar otro fichero»; «Atrás» del navegador desde el informe | Vuelve al estado inicial sin fichero ni informe; volver atrás nunca reenvía la importación |

## Decisiones aplicables
- **DEC-01** (stack y envelope): Fastify con JSON Schema, `node:sqlite`, React + Vite; errores en
  `{ error: { code, message, details? } }` (RF-02, RF-05, RNF-06).
- **DEC-03** (la `.db` no se versiona): sin migración (Modelo de datos); fixtures CSV inventados (RF-07).
- **DEC-04** (sin login, rol único): sin permisos por rol; la seguridad se centra en datos personales, tamaño, ficheros
  maliciosos e inyección (EC-06, EC-16, EC-26, EC-33).
- **DEC-05** (dependencias): si `/tech-design` quiere una librería de CSV o de multipart, la justifica en un `DEC-NN`
  nuevo.
- **DEC-06** (módulos): todo queda en `candidatos`; el recálculo de la retención usa el puerto de procesos ya conectado
  en `apps/api/src/app.ts` (un importado no tiene inscripciones); ningún otro módulo cambia (RF-05).
- **DEC-07** (códigos HTTP): 400 `VALIDATION_ERROR`, 500 y los códigos que el PRD fija. **Tensión:** «201 · creación»
  frente a un informe que puede crear 0 candidatos; propuesta de 200 en OQ-10.
- **DEC-08** (concurrencia): unicidad por índice único (RF-04, EC-31). **Tensión:** DEC-08 dice que el choque «se
  traduce a 409»; en la importación, RN-11 lo convierte en una fila «duplicado» de un informe 200 (ver paso 7, OQ-10).
- **DEC-09** (fechas y reloj): alta con el reloj inyectado y retención por día natural de Europe/Madrid (RF-05, EC-36).
- **DEC-11** (validación y errores): las reglas de fila son las del alta, con recorte (11.3) y caracteres de control
  (11.8); mensajes sin repetir el valor (11.4); 413 `PAYLOAD_TOO_LARGE` y 415 `UNSUPPORTED_MEDIA_TYPE` (11.5);
  `withTransaction` (11.7). **Hoy 11.5 da 415 a `multipart/form-data` y el `bodyLimit` es el de Fastify (1 048 576
  bytes):** el transporte del fichero y el límite de la ruta los decide `/tech-design` (OQ-11), con un `DEC-NN` nuevo si
  cambia la convención (nota de FEAT-04).
- **DEC-12** (escrituras desde otro sitio): la importación es una escritura y hereda el 403 `CROSS_SITE_REQUEST`
  (EC-06).
- No aplica **DEC-02** (sin scripts nuevos) ni **DEC-10** (el listado no cambia; los importados aparecen por su fecha
  de alta con desempate por ID).

## Fuera de scope
De FEAT-04 «Alcance · Fuera»:
- Previsualización o validación en seco antes de importar.
- Mapeo de columnas, columnas en otro orden o con otros nombres.
- Separador `;` y codificaciones distintas de UTF-8.
- Resumen, skills y consentimiento en el CSV.
- Actualizar candidatos existentes desde el CSV (RV-27).
- Informe descargable o persistido, e historial de importaciones.
- Deshacer una importación.
- Inscribir en una oferta al importar (S-19).
- Importación asíncrona o barra de progreso.
- Plantilla CSV descargable (la cabecera esperada se muestra como texto).
- Exportación CSV y, con ella, la neutralización de fórmulas (RN-16).
- Guardar el origen del dato y el deber de informar del art. 14 RGPD (RN-14).
- Cambios en UC-09 (alta por formulario): se reutiliza tal cual.

## Open Questions

OQ-01 a OQ-05 son las PA de FEAT-04: el PRD ya está escrito con su recomendación y **no bloquean el borrador**, pero
siguen abiertas hasta que la persona responsable las ratifique. OQ-06 a OQ-09 son de producto; OQ-10 y OQ-11, técnicas
(fijan el contrato).

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | [Producto · PA-01] ¿Importación parcial o todo o nada ante una fila mala? | FEAT-04 RN-06; afecta a RF-05, RF-06, CA-08, CA-09 | Parcial: entran las válidas y el resto va al informe; 0 válidas no es un error del fichero | Recomendación aplicada, PENDIENTE DE RATIFICAR | Abierta |
| OQ-02 | [Producto · PA-02] ¿Qué columnas y con qué cabecera? | FEAT-04 RN-02; afecta a RF-02, RF-03, CA-11 | `nombre,email,telefono` exacta y en ese orden (recortada, sin distinguir mayúsculas), teléfono opcional por fila; resumen y skills fuera | Recomendación aplicada, PENDIENTE DE RATIFICAR | Abierta |
| OQ-03 | [Producto · PA-03] ¿Separador y codificación? | FEAT-04 RN-01; Excel en español exporta con `;`; afecta a RF-02, EC-08, CA-11, CA-12 | Solo coma, comillas RFC 4180, UTF-8 con BOM aceptado; un `;` se rechaza mostrando la cabecera esperada | Recomendación aplicada, PENDIENTE DE RATIFICAR | Abierta |
| OQ-04 | [Producto · PA-04] ¿Límites del fichero? | FEAT-04 RN-03; afecta a RF-02, RNF-05, CA-14 | 500 filas de datos y 1 MiB; si se pasa cualquiera, se rechaza entero | Recomendación aplicada, PENDIENTE DE RATIFICAR | Abierta |
| OQ-05 | [Producto · PA-05] ¿Consentimiento y origen de los importados? | FEAT-04 RN-09, RN-14; afecta a RF-05, Datos personales | Sin consentimiento (se registra después con UC-13); sin campo de origen; art. 14 RGPD fuera como supuesto didáctico declarado | Recomendación aplicada, PENDIENTE DE RATIFICAR | Abierta |
| OQ-06 | [Producto] Una fila válida cuyo email ya existe en la base y que además se repite en el fichero: ¿las repeticiones salen como «duplicado» o como «repetido en el fichero (fila N)»? | RN-07 y RN-08 no fijan la precedencia; RN-08 dice «entra la primera», pero aquí no entra ninguna. Cambia lo que ve el reclutador al reimportar un fichero con repeticiones (EC-34) | Todas «duplicado» con «Ver candidato»: la comparación con la base va primero y «repetido en el fichero» queda solo para emails nuevos; así reimportar da siempre «todas duplicado» | PENDIENTE | Abierta |
| OQ-07 | [Producto] (a) Un registro entrecomillado que ocupa varias líneas físicas: ¿qué «fila N» lleva, y cómo se numeran los siguientes? (b) Una línea solo con separadores (`,,`), típica al final de las exportaciones de hojas de cálculo: ¿se ignora como vacía o es una fila con errores? | RN-04 dice «línea física» y «líneas totalmente vacías»; no cubre ninguno de los dos casos. Afecta a RF-03, EC-20, EC-25, CA-10 | (a) La línea donde empieza el registro; los siguientes siguen con su línea física real. (b) Fila con errores (nombre y email obligatorios): RN-04 solo ignora las totalmente vacías | PENDIENTE | Abierta |
| OQ-08 | [Producto] Textos de los errores del fichero y precedencia cuando hay varios | FEAT-04 fija «Formato CSV inválido» y «El fichero no tiene candidatos», pero no el de la cabecera ni el del límite; UC-20 · E1-E3 piden «mensaje útil». Afecta a RF-02, CA-11 a CA-14 | Un solo error por fichero, en este orden: tamaño → codificación → formato CSV → cabecera → sin filas → número de filas. Textos: «Formato CSV inválido: el fichero debe estar en UTF-8 y separado por comas.» (+ « Revisa la línea N.» si aplica); «La cabecera no es válida. La primera línea debe ser exactamente: nombre,email,telefono»; «El fichero no tiene candidatos.»; «El fichero tiene más de 500 filas de candidatos. Divídelo en ficheros más pequeños.»; «El fichero ocupa más de 1 MiB. Divídelo en ficheros más pequeños.». Motivos de fila: los `message` del alta, «Número de columnas incorrecto.», «Duplicado» y «Repetido en el fichero (fila N)» | PENDIENTE | Abierta |
| OQ-09 | [Producto] Detalles de la pantalla | FEAT-04 y UC-20 no fijan la ruta, el título, cuándo está activo «Importar», qué pasa con el fichero tras un error ni si «Ver candidato» hace perder el informe (no se persiste, RN-12). Afecta a RF-01, EC-02, EC-03, EC-06, Flujos 2 y 4 | Ruta `/candidates/import`; título «Importar candidatos · ATS» y `h1` «Importar candidatos»; «Importar CSV» como enlace junto a «Nuevo candidato»; «Importar» deshabilitado sin fichero y mientras importa; tras un error se conserva el fichero elegido para reintentar; «Ver candidato» abre la ficha en una pestaña nueva (`rel="noopener"`) para no perder el informe; el foco va al mensaje de error o al título del informe | PENDIENTE | Abierta |
| OQ-10 | [Técnica · contrato] Ruta, código de éxito y códigos de error de la importación | DEC-07 dice «201 · creación» y DEC-08 «el choque se traduce a 409», pero el informe puede crear 0 y convierte el choque en una fila; DEC-11.4 fija `details` como `[{ field, message }]`. Los CA citan códigos (DEC-07) | `POST /api/candidates/import`; 200 con el informe siempre que el fichero sea válido (también con 0 creados); E1, E2 y más de 500 filas → 400 `VALIDATION_ERROR` con un solo `details: [{ field: 'file', message }]` (la línea va en el texto, sin claves nuevas); más de 1 MiB → 413 `PAYLOAD_TOO_LARGE`; E4 → 500 `INTERNAL_ERROR`; duplicados del informe con `existingId` como el 409. `/tech-design` anota la aclaración de DEC-07 y DEC-08 | PENDIENTE | Abierta |
| OQ-11 | [Técnica · contrato] ¿Sobre qué se mide el 1 MiB? | El `bodyLimit` de la API es el de Fastify, 1 048 576 bytes **para todo el cuerpo** (`apps/api/src/app.ts`, `apps/api/test/http/error-handler.test.ts`): con cualquier envoltorio (JSON escapado, *boundaries* de multipart) un fichero de 1 MiB exacto daría 413 antes de validarse y CA-14 fallaría. El transporte (hoy multipart da 415, DEC-11.5, DEC-12) es de `/tech-design` | El límite se mide sobre los bytes del fichero tal como lo eligió el reclutador (BOM incluido): 1 048 576 se acepta y 1 048 577 se rechaza. `/tech-design` elige el transporte y el límite de cuerpo de esa ruta para cumplirlo (con `DEC-NN` si cambia DEC-11.5); la web comprueba también `File.size` antes de enviar, solo para la experiencia | PENDIENTE | Abierta |

> Un PRD con Open Questions abiertas **no pasa** a diseño.

## Decisiones tomadas

Ninguna todavía.

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|

## Criterios de aceptación

Reloj inyectado en 2026-10-12T09:00:00Z salvo que se diga otra cosa (DEC-09). Todos los datos son inventados. Códigos
HTTP según la propuesta de OQ-10.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-20 · P / RF-05, RF-06 | que no existen `lucia.ferrer@example.com`, `marcos.vidal@example.com` ni `noa.serra@example.com` | importo un CSV con la cabecera y las filas `Lucía Ferrer Prat,lucia.ferrer@example.com,+34 600 000 012`, `Marcos Vidal Roca, Marcos.Vidal@Example.com ,` y `Noa Serra Gil,noa.serra@example.com,+34 600 000 014` | se crean 3 candidatos con los emails en minúsculas y recortados, Marcos sin teléfono, los tres sin consentimiento (fecha, versión y retirada vacías) y con fin de retención 2027-04-12; el informe muestra «3 creados», 0 duplicados, 0 filas con error y no lista las creadas |
| CA-02 | UC-20 · P / RF-01 | el listado de candidatos | pulso «Importar CSV», elijo el fichero de CA-01 y pulso «Importar» | veo la pantalla «Importar candidatos» con la cabecera `nombre,email,telefono` como texto y un selector con `<label>` que filtra `.csv`; al pulsar, «Importar» queda deshabilitado y se anuncia «Importando…» con `role="status"` hasta que aparece el informe, anunciado igual, con «Importar otro fichero» e «Ir al listado»; «Ir al listado» muestra a los 3 creados |
| CA-03 | UC-20 · P / RF-02 | el CSV de CA-01 guardado en UTF-8 con BOM y finales CRLF | lo importo | la cabecera se reconoce y el resultado es el mismo que sin BOM: 3 creados |
| CA-04 | UC-20 · A1 / RF-04, RF-06 | que existe «Ana Gil Mora» con `ana.gil@example.com` y teléfono `+34 600 000 020` | importo `Ana G.,ANA.GIL@example.com,+34 600 000 021` (línea 2) y una fila nueva | 1 creado y 1 duplicado; la fila 2 sale como «duplicado» con «Ver candidato», que lleva a la ficha de Ana por su ID; la respuesta solo lleva su ID, no su nombre ni su email; la ficha de Ana no cambia (nombre, teléfono, consentimiento y fin de retención) |
| CA-05 | UC-20 · A1 / RF-04 | que ya importé el CSV de CA-01 | lo importo otra vez | 0 creados y las 3 filas «duplicado»; el número de candidatos y sus fichas no cambian |
| CA-06 | UC-20 · A1 / RF-04, RF-05 | dos CSV distintos que comparten la fila `Pau Roig Mas,pau.roig@example.com,` (email nuevo) | los importo a la vez | existe un solo candidato con ese email; en un informe la fila es «creado» y en el otro «duplicado»; ninguna respuesta es 500 |
| CA-07 | UC-20 · A2 / RF-04, RF-06 | un CSV con `pau.roig@example.com` en la línea 2 y `Pau.Roig@example.com` en la 4, ambas válidas; y otro con la línea 2 inválida (nombre de 1 carácter) y la 3 válida, con el mismo email | los importo | en el primero entra la línea 2 y la 4 sale «repetido en el fichero (fila 2)»; en el segundo, la línea 2 sale con su error y entra la 3 |
| CA-08 | UC-20 · A3 / RF-03, RF-06 | un CSV con `Lucía Ferrer Prat,lucia.ferrer@example.com,` en la línea 2, `,ana.gil@,+34 600 000 030` en la 3 y una fila de 4 campos en la 4 | lo importo | entra la línea 2; la «fila 3» sale con dos errores (nombre: obligatorio; email: formato no válido) y la «fila 4» con «número de columnas incorrecto»; ni el informe ni la respuesta contienen `ana.gil@` ni ningún otro valor |
| CA-09 | UC-20 · A3 / RF-03, RF-05, RF-06 | un CSV cuyas 3 filas son inválidas | lo importo | la API responde 200 con el informe: 0 creados, 0 duplicados, 3 filas con error; no es un error del fichero y no se crea nada |
| CA-10 | UC-20 · A3 / RF-03 | un CSV con las líneas 3 y 6 en blanco y una fila inválida en la línea 7 | lo importo | la fila inválida sale como «fila 7»; las líneas en blanco no cuentan en ningún recuento |
| CA-11 | UC-20 · E1 / RF-02 | tres CSV con la cabecera `nombre;email;telefono`, `email,nombre,telefono` y `nombre,email,telefono,resumen`, con filas válidas | los importo | cada uno se rechaza entero con 400 y el mensaje con la cabecera esperada `nombre,email,telefono`, sin informe y con 0 creados; con la cabecera ` Nombre , EMAIL,Telefono` se importa |
| CA-12 | UC-20 · E1 / RF-02 | un CSV en Latin-1 con «Muñoz», un PNG renombrado a `.csv` y un CSV con unas comillas sin cerrar desde la línea 4 | los importo | los tres se rechazan con «Formato CSV inválido» (el tercero con la línea 4), con 0 creados y sin ningún contenido del fichero en el mensaje |
| CA-13 | UC-20 · E2 / RF-02 | un fichero de 0 bytes, uno solo con BOM, uno solo con la cabecera y uno con la cabecera y líneas en blanco | los importo | los cuatro dan «El fichero no tiene candidatos», sin informe y con 0 creados |
| CA-14 | UC-20 · E3 / RF-02 | CSV de 500 y de 501 filas de datos válidas y nuevas; ficheros de 1 048 576 y de 1 048 577 bytes con ≤ 500 filas | los importo | 500 → 500 creados; 501 → rechazo entero con el límite de 500 filas y 0 creados; 1 048 576 bytes → no se rechaza por tamaño (se procesa y da su informe); 1 048 577 → 413 con el límite de 1 MiB y 0 creados |
| CA-15 | UC-20 · E4 / RF-05 | que la escritura en la base falla al guardar la segunda fila válida de un CSV de 3 (*trigger* de fallo) | lo importo y después, sin el fallo, lo reintento | la primera vez, 500 `INTERNAL_ERROR` en el envelope sin datos personales y 0 creados (ni siquiera la primera fila); la web muestra el error con `role="alert"` y conserva el fichero; el reintento crea los 3 una sola vez |
| CA-16 | UC-20 · E4 / RF-01 | que la API no responde | pulso «Importar» | veo un error con `role="alert"`; el fichero sigue elegido y «Importar» vuelve a estar activo para reintentar |
| CA-17 | UC-20 · P, E1, E2, E3, E4 / RF-06, RNF-02, RNF-03 | el logger capturado en los tests y ficheros con los datos de CA-01 y CA-04 | hago la importación de CA-01 y cada error de CA-08, CA-11, CA-12, CA-13, CA-14 y CA-15 | ni los logs, ni los `message` y `details` de error, ni el informe contienen «Lucía Ferrer Prat», `lucia.ferrer@example.com`, `+34 600 000 012` ni ningún otro valor del fichero; no se ha creado ningún fichero en el directorio temporal ni en `data/` |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.

---
_v1 (2026-10-12): borrador de `/prd-writer` con 11 Open Questions (OQ-01 a OQ-05, PA de FEAT-04 con la recomendación
aplicada y pendientes de ratificar; OQ-06 a OQ-09 de producto; OQ-10 y OQ-11 técnicas). Estado: Draft._
