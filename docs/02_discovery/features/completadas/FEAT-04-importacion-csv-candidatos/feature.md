---
id: FEAT-04
titulo: "Importación CSV de candidatos"
estado: entregada        # shaping | priorizada | en delivery | entregada
prioridad: null          # alta | media | baja (la fija la persona)
idea_origen: IDEA-004
modulos_afectados: [candidatos]
fecha: 2026-10-12
owner: "persona responsable del taller"
---

# FEAT-04 — Importación CSV de candidatos

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.

**Fuentes de esta feature.** `RV-NN` y `S-NN`: `docs/02_discovery/reglas-validadas.md`. «RT (Qn)»: respuesta del
responsable técnico del 2026-10-12 a la pregunta n del análisis (R confirmadas con su fuente y P de detalle aprobadas
con la recomendación). «† PA-0N»: respuesta de producto que se aplicó con la recomendación y que el responsable técnico
**ratificó el 2026-10-13** (ver «Preguntas abiertas»).

## Qué
El reclutador sube un fichero CSV con una lista de candidatos y el sistema da de alta las filas válidas, descarta los
duplicados sin tocar a nadie y le enseña un informe con qué filas entraron, cuáles no y por qué (IDEA-004).

## Por qué
Un reclutador que vuelve de una feria de empleo, o que trae una lista de otra herramienta, hoy tiene que teclear los
candidatos uno a uno con el formulario (UC-09). La importación lo ahorra, pero solo sirve si deja claro el resultado de
cada fila (`docs/02_discovery/ideas/completadas/004-importacion-csv-candidatos.md`). Es además la feature en vivo C del taller:
enseña los casos límite y los tests guiados por casos (`docs/07_architecture_principles/QUALITY-GATES.md` §3).

## Alcance
- **Dentro:** botón «Importar CSV» en el listado de candidatos y pantalla propia con la cabecera esperada; subida de
  un fichero; validación del fichero (formato, cabecera y límites) y de cada fila con las reglas del alta;
  deduplicación contra la base y dentro del fichero; alta de las filas válidas sin consentimiento y con su retención
  calculada, en una sola transacción; informe en pantalla. Módulo `candidatos`, en API y web, más un e2e con CSV
  inventados.
- **Fuera** (RT, Q33 salvo que se indique otra):
  - previsualización o validación en seco antes de importar (Q4);
  - mapeo de columnas, columnas en otro orden o con otros nombres (Q6†);
  - separador `;` (el de Excel en español) y codificaciones distintas de UTF-8 (Q7, Q8†);
  - resumen, skills y consentimiento en el CSV (Q5†, Q16†);
  - actualizar candidatos existentes desde el CSV (RV-27);
  - informe descargable o persistido, e historial de importaciones (Q19);
  - deshacer una importación;
  - inscribir en una oferta al importar (S-19, Q34);
  - importación asíncrona o barra de progreso;
  - plantilla CSV descargable (se muestra la cabecera esperada como texto);
  - exportación CSV (y, con ella, la neutralización de fórmulas, Q28);
  - guardar el origen del dato y el deber de informar del art. 14 RGPD (Q18†).

## Actores y roles
- **Reclutador**: único rol de la aplicación, sin login; lanza la importación (DEC-04; RT, Q1).
- **Candidato**: interesado cuyos datos llegan en el fichero; no usa la aplicación (`docs/05_modules/candidatos/functional.md`
  §Actores; RT, Q1).
- No hay procesos programados (RT, Q1).

## Casos de uso

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-20 | Importar candidatos desde un CSV | candidatos | P, A1, A2, A3, E1, E2, E3, E4 | `docs/05_modules/candidatos/casos-de-uso/UC-20-importar-candidatos-csv.md` | Nuevo |

UC-09 (alta por formulario) **no se modifica**: UC-20 reutiliza sus reglas por cita (RT, Q2).

## Reglas de negocio
- **RN-01 · Formato del fichero.** UTF-8; un BOM inicial se acepta y se ignora; separador coma; comillas dobles según
  RFC 4180; finales de línea LF o CRLF. Una secuencia que no es UTF-8, un fichero binario o unas comillas sin cerrar
  rechazan el fichero entero con «Formato CSV inválido» (y la línea, si aplica). _(† PA-03; RT, Q7, Q32)_
