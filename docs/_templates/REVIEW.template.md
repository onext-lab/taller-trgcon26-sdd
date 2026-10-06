# Review — HU-NN <título>

## 1. Resumen ejecutivo
- **Fecha:** AAAA-MM-DD · **Rama:** `hu/HU-NN-slug` · **Commits revisados:** `<base>..<head>` (N)
- **Ficheros tocados:** N · **Tasks:** N/N completadas
- **Auditores:** security-auditor <✔ | no concluido> · datos-personales-auditor <✔ | no concluido> ·
  doc-code-drift-checker <✔ | no concluido>
- **Hallazgos:** críticos N · altos N · medios N · bajos N
- <Dos o tres frases: qué entrega la HU y si cumple el PRD.>

## 2. Veredicto
<Aprobado | Aprobado con observaciones | Requiere cambios>, y por qué en una frase. No se aprueba por defecto: sin
evidencia ejecutada, no hay `Aprobado`.

## 3. Decisiones aplicables

| DEC-NN | Aplica porque | ¿Cumple? |
|---|---|---|
| DEC-01 | … | Sí / No — `archivo:línea` |

## 4. Hallazgos por auditor

### security-auditor
<Hallazgos con `archivo:línea`, severidad, evidencia y remediación, o «Sin hallazgos».>

### datos-personales-auditor
<Ídem: minimización, base jurídica, retención, supresión, datos personales en logs, errores y respuestas.>

### doc-code-drift-checker
<Rutas, módulos o comandos citados en PRD, diseño o docs que no existen o no coinciden con el código.>

## 5. Criterio → test
Una fila por criterio de aceptación del `hu.md` y del PRD (CA-NN), por criterio de cada RF y por edge case Must del
PRD. La columna **UC** dice de qué caso de uso y flujo viene (`UC-NN · A1`), o `—` si no viene de un UC. Todas
empiezan en `falla`; solo pasan a `pasa` con un test que cubre el criterio y sale en verde en la salida de §7.
Un criterio de un RF Must en `falla` es crítico. **Un UC, o un flujo de UC cubierto por la HU, sin ningún test es un
hallazgo crítico.** Al cerrar, copia el test de cada flujo a la «Trazabilidad» del fichero del UC.

| Origen | UC | Criterio o edge case | Categoría | Test (`fichero:línea`) | Estado |
|---|---|---|---|---|---|
| `hu.md` / CA-01 / RF-01 (Must) / EC-01 | UC-NN · P / — | … | input inválido / … / — | `apps/api/test/…:NN` | falla |

## 6. Gates de QUALITY-GATES

| Umbral | Medido | ¿Cumple? |
|---|---|---|
| Líneas por fichero ≤ 300 | <máximo y `fichero`> | Sí / No |
| Líneas por función ≤ 50 | … | … |
| 1 test por RF y por edge case Must | … | … |
| Anti-patrones de §4 | … | … |

## 7. Integración
Comandos ejecutados **por la review** y su salida real:

```
<npm test -w apps/<app> -- <patrón>>
<npm run typecheck>
<npx eslint <ficheros>>
<npx playwright test <spec>  (si aplica)>
```

## 8. Limitaciones
<Lo que esta review no pudo comprobar y por qué (p. ej. un auditor no concluido), o «Ninguna».>

## 9. Acciones requeridas
1. `archivo:línea` — <qué> — <por qué bloquea> — <arreglo propuesto>

<Si `Aprobado con observaciones`: las observaciones, que no bloquean.>

---
Ronda: N · «Requiere cambios» previos: K (máximo 2; al tercero se para y se escala a la persona)

VERDICT: <Aprobado | Aprobado con observaciones | Requiere cambios>
