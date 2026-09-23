import { describe, expect, it } from 'vitest';

import { psaStringify } from './psa-stringify';

describe('psaStringify', () => {
  it('should stringify simple values', () => {
    expect(psaStringify(['hello'])).toBe('hello');
    expect(psaStringify(['hello', 'world'])).toBe('hello\nworld');
  });

  it('should stringify arrays as comma-separated values', () => {
    expect(psaStringify([['a', 'b', 'c']])).toBe('a,b,c');
    expect(
      psaStringify([
        ['x', 'y'],
        ['1', '2'],
      ]),
    ).toBe('x,y\n1,2');
  });

  it('should escape backslashes', () => {
    expect(psaStringify([String.raw`a\b`])).toBe(String.raw`a\\b`);
    expect(psaStringify(['\\'])).toBe('\\\\');
    expect(psaStringify(['\\\\'])).toBe('\\\\\\\\');
  });

  it('should escape commas', () => {
    expect(psaStringify(['a,b'])).toBe(String.raw`a\,b`);
    expect(psaStringify([','])).toBe(String.raw`\,`);
    expect(psaStringify(['x,y,z'])).toBe(String.raw`x\,y\,z`);
  });

  it('should escape both backslashes and commas correctly', () => {
    expect(psaStringify([String.raw`a\,b`])).toBe(String.raw`a\\\,b`);
    expect(psaStringify([String.raw`\,`])).toBe(String.raw`\\\,`);
    expect(psaStringify([String.raw`a,b\c`])).toBe(String.raw`a\,b\\c`);
  });

  it('should handle arrays with escaped values', () => {
    expect(psaStringify([[String.raw`a\b`, 'c,d']])).toBe(
      String.raw`a\\b,c\,d`,
    );
    expect(psaStringify([['\\', ',']])).toBe(String.raw`\\,\,`);
  });

  it('should handle mixed arrays and non-arrays', () => {
    expect(psaStringify(['header', ['a', 'b'], 'footer'])).toBe(
      'header\na,b\nfooter',
    );
    expect(psaStringify([['x', 'y'], 'single', ['1', '2']])).toBe(
      'x,y\nsingle\n1,2',
    );
  });

  it('should convert non-string values to strings', () => {
    expect(psaStringify([123])).toBe('123');
    expect(psaStringify([true])).toBe('true');
    expect(psaStringify([null])).toBe('null');
    expect(psaStringify([undefined])).toBe('undefined');
    expect(psaStringify([[1, 2, 3]])).toBe('1,2,3');
  });

  it('should handle empty inputs', () => {
    expect(psaStringify([])).toBe('');
    expect(psaStringify([[]])).toBe('');
  });

  it('should handle empty strings', () => {
    expect(psaStringify([''])).toBe('');
    expect(psaStringify([['', '']])).toBe(',');
    expect(psaStringify(['', 'data'])).toBe('\ndata');
  });

  it('should handle complex real-world examples', () => {
    const input = [
      ['Name', 'Path', 'Description'],
      [
        String.raw`File\Backup`,
        String.raw`C:\data\file.txt`,
        'Contains, commas',
      ],
      'metadata',
    ];
    const expected =
      'Name,Path,Description\nFile\\\\Backup,C:\\\\data\\\\file.txt,Contains\\, commas\nmetadata';
    expect(psaStringify(input)).toBe(expected);
  });
});
