# Auditoría del sprint-NN

## Resumen
- **Fecha:** AAAA-MM-DD · **HU auditadas:** HU-NN, HU-NN
- **Rango auditado:** `<base>..<head>` (`base` del frontmatter del sprint → `main`) · **Commit auditado:** `<sha de main>`
- **Commits:** N · **Ficheros tocados:** N
- **Hallazgos:** críticos N · altos N · medios N · bajos N

## 1. Suite completa

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run typecheck` | verde / rojo | … |
| `npm run lint` | verde / rojo | … |
| `npm test` | verde / rojo | N tests en N ficheros |
| `npm run e2e` | verde / rojo | N specs |

```
<salida real, recortada a lo relevante>
```

Cada fallo se clasifica: **atribuible al sprint** (bloquea) o **previo al sprint** (deuda conocida).

## 2. Dimensión código
<Auditor de código sobre el diff consolidado: interacciones entre HU, duplicación entre módulos, umbrales de
QUALITY-GATES sobre el agregado, drift doc-código. Cada hallazgo con `archivo:línea`, severidad y evidencia.>

## 3. Dimensión seguridad y datos personales
<security-auditor + datos-personales-auditor sobre el diff consolidado: seguridad acumulada entre HU, exposición de
datos personales, retención y supresión según docs/RGPD.md. Cada hallazgo con `archivo:línea`, severidad y evidencia.>

## 4. Dimensiones no concluidas
<Fail-closed: si alguna dimensión no concluyó, el veredicto no puede ser `Aprobado`. O «Ninguna».>

## 5. Override
<Si el sprint lleva `audit-override`, la razón y la deuda heredada. O «No aplica».>

## 6. Acciones
- [ ] <acción · HU o task nueva>

VERDICT: <Aprobado | Aprobado con observaciones | Bloqueado>
