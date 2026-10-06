# Brief de implementación — HU-NN · TASK-NN

> Se guarda como `docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN-BRIEF.md`. `/implementar-hu` lo rellena **entero** y se
> lo pasa al builder: con este brief y lo que nombra, el builder no necesita más contexto. Recorre la lista completa y
> marca solo lo que aplique: el valor está en lo que descartas a conciencia. El porqué de cada línea está en
> `docs/IMPLEMENTATION-RULE.md` (R1-R4).

## 1. Qué hay que hacer
- **La task es el contrato:** `docs/03_delivery/hu/HU-NN-slug/tasks/TASK-NN.md` (criterios de done incluidos).
- **Diseño:** `docs/03_delivery/hu/HU-NN-slug/plans/TECHNICAL_DOC.md`, secciones <anclas> (no el documento entero).
- **Criterios que cubre:** RF-NN, EC-NN del `specs/PRD.md`.
- **Dónde se trabaja:** repo `<ruta absoluta>`, rama `hu/HU-NN-slug` (ya creada; no cambies de rama).
- **Lo que ya está en la rama:** <commits y ficheros de tasks anteriores que esta reutiliza>.
- **Lee solo lo que la task nombra.**

## 2. Invariantes que aplican
- [ ] **Decisiones:** <DEC-NN de docs/07_architecture_principles/DECISIONS.md que aplican y qué exigen>.
- [ ] **Envelope de error** `{ error: { code, message, details? } }` con códigos estables; nunca *stack traces*.
- [ ] **Validación con el JSON Schema de Fastify** en cada ruta (body, params, querystring y respuesta).
- [ ] **SQLite parametrizado**: siempre `db.prepare(…).run/get/all(params)`; nunca SQL concatenado con entrada.
- [ ] **Migraciones**: un cambio de esquema es un fichero nuevo `apps/api/src/db/migrations/NNN-descripcion.sql`; nunca
      se edita uno comiteado.
- [ ] **Datos personales** (docs/RGPD.md): minimización en respuestas, nada en logs ni errores, datos inventados en
      seed y tests.
- [ ] **Accesibilidad** (web): roles y nombres accesibles, `label` en cada control, estados de carga, vacío y error.
- [ ] **Caracteres crudos**: nunca NUL ni U+2028/U+2029 en el código; usa secuencias de escape (el hook lo bloquea).
- [ ] **Reuso obligatorio**: <qué pieza existente usar y dónde, `fichero:línea`>.
- [ ] Otros: <…>

## 3. Prohibiciones
- [ ] **El builder no hace commit**: deja los cambios en el árbol; la sesión integra, verifica y comitea.
- [ ] **No arregles bugs fuera de alcance: repórtalos.** Un test que se adapta al bug es un certificado del bug.
- [ ] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [ ] **No toques ficheros que no estén en la tabla «Archivos afectados»** de la task sin decirlo en el informe.
- [ ] **No instales dependencias** que el diseño no prevea.
- [ ] **No ejecutes la suite completa**: tests acotados a tus ficheros.
- [ ] **Nada de red** ni servicios externos; datos inventados.

## 4. Verificación que debes PEGAR en tu informe (salida real, no un resumen)
- [ ] `npm test -w apps/<app> -- <patrón>`: el número de ficheros de test ejecutados = el de ficheros que tocaste.
- [ ] `npm run typecheck`.
- [ ] `npx eslint <ficheros tocados>`.
- [ ] `npx playwright test <spec>` si la task toca una pantalla con e2e.
- [ ] Los **criterios de done de la task, uno a uno, con su evidencia**.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice la task o el diseño, si necesitarías instalar una dependencia o si el reuso
> obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación sin
> pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo (un gotcha, un comando, una convención), añádelo al final de tu
> informe en un bloque `APRENDIZAJE`; la sesión lo llevará a la doc del módulo o a `docs/ARCHITECTURE.md`.

## 7. Resultado de la integración
> **Obligatoria.** La rellena `/implementar-hu` después del builder, con la **salida real** de los comandos que ejecuta
> la sesión (no la del builder). Ciclo de arreglo: N/2.

```
<npm test -w apps/<app> -- <patrón>>
<npm run typecheck>
<npx eslint <ficheros>>
<npx playwright test <spec>  (si aplica)>
```

- **Resultado:** verde | rojo (vuelta N al builder con la evidencia) | escalado a la persona (tras 2 ciclos)
- **Commit:** `<sha corto>` `<tipo>(<scope>): … [HU-NN TASK-NN]`
