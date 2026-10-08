import { Predicate, Record, Result, Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import { TomlFromText, TomlTable, type TomlValue } from './toml-from-text';

const TomlTableFromText = TomlFromText.pipe(S.decodeTo(TomlTable));
const decode = S.decodeResult(TomlTableFromText);
const encode = S.encodeResult(TomlTableFromText);

// Every kind of value TOML holds, in the places a writer treats differently.
const EVERY_VALUE = String.raw`title = "Quote \" backslash \\ tab \t newline \n delete \u007f café"
"key with spaces" = 1
"dotted.key" = 2
"" = "empty key"
integer = -42
float = 1.5
small = 1e-7
large = 1152921504606846976.0
not_a_number = nan
infinity = inf
negative_infinity = -inf
yes = true
no = false
local_date = 2026-09-23
local_time = 07:32:00.000
local_date_time = 2026-09-23T07:32:00.000
offset_date_time = 1979-05-27T07:32:00.000-08:00
nested = [[1, 2], ["a"], []]
mixed = [1, "two", { three = 3 }]
empty_table = {}
table = { list_of_tables = [{ a = 1 }, { b = { c = [] } }] }

[[section]]
name = "first"

[[section.inner]]
name = "inner of first"

[[section]]
name = "second"
`;

// A date as TOML wrote it, so a local date written back as a date-time compares
// unequal.
const withDatesAsText = (value: TomlValue): unknown =>
  Predicate.isDate(value)
    ? value.toISOString()
    : Array.isArray(value)
      ? value.map(withDatesAsText)
      : Predicate.isObject(value)
        ? Record.map(value, withDatesAsText)
        : value;

describe('TomlFromText', () => {
  it('should write every kind of value so that it reads back the same', () => {
    const table = Result.getOrThrow(decode(EVERY_VALUE));
    const written = Result.getOrThrow(encode(table));

    expect(withDatesAsText(Result.getOrThrow(decode(written)))).toEqual(
      withDatesAsText(table),
    );
  });

  it('should refuse an integer beyond JavaScript’s safe range rather than round it', () => {
    expect(Result.isFailure(decode('width = 9007199254740993\n'))).toBe(true);
  });

  it('should report a syntax error with its line', () => {
    const decoded = decode('name = "Example"\nwidth = = 3\n');

    expect(Result.isFailure(decoded) && decoded.failure.message).toContain(
      '2:',
    );
  });

  it.each([
    ['at the top', '__proto__ = "Dummy"\n'],
    ['in a nested table', '[a]\n__proto__ = { x = 1 }\n'],
    ['in a list of tables', '[[a]]\n__proto__ = "Dummy"\n'],
  ])('should refuse `__proto__` as a key %s', (_, text) => {
    const decoded = decode(text);

    expect(Result.isFailure(decoded) && decoded.failure.message).toContain(
      '["__proto__"]',
    );
  });

  it('should keep `constructor` and `toString` as keys, with a plain prototype', () => {
    const table = Result.getOrThrow(
      decode('constructor = "C"\n[a]\ntoString = "T"\n'),
    );

    expect(table).toEqual({ a: { toString: 'T' }, constructor: 'C' });
    expect(Object.getPrototypeOf(table)).toBe(Object.prototype);
    expect(Result.getOrThrow(decode(Result.getOrThrow(encode(table))))).toEqual(
      table,
    );
  });
});
