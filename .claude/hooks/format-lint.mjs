// Hook format-lint (PostToolUse Edit|Write|MultiEdit).
// Tras escribir un fichero de código, pasa Prettier y `eslint --fix` SOLO sobre ese fichero.
// Nunca bloquea: si algo falla (dependencias sin instalar, fichero ignorado…), sale con 0.
// Usa los binarios del node_modules del repo con el mismo Node que ejecuta el hook
// (sin npx, sin red y sin depender de .cmd en Windows).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { readHookInput, repoRoot, targetPath } from './_lib.mjs';

const input = readHookInput('format-lint');
const path = targetPath(input);
if (!path || !/\.(ts|tsx|js|jsx|mjs|cjs|json|css|html)$/i.test(path)) process.exit(0);

const root = repoRoot(input?.cwd ?? process.cwd());
const file = resolve(root, path);
const rel = relative(root, file);
if (rel.startsWith('..') || rel.split(/[\\/]/).includes('node_modules') || !existsSync(file))
  process.exit(0);

const run = (cli, args) => {
  const script = join(root, 'node_modules', ...cli);
  if (!existsSync(script)) return;
  spawnSync(process.execPath, [script, ...args, file], {
    cwd: root,
    stdio: 'ignore',
    timeout: 20_000,
  });
};

run(['prettier', 'bin', 'prettier.cjs'], ['--write', '--log-level', 'silent']);
if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) {
  run(['eslint', 'bin', 'eslint.js'], ['--fix', '--no-warn-ignored']);
}
process.exit(0);
