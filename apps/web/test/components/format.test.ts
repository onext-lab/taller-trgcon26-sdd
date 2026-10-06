import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatDate, formatInteger } from '../../src/components/format.ts';

describe('formatDate', () => {
  it('pinta la fecha en Europe/Madrid como dd/mm/aaaa (EC-36)', () => {
    expect(formatDate('2026-10-06T22:30:00.000Z')).toBe('07/10/2026');
  });

  it('respeta el horario de invierno de Europe/Madrid', () => {
    expect(formatDate('2026-12-31T22:59:59.999Z')).toBe('31/12/2026');
    expect(formatDate('2026-12-31T23:00:00.000Z')).toBe('01/01/2027');
  });

  it('una cadena no parseable da «Fecha no válida», nunca «Invalid Date»', () => {
    expect(formatDate('no es una fecha')).toBe('Fecha no válida');
    expect(formatDate('')).toBe('Fecha no válida');
  });
});

describe('formatInteger', () => {
  it('separa los miles con punto en es-ES', () => {
    expect(formatInteger(32000)).toBe('32.000');
    expect(formatInteger(40000)).toBe('40.000');
  });
});

describe('formatCalendarDate', () => {
  it('EC-51 reordena una fecha de calendario sin zona horaria', () => {
    expect(formatCalendarDate('2027-04-06')).toBe('06/04/2027');
    expect(formatCalendarDate('2028-02-29')).toBe('29/02/2028');
  });

  it('otro formato da «Fecha no válida»', () => {
    for (const text of ['2027-4-6', '', '06/04/2027', '2027-04-06T00:00:00Z', ' 2027-04-06', 'x']) {
      expect(formatCalendarDate(text)).toBe('Fecha no válida');
    }
  });
});
