#!/usr/bin/env node
// npm run integrate — integración completa en serie (T-08 del sprint-02, auditoría del sprint-01, A-02).
// Ejecuta uno detrás de otro typecheck, lint, unitarios de la API, unitarios de la web, e2e y check:harness: nunca la
// suite unitaria y los e2e a la vez, porque con la CPU saturada los tests web fallaban por timeout (review de HU-04).
// Se para en el primer paso en rojo, guarda la salida completa de cada paso en logs/integrate/<paso>.log (ignorado por
// git) y la tabla de resultados y segundos en logs/integrate/summary.txt.
// `node scripts/integrate.mjs --self-test` se prueba a sí mismo con pasos falsos en un directorio temporal (lo llama
// `npm run check:harness`, como scripts/check-passive-effects.mjs).
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT, 'logs', 'integrate');
const IS_WINDOWS = process.platform === 'win32';

/** Pasos de la integración, en el orden en que se ejecutan. */
export const STEPS = [
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'test-api', command: 'npm', args: ['test', '-w', 'apps/api'] },
  { name: 'test-web', command: 'npm', args: ['test', '-w', 'apps/web'] },
  { name: 'e2e', command: 'npm', args: ['run', 'e2e'] },
  { name: 'check-harness', command: 'npm', args: ['run', 'check:harness'] },
];

const seconds = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

/** Ejecuta un paso con su salida (stdout y stderr) volcada entera en `logPath`. Devuelve si pasó y cuánto tardó. */
function runStep(step, { cwd, logPath }) {
  const fd = openSync(logPath, 'w');
  const start = performance.now();
  // En Windows, `npm` es un .cmd y Node 24 solo lo lanza a través de la shell; los pasos son fijos, sin entrada externa.
  const result = IS_WINDOWS
    ? spawnSync([step.command, ...step.args].join(' '), {
        cwd,
        stdio: ['ignore', fd, fd],
        shell: true,
      })
    : spawnSync(step.command, step.args, { cwd, stdio: ['ignore', fd, fd] });
  const ms = performance.now() - start;
  closeSync(fd);
  if (result.error)
    writeFileSync(logPath, `No se pudo lanzar el paso: ${result.error.message}\n`, { flag: 'a' });
  return { name: step.name, ok: result.status === 0 && !result.error, code: result.status, ms };
}

/** Ejecuta los pasos uno a uno y se para en el primero en rojo. Borra antes los logs de todos para no dejar viejos. */
export function runSteps(steps, { cwd, logDir, print }) {
  mkdirSync(logDir, { recursive: true });
  for (const step of steps) rmSync(join(logDir, `${step.name}.log`), { force: true });
  const results = [];
  for (const step of steps) {
    print(`▶ ${step.name}…`);
    const result = runStep(step, { cwd, logPath: join(logDir, `${step.name}.log`) });
    results.push(result);
    print(`  ${result.ok ? '✔' : '✘'} ${step.name} (${seconds(result.ms)} s)`);
    if (!result.ok) break;
  }
  return results;
}

