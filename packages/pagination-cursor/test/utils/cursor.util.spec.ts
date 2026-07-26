import { InvalidCursorException } from '../../src/errors/pagination.errors';
import { decodeCursor, encodeCursor } from '../../src/utils/cursor.util';

describe('cursor.util', () => {
  it('round-trips primitive values', () => {
    const cursor = encodeCursor(['acme', 42, true]);
    expect(decodeCursor(cursor).values).toEqual(['acme', 42, true]);
  });

  it('round-trips Date values', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const cursor = encodeCursor([date]);
    const decoded = decodeCursor(cursor).values[0];
    expect(decoded).toBeInstanceOf(Date);
    expect((decoded as Date).toISOString()).toBe(date.toISOString());
  });

  it('produces a URL-safe, opaque string', () => {
    const cursor = encodeCursor(['x/y+z=']);
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('throws InvalidCursorException for garbage input', () => {
    expect(() => decodeCursor('not-a-real-cursor')).toThrow(InvalidCursorException);
  });

  it('throws InvalidCursorException for a well-formed but tampered payload', () => {
    const tampered = Buffer.from(JSON.stringify({ v: 1 }), 'utf8').toString('base64url');
    expect(() => decodeCursor(tampered)).toThrow(InvalidCursorException);
  });

  it('throws InvalidCursorException for an unsupported cursor version', () => {
    const futureCursor = Buffer.from(JSON.stringify({ v: 999, values: [1] }), 'utf8').toString('base64url');
    expect(() => decodeCursor(futureCursor)).toThrow(InvalidCursorException);
  });
});
