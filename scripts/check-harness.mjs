// npm run check:harness — evals deterministas del harness (skills, agentes, hooks y docs).
// Sale con 1 si algo falla e imprime cada fallo con su fichero. Sin red y sin dependencias.
//
//   a) frontmatter válido en skills y agentes; description ≤ 200 caracteres
//   b) enlaces relativos resueltos en docs/, docs/_templates/, .claude/ y los .md de la raíz
//   c) rutas de fichero citadas en .claude/, AGENTS.md y CLAUDE.md que existen
//   d) fixtures de hooks (deniegan lo que deben) y ningún hook abre red
//   e) numeración determinista de IDEA, sprint, HU y UC en un directorio temporal, sin colisión
//   f) contexto de arranque: AGENTS.md + CLAUDE.md + todas las description ≤ 15 000 caracteres
//   g) límites de tamaño (AGENTS.md, WORKFLOW.md, skills, arquitectos, security-auditor)
//   h) sin caracteres crudos invisibles (NUL, U+2028, U+2029) en los ficheros versionables
//   i) catálogo de casos de uso: UC-NN-slug.md con frontmatter coherente, en el índice de su módulo,
//      sin IDs repetidos, y cada `UC-<número>` citado en docs/ o .claude/ existe
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passed = [];
const fail = (check, file, message) => failures.push(`[${check}] ${file}: ${message}`);
const rel = (path) => relative(ROOT, path).split('\\').join('/');
const read = (path) => readFileSync(path, 'utf8');

function walk(dir, filter = () => true, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry === 'worktrees' || entry === '.git') continue;
    if (statSync(path).isDirectory()) walk(path, filter, out);
    else if (filter(path)) out.push(path);
  }
  return out;
}

/** Frontmatter YAML mínimo: `clave: valor`, comillas, bloques `>`/`|` y listas `- x`. */
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const data = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) {
      if (lines[i].trim() && !/^\s/.test(lines[i]))
        return { error: `línea no válida: «${lines[i].slice(0, 40)}»` };
      continue;
    }
    let value = kv[2].trim();
    // Comentario YAML al final de un valor sin comillas (`estado: borrador   # borrador | …`).
    if (!/^['"]/.test(value)) value = value.replace(/\s+#.*$/, '');
    if (/^[>|][-+]?$/.test(value) || value === '') {
      const block = [];
      while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || lines[i + 1] === ''))
        block.push(lines[++i].trim());
      value = block.some((l) => l.startsWith('- '))
        ? block.map((l) => l.replace(/^- /, ''))
        : block.join(kv[2].startsWith('|') ? '\n' : ' ').trim();
    } else if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return { data };
}

