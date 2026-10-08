/* eslint-disable perfectionist/sort-objects -- a table's keys follow the specification's field order, which is the order a file is written in */
import { Schema as S } from 'effect';

// A string of 8, 12, 13 or 14 digits.
const GTIN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

// Refuse a key the table cannot hold rather than dropping it.
const knownKeysOnly = <Fields extends S.Struct.Fields>(
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

// Keep reserved prototype keys out of files and model attributes.
const TomlKey = S.String.pipe(
  S.check(
    S.makeFilter((key) => key !== '__proto__', {
      description: 'a key other than "__proto__"',
    }),
  ),
);

// Any value a TOML document can hold, with dates and times as `Date`s.
type TomlValue =
  boolean | number | string | Date | ReadonlyArray<TomlValue> | TomlTable;

type TomlTable = { readonly [key: string]: TomlValue };

const TomlValue: S.Codec<TomlValue> = S.suspend(() =>
  S.Union([
    S.Boolean,
    S.Date,
    S.Number,
    S.String,
    S.Array(TomlValue),
    TomlTable,
  ]),
).annotate({ identifier: 'TomlValue' });

const TomlTable: S.Codec<TomlTable> = S.Record(S.String, TomlValue)
  .check(S.isPropertyNames(TomlKey))
  .annotate({ identifier: 'TomlTable' });

// The keys beside a table's standard keys, holding any TOML value. What a
// descriptive key may hold is a rule of a project's attributes, not of a table.
const OtherKeys = S.Record(S.String, TomlValue).check(
  S.isPropertyNames(TomlKey),
);

// Each table spells out its own shapes, so this file shows a 0.3.0 file whole
// and shares nothing that could change under it. Only two tables are named:
// equipment, which holds further equipment, and the site, which its type has
// to name.
const TomlSite = S.StructWithRest(
  S.Struct({
    product: S.Record(
      S.String,
      S.Union([S.Boolean, S.Date, S.Number, S.String]),
    ).check(S.isPropertyNames(TomlKey)),
    orientation: S.optionalKey(
      S.Literals([
        'F',
        'Fl',
        'Fr',
        'Fu',
        'B',
        'Bl',
        'Br',
        'Bu',
        'L',
        'Ll',
        'Lr',
        'Lu',
        'R',
        'Rl',
        'Rr',
        'Ru',
        'U',
        'Ul',
        'Ur',
        'Uu',
        'D',
        'Dl',
        'Dr',
        'Du',
      ]),
    ),
    facings: S.optionalKey(
      S.Struct({
        wide: S.optionalKey(S.Finite),
        high: S.optionalKey(S.Finite),
        deep: S.optionalKey(S.Finite),
      }).pipe(knownKeysOnly),
    ),
    sort_order: S.optionalKey(S.Finite),
    position: S.optionalKey(
      S.Struct({ x: S.Finite, y: S.Finite, z: S.Finite }).pipe(knownKeysOnly),
    ),
    dimensions: S.optionalKey(
      S.Struct({
        width: S.Finite,
        height: S.Finite,
        depth: S.Finite,
      }).pipe(knownKeysOnly),
    ),
  }),
  [OtherKeys],
).check(S.isPropertyNames(TomlKey));

// Equipment holds further equipment, so its type is written out for the
// recursion, and the compiler checks the table against it.
type TomlEquipment = TomlTable & {
  readonly dimensions?: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly equipment?: ReadonlyArray<TomlEquipment>;
  readonly position?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly sites?: ReadonlyArray<typeof TomlSite.Type>;
  readonly sort_order?: number;
  readonly type: string;
};

const TomlEquipment = S.StructWithRest(
  S.Struct({
    type: S.String,
    sort_order: S.optionalKey(S.Finite),
    position: S.optionalKey(
      S.Struct({ x: S.Finite, y: S.Finite, z: S.Finite }).pipe(knownKeysOnly),
    ),
    dimensions: S.optionalKey(
      S.Struct({
        width: S.Finite,
        height: S.Finite,
        depth: S.Finite,
      }).pipe(knownKeysOnly),
    ),
    equipment: S.optionalKey(
      S.Array(S.suspend((): S.Codec<TomlEquipment> => TomlEquipment)),
    ),
    sites: S.optionalKey(S.Array(TomlSite)),
  }),
  [OtherKeys],
).check(S.isPropertyNames(TomlKey));

/**
 * The tables of a 0.3.0 `.vazen.toml` file: one schema written out in full and
 * shared with nothing, so the shape a 0.3.0 file has stays fixed here for as
 * long as the package reads and writes the version. Encoded equals Type: it is
 * the file's data and no more. `VazenProjectFromVazenTomlProjectV0_3_0` reads
 * it into a project and writes it from one.
 */
export const VazenTomlProjectV0_3_0 = S.StructWithRest(
  S.Struct({
    schema: S.Literals(['vazen/spec', 'vazen/layout']),
    schema_version: S.Literal('0.3.0'),
    name: S.optionalKey(S.String),
    products: S.optionalKey(
      S.Array(
        S.StructWithRest(
          S.Struct({
            ref: S.optionalKey(S.String),
            name: S.String,
            description: S.optionalKey(S.String),
            gtin: S.optionalKey(S.String.pipe(S.check(S.isPattern(GTIN)))),
            dimensions: S.optionalKey(
              S.Struct({
                width: S.Finite,
                height: S.Finite,
                depth: S.Finite,
              }).pipe(knownKeysOnly),
            ),
            form: S.optionalKey(S.String),
            images: S.optionalKey(
              S.Struct({
                front: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
                back: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
                left: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
                right: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
                top: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
                base: S.optionalKey(
                  S.Union([
                    S.String,
                    S.StructWithRest(S.Struct({ url: S.String }), [
                      OtherKeys,
                    ]).check(S.isPropertyNames(TomlKey)),
                  ]),
                ),
              }).pipe(knownKeysOnly),
            ),
          }),
          [OtherKeys],
        ).check(S.isPropertyNames(TomlKey)),
      ),
    ),
    fixtures: S.optionalKey(
      S.Array(
        S.StructWithRest(
          S.Struct({
            id: S.optionalKey(S.String),
            name: S.optionalKey(S.String),
            dimensions: S.optionalKey(
              S.Struct({
                width: S.Finite,
                height: S.Finite,
                depth: S.Finite,
              }).pipe(knownKeysOnly),
            ),
            sort_order: S.optionalKey(S.Finite),
            equipment: S.optionalKey(S.Array(TomlEquipment)),
          }),
          [OtherKeys],
        ).check(S.isPropertyNames(TomlKey)),
      ),
    ),
  }),
  [OtherKeys],
)
  .check(S.isPropertyNames(TomlKey))
  .annotate({ identifier: 'VazenTomlProjectV0_3_0' });

export type VazenTomlProjectV0_3_0 = typeof VazenTomlProjectV0_3_0.Type;
