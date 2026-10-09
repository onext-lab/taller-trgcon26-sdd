# Quality gates

**Única fuente de verdad de los criterios de calidad del flujo.** Un criterio que no se puede medir o verificar
mecánicamente no es un gate: es una recomendación. Los umbrales están pensados para trabajar **en local**, sin CI: el
paso de integración de `/implementar-hu` y la review **son** el gate.

- **Veredictos**, siempre en una línea parseable al final del artefacto:
  - `REVIEW.md` → `VERDICT: Aprobado` · `VERDICT: Aprobado con observaciones` · `VERDICT: Requiere cambios`.
  - `sprint-NN-AUDIT.md` → `VERDICT: Aprobado` · `VERDICT: Aprobado con observaciones` · `VERDICT: Bloqueado`.
  - Informe de QA → `VERDICT: PASS` · `VERDICT: FAIL` · `VERDICT: BLOCKED`.
- **No se aprueba por defecto**: sin evidencia, no hay `Aprobado`.
- **Bypass** de la auditoría de sprint: solo con `audit-override: <razón ≥ 20 caracteres>` en el frontmatter del sprint.
  Se hereda como deuda.
- **Techos**: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU. Al siguiente, se para y se escala.

## 1. Gates bloqueantes por artefacto

| Artefacto | Gates bloqueantes | Lo comprueba |
|---|---|---|
| **FEATURE** | 6 dimensiones resueltas (actores, casos de uso, reglas, invariantes, casos límite, alcance dentro/fuera); **cada UC es un fichero del catálogo del módulo** con flujo principal (P), alternativos (A) y excepciones (E), y su fila en el índice; **0 preguntas abiertas** (o aplazadas explícitamente por la persona) | `/feature-shaping` |
| **HU** | Atómica, vertical y con valor; `FEAT-NN` citado; **UC y flujos que cubre** (entre todas las HU de la feature, todos los flujos cubiertos o declarados fuera con motivo); criterios de aceptación verificables; dependencias | `product-owner` |
| **PRD** | Rutas citadas existen; **cada flujo de UC cubierto (P, A y E) con ≥1 criterio de aceptación `CA-NN`**; cada RNF con métrica numérica o rango; **≥3 edge cases por RF Must** recorriendo las 7 categorías de §3 (`N/A — razón` permitido); sección *Decisiones aplicables* (`DEC-NN`); datos personales declarados (qué, para qué, cuánto tiempo); **0 Open Questions**; estado `Ready` | `/prd-writer` |
| **TECHNICAL_DOC** | PRD `Ready`; secciones 🔒 presentes (o `N/A — razón`); cada RF cubierto; tabla *Error paths* con cada edge case del PRD; cada `DD-NN` con alternativas y tradeoff; **0 Open Decisions** | `/tech-design` |
| **TASK** | ≤ 4 h por task (S < 1 h, M 1–2 h, L 2–4 h); ≤ 15 tasks por HU; ficheros concretos; criterios de Done verificables; ≥ 1 task `[adversarial]` por RF Must; tests explícitos | `/task-planner` |
| **CODE** | Umbrales de §2; anti-patrones de §4; cada edge case Must con su test; typecheck, lint y tests en verde | `/implementar-hu` + `/reviewer` |
| **REVIEW** | Auditores concluidos (o dimensión declarada no concluida); verificación **ejecutada** pegada; tabla criterio → test → resultado con columna UC (**un UC o un flujo cubierto sin test es crítico**); cada hallazgo con `archivo:línea`; línea `VERDICT:` | `/reviewer` |
| **SPRINT** | Suite completa ejecutada y clasificada; 2 dimensiones (código; seguridad y datos personales) sobre el diff del sprint; **fail-closed** | `/audit-sprint` → `/cerrar-sprint` |

## 2. Umbrales

| Umbral | Valor | Notas |
|---|---|---|
| Líneas por fichero nuevo o modificado | ≤ 300 | Sobre el diff, con `archivo:línea`. |
| Líneas por función | ≤ 50 | Lo mide `npm run lint`: `max-lines-per-function` sin líneas en blanco ni comentarios, sobre `apps/*/src` (no los tests), sin excepciones. |
| Complejidad por función | ≤ 10 ramas | Estimación razonada en la review. |
| Tests | 1 test por RF, por flujo de UC cubierto y por edge case Must | El repo no mide cobertura: se exige el mapeo criterio → test. |
| Latencia local (`fastify.inject` o e2e) | lectura < 200 ms; acción < 500 ms | Solo si el PRD define RNF de rendimiento. |
| Tasks por HU | ideal 6–10, **máximo 15** | Más de 15: dividir la HU. |
| Horas por task | ≤ 4 | |
| RF por PRD | ≤ 15 | Más: dividir la HU. |
| Verificaciones de cada etiqueta | `test`, `typecheck`, `lint`, `e2e`, `check:harness` en verde | Con la salida pegada. |