- **RN-02 · Cabecera.** Obligatoria y exacta: `nombre,email,telefono`, en ese orden; cada nombre se compara recortado y
  sin distinguir mayúsculas. Si falta o sobra una columna, va en otro orden o se repite (incluido un fichero separado
  por `;`), se rechaza el fichero entero con un mensaje que muestra la cabecera esperada. _(† PA-02; RT, Q6)_
- **RN-03 · Límites.** Como mucho 500 filas de datos y 1 MiB; si se supera cualquiera, se rechaza el fichero entero y
  no se importa nada. _(† PA-04)_
- **RN-04 · Líneas y numeración.** Las líneas totalmente vacías (incluida la final) se ignoran y no cuentan como filas.
  La «fila N» del informe es la línea física del fichero, con la cabecera como línea 1. Un fichero vacío o solo con la
  cabecera se rechaza con «El fichero no tiene candidatos». _(RT, Q10, Q23)_
- **RN-05 · Validación de cada fila.** Las reglas del alta: nombre y apellidos de 2 a 100 caracteres y email
  obligatorios; teléfono opcional (vacío = sin teléfono) con «+» opcional y 6-20 caracteres entre dígitos, espacios,
  guiones y paréntesis; email estándar de ≤ 254; recorte previo (solo espacios = vacío); sin caracteres de control. Una
  fila con un número de campos distinto del de la cabecera es un error de esa fila («número de columnas incorrecto»).
  Se informan todos los errores de la fila, uno por campo. _(RV-09, S-03, DEC-11.8; RT, Q11, Q12, Q21)_
- **RN-06 · Importación parcial.** Entran las filas válidas y no duplicadas; las demás van al informe. Si ninguna es
  válida, no es un error del fichero: informe con 0 creados. _(† PA-01; RT, Q24)_
- **RN-07 · Email que ya existe.** El email se normaliza (recortado y en minúsculas) y se compara sin distinguir
  mayúsculas; si ya existe, la fila no sobrescribe nada y sale como «duplicado» con un enlace «Ver candidato» a la ficha
  existente, sin mostrar sus datos. _(RV-10, RV-27; RT, Q14)_
- **RN-08 · Email repetido dentro del fichero.** Solo entre filas válidas: entra la primera; las siguientes salen como
  «repetido en el fichero (fila N)», con N la fila de la primera. _(RT, Q15)_
- **RN-09 · Sin consentimiento.** Todos los importados entran sin consentimiento para futuros procesos; se registra
  después, ficha a ficha, con UC-13. El CSV no puede traerlo: no tiene columna (RN-02) y no prueba qué versión del texto
  vio el candidato. _(† PA-05; RV-11, S-07, RGPD §2)_
- **RN-10 · Retención.** La calcula el sistema: alta + 6 meses, por día natural en Europe/Madrid, en la misma
  transacción que el alta. _(RV-12, RV-13, RV-25, S-06, RGPD §3; RT, Q17)_
- **RN-11 · Escritura atómica y unicidad.** Las filas válidas se escriben todas en una sola transacción: si la base
  falla, no se crea ninguna. La unicidad del email la garantiza el índice único: un choque con otra importación
  simultánea sale como «duplicado», nunca como error interno. En la web, el botón «Importar» se deshabilita mientras se
  importa. _(DEC-06, DEC-08, DEC-11.7, RV-27; RT, Q25, Q26)_
- **RN-12 · Informe.** Solo en pantalla, sin persistir: recuentos de creados, duplicados y filas con error, y la lista
  de filas no importadas con número de fila, campo y motivo en castellano, sin repetir el valor recibido; no lista los
  creados. Al final ofrece «Importar otro fichero» e «Ir al listado». _(DEC-11.4, RGPD §6.1, principio de diseño 5; RT,
  Q19, Q20, Q22, Q35)_
- **RN-13 · Nada del fichero se queda.** Ni copias temporales ni contenido del fichero o del informe en logs, mensajes
  de error o respuestas que no lo necesitan. _(RGPD §6.1 y §6.5; RT, Q19)_
- **RN-14 · Sin origen del dato.** No se guarda ningún campo de origen («importado por CSV») y el deber de informar del
  art. 14 RGPD (datos no obtenidos del interesado) queda fuera del ATS como supuesto didáctico declarado. _(† PA-05;
  RGPD §1, minimización)_
