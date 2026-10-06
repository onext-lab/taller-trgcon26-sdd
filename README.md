# Taller SDD · ATS de ejemplo

Repo de ejemplo del taller de **Spec-Driven Development** (TRGCON 2026): un ATS ficticio de RR. HH. (ofertas,
candidatos e inscripciones) construido con un flujo de agentes en Claude Code, de la idea al código integrado. Todos los
datos son inventados.

## Requisitos

- **Node 24 LTS (≥ 24.15)**, npm y git.
- Claude Code.
- Puertos 3001 y 5173 libres.

Detalle, motivos y cómo instalar Node 24: [docs/SETUP.md](docs/SETUP.md).

## Arranque en 3 comandos

```bash
npm ci
npx playwright install chromium
npm run db:reset && npm run dev
```

Abre <http://127.0.0.1:5173> y comprueba que pone «Estado de la API: ok». Para revisar el portátil:
`npm run check:env`.

## Dónde empezar

- [AGENTS.md](AGENTS.md): el repo en una página (comandos, flujo y reglas de oro).
- [docs/WORKFLOW.md](docs/WORKFLOW.md): el flujo completo.
- [docs/README.md](docs/README.md): el mapa de la documentación.

El guion del taller, el recorrido por etiquetas y el punto de partida para los asistentes llegan en
`paso-3-punto-de-partida`.
