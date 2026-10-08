import { Effect, Schema as S, SchemaGetter, SchemaIssue } from 'effect';
import { parse, stringify } from 'smol-toml';

// Keep reserved prototype keys out of files and model attributes.
export const TomlKey = S.String.pipe(
  S.check(
    S.makeFilter((key) => key !== '__proto__', {
      description: 'a key other than "__proto__"',
    }),
  ),
);

export type TomlValue =
  boolean | number | string | Date | ReadonlyArray<TomlValue> | TomlTable;

export type TomlTable = { readonly [key: string]: TomlValue };

/**
 * Any value a TOML document can hold. smol-toml reads dates and times as
 * `Date`s.
 */
export const TomlValue: S.Codec<TomlValue> = S.suspend(() =>
  S.Union([
    S.Boolean,
    S.Date,
    S.Number,
    S.String,
    S.Array(TomlValue),
    TomlTable,
  ]),
).annotate({ identifier: 'TomlValue' });

export const TomlTable: S.Codec<TomlTable> = S.Record(S.String, TomlValue)
  .check(S.isPropertyNames(TomlKey))
  .annotate({
    identifier: 'TomlTable',
  });

/**
 * The value a TOML document holds, from its text, left for the schema composed
 * after it to check, as Effect's `parseJson` does for JSON. smol-toml reads and
 * writes it, refusing an integer beyond JavaScript's safe range rather than
 * rounding it. Writing puts every table under its own header, and drops
 * comments and the difference between `1.0` and `1`.
 */
export const TomlFromText = S.String.pipe(
  S.decodeTo(S.Unknown, {
    decode: SchemaGetter.transformEffect((text, _) =>
      Effect.try({
        catch: (error) =>
          new SchemaIssue.InvalidValue({ message: messageOf(error) }, text),
        try: () => parse(text),
      }),
    ),
    encode: SchemaGetter.transformEffect((value, _) =>
      Effect.try({
        catch: (error) =>
          new SchemaIssue.InvalidValue({ message: messageOf(error) }, value),
        try: () => stringify(value),
      }),
    ),
  }),
).annotate({ identifier: 'TomlFromText' });

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
