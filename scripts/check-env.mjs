// npm run check:env — comprueba que el portátil está listo para el taller.
// Sale con 1 y dice qué hacer si algo falla. Ver docs/SETUP.md.
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';

const MIN_NODE = [24, 15, 0];
const PORTS = [
  { port: Number(process.env.API_PORT ?? 3001), what: 'la API (Fastify)' },
  { port: Number(process.env.WEB_PORT ?? 5173), what: 'la web (Vite)' },
];

const failures = [];
const ok = (msg) => console.log(`  ✔ ${msg}`);
const fail = (msg, fix) => {
  failures.push(msg);
  console.log(`  ✘ ${msg}\n    → ${fix}`);
};

function checkNode() {
  const current = process.versions.node.split('.').map(Number);
  const tooOld = current[0] !== MIN_NODE[0] ? current[0] < MIN_NODE[0] : current[1] < MIN_NODE[1];
  if (tooOld) {
    fail(
      `Node ${process.versions.node} es demasiado antiguo: el mínimo es ${MIN_NODE.join('.')} (Node 24 LTS).`,
      'Instala Node 24 LTS y actívalo: con nvm, `nvm install 24 && nvm use 24`; con fnm, `fnm install 24 && fnm use 24`; o el instalador de https://nodejs.org. Detalle en docs/SETUP.md.',
    );
  } else {
    ok(`Node ${process.versions.node} (mínimo ${MIN_NODE.join('.')})`);
  }
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function checkPorts() {
  for (const { port, what } of PORTS) {
    if (await portIsFree(port)) ok(`Puerto ${port} libre (${what})`);
    else
      fail(
        `El puerto ${port}, que usa ${what}, está ocupado.`,
        `Cierra lo que lo esté usando (¿un \`npm run dev\` abierto en otra terminal?). Para ver qué es: \`lsof -i :${port}\` en macOS/Linux o \`netstat -ano | findstr :${port}\` en Windows.`,
      );
  }
}

function checkDependencies() {
  if (!existsSync(new URL('../node_modules/', import.meta.url))) {
    fail('No están instaladas las dependencias.', 'Ejecuta `npm ci` en la raíz del repo.');
    return false;
  }
  ok('Dependencias instaladas (node_modules)');
  return true;
}

async function checkChromium() {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('@playwright/test'));
  } catch {
    fail('No se encuentra @playwright/test.', 'Ejecuta `npm ci` en la raíz del repo.');
    return;
  }
  const executable = chromium.executablePath();
  if (executable && existsSync(executable)) ok('Navegador Chromium de Playwright instalado');
  else
    fail(
      'Falta el navegador Chromium de Playwright.',
      'Ejecuta `npx playwright install chromium` (es una descarga grande: hazlo antes del taller, no con la wifi del congreso).',
    );
}

console.log('Comprobando el entorno del taller…');
checkNode();
await checkPorts();
if (checkDependencies()) await checkChromium();

if (failures.length > 0) {
  console.log(
    `\n${failures.length} comprobación(es) fallida(s). Corrige lo indicado y vuelve a ejecutar \`npm run check:env\`.`,
  );
  process.exit(1);
}
console.log('\nTodo listo para el taller.');
