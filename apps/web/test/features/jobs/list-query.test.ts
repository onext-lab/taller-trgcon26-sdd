import { describe, expect, it } from 'vitest';
import { listJobs } from '../../../src/features/jobs/api.ts';
import {
  clearFiltersPath,
  hasFilters,
  listPath,
  listRequest,
  listView,
  pagePath,
  readListQuery,
  toSearch,
  totalPages,
  validateSearchText,
} from '../../../src/features/jobs/list-query.ts';
import { mockFetch } from '../../helpers/fetch.ts';

describe('readListQuery', () => {
  it('lee las cuatro claves conocidas', () => {
    expect(readListQuery('?status=published&q=gestion&page=2&pageSize=50')).toEqual([
      ['status', 'published'],
      ['q', 'gestion'],
      ['page', '2'],
      ['pageSize', '50'],
    ]);
  });

  it('conserva las claves repetidas en bruto, sin validar', () => {
    expect(readListQuery('?status=draft&status=closed&pageSize=abc&page=')).toEqual([
      ['status', 'draft'],
      ['status', 'closed'],
      ['pageSize', 'abc'],
      ['page', ''],
    ]);
  });

  it('EC-32 deja fuera las claves desconocidas', () => {
    expect(readListQuery('?sort=title&q=a&Status=draft&extra=1')).toEqual([['q', 'a']]);
    expect(readListQuery('')).toEqual([]);
  });

  it('decodifica el valor (%C3%93 y +)', () => {
    expect(readListQuery('?q=GESTI%C3%93N+n%C3%B3minas')).toEqual([['q', 'GESTIÓN nóminas']]);
  });
});

describe('toSearch', () => {
  it('escribe en orden canónico aunque los pares vengan desordenados', () => {
    expect(
      toSearch([
        ['pageSize', '50'],
        ['page', '2'],
        ['q', 'a'],
        ['status', 'draft'],
      ]),
    ).toBe('?status=draft&q=a&page=2&pageSize=50');
  });

  it('sin pares → cadena vacía; las repetidas se conservan en su orden', () => {
    expect(toSearch([])).toBe('');
    expect(
      toSearch([
        ['status', 'draft'],
        ['status', 'closed'],
      ]),
    ).toBe('?status=draft&status=closed');
  });

  it('EC-35 no normaliza: GESTIÓN → q=GESTI%C3%93N', () => {
    expect(toSearch([['q', 'GESTIÓN']])).toBe('?q=GESTI%C3%93N');
  });

  it('EC-39 [adversarial] codifica cada valor: no se pueden inyectar parámetros', () => {
    expect(toSearch([['q', '%']])).toBe('?q=%25');
    expect(toSearch([['q', 'a&status=closed']])).toBe('?q=a%26status%3Dclosed');
    expect(toSearch([['q', 'a b']])).toBe('?q=a%20b');
  });

  it('EC-39 encodeURIComponent por valor: + # ? = / y comillas no cambian la estructura de la URL', () => {
    expect(toSearch([['q', 'a+b']])).toBe('?q=a%2Bb');
    expect(toSearch([['q', '#x?y=z']])).toBe('?q=%23x%3Fy%3Dz');
    expect(toSearch([['q', '"; DROP--']])).toBe('?q=%22%3B%20DROP--');
    const params = new URLSearchParams(toSearch([['q', 'a&page=9#b']]));
    expect([...params.keys()]).toEqual(['q']);
    expect(params.get('q')).toBe('a&page=9#b');
  });

  it('EC-39 [adversarial] la petición a la API lleva ese valor codificado y ningún parámetro extra', async () => {
    const url = '/api/jobs?q=a%26status%3Dclosed';
    const mock = mockFetch({
      [`GET ${url}`]: { status: 200, json: { items: [], total: 0, page: 1, pageSize: 20 } },
    });

    await listJobs([['q', 'a&status=closed']]);

    expect(mock.calls.map((call) => call.url)).toEqual([url]);
  });
});

describe('listRequest', () => {
  it('CA-18 un pageSize válido no ofrecido (7) se pide como 20; los ofrecidos y los inválidos pasan en bruto', () => {
    expect(listRequest([['pageSize', '7']])).toEqual([['pageSize', '20']]);
    expect(listRequest([['pageSize', '50']])).toEqual([['pageSize', '50']]);
    expect(listRequest([['pageSize', '101']])).toEqual([['pageSize', '101']]);
    expect(listRequest([['q', 'x']])).toEqual([['q', 'x']]);
  });
});

