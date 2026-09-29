import { Either, Predicate, Record, Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import { TomlFromText, TomlTable, type TomlValue } from './toml-from-text';

const TomlTableFromText = S.compose(TomlFromText, TomlTable);
const decode = S.decodeEither(TomlTableFromText);
const encode = S.encodeEither(TomlTableFromText);

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
      : Predicate.isRecord(value)
        ? Record.map(value, withDatesAsText)
        : value;

describe('TomlFromText', () => {
  it('should write every kind of value so that it reads back the same', () => {
    const table = Either.getOrThrow(decode(EVERY_VALUE));
    const written = Either.getOrThrow(encode(table));

    expect(withDatesAsText(Either.getOrThrow(decode(written)))).toEqual(
      withDatesAsText(table),
    );
  });

  it('should refuse an integer beyond JavaScript’s safe range rather than round it', () => {
    expect(Either.isLeft(decode('width = 9007199254740993\n'))).toBe(true);
  });

  it('should report a syntax error with its line', () => {
    const decoded = decode('name = "Example"\nwidth = = 3\n');

    expect(Either.isLeft(decoded) && decoded.left.message).toContain('2:');
  });
});
