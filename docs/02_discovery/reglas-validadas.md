# Reglas de negocio validadas del ATS

- **Fuente:** propuesta de ingeniería validada en bloque por la persona que decide el producto el 2026-10-06
  («aprobadas las reglas con tus recomendaciones»).
- **Uso:** el shaping de cada feature cita estas reglas como fuente (`RV-NN`) y las convierte en sus `RN-NN`, casos
  de uso e invariantes. Una pregunta de shaping que ya responda una `RV-NN` no se vuelve a hacer; las que no estén
  cubiertas se preguntan.
- **Cambios:** una regla validada solo cambia con una nueva validación; se anota aquí con fecha, sin borrar la anterior.
- Rol único: «reclutador», sin login ([DEC-04](../07_architecture_principles/DECISIONS.md)). Datos personales según
  [RGPD.md](../RGPD.md).

## Ofertas (`JobOpening`, módulo `ofertas`)

- **RV-01 · Campos.** Para publicar son obligatorios: título (3-120 caracteres), descripción (≤ 5 000), ubicación y
  modalidad (`presencial`, `híbrida` o `remota`). Opcional: banda salarial en €/año, con mínimo ≤ máximo.
- **RV-02 · Borrador.** Un borrador se guarda con solo el título; publicar exige todos los campos obligatorios.
- **RV-03 · Estados.** `draft → published → closed`. `closed` es final: para reabrir, se duplica la oferta como borrador.
- **RV-04 · Edición.** `draft` y `published` son editables; `closed` es solo lectura.
- **RV-05 · Cierre con inscripciones activas.** Se permite cerrar. Las inscripciones en etapa no final pasan a
  `rejected` con el motivo «oferta cerrada», y cada cambio queda en su historial.
- **RV-06 · Borrado.** Solo se borra una oferta en `draft`; `published` y `closed`, nunca.
- **RV-07 · Puestos.** Una oferta es un puesto, sin número de vacantes. Contratar no cierra la oferta: la cierra el
  reclutador.
- **RV-08 · Listado.** Filtros por estado y por texto en el título. Orden: fecha de publicación, la más reciente
  primero (los borradores, por fecha de creación). Paginación de 20 por página, máximo 100.

## Candidatos (`Candidate`, módulo `candidatos`)

- **RV-09 · Campos.** Obligatorios: nombre y apellidos (2-100) y email válido. Opcionales: teléfono (formato
  internacional laxo), resumen (≤ 2 000) y skills (0-20 etiquetas de ≤ 40 caracteres, normalizadas a minúsculas y
  sin repetir).
- **RV-10 · Email único.** Sin distinguir mayúsculas: se guarda sin espacios alrededor y en minúsculas. Un duplicado
  devuelve 409 con el ID del candidato existente. Es también la clave de deduplicación de la importación CSV.
- **RV-11 · Consentimiento para futuros procesos.** Casilla opcional, desmarcada por defecto. La marca el reclutador,
  que declara que el candidato lo dio; se guardan la fecha y la versión del texto. Retirarlo recalcula la retención.
- **RV-12 · Fin de retención.** Lo calcula siempre el sistema ([RGPD.md](../RGPD.md) §3); nunca se edita a mano.
- **RV-13 · Sin inscripción ni consentimiento.** Retención de 6 meses desde el alta (añadido a RGPD.md §3).
- **RV-14 · Búsqueda.** `?q=` busca por coincidencia parcial en nombre o email, sin distinguir mayúsculas ni tildes
  («jose» encuentra «José»). Filtro por skill exacta. Los candidatos anonimizados nunca aparecen.
- **RV-15 · Cambio de email.** Se permite, manteniendo la unicidad de RV-10.
- **RV-16 · Sin borrado físico.** La supresión es la anonimización ([RGPD.md](../RGPD.md) §5).

## Inscripciones y etapas (`Application`, `StageChange`, módulo `inscripciones`)

- **RV-17 · Dónde.** Solo se inscribe en ofertas `published`. Un candidato anonimizado no puede inscribirse.
- **RV-18 · Una por pareja.** Una sola inscripción por candidato y oferta, para siempre: tampoco tras un rechazo.
- **RV-19 · Transiciones.** Solo se avanza a la etapa siguiente: `received → screening → interview → offer → hired`.
  `rejected` es posible desde cualquier etapa no final. `hired` y `rejected` son finales.
- **RV-20 · Rechazo.** Exige un motivo de una lista cerrada (no encaja con el perfil, retirada del candidato, oferta
  cerrada, otro) y admite una nota opcional (≤ 500), con un aviso en la interfaz de no usarla para datos sensibles.
- **RV-21 · Historial.** `StageChange` es inmutable, solo se añade: etapa origen, etapa destino, fecha y motivo o nota.
- **RV-22 · Concurrencia.** El cambio de etapa envía la etapa esperada; si la actual es distinta, 409 y no cambia nada.
- **RV-23 · Idempotencia.** Pedir la etapa en la que ya está devuelve 200 sin crear un `StageChange` nuevo.
- **RV-24 · Independencia.** Contratar a un candidato en una oferta no toca sus inscripciones en otras ofertas.

## Transversales

- **RV-25 · Fechas.** Se guardan en UTC (ISO 8601) y se muestran en Europe/Madrid. La retención vence por día natural
  en Europe/Madrid.
