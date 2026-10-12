---
id: UC-20
titulo: "Importar candidatos desde un CSV"
modulo: candidatos
actor: reclutador
estado: borrador
feature: FEAT-04
hus: []
---

# UC-20 — Importar candidatos desde un CSV

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

Las reglas `RN-NN` son las de FEAT-04 (`docs/02_discovery/features/FEAT-04-importacion-csv-candidatos/feature.md`).
Las marcadas con † están **pendientes de ratificar** por la persona responsable, con la recomendación ya aplicada.

## Objetivo
El reclutador da de alta de una vez a los candidatos de una lista (de una feria de empleo o de otra herramienta)
subiendo un fichero CSV, y sabe qué filas entraron, cuáles no y por qué (IDEA-004).

## Actor y disparador
- **Actor principal:** reclutador (DEC-04). El candidato es el interesado cuyos datos se tratan; no usa la aplicación.
- **Disparador:** el reclutador pulsa «Importar CSV» en el listado de candidatos.

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador pulsa «Importar CSV» en el listado de candidatos (RN-15).
2. El sistema muestra la pantalla de importación con la cabecera esperada como texto (`nombre,email,telefono`) y un
   selector de fichero que filtra `.csv` (RN-02†, RN-15).
3. El reclutador elige un fichero y pulsa «Importar»; el botón queda deshabilitado mientras se importa (RN-11).
4. El sistema valida el fichero entero: tamaño y número de filas, codificación, formato CSV y cabecera; ignora las
   líneas totalmente vacías (RN-01†, RN-02†, RN-03†, RN-04).
5. El sistema valida cada fila con las reglas del alta y deduplica por email normalizado, contra la base y dentro del
   fichero (RN-05, RN-07, RN-08).
6. El sistema crea los candidatos de las filas válidas, sin consentimiento y con su fin de retención calculado (alta +
   6 meses), todos en una sola transacción (RN-06†, RN-09†, RN-10, RN-11).
7. El sistema muestra el informe: número de creados, de duplicados y de filas con error, y la lista de filas no
   importadas con su número de fila, el campo y el motivo; ofrece «Importar otro fichero» e «Ir al listado» (RN-12).

## Flujos alternativos
- **A1 — Email que ya existe en la base** (desde el paso 5): una fila válida trae un email que ya tiene otro
  candidato, sin distinguir mayúsculas → la fila no se importa ni modifica al existente; sale en el informe como
  «duplicado» con un enlace «Ver candidato» a la ficha existente, sin mostrar sus datos. Continúa con el resto de filas
  (RN-07; RV-27, RV-10).
- **A2 — Email repetido dentro del fichero** (desde el paso 5): varias filas válidas comparten email normalizado → se
  importa la primera válida; las siguientes salen como «repetido en el fichero (fila N)», con N la fila de la primera.
  Continúa con el resto de filas (RN-08).
- **A3 — Filas inválidas** (desde el paso 5): una fila incumple las reglas del alta o tiene un número de campos
  distinto del de la cabecera → no se importa y sale en el informe con todos sus errores (campo y motivo, sin repetir
  el valor); el resto de filas sigue. Si ninguna fila es válida, el informe muestra 0 creados y no es un error del
  fichero (RN-05, RN-06†).

## Excepciones
- **E1 — Fichero ilegible** (en el paso 4): no es UTF-8 (o es binario), tiene unas comillas sin cerrar o la cabecera
  no es exactamente `nombre,email,telefono` (falta o sobra una columna, va en otro orden, se repite o el separador es
  `;`) → error del fichero con un mensaje útil (con la línea, si aplica) y sin datos personales; no se importa ninguna
  fila (RN-01†, RN-02†, RN-15).
- **E2 — Fichero sin candidatos** (en el paso 4): el fichero está vacío o solo trae la cabecera (y líneas vacías) →
  «El fichero no tiene candidatos»; no se importa nada ni se muestra informe (RN-04).
- **E3 — Fichero demasiado grande** (en el paso 4): más de 500 filas de datos o más de 1 MiB → error que indica el
  límite; no se importa ninguna fila (RN-03†; DEC-11.5).
- **E4 — Fallo al guardar** (en el paso 6): la base de datos no responde o está ocupada → error genérico en el envelope
  sin datos personales; no se crea ningún candidato y el reintento es seguro gracias a la deduplicación (RN-11; DEC-01,
  DEC-06).

## Reglas de negocio
- RN-01† formato: UTF-8 (BOM aceptado), coma, comillas RFC 4180, LF o CRLF.
- RN-02† cabecera obligatoria y exacta `nombre,email,telefono`.
- RN-03† como mucho 500 filas de datos y 1 MiB; si se supera, se rechaza el fichero entero.
- RN-04 líneas vacías ignoradas; la fila N es la línea física; sin filas de datos, se rechaza el fichero.
- RN-05 cada fila se valida como el alta (RV-09, S-03, RV-10, DEC-11.8), con todos sus errores.
- RN-06† importación parcial: entran las filas válidas y el resto va al informe.
- RN-07 email existente → «duplicado», sin sobrescribir (RV-27).
- RN-08 email repetido en el fichero → entra la primera fila válida.
- RN-09† los importados entran sin consentimiento.
- RN-10 retención calculada por el sistema: alta + 6 meses (RV-12, RV-13, S-06).
- RN-11 escritura de las filas válidas en una sola transacción; unicidad por índice (DEC-06, DEC-08).
- RN-12 informe solo en pantalla, sin repetir valores ni listar los creados (DEC-11.4, RGPD §6.1).
- RN-13 del fichero no se guarda nada, ni en logs (RGPD §6.1 y §6.5).
- RN-14† no se guarda el origen del dato; el art. 14 RGPD queda fuera.
- RN-15 se valida el contenido, no la extensión; se lanza desde el listado de candidatos.

## Postcondiciones
- **Éxito:** existe un candidato nuevo por cada fila válida no duplicada, con email normalizado, sin consentimiento y
  con fin de retención; ningún candidato existente ha cambiado; creados + duplicados + filas con error = filas de datos.
- **Fallo (E1-E4):** no existe ningún candidato nuevo ni se ha modificado ninguno; del fichero no queda nada.

## Datos personales
Lee del fichero y escribe nombre y apellidos, email y teléfono, y el fin de retención calculado (RGPD §1). Base
jurídica: la misma que el alta sin inscripción ni consentimiento (RGPD §2), con retención de 6 meses desde el alta
(RV-13, RGPD §3). No se guarda el origen del dato y el deber de informar del art. 14 RGPD queda fuera como supuesto
didáctico (RN-14†). Ni el fichero ni el informe se persisten, y su contenido no va a logs ni a errores (RGPD §6.1 y §6.5).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | | | |
| A1 | | | |
| A2 | | | |
| A3 | | | |
| E1 | | | |
| E2 | | | |
| E3 | | | |
| E4 | | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
