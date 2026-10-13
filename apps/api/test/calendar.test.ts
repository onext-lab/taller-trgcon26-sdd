import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  formatCalendarDate,
  isCalendarDate,
  isDeadlinePassed,
  madridCalendarDate,
} from '../src/calendar.ts';

// Datos inventados. Funciones puras: sin reloj ni base.
describe('isCalendarDate', () => {
  it.each(['2026-10-13', '2028-02-29', '0050-01-01'])('acepta %s', (text) => {
    expect(isCalendarDate(text)).toBe(true);
  });

  it.each([
    '2026-02-31',
    '2026-13-01',
    '2027-02-29',
    ' 2026-10-13',
    '2026-10-13 ',
    '2026-10-13T00:00:00Z',
    '13/10/2026',
    '2026-10-13\u0000',
    '',
  ])('rechaza %j', (text) => {
    expect(isCalendarDate(text)).toBe(false);
  });
});

describe('addCalendarDays', () => {
  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-10-13', -3, '2026-10-10'],
    ['2026-10-13', 14, '2026-10-27'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-03-28', 1, '2026-03-29'],
    ['2026-03-28', 2, '2026-03-30'],
    ['2026-10-24', 1, '2026-10-25'],
    ['2026-10-24', 2, '2026-10-26'],
    ['2026-10-26', -1, '2026-10-25'],
  ])('%s %i días → %s', (date, days, expected) => {
    expect(addCalendarDays(date, days)).toBe(expected);
  });
});

describe('formatCalendarDate', () => {
  it('2026-10-13 → 13/10/2026', () => {
    expect(formatCalendarDate('2026-10-13')).toBe('13/10/2026');
  });
});

describe('isDeadlinePassed', () => {
  it.each([
    [null, '2026-10-13', false],
    ['2026-10-13', '2026-10-13', false],
    ['2026-10-12', '2026-10-13', true],
    ['2026-10-14', '2026-10-13', false],
  ])('%s frente a hoy %s → %s', (deadline, today, expected) => {
    expect(isDeadlinePassed(deadline, today)).toBe(expected);
  });
});

describe('madridCalendarDate (RNF-01)', () => {
  it.each([
    ['2026-10-13T21:59:59Z', '2026-10-13'],
    ['2026-10-13T22:00:00Z', '2026-10-14'],
    ['2026-03-28T23:00:00Z', '2026-03-29'],
    ['2026-10-25T22:59:59Z', '2026-10-25'],
    ['2026-10-25T23:00:00Z', '2026-10-26'],
  ])('%s → %s', (instant, expected) => {
    expect(madridCalendarDate(instant)).toBe(expected);
  });
});
