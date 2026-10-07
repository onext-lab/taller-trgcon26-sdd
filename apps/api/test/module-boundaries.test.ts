import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES_DIR = join(import.meta.dirname, '..', 'src', 'modules');
const MODULES = ['applications', 'candidates', 'jobs'] as const;
type ModuleName = (typeof MODULES)[number];

// Tablas ajenas por módulo (DEC-06): un módulo no escribe SQL sobre las tablas de otro (EC-20).
const FOREIGN_TABLES: Record<ModuleName, string[]> = {
  applications: ['job_openings', 'candidates'],
  candidates: ['applications', 'stage_changes'],
  jobs: ['applications', 'stage_changes'],
};

function sourceFiles(moduleName: ModuleName): { file: string; code: string }[] {
  const dir = join(MODULES_DIR, moduleName);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      file: `${moduleName}/${name}`,
      code: readFileSync(join(dir, name), 'utf8'),
    }));
}

/** Quita los comentarios: la prosa puede nombrar otros módulos, el código no. */
export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/** Rutas de los `import`/`export … from` (y de `import()` dinámicos) de un fichero. */
export function importSpecifiers(code: string): string[] {
  const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
  return [...stripComments(code).matchAll(pattern)].map((match) => match[2] ?? '');
}

/** Literales de cadena y plantillas que contienen SQL (una sentencia DML o `FROM`/`JOIN`). */
export function sqlLiterals(code: string): string[] {
  const literals = stripComments(code).match(
    /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g,
  );
  return (literals ?? []).filter((text) =>
    /\b(SELECT|INSERT|UPDATE|DELETE|FROM|JOIN)\b/i.test(text),
  );
}

export function mentionsTable(sql: string, table: string): boolean {
  return new RegExp(`\\b${table}\\b`, 'i').test(sql);
}

/** `import` hacia otra carpeta de `modules/` (`../otro/...`) desde un fichero del módulo. */
function crossModuleImports(moduleName: ModuleName): string[] {
  return sourceFiles(moduleName).flatMap(({ file, code }) =>
    importSpecifiers(code)
      .filter((specifier) => /^\.\.\/[^.]/.test(specifier) || /\bmodules\//.test(specifier))
      .map((specifier) => `${file} importa ${specifier}`),
  );
}

function foreignSql(moduleName: ModuleName): string[] {
  return sourceFiles(moduleName).flatMap(({ file, code }) =>
    sqlLiterals(code).flatMap((sql) =>
      FOREIGN_TABLES[moduleName]
        .filter((table) => mentionsTable(sql, table))
        .map((table) => `${file} usa ${table} en un SQL`),
    ),
  );
}

describe('fronteras entre módulos', () => {
  it.each(MODULES)('CA-21 %s no importa de otra carpeta de modules/', (moduleName) => {
    expect(crossModuleImports(moduleName)).toEqual([]);
  });

  it.each(MODULES)('CA-21 %s no escribe SQL sobre tablas ajenas (EC-20)', (moduleName) => {
    expect(foreignSql(moduleName)).toEqual([]);
  });

  it('CA-21 recorre ficheros reales y encuentra SQL propio en cada módulo (no es vacuo)', () => {
    for (const moduleName of MODULES) {
      const files = sourceFiles(moduleName);
      expect(files.length).toBeGreaterThan(2);
      expect(files.flatMap(({ code }) => sqlLiterals(code)).length).toBeGreaterThan(0);
    }
  });
});

describe('detector de las fronteras', () => {
  it('EC-20 detecta un import cruzado y un SQL ajeno, e ignora comentarios', () => {
    const code = [
      "import { x } from '../jobs/service.ts';",
      "import { y } from './local.ts';",
      '// import { z } from "../candidates/repository.ts";',
      'const sql = `SELECT id FROM job_openings WHERE id = ?`;',
      "const prose = 'El candidato no existe.';",
    ].join('\n');

    expect(importSpecifiers(code)).toEqual(['../jobs/service.ts', './local.ts']);
    expect(sqlLiterals(code)).toHaveLength(1);
    expect(mentionsTable(sqlLiterals(code)[0] ?? '', 'job_openings')).toBe(true);
    expect(mentionsTable('SELECT candidate_id FROM applications', 'candidates')).toBe(false);
  });
});
