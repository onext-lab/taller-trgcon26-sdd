#!/usr/bin/env node
// Comprueba que ningún test web aserte en seguida lo que pone un efecto pasivo de React (T-03 y T-06 del sprint-01).
// El foco, document.title y el cierre de un <dialog> los cambia un useEffect que corre después del commit que pinta:
// un test que los aserta sin esperar pasa casi siempre y falla con la CPU cargada (EC-46 de HU-02, EC-21 de
// DeleteJobAction). Se aserta con `await expectFocusOn(() => …)` (apps/web/test/helpers/focus.ts) o dentro de
// `await waitFor(() => …)`. Si un caso es síncrono de verdad (el foco lo mueve el propio test o un handler sin efecto),
// se marca en la línea anterior o en la misma con `// efecto-síncrono: <motivo>`.
// Se ejecuta con `npm run check:harness`; antes de mirar los tests, se prueba a sí mismo con casos fijos.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = join(ROOT, 'apps/web/test');
const PASSIVE = [
  /expect\(document\.activeElement\)/,
  /expect\(document\.title\)/,
  /\.hasAttribute\('open'\)\)\.toBe\(false\)/,
];
const MARKER = /\/\/ efecto-síncrono: .{10,}/;

// Excepciones explícitas y fechadas (tope del responsable técnico para T-06): fichero y número de aserciones que aún
// no se han barrido. Vacía = barrido completo. Nunca se desactiva la comprobación.
const EXCEPTIONS = [
  { file: 'apps/web/test/App.test.tsx', count: 5, since: '2026-10-07' },
  { file: 'apps/web/test/components/ConfirmDialog.test.tsx', count: 4, since: '2026-10-07' },
  { file: 'apps/web/test/components/form-errors.test.ts', count: 2, since: '2026-10-07' },
  {
    file: 'apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx',
    count: 2,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/applications/PipelineScreen.hire.test.tsx',
    count: 2,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/applications/PipelineScreen.reject.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/applications/PipelineScreen.search.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateDetailScreen.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx',
    count: 2,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateFormScreen.test.tsx',
    count: 3,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/candidates/CandidateListScreen.filters.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  { file: 'apps/web/test/features/jobs/CloseJobAction.test.tsx', count: 3, since: '2026-10-07' },
  { file: 'apps/web/test/features/jobs/DeleteJobAction.test.tsx', count: 2, since: '2026-10-07' },
  {
    file: 'apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx',
    count: 5,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/jobs/JobFormScreen.edit.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/jobs/JobFormScreen.published.test.tsx',
    count: 3,
    since: '2026-10-07',
  },
  { file: 'apps/web/test/features/jobs/JobFormScreen.test.tsx', count: 2, since: '2026-10-07' },
  {
    file: 'apps/web/test/features/jobs/JobListScreen.filters-adversarial.test.tsx',
    count: 2,
    since: '2026-10-07',
  },
  {
    file: 'apps/web/test/features/jobs/JobListScreen.filters.test.tsx',
    count: 1,
    since: '2026-10-07',
  },
];

/** Líneas (1-based) con una aserción síncrona sobre un efecto pasivo, fuera de `waitFor` y sin marca. */
export function findPassiveAssertions(text) {
  const lines = text.split('\n');
  const found = [];
  let depth = 0;
  lines.forEach((line, i) => {
    const start = line.indexOf('waitFor(');
    const inside = depth > 0 || start >= 0;
    if (start >= 0 && depth === 0) depth = balance(line.slice(start + 'waitFor'.length));
    else if (depth > 0) depth += balance(line);
    if (depth < 0) depth = 0;
    if (inside || !PASSIVE.some((re) => re.test(line))) return;
    if (MARKER.test(line) || MARKER.test(lines[i - 1] ?? '')) return;
    found.push(i + 1);
  });
  return found;
}

function balance(chunk) {
  let n = 0;
  for (const ch of chunk) n += ch === '(' ? 1 : ch === ')' ? -1 : 0;
  return n;
}

const SELF_TEST = [
  ['expect(document.activeElement).toBe(button);', [1]],
  ["expect(document.title).not.toContain('Lucía');", [1]],
  ["expect(dialog.hasAttribute('open')).toBe(false);", [1]],
  ['await waitFor(() => expect(document.activeElement).toBe(button));', []],
  [
    'await waitFor(() => {\n  expect(document.title).toBe("A");\n});\nexpect(document.title).toBe("B");',
    [4],
  ],
  ['await expectFocusOn(() => button);', []],
  [
    '// efecto-síncrono: el test mueve el foco con focus()\nexpect(document.activeElement).toBe(input);',
    [],
  ],
  ["expect(dialog.hasAttribute('open')).toBe(true);", []],
];

function selfTest() {
  return SELF_TEST.filter(
    ([text, want]) => JSON.stringify(findPassiveAssertions(text)) !== JSON.stringify(want),
  ).map(
    ([text, want]) => `autoprueba: «${text.split('\n')[0]}…» debía dar ${JSON.stringify(want)}`,
  );
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const failures = selfTest();
let total = 0;
for (const file of walk(TESTS)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const lines = findPassiveAssertions(readFileSync(file, 'utf8'));
  total += lines.length;
  const allowed = EXCEPTIONS.find((e) => e.file === rel)?.count ?? 0;
  if (lines.length > allowed)
    failures.push(
      `${rel}:${lines.join(',')}: aserción síncrona sobre un efecto pasivo (usa expectFocusOn o waitFor)`,
    );
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  ✘ [efectos pasivos] ${f}`);
  console.error(`check:passive-effects: ${failures.length} fallo(s).`);
  process.exit(1);
}
const pending = EXCEPTIONS.reduce((n, e) => n + e.count, 0);
console.log(
  `  ✔ efectos pasivos: ${SELF_TEST.length} casos de autoprueba; ${total} aserciones síncronas, ${pending} en excepciones fechadas`,
);
