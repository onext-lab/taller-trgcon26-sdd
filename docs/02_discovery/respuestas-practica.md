# Práctica del taller · Respuestas canónicas del shaping

En el taller, cada asistente repite en su portátil el flujo de la feature «Fecha límite de inscripción en una oferta»,
desde `paso-3-punto-de-partida`. El agente no se inventa las respuestas: pregunta. Para que todos acabéis con la misma
feature, contestad con estas respuestas. Si os quedáis atrás, saltad al punto de control: `git switch --detach
taller-1-feature`.

## 1. La idea

Para `/anadir-idea`, esta frase exacta:

> Fecha límite de inscripción en una oferta: el reclutador puede fijar, al crear o editar una oferta, hasta qué día
> acepta inscripciones; pasada esa fecha no se puede inscribir a nadie más en ella.

Si la skill pregunta si se acepta la idea, la respuesta es sí.

## 2. Las respuestas

Cuando el `feature-analyst` abra sus preguntas, pegadle este bloque entero y dejad que lo reparta:

- **R1.** La fecha límite es opcional; vacía = sin límite. Es solo un día (sin hora) e inclusiva: el mismo día aún se
  puede inscribir (día natural de Europe/Madrid, DEC-09, con el reloj del servidor y sin margen); al día siguiente,
  inscribir da 409 `ENROLLMENT_DEADLINE_PASSED`, con el mensaje «El plazo de inscripción de esta oferta terminó el
  dd/mm/aaaa.».
- **R2.** No se puede poner en el pasado al crear ni al editar (400 junto al campo); hoy sí vale. Solo se comprueba
  cuando la fecha cambia. No hay fecha máxima. Publicar un borrador con el plazo ya vencido da 400 y sigue en borrador.
- **R3.** Se puede cambiar en una oferta publicada (S-09): ampliarla, reducirla o quitarla, nunca al pasado. Ampliar un
  plazo vencido reabre las inscripciones. En una cerrada no se edita (RV-04). No hay forma de «cortar hoy» sin cerrar.
- **R4.** No se copia al duplicar (S-11, «sin fechas»).
- **R5.** En una oferta cerrada se muestra como dato informativo. Si fallan varias cosas al inscribir, gana «oferta no
  publicada», luego «plazo vencido» y luego «duplicado».
- **R6.** Se ve en la ficha de la oferta (la fecha o «Sin fecha límite», con un aviso si ha vencido), en una columna
  del listado (sin filtro ni orden por ella) y en el pipeline, donde, pasado el plazo, no se ofrece «Inscribir
  candidato» y se explica por qué. Las inscripciones existentes no cambian, la oferta no se cierra sola y no es un
  estado nuevo.
- **R7.** Alcance: una sola HU fullstack, sin RGPD (la fecha no es un dato personal). El seed lleva al menos una oferta
  publicada con plazo futuro y otra con el plazo vencido. Fuera: avisos, filtros u orden por la fecha, hora o límite por
  etapa, excepciones por candidato e historial de cambios del plazo.
- **Cualquier otra pregunta:** si la respuesta está en una regla del repo (RV, S, DEC), la que diga esa regla; si no,
  «según tu recomendación».
- **Validación de la feature:** «aprobado».

## 3. Para comparar

El shaping de referencia abrió 24 preguntas y está en
`git show taller-1-feature:docs/02_discovery/features/FEAT-04-fecha-limite-inscripcion/feature.md`, sección
«Preguntas y respuestas del shaping». El vuestro no tiene que ser idéntico: tiene que llegar a las mismas reglas.

Ojo con los números. Esta rama sale de `paso-3-punto-de-partida`, igual que las ramas de las features A y C, así que
vuestra idea será IDEA-004, la feature FEAT-04 y la HU HU-07, los mismos números que allí. Son features distintas.