## 3. Categorías de edge cases (recorrerlas por cada RF Must)

Para cada RF **Must**, el PRD evalúa las 7 categorías y declara **≥3 edge cases** con su comportamiento esperado. Una
categoría puede ir como `N/A — <razón>` si de verdad no aplica; «no se me ocurre» no es una razón.

1. **Input inválido o malformado** — tipos, formatos (email, teléfono, fechas), campos ausentes o de más, tamaños,
   codificaciones (CSV con BOM, separadores), caracteres de control.
2. **Boundary** — vacío, uno, máximo, máximo + 1, fechas límite (el día exacto en que vence una retención), paginación
   en el borde, cero y negativos.
3. **Fallo de dependencia** — la base de datos bloqueada u ocupada, un fichero que no se puede leer, la API caída vista
   desde la web, un timeout.
4. **Concurrencia** — doble envío del formulario, dos inscripciones simultáneas del mismo candidato, cambios de etapa
   cruzados, escrituras simultáneas.
5. **Datos corruptos o legacy** — filas creadas antes de una migración sin los campos nuevos, estados imposibles
   (una inscripción en una oferta borrada), datos a medio importar.
6. **Seguridad** — exposición de datos personales en respuestas, errores o logs; inyección (SQL, HTML); enumeración de
   IDs; ficheros subidos maliciosos; abuso de tamaño.
7. **Idempotencia** — qué pasa si la misma operación llega dos veces (reintento del cliente, doble clic, reimportar el
   mismo CSV, pedir dos veces la supresión del mismo candidato).

## 4. Anti-patrones (bloqueantes)

1. **Secretos** en código, config versionada, logs o mensajes de error.
2. **Datos personales sin base jurídica ni minimización**: el PRD declara qué datos, para qué y cuánto tiempo
   ([RGPD.md](../RGPD.md)).
3. **Datos personales en logs, errores o respuestas** que no los necesitan.
4. **SQL construido concatenando entrada del usuario**: siempre sentencias preparadas de `node:sqlite`.
5. **Validación solo en el cliente**: la API valida con el JSON Schema de Fastify.
6. **Errores fuera del envelope** `{ error: { code, message, details? } }` o con *stack traces* hacia el cliente.
7. **Tests que se adaptan a un bug** en lugar de reportarlo.
8. **Rutas, módulos o comandos citados en docs que no existen** (drift doc-código).
9. **Operaciones no idempotentes** donde puede haber reintentos.
10. **Errores tragados** (`catch` vacío) sin log ni propagación.
11. **Datos reales** (CVs, personas) en seeds, fixtures o tests: siempre inventados.
12. **Aserciones síncronas sobre lo que pone un efecto pasivo** en los tests web: el foco, `document.title` y el
    cierre de un `<dialog>` cambian en un `useEffect` que corre después del commit, así que un test que los aserta en
    seguida falla a veces con la CPU cargada (sprint-01: EC-46 de HU-02 y EC-21 de `DeleteJobAction`). Se espera al
    estado final: `await expectFocusOn(() => campo)` (`apps/web/test/helpers/focus.ts`) o
    `await waitFor(() => expect(document.title).toBe('Oferta · ATS'))`. Una aserción negativa («el título no contiene
    el nombre») espera antes al título positivo, o pasaría en vacío. Si el caso es síncrono de verdad, se marca con
    `// efecto-síncrono: <motivo>`. Lo comprueba `npm run check:harness` (`scripts/check-passive-effects.mjs`).

## 5. Checklist ready-to-review (antes de `/reviewer`)

- [ ] Todas las tasks de la HU en estado **Completada**.
- [ ] Paso de integración ejecutado en verde y su salida real pegada ([IMPLEMENTATION-RULE.md](../IMPLEMENTATION-RULE.md) R2).
- [ ] Cada edge case Must del PRD tiene al menos un test; tests `[adversarial]` presentes.
- [ ] Sin secretos ni datos personales reales en código, fixtures o logs.
- [ ] Commits de la HU con su ID; ningún `git add -A`; sin cambios fuera del alcance.

## 6. Checklist ready-to-merge (antes del merge local a `main`)

- [ ] `/reviewer` con `VERDICT` ≠ `Requiere cambios`.
- [ ] `/module-sync` hecho: docs de módulo y `MVP-STATUS.md` al día; rutas citadas existen.
- [ ] `DECISIONS.md` actualizado si la HU introduce o cambia un `DEC-NN`.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` y `npm run e2e` en verde en la rama.