- **RN-15 · Entrada y tipo de fichero.** Se lanza desde el botón «Importar CSV» del listado de candidatos. El selector
  filtra `.csv`, pero se valida el contenido (RN-01, RN-02), no la extensión. _(RT, Q3, Q31)_
- **RN-16 · Valores tal cual.** Un valor que empieza por `=`, `+`, `-` o `@` se guarda como texto, sin neutralizarlo
  (no hay exportación y la web escapa el HTML); el riesgo queda anotado para una futura exportación. _(RT, Q28; S-03:
  el teléfono puede empezar por «+»)_

## Invariantes
- **INV-01:** una importación nunca modifica un candidato existente. _(RV-27)_
- **INV-02:** después de cualquier importación, nunca hay dos candidatos con el mismo email normalizado. _(RV-10,
  DEC-08)_
- **INV-03:** cada fila de datos acaba en una sola categoría (creada, duplicada o con error): creados + duplicados +
  filas con error = filas de datos del fichero. _(RN-04, RN-06; RT, Q10)_
- **INV-04:** todo candidato importado tiene el consentimiento sin registrar y un fin de retención calculado por el
  sistema; ningún valor del fichero lo fija. _(RV-11, RV-12, RV-13; † PA-05)_
- **INV-05:** un fichero rechazado (formato, cabecera, límites o sin filas) o un fallo de la base no crea ningún
  candidato: nunca queda una importación a medias. _(RN-01 a RN-04, RN-11; DEC-06)_
- **INV-06:** el contenido del fichero (nombres, emails, teléfonos) no aparece en logs, en mensajes de error ni en el
  informe, y no queda copia del fichero. _(RGPD §6.1 y §6.5)_
- **INV-07:** la pantalla de importación siempre está en un estado explícito: inicial, importando, error del fichero o
  informe; cada error es útil y se anuncia con `role="alert"` o `role="status"`. _(principios de diseño 2, 3 y 4)_

## Datos y conceptos clave
- **Fichero de importación:** CSV de entrada; no se guarda (RN-13).
- **Fila de datos:** cada línea no vacía tras la cabecera; su número es la línea física (RN-04).
- **Informe de importación:** resultado en pantalla: creados, duplicados («duplicado» o «repetido en el fichero») y
  filas con error; no se persiste (RN-12).
- **Datos personales** (`docs/RGPD.md` §1): nombre y apellidos, email y teléfono del fichero; el sistema añade el fin de
  retención. **Para qué:** dar de alta al candidato como el formulario. **Base jurídica y plazo:** los del alta sin
  inscripción ni consentimiento, 6 meses desde el alta (RV-13, RGPD §2 y §3). Sin campos nuevos ni migración de datos
  (RN-14). Lo revisará el agente `datos-personales-auditor` en `/reviewer`.
- **Datos de ejemplo** (inventados, RGPD §6.3 y RV-26; RT, Q30): `Lucía Ferrer Prat,lucia.ferrer@example.com,+34 600 000 012`.

## Casos límite
- **Input inválido:** BOM al inicio → se ignora (RN-01). Separador `;` → cabecera inválida, se rechaza el fichero
  (RN-02). Codificación que no es UTF-8 o fichero binario → «Formato CSV inválido» (RN-01). Comillas sin cerrar → se
  rechaza el fichero con la línea (RN-01). Cabecera con una columna de más, de menos, desordenada o repetida → se
  rechaza el fichero (RN-02). Fila con columnas de más o de menos → error de esa fila (RN-05). Email o teléfono mal
  formados, nombre de un carácter, carácter de control o salto de línea entrecomillado en un campo → error de esa fila,
  con todos sus errores (RN-05).
- **Boundary:** fichero vacío o solo con la cabecera → «El fichero no tiene candidatos» (RN-04). 1 fila → se importa.
  500 filas → se importa; 501 → se rechaza el fichero entero (RN-03). 1 MiB → se acepta; 1 MiB + 1 byte → se rechaza
  (RN-03). Nombre de 2 y de 100 caracteres → válido; de 1 y de 101 → error (RN-05). Email de 254 → válido; de 255 →
  error (RN-05). Líneas en blanco intercaladas y al final → se ignoran sin desplazar la numeración física (RN-04). Todas
  las filas inválidas → informe con 0 creados (RN-06).
