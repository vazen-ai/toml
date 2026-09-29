import { ParseResult, Schema as S } from 'effect';
import { parse, stringify } from 'smol-toml';

export type TomlValue =
  boolean | number | string | Date | ReadonlyArray<TomlValue> | TomlTable;

export type TomlTable = { readonly [key: string]: TomlValue };

/**
 * Any value a TOML document can hold. smol-toml reads dates and times as
 * `Date`s.
 */
export const TomlValue: S.Schema<TomlValue> = S.suspend(() =>
  S.Union(
    S.Boolean,
    S.ValidDateFromSelf,
    S.Number,
    S.String,
    S.Array(TomlValue),
    TomlTable,
  ),
).annotations({ identifier: 'TomlValue' });

export const TomlTable: S.Schema<TomlTable> = S.Record({
  key: S.String,
  value: TomlValue,
}).annotations({ identifier: 'TomlTable' });

/**
 * The value a TOML document holds, from its text, left for the schema composed
 * after it to check, as Effect's `parseJson` does for JSON. smol-toml reads and
 * writes it, refusing an integer beyond JavaScript's safe range rather than
 * rounding it. Writing puts every table under its own header, and drops
 * comments and the difference between `1.0` and `1`.
 */
export const TomlFromText = S.transformOrFail(S.String, S.Unknown, {
  decode: (text, _, ast) =>
    ParseResult.try({
      catch: (error) => new ParseResult.Type(ast, text, messageOf(error)),
      try: () => parse(text),
    }),
  encode: (value, _, ast) =>
    ParseResult.try({
      catch: (error) => new ParseResult.Type(ast, value, messageOf(error)),
      try: () => stringify(value),
    }),
  strict: true,
}).annotations({ identifier: 'TomlFromText' });

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