describe('listView', () => {
  it('valores por defecto sin parámetros', () => {
    expect(listView([])).toEqual({ status: '', q: '', pageSize: 20 });
  });

  it('un status que no es ninguno de los tres → «Todos» (cadena vacía)', () => {
    expect(listView([['status', 'x']]).status).toBe('');
    expect(listView([['status', 'closed']]).status).toBe('closed');
  });

  it('CA-18 solo se ofrecen 20, 50 y 100; cualquier otro valor, válido o no, vuelve a 20', () => {
    expect(listView([['pageSize', '50']]).pageSize).toBe(50);
    expect(listView([['pageSize', '100']]).pageSize).toBe(100);
    for (const bad of ['7', '101', '0', '007', 'abc', '']) {
      expect(listView([['pageSize', bad]]).pageSize).toBe(20);
    }
  });

  it('con claves repetidas manda la primera', () => {
    expect(
      listView([
        ['q', 'uno'],
        ['q', 'dos'],
      ]).q,
    ).toBe('uno');
  });
});

describe('listPath y pagePath', () => {
  it('omite los valores por defecto', () => {
    expect(listPath({})).toBe('/jobs');
    expect(listPath({ status: '', q: '', page: 1, pageSize: 20 })).toBe('/jobs');
  });

  it('CA-18 canónico: /jobs?status=published&page=2 y, con 50, /jobs?status=published&pageSize=50', () => {
    expect(listPath({ status: 'published', page: 2 })).toBe('/jobs?status=published&page=2');
    expect(listPath({ status: 'published', pageSize: 50 })).toBe(
      '/jobs?status=published&pageSize=50',
    );
  });

  it('codifica el texto', () => {
    expect(listPath({ status: 'published', q: 'gestión' })).toBe(
      '/jobs?status=published&q=gesti%C3%B3n',
    );
  });

  it('pagePath conserva filtros y tamaño de la URL y cambia la página', () => {
    const query = readListQuery('?status=published&q=gestion&pageSize=50&sort=title');
    expect(pagePath(query, 2)).toBe('/jobs?status=published&q=gestion&page=2&pageSize=50');
    expect(pagePath(query, 1)).toBe('/jobs?status=published&q=gestion&pageSize=50');
  });
});

describe('clearFiltersPath y hasFilters', () => {
  it('«Quitar filtros» va a /jobs sin parámetros, también con un pageSize inválido', () => {
    expect(clearFiltersPath(readListQuery('?pageSize=abc&status=x'))).toBe('/jobs');
  });

  it('hay filtros con status o q con valor; page y pageSize no cuentan', () => {
    expect(hasFilters(readListQuery('?status=draft'))).toBe(true);
    expect(hasFilters(readListQuery('?q=a'))).toBe(true);
    expect(hasFilters(readListQuery('?page=2&pageSize=50'))).toBe(false);
    expect(hasFilters(readListQuery('?q='))).toBe(false);
    expect(hasFilters([])).toBe(false);
  });
});

describe('validateSearchText', () => {
  it('EC-34 100 caracteres es válido y 101 da error', () => {
    expect(validateSearchText('a'.repeat(100))).toEqual({ ok: true, value: 'a'.repeat(100) });
    expect(validateSearchText('a'.repeat(101))).toEqual({
      ok: false,
      error: 'La búsqueda no puede pasar de 100 caracteres.',
    });
  });

  it('cuenta puntos de código, no unidades UTF-16', () => {
    expect(validateSearchText('😀'.repeat(100)).ok).toBe(true);
    expect(validateSearchText('😀'.repeat(101)).ok).toBe(false);
  });

  it('recorta los extremos antes de contar y de enviar', () => {
    expect(validateSearchText(`  ${'a'.repeat(100)}  `)).toEqual({
      ok: true,
      value: 'a'.repeat(100),
    });
    expect(validateSearchText('   ')).toEqual({ ok: true, value: '' });
  });

  it('EC-33 rechaza un carácter de control en el interior (tabulador, DEL, NUL)', () => {
    const error = { ok: false, error: 'La búsqueda no puede tener caracteres de control.' };
    expect(validateSearchText('a\tb')).toEqual(error);
    expect(validateSearchText('a\u007Fb')).toEqual(error);
    expect(validateSearchText('a\u0000b')).toEqual(error);
  });

  it('EC-35 no normaliza: conserva mayúsculas y tildes', () => {
    expect(validateSearchText('GESTIÓN')).toEqual({ ok: true, value: 'GESTIÓN' });
  });
});

describe('totalPages', () => {
  it('max(1, ceil(total / pageSize))', () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(101, 50)).toBe(3);
  });
});
