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