// ---------- a) frontmatter de skills y agentes ----------
const skillFiles = readdirSync(join(ROOT, '.claude/skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(ROOT, '.claude/skills', d.name, 'SKILL.md'));
const agentFiles = walk(join(ROOT, '.claude/agents'), (p) => p.endsWith('.md'));
const descriptions = [];
for (const file of [...skillFiles, ...agentFiles]) {
  if (!existsSync(file)) {
    fail('a', rel(file), 'no existe');
    continue;
  }
  const parsed = parseFrontmatter(read(file));
  const isSkill = file.endsWith('SKILL.md');
  const expectedName = isSkill
    ? file.split(/[\\/]/).at(-2)
    : file.split(/[\\/]/).at(-1).replace(/\.md$/, '');
  if (!parsed) fail('a', rel(file), 'sin frontmatter (--- … ---) al principio');
  else if (parsed.error) fail('a', rel(file), `frontmatter no válido: ${parsed.error}`);
  else {
    const { name, description, tools, model } = parsed.data;
    if (name !== expectedName)
      fail('a', rel(file), `name «${name}» no coincide con «${expectedName}»`);
    if (typeof description !== 'string' || !description) fail('a', rel(file), 'falta description');
    else {
      descriptions.push(description);
      if (description.length > 200)
        fail('a', rel(file), `description de ${description.length} caracteres (máximo 200)`);
    }
    if (!isSkill && !tools) fail('a', rel(file), 'el agente no declara tools');
    if (model && /opus/i.test(String(model))) fail('a', rel(file), 'model no puede ser opus');
  }
}
if (skillFiles.length !== 12)
  fail('a', '.claude/skills', `hay ${skillFiles.length} skills y se esperan 12`);
if (agentFiles.length !== 8)
  fail('a', '.claude/agents', `hay ${agentFiles.length} agentes y se esperan 8`);
passed.push(`a) frontmatter: ${skillFiles.length} skills y ${agentFiles.length} agentes`);

// ---------- b) enlaces relativos ----------
/** Quita los bloques de código (``` … ```) y el código en línea, donde un «enlace» es solo texto. */
const stripCode = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
const mdFiles = [
  ...walk(join(ROOT, 'docs'), (p) => p.endsWith('.md')),
  ...walk(join(ROOT, '.claude'), (p) => p.endsWith('.md')),
  ...['AGENTS.md', 'CLAUDE.md', 'README.md'].map((f) => join(ROOT, f)).filter(existsSync),
];
let links = 0;
for (const file of mdFiles) {
  for (const [, target] of stripCode(read(file)).matchAll(
    /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    links++;
    const path = decodeURI(target.split('#')[0]);
    if (!existsSync(resolve(dirname(file), path))) fail('b', rel(file), `enlace roto → ${target}`);
  }
}
passed.push(`b) enlaces: ${links} enlaces relativos en ${mdFiles.length} ficheros .md`);

// ---------- c) rutas citadas en .claude/, AGENTS.md y CLAUDE.md ----------
const PATH_RE = /(?<![\w./-])((?:docs|apps|scripts|e2e|data|\.claude)\/[\w./{}<>*…áéíóúñ-]*[\w/])/g;
const PLACEHOLDER = /[{}<>*…]|NNN?|\bNN\b|-NN|NN-|slug|AAAA|XX|\.\.\./;
// Rutas que se generan al ejecutar (ignoradas por git): se citan, pero no tienen por qué existir.
const GENERATED =
  /^(data\/[\w-]+\.db|test-results\/.*|playwright-report\/.*|\.claude\/worktrees\/?)$/;
const citing = [
  ...walk(join(ROOT, '.claude'), (p) => /\.(md|json)$/.test(p)),
  ...['AGENTS.md', 'CLAUDE.md'].map((f) => join(ROOT, f)).filter(existsSync),
];
let cited = 0;
for (const file of citing) {
  const seen = new Set();
  for (const [, raw] of read(file).matchAll(PATH_RE)) {
    const path = raw.replace(/[.,:;]+$/, '');
    if (seen.has(path) || PLACEHOLDER.test(path) || GENERATED.test(path)) continue;
    seen.add(path);
    cited++;
    if (!existsSync(join(ROOT, path)))
      fail('c', rel(file), `cita una ruta que no existe → ${path}`);
  }
}
passed.push(`c) rutas citadas: ${cited} rutas concretas en ${citing.length} ficheros`);

// ---------- d) hooks ----------
const hooksDir = join(ROOT, '.claude/hooks');
const settings = JSON.parse(read(join(ROOT, '.claude/settings.json')));
for (const group of Object.values(settings.hooks ?? {}).flat()) {
  for (const hook of group.hooks ?? []) {
    const script = /\$\{CLAUDE_PROJECT_DIR\}\/(\.claude\/hooks\/[\w-]+\.mjs)/.exec(
      hook.command,
    )?.[1];
    if (!script)
      fail(
        'd',
        '.claude/settings.json',
        `hook sin ruta \${CLAUDE_PROJECT_DIR}/.claude/hooks/*.mjs → ${hook.command}`,
      );
    else if (!existsSync(join(ROOT, script)))
      fail('d', '.claude/settings.json', `el hook ${script} no existe`);
  }
}
if (/"\/(Users|home)\/|[A-Z]:\\\\/.test(read(join(ROOT, '.claude/settings.json')))) {
  fail('d', '.claude/settings.json', 'contiene rutas absolutas');
}
for (const file of walk(hooksDir, (p) => p.endsWith('.mjs'))) {
  const code = read(file);
  if (
    /from\s+['"](node:)?(https?|net|tls|dgram|http2)['"]|import\(\s*['"](node:)?(https?|net|tls|dgram|http2)['"]|require\(\s*['"](node:)?(https?|net|tls|dgram|http2)['"]/.test(
      code,
    )
  ) {
    fail('d', rel(file), 'importa un módulo de red (http, https, net…)');
  }
  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/.test(code))
    fail('d', rel(file), 'usa fetch u otra API de red');
}
const HOOK_CASES = [
  ['sensitive-files', { tool_input: { file_path: '.env' } }, 2],
  ['sensitive-files', { tool_input: { file_path: 'apps/api/.env.local' } }, 2],
  ['sensitive-files', { tool_input: { file_path: 'certs/server.pem' } }, 2],
  ['sensitive-files', { tool_input: { file_path: 'package-lock.json' } }, 2],
  ['sensitive-files', { tool_input: { file_path: 'data/ats.db' } }, 2],
  ['sensitive-files', { tool_input: { file_path: '.env.example' } }, 0],
  ['sensitive-files', { tool_input: { file_path: 'apps/api/src/app.ts' } }, 0],
  ['raw-chars', { tool_input: { file_path: 'a.ts', content: `x${String.fromCharCode(0)}` } }, 2],
  [
    'raw-chars',
    { tool_input: { file_path: 'a.ts', new_string: `x${String.fromCharCode(0x2028)}` } },
    2,
  ],
  ['raw-chars', { tool_input: { file_path: 'a.ts', content: "const s = '\\u2028';" } }, 0],
  ['no-externo', { tool_input: { command: 'git push --dry-run' } }, 2],
  ['no-externo', { tool_input: { command: 'git -C . push origin main' } }, 2],
  ['no-externo', { tool_input: { command: 'curl -s http://localhost:3001/api/health' } }, 2],
  ['no-externo', { tool_input: { command: 'npm test && wget http://x' } }, 2],
  ['no-externo', { tool_input: { command: 'git remote add origin x' } }, 2],
  ['no-externo', { tool_input: { command: 'npm publish' } }, 2],
  ['no-externo', { tool_input: { command: 'git commit -m "sin push"' } }, 0],
  ['no-externo', { tool_input: { command: 'npm install' } }, 0],
  ['no-externo', { tool_input: { command: 'cat .env' } }, 2],
  ['no-externo', { tool_input: { command: 'source apps/api/.env.local' } }, 2],
  ['no-externo', { tool_input: { command: 'echo X=1 > .env.test' } }, 2],
  ['no-externo', { tool_input: { command: 'cat .env.example' } }, 0],
  ['typecheck-precommit', { tool_input: { command: 'git status' } }, 0],
];
for (const [hook, input, expected] of HOOK_CASES) {
  const result = spawnSync(process.execPath, [join(hooksDir, `${hook}.mjs`)], {
    input: JSON.stringify({ cwd: ROOT, ...input }),
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (result.status !== expected) {
    fail(
      'd',
      `.claude/hooks/${hook}.mjs`,
      `con ${JSON.stringify(input.tool_input)} sale ${result.status} y se esperaba ${expected}`,
    );
  } else if (expected === 2 && !/Qué hacer/.test(result.stderr)) {
    fail('d', `.claude/hooks/${hook}.mjs`, 'deniega sin decir qué hacer');
  }
}
passed.push(`d) hooks: ${HOOK_CASES.length} fixtures y ningún import de red`);

// ---------- e) numeración determinista ----------
const tmp = mkdtempSync(join(tmpdir(), 'ats-next-id-'));
try {
  const nextId = (kind) =>
    execFileSync(process.execPath, [join(ROOT, 'scripts/next-id.mjs'), kind, '--root', tmp], {
      encoding: 'utf8',
    }).trim();
  const firstIdea = nextId('idea');
  const firstSprint = nextId('sprint');
  if (firstIdea !== 'IDEA-001')
    fail('e', 'scripts/next-id.mjs', `en vacío da ${firstIdea} y se esperaba IDEA-001`);
  if (firstSprint !== 'sprint-01')
    fail('e', 'scripts/next-id.mjs', `en vacío da ${firstSprint} y se esperaba sprint-01`);
  mkdirSync(join(tmp, 'docs/02_discovery/ideas/descartadas'), { recursive: true });
  writeFileSync(
    join(tmp, 'docs/02_discovery/ideas/descartadas/001-archivada.md'),
    '---\nid: IDEA-001\n---\n',
  );
  mkdirSync(join(tmp, 'docs/01_roadmap/sprints'), { recursive: true });
  writeFileSync(
    join(tmp, 'docs/01_roadmap/sprints/sprint-01.md'),
    '# sprint-01\n\n### HU-01 · algo\n',
  );
  if (nextId('idea') !== 'IDEA-002')
    fail('e', 'scripts/next-id.mjs', 'no cuenta las ideas archivadas (colisión)');
  if (nextId('sprint') !== 'sprint-02')
    fail('e', 'scripts/next-id.mjs', 'no continúa la numeración de sprints');
  if (nextId('hu') !== 'HU-02')
    fail('e', 'scripts/next-id.mjs', 'no continúa la numeración de HU de los sprints');
  if (nextId('uc') !== 'UC-01') fail('e', 'scripts/next-id.mjs', 'en vacío no da UC-01');
  for (const [module, file] of [
    ['candidatos', 'UC-03-alta.md'],
    ['ofertas', 'UC-01-crear.md'],
  ]) {
    mkdirSync(join(tmp, 'docs/05_modules', module, 'casos-de-uso'), { recursive: true });
    writeFileSync(join(tmp, 'docs/05_modules', module, 'casos-de-uso', file), '');
  }
  if (nextId('uc') !== 'UC-04')
    fail('e', 'scripts/next-id.mjs', 'la numeración de UC no es global entre módulos');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
for (const skill of ['anadir-idea', 'crear-sprint', 'feature-shaping']) {
  const file = join(ROOT, '.claude/skills', skill, 'SKILL.md');
  if (existsSync(file) && !read(file).includes('scripts/next-id.mjs')) {
    fail('e', rel(file), 'la skill no usa scripts/next-id.mjs para numerar');
  }
}
passed.push(
  'e) numeración: IDEA-001, sprint-01 y UC-01 en vacío, sin colisión con archivadas, UC global',
);

// ---------- f) contexto de arranque ----------
const startup =
  ['AGENTS.md', 'CLAUDE.md'].reduce(
    (n, f) => n + (existsSync(join(ROOT, f)) ? read(join(ROOT, f)).length : 0),
    0,
  ) + descriptions.reduce((n, d) => n + d.length, 0);
if (startup > 15_000)
  fail('f', 'AGENTS.md + CLAUDE.md + descriptions', `${startup} caracteres (máximo 15 000)`);
passed.push(`f) contexto de arranque: ${startup} caracteres (máximo 15 000)`);

// ---------- g) límites de tamaño ----------
const LIMITS = [
  ['AGENTS.md', 'lines', 80],
  ['docs/WORKFLOW.md', 'lines', 250],
  ['.claude/agents/backend-architect.md', 'bytes', 8 * 1024],
  ['.claude/agents/frontend-architect.md', 'bytes', 8 * 1024],
  ['.claude/agents/security-auditor.md', 'bytes', 10 * 1024],
  ...skillFiles.map((f) => [rel(f), 'bytes', f.includes('/reviewer/') ? 12 * 1024 : 10 * 1024]),
];
for (const [file, unit, max] of LIMITS) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    fail('g', file, 'no existe');
    continue;
  }
  const size =
    unit === 'lines'
      ? read(path).split('\n').length - (read(path).endsWith('\n') ? 1 : 0)
      : statSync(path).size;
  if (size > max)
    fail('g', file, `${size} ${unit === 'lines' ? 'líneas' : 'bytes'} (máximo ${max})`);
}
passed.push(`g) límites: ${LIMITS.length} ficheros medidos`);

// ---------- h) caracteres crudos invisibles ----------
const RAW = new RegExp(
  `[${String.fromCharCode(0)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
);
const versioned = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter((f) => f && /\.(md|mjs|js|ts|tsx|json|sql|html|css|ya?ml)$/.test(f));
for (const file of versioned) {
  const path = join(ROOT, file);
  if (existsSync(path) && RAW.test(read(path)))
    fail('h', file, 'contiene NUL, U+2028 o U+2029 crudos (usa la secuencia de escape)');
}
passed.push(`h) caracteres crudos: ${versioned.length} ficheros de texto`);

// ---------- i) catálogo de casos de uso ----------
const UC_STATES = new Set(['borrador', 'aprobado', 'implementado', 'obsoleto']);
const modulesDir = join(ROOT, 'docs/05_modules');
const ucById = new Map();
const moduleNames = readdirSync(modulesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
for (const module of moduleNames) {
  const catalog = join(modulesDir, module, 'casos-de-uso');
  const index = join(catalog, 'README.md');
  if (!existsSync(index)) {
    fail('i', rel(catalog), 'falta el índice casos-de-uso/README.md');
    continue;
  }
  const indexText = read(index);
  for (const entry of readdirSync(catalog).filter((f) => f !== 'README.md' && f !== '.gitkeep')) {
    const file = join(catalog, entry);
    const byName = /^(UC-\d+)-[\w-]+\.md$/.exec(entry);
    if (!byName) {
      fail('i', rel(file), 'el nombre no sigue UC-NN-slug.md');
      continue;
    }
    const id = byName[1];
    if (ucById.has(id)) fail('i', rel(file), `${id} repetido (también en ${ucById.get(id)})`);
    ucById.set(id, rel(file));
    const { data, error } = parseFrontmatter(read(file)) ?? { error: 'sin frontmatter' };
    if (error) {
      fail('i', rel(file), `frontmatter no válido: ${error}`);
      continue;
    }
    if (data.id !== id) fail('i', rel(file), `id «${data.id}» no coincide con el fichero (${id})`);
    if (data.modulo !== module) fail('i', rel(file), `modulo «${data.modulo}» y está en ${module}`);
    if (!UC_STATES.has(data.estado)) fail('i', rel(file), `estado «${data.estado}» no válido`);
    if (!/^FEAT-\d+$/.test(data.feature ?? '')) fail('i', rel(file), 'falta feature: FEAT-NN');
    if (!/^## Flujo principal/m.test(read(file)))
      fail('i', rel(file), 'falta «## Flujo principal»');
    if (!indexText.includes(id)) fail('i', rel(index), `no lista ${id}`);
  }
}
let ucRefs = 0;
for (const file of [...mdFiles, ...walk(join(ROOT, 'docs'), (p) => p.endsWith('.html'))]) {
  for (const id of new Set(read(file).match(/\bUC-\d+\b/g) ?? [])) {
    ucRefs++;
    if (!ucById.has(id))
      fail('i', rel(file), `cita ${id}, que no existe en ningún catálogo de módulo`);
  }
}
passed.push(
  `i) casos de uso: ${ucById.size} UC en ${moduleNames.length} catálogos; ${ucRefs} citas a UC concretos`,
);

// ---------- informe ----------
for (const line of passed) console.log(`  ✔ ${line}`);
if (failures.length > 0) {
  console.error(`\ncheck:harness: ${failures.length} fallo(s):`);
  for (const failure of failures) console.error(`  ✘ ${failure}`);
  process.exit(1);
}
console.log('\ncheck:harness: todo en verde.');
