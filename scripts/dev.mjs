// Arranca api (Fastify, :3001) y web (Vite, :5173) a la vez, sin dependencias extra.
// Ctrl+C para los dos.
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const children = ['apps/api', 'apps/web'].map((workspace) =>
  spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: isWindows }),
);

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const child of children) {
  child.on('exit', (code) => stopAll(code ?? 0));
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