- **Fallo de dependencia:** la base ocupada o caída al guardar → error genérico sin datos y ningún candidato creado
  (RN-11, UC-20 · E4). La API caída vista desde la web → error en la pantalla y el reclutador puede reintentar
  (INV-07).
- **Concurrencia:** doble clic en «Importar» → el botón está deshabilitado mientras se importa (RN-11). Dos
  importaciones simultáneas con el mismo email → entra uno y el otro sale como «duplicado», sin error interno (RN-11,
  DEC-08).
- **Datos corruptos o legacy:** los emails existentes ya están en minúsculas y con unicidad en la base desde la
  migración 002, así que la comparación vale sin migrar nada (`docs/05_modules/candidatos/functional.md`; RT, Q29).
  Datos a medio importar → imposibles por la transacción única (INV-05).
- **Seguridad:** el contenido del fichero no va a logs, errores ni respuestas de más (INV-06). Fichero enorme → se
  rechaza por los límites (RN-03; DEC-11.5). Escritura desde otra web → 403 heredado (DEC-12). HTML en un nombre → se
  guarda como texto y la web lo escapa (RN-16). Fórmulas (`=`, `+`, `-`, `@`) → se guardan tal cual; el riesgo se
  anota para la exportación, que queda fuera (RN-16). El enlace «Ver candidato» de un duplicado no muestra datos del
  existente (RN-07).
- **Idempotencia:** reimportar el mismo CSV → 0 creados, todas las filas que entraron salen como «duplicado» y nada
  cambia (RV-27, RV-10; RT, Q27). Reintentar tras un fallo de la base → seguro, porque no quedó nada a medias (RN-11).

## Módulos afectados
- **`candidatos`:** capacidad nueva «Importar candidatos desde un CSV» (UC-20), en API y web; reutiliza la validación,
  la normalización y el cálculo de la retención del alta (UC-09). Sin cambios en el esquema de datos previstos por el
  shaping (RN-14).
- **`ofertas` e `inscripciones`:** no cambian (importar no inscribe; S-19).

## Dependencias, riesgos y supuestos
- **Dependencias:** FEAT-02 entregada (alta de candidato, UC-09; consentimiento, UC-13; fórmula de retención).
- **Riesgos:**
  - Excel en español exporta con `;`: con RN-02, ese fichero se rechaza. El mensaje debe mostrar la cabecera esperada
    para que no parezca un fallo (PA-03).
  - La inyección de fórmulas se guarda tal cual y reaparecerá si algún día hay exportación (RN-16).
  - Las 5 respuestas de producto (PA-01 a PA-05) se ratificaron el 2026-10-13 tal como estaban: el alcance no cambia.
- **Nota para `/tech-design`** (no es una decisión de producto): hoy la API responde 415 a `multipart/form-data` y a
  `application/x-www-form-urlencoded` (DEC-11.5, DEC-12), y 413 por encima del límite de cuerpo. Cómo viaja el fichero
  de la web a la API (y cómo casa el límite de 1 MiB con ese transporte) lo decide el diseño técnico, con un `DEC-NN`
  nuevo si cambia la convención.
- **Supuestos confirmados:** todas las preguntas R con su fuente y todas las P de detalle con la recomendación (RT,
  2026-10-12). PA-01 a PA-05, ratificadas el 2026-10-13 (Preguntas abiertas).

## Criterios de aceptación
- [ ] Dado un CSV válido con 3 filas de candidatos nuevos, cuando el reclutador lo importa, entonces se crean 3
      candidatos sin consentimiento, con fin de retención a alta + 6 meses, y el informe muestra «3 creados».
- [ ] Dado un CSV con una fila cuyo email ya existe en otra capitalización, cuando se importa, entonces esa fila sale
      como «duplicado» con enlace a la ficha existente y el candidato existente no cambia.
- [ ] Dado un CSV con dos filas válidas con el mismo email, cuando se importa, entonces entra la primera y la segunda
      sale como «repetido en el fichero (fila N)».
- [ ] Dado un CSV con una fila válida y otra con el email mal formado y el nombre vacío, cuando se importa, entonces
      entra la válida y la otra sale con su número de fila y los dos errores, sin repetir los valores.
- [ ] Dado un CSV con la cabecera separada por `;`, en otro orden o con una columna de más, cuando se importa, entonces
      se rechaza el fichero entero con la cabecera esperada y no se crea ningún candidato.
