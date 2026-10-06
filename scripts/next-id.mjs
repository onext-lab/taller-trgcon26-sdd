// node scripts/next-id.mjs <idea|feat|spike|sprint|hu|task|uc> [--root <dir>]
//
// Imprime el siguiente identificador libre, calculado de forma determinista sobre lo que ya
// existe en docs/ (incluidas las carpetas completadas/ y descartadas/). Las skills lo usan en
// lugar de contar a mano. --root apunta a otra raíz (lo usa check:harness con un directorio vacío).
//
//   idea   → IDEA-NNN   máximo de docs/02_discovery/ideas/**/NNN-slug.md (+ `id: IDEA-NNN`)
//   feat   → FEAT-NN    máximo de docs/02_discovery/features/**/FEAT-NN-slug/
//   spike  → SPIKE-NN   máximo de docs/02_discovery/spikes/**/SPIKE-NN-slug.md
//   sprint → sprint-NN  máximo de docs/01_roadmap/sprints/sprint-NN.md
//   hu     → HU-NN      máximo entre docs/03_delivery/hu/**/HU-NN-slug/ y los `### HU-NN` de los sprints
//   task   → T-NN       máximo de los `### T-NN` de los sprints (tareas de sprint sin HU)
//   uc     → UC-NN      máximo global de docs/05_modules/*/casos-de-uso/UC-NN-slug.md (+ `id: UC-NN`)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const KINDS = {
  idea: {
    dir: 'docs/02_discovery/ideas',
    name: /^(\d{3})-.+\.md$/,
    content: /^id:\s*IDEA-(\d+)/m,
    format: (n) => `IDEA-${pad(n, 3)}`,
  },
  feat: {
    dir: 'docs/02_discovery/features',
    name: /^FEAT-(\d+)-/,
    format: (n) => `FEAT-${pad(n, 2)}`,
  },
  spike: {
    dir: 'docs/02_discovery/spikes',
    name: /^SPIKE-(\d+)-/,
    format: (n) => `SPIKE-${pad(n, 2)}`,
  },
  sprint: {
    dir: 'docs/01_roadmap/sprints',
    name: /^sprint-(\d+)/,
    format: (n) => `sprint-${pad(n, 2)}`,
  },
  hu: {
    dir: 'docs/03_delivery/hu',
    name: /^HU-(\d+)-/,
    sprints: /^###\s+HU-(\d+)/gm,
    format: (n) => `HU-${pad(n, 2)}`,
  },
  task: { dir: null, sprints: /^###\s+T-(\d+)/gm, format: (n) => `T-${pad(n, 2)}` },
  uc: {
    dir: 'docs/05_modules',
    name: /^UC-(\d+)-.+\.md$/,
    content: /^id:\s*UC-(\d+)/m,
    format: (n) => `UC-${pad(n, 2)}`,
  },
};

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function usage() {
  console.error(`Uso: node scripts/next-id.mjs <${Object.keys(KINDS).join('|')}> [--root <dir>]`);
  process.exit(1);
}

const kind = KINDS[process.argv[2]];
if (!kind) usage();
const rootIndex = process.argv.indexOf('--root');
const root = resolve(rootIndex === -1 ? process.cwd() : (process.argv[rootIndex + 1] ?? usage()));

/** Recorre dir en profundidad (completadas/, descartadas/…) y llama a visit(nombre, ruta). */
function walk(dir, visit) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    visit(entry, path);
    if (statSync(path).isDirectory()) walk(path, visit);
  }
}

let max = 0;
const bump = (value) => {
  const n = Number(value);
  if (Number.isInteger(n) && n > max) max = n;
};

if (kind.dir) {
  walk(join(root, kind.dir), (entry, path) => {
    const byName = kind.name.exec(entry);
    if (byName) bump(byName[1]);
    if (kind.content && entry.endsWith('.md') && statSync(path).isFile()) {
      const byContent = kind.content.exec(readFileSync(path, 'utf8'));
      if (byContent) bump(byContent[1]);
    }
  });
}
if (kind.sprints) {
  walk(join(root, 'docs/01_roadmap/sprints'), (entry, path) => {
    if (!entry.endsWith('.md') || !statSync(path).isFile()) return;
    for (const match of readFileSync(path, 'utf8').matchAll(kind.sprints)) bump(match[1]);
  });
}

console.log(kind.format(max + 1));
