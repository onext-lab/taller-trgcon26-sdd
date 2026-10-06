// Hook typecheck-precommit (PreToolUse Bash, solo `git commit`).
//
// Antes de un commit con ficheros .ts/.tsx, ejecuta el typecheck de los workspaces afectados
// y BLOQUEA si falla: la base empieza en verde, así que un error es un error nuevo.
// - Un commit solo de docs o config no dispara nada.
// - Si el mismo comando hace `git add … && git commit`, también cuenta lo modificado sin stage
//   (en PreToolUse el `git add` aún no ha ocurrido).
// - Sin escape: si hay que comitear con errores de tipos, que lo decida la persona.
import { execFileSync, spawnSync } from 'node:child_process';
import { commandSegments, deny, gitArgs, readHookInput, repoRoot } from './_lib.mjs';

const HOOK = 'typecheck-precommit';
const input = readHookInput(HOOK);
const command = input?.tool_input?.command;
if (typeof command !== 'string') process.exit(0);

const segments = commandSegments(command).map((words) => gitArgs(words) ?? []);
if (!segments.some((args) => args[0] === 'commit')) process.exit(0);
const addsInSameCommand = segments.some((args) => args[0] === 'add');

const root = repoRoot(input?.cwd ?? process.cwd());
const git = (...args) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
};

const files = new Set(git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n'));
if (addsInSameCommand) {
  for (const file of git('ls-files', '--modified', '--others', '--exclude-standard').split('\n'))
    files.add(file);
}
const tsFiles = [...files].filter((file) => /\.(ts|tsx|mts|cts)$/.test(file));
if (tsFiles.length === 0) process.exit(0);

// Workspace → comando de typecheck. Lo que no está en apps/ lo cubre el tsconfig de la raíz (e2e/, configs).
const checks = new Map();
for (const file of tsFiles) {
  const workspace = /^apps\/(api|web)\//.exec(file)?.[0]?.slice(0, -1);
  if (workspace) checks.set(workspace, ['run', 'typecheck', '-w', workspace]);
  else checks.set('raíz', ['exec', '--no', '--', 'tsc', '-p', 'tsconfig.json']);
}

const failures = [];
for (const [name, args] of checks) {
  const result = spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
      .trim()
      .split('\n')
      .slice(-30)
      .join('\n');
    failures.push(
      `--- ${name} (npm ${args.join(' ')}) ---\n${output || result.error?.message || 'sin salida'}`,
    );
  }
}

if (failures.length > 0) {
  deny(HOOK, [
    'El typecheck falla en los workspaces con ficheros .ts/.tsx de este commit:',
    ...failures,
    'Qué hacer: corrige los errores de tipos (`npm run typecheck`) y repite el commit.',
  ]);
}
process.exit(0);
