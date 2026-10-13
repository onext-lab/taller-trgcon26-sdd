@AGENTS.md

## Claude Code en este repo

- **Skills:** se invocan con `/nombre` y su argumento (`/prd-writer HU-01`, `/audit-sprint 01`). Las 12 están en
  `.claude/skills/`; cada una dice al principio qué lee, qué escribe y qué gate aplica.
- **Agentes:** en `.claude/agents/`. Los lanzan las skills; heredan el modelo de la sesión (Opus, fijado en `.claude/settings.json`), salvo los que
  declaran `model: sonnet`: los dos builders, los tres auditores y `qa-e2e-runner`.
- **Hooks** (`.claude/hooks/*.mjs`, Node sin dependencias y sin red), configurados en `.claude/settings.json`:
  - `sensitive-files`: bloquea escribir `.env*`, `*.pem`, `*.key`, lockfiles y `data/*.db`.
  - `raw-chars`: bloquea NUL y U+2028/U+2029 crudos en lo que escribes.
  - `no-externo`: bloquea `git push`, `git remote add/set-url`, `curl`, `wget`, `npm publish` y cualquier comando que
    lea o escriba un `.env*` (salvo `.env.example`).
  - `typecheck-precommit`: en `git commit`, typecheck de los workspaces con `.ts`/`.tsx` en stage; bloquea si falla.
  - `format-lint`: tras cada edición, Prettier y ESLint `--fix` sobre el fichero (nunca bloquea).
- **Permisos:** `permissions.deny` refuerza lo mismo (push, remotos, `curl`, `wget`, `npm publish`, lectura de `.env*`).
- Si un hook te bloquea, lee su mensaje: dice qué hacer. No lo esquives; si crees que es un falso positivo, para y
  pregunta.
- Preguntas a la persona: agrúpalas, numeradas y con tu recomendación.