- **RV-26 · Seed.** Unas 10 ofertas, 30 candidatos y 40 inscripciones, todos inventados y con emails `@example.com`
  (RFC 2606): nunca personas reales.
- **RV-27 · Importación CSV (feature C).** Una fila con un email que ya existe no sobrescribe: se informa como
  «duplicado» en el informe de errores. El resto se decide en el shaping de esa feature.

## Respuestas del shaping de FEAT-01..03 (2026-10-06)

Preguntas que no cubrían las RV, respondidas en bloque por la persona («todo según recomendación»). Se citan `S-NN`.

- **S-01 · Idempotencia.** Repetir una acción de estado ya aplicada (publicar una publicada, cerrar una cerrada,
  retirar un consentimiento inexistente, reintentar un cambio de etapa ya hecho) devuelve 200 sin cambios, sin tocar
  fechas ni crear `StageChange`. En el reintento de etapa prevalece RV-23 sobre RV-22.
- **S-02 · Concurrencia de ediciones.** En las ediciones de campos gana la última escritura; las transiciones de estado
  comprueban el estado actual y responden 409 si no lo permite.
- **S-03 · Formatos.** Se recortan los espacios antes de validar (solo espacios = vacío). Esquema estricto: un campo
  desconocido o de solo lectura (p. ej., el fin de retención) da 400. Email estándar de ≤ 254 caracteres. Teléfono:
  «+» opcional y 6-20 caracteres entre dígitos, espacios, guiones y paréntesis. Ubicación: texto libre de 2-120.
  Nombre y apellidos en un solo campo. Skills: se recortan, se descartan las vacías y se deduplican antes de contar
  el máximo. `q`: ≤ 100 caracteres y sin caracteres de control.
- **S-04 · Listados.** La búsqueda por título de ofertas ignora mayúsculas y tildes. Los candidatos se paginan como
  RV-08 y se ordenan por alta, la más reciente primero. Más de 100 por página da 400. Sin filtro, las ofertas mezclan
  estados por fecha de referencia (publicación o, si no hay, creación), con desempate por ID. El listado de candidatos
  muestra solo nombre, email y skills. Una sola skill por filtro, combinada con `q` en Y.
- **S-05 · Anonimizados.** El estado «anonimizado», su exclusión de búsquedas (RV-14) y el bloqueo de inscripción
  (RV-17) los introduce la feature A, que modifica los UC existentes. El núcleo solo prevé la etiqueta «Candidato
  anonimizado» en el pipeline.
- **S-06 · Fórmula de retención.** Con alguna inscripción no final, sin fecha de fin («mientras dure el proceso»). Si
  no, la fecha más tardía de las que apliquen: consentimiento vigente + 24 meses; cierre del último proceso + 6 meses;
  alta + 6 meses si nunca tuvo inscripciones. `hired` también cierra el proceso. Se recalcula al crear o cerrar
  inscripciones y al cambiar el consentimiento, en la misma transacción. Retirar el consentimiento aplica la fórmula
  aunque la fecha ya haya pasado. Fecha inexistente (31/08 + 6 meses) → último día del mes. Ver [RGPD.md](../RGPD.md) §3.
- **S-07 · Consentimiento.** La versión del texto es una constante versionada en el código, mostrada junto a la casilla.
  La fecha la pone el sistema. Al retirarlo se conservan la fecha de otorgamiento y la de retirada. Marcarlo con uno
  vigente es una renovación (fecha y versión nuevas, 24 meses desde ahí).
- **S-08 · Banda salarial.** Dos extremos opcionales e independientes, enteros > 0; mínimo ≤ máximo solo si vienen
  los dos.
- **S-09 · Editar una oferta publicada.** Debe seguir cumpliendo los campos obligatorios: vaciar uno da 400.
- **S-10 · Cierre de oferta.** Diálogo con el número de inscripciones activas que se rechazarán; una sola transacción
  (si algo falla, ni se cierra ni se rechaza nada); se guarda y se muestra la fecha de cierre; cerrar un borrador da 409.
- **S-11 · Duplicar.** Desde cualquier estado; copia los campos editables (título incluido), sin fechas, sin
  inscripciones y sin enlace a la original.
- **S-12 · Borrar un borrador.** Borrado físico.
- **S-13 · StageChange inicial.** Al crear una inscripción se registra un `StageChange` sin origen → `received`.
- **S-14 · Inscripción duplicada.** 409 con el ID de la inscripción existente.
- **S-15 · Motivo «oferta cerrada».** Lo reserva el sistema para RV-05; a mano solo se eligen los otros tres.
- **S-16 · Notas.** Solo los rechazos llevan nota (minimización).
- **S-17 · Segundo `hired`.** Se permite en la misma oferta (RV-07).
- **S-18 · Pipeline.** Visible también en ofertas `closed`, en solo lectura; con columna `rejected` y su motivo; cada
  columna ordenada por la fecha del último cambio, la más reciente primero; sin paginación; solo el nombre del candidato.
- **S-19 · Dónde se inscribe.** Solo desde el pipeline de la oferta, un candidato cada vez.

Reparto entre módulos (decisión de ingeniería, conforme la persona): `candidatos` es dueño de la fórmula de retención y
de su recálculo, y lee los procesos del candidato por un puerto que implementa `inscripciones`; `inscripciones` expone
una operación interna que rechaza las inscripciones activas de una oferta, y `ofertas` la invoca dentro de la
transacción de cierre.