/** Tabla de pasos ejecutados con su resultado y sus segundos, más el total y los que no llegaron a ejecutarse. */
export function formatSummary(steps, results) {
  const width = Math.max(5, ...steps.map((s) => s.name.length)) + 2;
  const row = (a, b, c) => `${a.padEnd(width)}${b.padEnd(12)}${c.padStart(8)}`;
  const total = results.reduce((sum, r) => sum + r.ms, 0);
  const lines = [row('Paso', 'Resultado', 'Segundos'), '-'.repeat(width + 20)];
  for (const r of results)
    lines.push(row(r.name, r.ok ? 'verde' : `rojo (${r.code ?? '-'})`, seconds(r.ms)));
  lines.push('-'.repeat(width + 20), row('Total', '', seconds(total)));
  const skipped = steps.slice(results.length).map((s) => s.name);
  if (skipped.length > 0) lines.push(`Sin ejecutar: ${skipped.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

/** Integración completa: ejecuta, imprime y guarda la tabla, y devuelve el código de salida (0 si todo en verde). */
export function integrate(steps, { cwd, logDir, print }) {
  print(`Integración en serie: ${steps.map((s) => s.name).join(' → ')}`);
  const results = runSteps(steps, { cwd, logDir, print });
  const summary = formatSummary(steps, results);
  writeFileSync(join(logDir, 'summary.txt'), summary);
  print('', summary.trimEnd(), '');
  const failed = results.find((r) => !r.ok);
  const where = (name) => relative(cwd, join(logDir, name)).split('\\').join('/');
  if (failed) {
    print(
      `✘ Integración en rojo: falló el paso «${failed.name}». Log completo: ${where(`${failed.name}.log`)}`,
    );
    return 1;
  }
  print(`✔ Integración en verde. Logs en ${where('')}/ y tabla en ${where('summary.txt')}`);
  return 0;
}

// ---------- autoprueba ----------
const node = (code) => ({ command: process.execPath, args: ['-e', code] });
const SELF_STEPS = [
  { name: 'verde', ...node("console.log('salida del paso verde'); process.exit(0)") },
  { name: 'rojo', ...node("console.error('salida del paso rojo'); process.exit(1)") },
  { name: 'despues', ...node("require('node:fs').writeFileSync('despues.txt', 'x')") },
];

/** Comprobaciones de una pasada con un paso en rojo en medio. Devuelve los fallos en castellano. */
function checkRedRun(tmp) {
  const logDir = join(tmp, 'logs');
  mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, 'despues.log'), 'log viejo de otra pasada');
  const code = integrate(SELF_STEPS, { cwd: tmp, logDir, print: () => {} });
  const log = (name) =>
    existsSync(join(logDir, name)) ? readFileSync(join(logDir, name), 'utf8') : '';
  const summary = log('summary.txt');
  const checks = [
    [code !== 0, 'con un paso en rojo devuelve 0'],
    [!existsSync(join(tmp, 'despues.txt')), 'ejecuta el paso siguiente al rojo'],
    [log('verde.log').includes('salida del paso verde'), 'no guarda la salida del paso verde'],
    [log('rojo.log').includes('salida del paso rojo'), 'no guarda la salida del paso rojo'],
    [!existsSync(join(logDir, 'despues.log')), 'deja el log viejo de un paso sin ejecutar'],
    [/verde\s+verde/.test(summary), 'summary.txt no tiene la fila del paso verde'],
    [/rojo\s+rojo \(1\)/.test(summary), 'summary.txt no tiene la fila del paso rojo'],
    [/^Total\s+\d+,\d$/m.test(summary), 'summary.txt no tiene el total'],
    [summary.includes('Sin ejecutar: despues'), 'summary.txt no dice qué pasos no se ejecutaron'],
  ];
  return checks.filter(([ok]) => !ok).map(([, message]) => message);
}

function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'integrate-'));
  try {
    const failures = checkRedRun(tmp).map((f) => `paso en rojo: ${f}`);
    const greenDir = join(tmp, 'verde');
    mkdirSync(greenDir);
    const green = integrate(SELF_STEPS.slice(0, 1), {
      cwd: greenDir,
      logDir: join(greenDir, 'logs'),
      print: () => {},
    });
    if (green !== 0) failures.push('todo en verde: no devuelve 0');
    return failures;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// `import.meta.main` (Node ≥ 24.2) y no comparar process.argv[1] con la URL del módulo: bajo una ruta con enlaces
// simbólicos (en macOS, /var → /private/var) esa comparación falla y el script saldría con 0 sin hacer nada.
const isMain = import.meta.main === true;
if (isMain && process.argv.includes('--self-test')) {
  const failures = selfTest();
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✘ [integrate] autoprueba: ${f}`);
    console.error(`integrate --self-test: ${failures.length} fallo(s).`);
    process.exit(1);
  }
  console.log(
    '  ✔ integrate: autoprueba con pasos falsos (para en el rojo, no sigue, guarda logs y tabla)',
  );
} else if (isMain) {
  process.exitCode = integrate(STEPS, {
    cwd: ROOT,
    logDir: LOG_DIR,
    print: (...l) => console.log(l.join('\n')),
  });
}
