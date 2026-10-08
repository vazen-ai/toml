import { Array as A, Option, Record, Schema as S } from 'effect';

import { TomlTable } from './toml-from-text';

// A single leading underscore; the namespace, a domain with its dots as
// underscores, so its labels may hold hyphens; a double underscore; then a key
// of at least one character. Any namespace is read, even a generic word the
// specification advises against: which to use is up to whoever writes the file.
const NAMESPACED_KEY = /^_[a-z\d-]+(?:_[a-z\d-]+)*__./;

/** The namespace of a PSA column kept as an attribute, as in `_psa__brand`. */
export const PSA_KEY_PREFIX = '_psa__';

/** Refuse extra keys when reading or writing a model. */
export const knownKeysOnly = <Fields extends S.Struct.Fields>(
  schema: S.Struct<Fields>,
) =>
  schema.rebuild(
    S.StructWithRest(schema, [
      S.Record(
        S.String.check(
          S.makeFilter((key) => !Object.hasOwn(schema.fields, key)),
        ),
        S.Never,
      ),
    ]).ast,
  );

/**
 * A TOML scalar: what a product selector matches on, and what a descriptive key
 * holds.
 */
export const VazenAttributeScalar = S.Union([
  S.Boolean,
  S.Date,
  S.Number,
  S.String,
]).annotate({ identifier: 'VazenAttributeScalar' });

export type VazenAttributeScalar = typeof VazenAttributeScalar.Type;

/**
 * The keys an object carries beside its standard fields, named as in the file.
 * A namespaced key, such as `_example_org__supplier_code`, holds any value; a
 * descriptive key, any other such as `brand`, holds a scalar or an array of
 * scalars.
 */
export const VazenAttributes = TomlTable.pipe(
  S.check(
    S.makeFilter((attributes) =>
      A.getSomes(
        A.map(Record.toEntries(attributes), ([key, value]) =>
          NAMESPACED_KEY.test(key) || isDescriptiveValue(value)
            ? Option.none()
            : Option.some({
                issue:
                  'a descriptive key holds a scalar or an array of scalars; a table needs a namespaced key',
                path: [key],
              }),
        ),
      ),
    ),
  ),
).annotate({ identifier: 'VazenAttributes' });

export type VazenAttributes = typeof VazenAttributes.Type;

const isDescriptiveValue = S.is(
  S.Union([VazenAttributeScalar, S.Array(VazenAttributeScalar)]),
);
