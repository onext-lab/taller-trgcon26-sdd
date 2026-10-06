// Hook sensitive-files (PreToolUse Edit|Write|MultiEdit|NotebookEdit).
// Bloquea la escritura en secretos, claves, lockfiles y la base de datos local.
import { deny, readHookInput, targetPath } from './_lib.mjs';

const HOOK = 'sensitive-files';
const RULES = [
  {
    test: (name) => /^\.env(\..+)?$/i.test(name) && name.toLowerCase() !== '.env.example',
    why: 'es un fichero de entorno (.env*): puede llevar secretos.',
    fix: 'El taller no usa secretos. Si necesitas documentar variables, hazlo en .env.example o en docs/SETUP.md.',
  },
  {
    test: (name) =>
      /\.(pem|key|p12|pfx|ppk)$/i.test(name) || /^id_(rsa|ed25519|ecdsa|dsa)$/i.test(name),
    why: 'es una clave o un certificado.',
    fix: 'Las claves no se escriben ni se versionan desde Claude Code. Si de verdad hace falta, lo hace la persona a mano.',
  },
  {
    test: (name) =>
      ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(
        name.toLowerCase(),
      ),
    why: 'es un lockfile: se regenera, no se edita a mano.',
    fix: 'Usa `npm install <paquete>` (o `npm uninstall`) y deja que npm lo actualice. Las dependencias nuevas se justifican en docs/07_architecture_principles/DECISIONS.md.',
  },
  {
    test: (_name, path) => /(^|\/)data\/[^/]+\.(db|sqlite3?)(-wal|-shm|-journal)?$/i.test(path),
    why: 'es la base de datos SQLite local (data/*.db), que no se versiona.',
    fix: 'Cambia el esquema con una migración en apps/api/src/db/migrations/ o los datos en apps/api/src/db/seed.ts, y ejecuta `npm run db:reset`.',
  },
];

const input = readHookInput(HOOK);
const path = targetPath(input).replace(/\\/g, '/');
if (!path) process.exit(0);

const name = path.split('/').pop() ?? '';
for (const rule of RULES) {
  if (rule.test(name, path)) {
    deny(HOOK, [`Fichero: ${path}`, `Motivo: ${rule.why}`, `Qué hacer: ${rule.fix}`]);
  }
}
process.exit(0);
