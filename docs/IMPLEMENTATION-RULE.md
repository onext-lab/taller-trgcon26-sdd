# Regla de implementación: cómo se encarga y cómo se integra el código

Aplica al paso 5.4 del flujo ([WORKFLOW.md](WORKFLOW.md)), que ejecuta la skill `/implementar-hu`, y a toda task sin HU
que escriba código. La sesión principal hace de orquestador: prepara el brief, lanza un **builder** (subagente) por task
y ejecuta ella misma la integración.

> **Por qué existe.** Un agente obedece bien lo que le pides y no sabe lo que no le dijiste. Y una review que solo lee
> código no ve lo que únicamente aparece al ejecutarlo.

## R1. Todo encargo de implementación usa la plantilla de brief

- Cada task se encarga con [BRIEF-IMPLEMENTACION.template.md](_templates/BRIEF-IMPLEMENTACION.template.md), que se
  guarda como `tasks/TASK-NN-BRIEF.md` dentro de la carpeta de la HU.
- La plantilla se **recorre entera**, incluidas las líneas que se descartan: el valor está en descartarlas a conciencia.
- El brief nombra **la task como contrato** (`tasks/TASK-NN.md`), las secciones del diseño por ancla (no el documento
  entero), la rama, los **invariantes que aplican** (con su fichero), las **prohibiciones**, la **verificación que debe
  pegar** y el **permiso explícito para pararse**.

## R2. El paso de integración se ejecuta siempre

Antes de dar una task por buena, y siempre antes de `/reviewer`, la sesión **ejecuta** y **pega la salida real**, no un
resumen:

1. **Tests acotados** a los ficheros de test tocados o afectados (`npm test -w apps/api -- <patrón>`,
   `npm test -w apps/web -- <patrón>`), comprobando que **el número de ficheros de test ejecutados cuadra con los que
   se pasaron**: una ruta mal escrita ejecuta menos y sigue en verde.
2. **Typecheck** del workspace tocado (`npm run typecheck`). La base empieza en verde: cualquier error es nuevo.
3. **Lint acotado** a los ficheros tocados (`npx eslint <ficheros>`), sin `--fix` global.
4. **E2E** (`npx playwright test <spec>`) si la task toca una pantalla o un flujo cubierto por un smoke.
5. Si algo falla, se devuelve al builder con la evidencia (comando para reproducirlo, salida real y lo esperado); no se
   «arregla» el test para que pase.

**Techo de 2 ciclos de arreglo por task.** Primer intento + como máximo 2 vueltas al builder. Si al tercer intento
sigue en rojo, **se para y se escala a la persona** con la evidencia y una propuesta (partir la task, revisar el diseño
o aceptar la deuda). Lo mismo en la review: como máximo **2 «Requiere cambios» por HU**.

> Si no lo ejecuta el paso de integración, no lo ejecuta nadie.

## R3. Por qué la review no sustituye a R2

Los auditores de `/reviewer` trabajan en **solo lectura**: no ejecutan nada. Hay defectos que solo aparecen al ejecutar
(caracteres invisibles, un test que no llega a correr, una migración que no aplica, datos duplicados). Por eso la review
exige la salida del paso de integración y además la vuelve a ejecutar.

## R4. Cómo se delega

- **R4.1 Como máximo 4 builders a la vez**, y **solo en paralelo si no comparten ficheros**. En el taller, lo normal
  es uno por task, en orden.
- **R4.2 Briefs cortos.** Lo que ya está en la rama, la task como contrato y «lee solo lo que la task nombra».
- **R4.3 Modelo heredado.** Los builders heredan el modelo de la sesión; nunca se fija uno más caro en el repo.
- **R4.4 Un commit por task**, *conventional* en inglés, con el ID (`feat(scope): … [HU-NN TASK-NN]`), nombrando los
  ficheros: `git add -- <paths>` y `git commit -m "…" -- <paths>`. **Nunca** `git add -A`, `git add .` ni `git stash`.
- **R4.5 Nada externo.** Sin push, sin remotos, sin red y sin servicios de terceros: el builder deja la rama lista y la
  sesión hace el merge local tras la review.

## Permiso explícito para pararse

> Si te falta algo, si el brief contradice la task o el diseño, si necesitarías instalar una dependencia no prevista o
> si el reuso que se te pide no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una
> afirmación sin pruebas.