- [ ] Dado un CSV con 501 filas de datos (o de más de 1 MiB), cuando se importa, entonces se rechaza entero y no se
      crea ningún candidato; con 500 filas se importa.
- [ ] Dado un CSV vacío o solo con la cabecera, cuando se importa, entonces sale «El fichero no tiene candidatos».
- [ ] Dado un CSV en UTF-8 con BOM, cuando se importa, entonces la cabecera se reconoce y se importa como sin BOM.
- [ ] Dado un fallo de la base al guardar, cuando se importa, entonces no se crea ningún candidato y el error no
      contiene datos personales.
- [ ] Dado un CSV ya importado, cuando se importa otra vez, entonces el informe muestra 0 creados y todas esas filas
      como «duplicado».
- [ ] Ningún log, mensaje de error ni respuesta contiene nombres, emails ni teléfonos del fichero.

## Preguntas abiertas
- **PA-01 (Q13) · Importación parcial.** ¿Entran las filas buenas y se informa del resto, o el fichero falla entero
  ante una fila mala? Recomendación aplicada: parcial (RN-06), porque la idea pide saber «qué filas entraron, cuáles no»
  y RV-27 habla de «informe». — _Estado: ratificada por el responsable técnico el 2026-10-13_
- **PA-02 (Q5 + Q6) · Columnas y cabecera.** ¿Qué columnas y con qué cabecera? Recomendación aplicada: `nombre`,
  `email` y `telefono` (teléfono opcional por fila), cabecera obligatoria y exacta en ese orden (RN-02); resumen y
  skills, fuera. — _Estado: ratificada por el responsable técnico el 2026-10-13_
- **PA-03 (Q8) · Separador y codificación.** Recomendación aplicada: solo coma, comillas RFC 4180 y UTF-8 con BOM
  aceptado (RN-01); un fichero con `;` se rechaza con la cabecera esperada. Es la pregunta más probable en la demo,
  porque Excel en español exporta con `;`. — _Estado: ratificada por el responsable técnico el 2026-10-13_
- **PA-04 (Q9) · Límites.** Recomendación aplicada: 500 filas de datos y 1 MiB como máximo; si se pasa, se rechaza el
  fichero entero (RN-03). — _Estado: ratificada por el responsable técnico el 2026-10-13_
- **PA-05 (Q16 + Q18) · Consentimiento y origen.** Recomendación aplicada: los importados entran sin consentimiento
  (RN-09; RV-11, S-07, RGPD §2); no se guarda el origen del dato y el art. 14 RGPD queda fuera como supuesto didáctico
  declarado (RN-14). — _Estado: ratificada por el responsable técnico el 2026-10-13_

## Handoff a delivery
**Una sola HU fullstack** (decisión de la persona responsable del 2026-10-09, IDEA-004): «Importar candidatos desde
un CSV», que cubre UC-20 entero (P, A1-A3 y E1-E4). Valor: el reclutador da de alta una lista de golpe y sabe qué
entró y qué no. Depende solo de FEAT-02, ya entregada.

Estimación orientativa para `/task-planner`: **unas 11 tasks** (máximo de QUALITY-GATES: 15).
- **API, unas 6:**
  1. Lector y validador del fichero: formato, cabecera y límites.
  2. Validación de cada fila con las reglas del alta.
  3. Servicio con la deduplicación y la transacción única.
  4. Ruta, con los límites de tamaño y de filas.
  5. `[adversarial]` de fichero y filas.
  6. `[adversarial]` de concurrencia, fallo de la base y no fuga a logs.
- **Web, unas 3:** pantalla de importación con sus estados, componente del informe y tests (incluido uno
  `[adversarial]`).
- **e2e, 1-2:** fixtures CSV inventados y el flujo de la demo.

Lo que la sacaría de 15 tasks (por eso está fuera): el separador `;`, la previsualización, skills o resumen en el CSV,
el informe persistido o descargable y el campo de origen con migración.

## Cierre
Entregada en sprint-03 el 2026-10-12, en la rama `vivo/C` (solución de referencia de la feature en vivo C): HU-07
(merge `0bd38ac`, module-sync `ef730fc`). Review «Aprobado con observaciones» y auditoría del sprint «Aprobado con
observaciones» (`docs/10_audits/sprints/sprint-03-AUDIT.md`). PA-01 a PA-05, ratificadas por el responsable
técnico el 2026-10-13.
