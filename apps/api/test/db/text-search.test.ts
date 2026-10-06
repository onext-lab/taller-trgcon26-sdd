import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.ts';
import { foldSearchText, registerTextSearch } from '../../src/db/text-search.ts';

// Datos inventados.
describe('foldSearchText', () => {
  it.each([
    ['GESTIÓN de Proveedores', 'gestion de proveedores'],
    ['Peña', 'pena'],
    ['Año', 'ano'],
    ['Ñandú', 'nandu'],
    ['Técnico/a de gestión', 'tecnico/a de gestion'],
    ['', ''],
  ])('foldSearchText: minúsculas, sin tildes, ñ → n: %j → %j', (input, expected) => {
    expect(foldSearchText(input)).toBe(expected);
  });

  it('foldSearchText: entrada en NFD da lo mismo que en NFC', () => {
    const nfd = 'Gestión de Peña'.normalize('NFD');

    expect(nfd).not.toBe('Gestión de Peña');
    expect(foldSearchText(nfd)).toBe('gestion de pena');
    expect(foldSearchText(nfd)).toBe(foldSearchText('Gestión de Peña'));
  });
});

describe('registerTextSearch', () => {
  it('registra fold_search, deja pasar lo que no es texto y admite un segundo registro', () => {
    const db = openDatabase(':memory:');
    registerTextSearch(db);
    registerTextSearch(db);

    const row = db
      .prepare('SELECT fold_search(?) AS folded, fold_search(NULL) AS missing')
      .get('ÁRBOL');

    expect(row).toEqual({ folded: 'arbol', missing: null });
    db.close();
  });
});
