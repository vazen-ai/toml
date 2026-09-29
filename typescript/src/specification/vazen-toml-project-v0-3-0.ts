/* eslint-disable perfectionist/sort-objects, perfectionist/sort-object-types -- a table's keys follow the specification's field order, which is the order a file is written in */
import { Schema as S } from 'effect';

// A string of 8, 12, 13 or 14 digits.
const GTIN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

// A table with only the keys the specification gives it refuses another rather
// than dropping it.
const CLOSED = { parseOptions: { onExcessProperty: 'error' } } as const;

// Any value a TOML document can hold, with dates and times as `Date`s.
type TomlValue =
  boolean | number | string | Date | ReadonlyArray<TomlValue> | TomlTable;

type TomlTable = { readonly [key: string]: TomlValue };

const TomlValue: S.Schema<TomlValue> = S.suspend(() =>
  S.Union(
    S.Boolean,
    S.ValidDateFromSelf,
    S.Number,
    S.String,
    S.Array(TomlValue),
    TomlTable,
  ),
).annotations({ identifier: 'TomlValue' });

const TomlTable: S.Schema<TomlTable> = S.Record({
  key: S.String,
  value: TomlValue,
}).annotations({ identifier: 'TomlTable' });

// The keys beside a table's standard keys, holding any TOML value. What a
// descriptive key may hold is a rule of a project's attributes, not of a table.
const OtherKeys = S.Record({ key: S.String, value: TomlValue });

// Each table spells out its own shapes, so this file shows a 0.3.0 file whole
// and shares nothing that could change under it. Only two tables are named:
// equipment, which holds further equipment, and the site, which its type has
// to name.
const TomlSite = S.Struct(
  {
    product: S.Record({
      key: S.String,
      value: S.Union(S.Boolean, S.ValidDateFromSelf, S.Number, S.String),
    }),
    orientation: S.optionalWith(
      S.Literal(
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
      ),
      { exact: true },
    ),
    facings: S.optionalWith(
      S.Struct({
        wide: S.optionalWith(S.Finite, { exact: true }),
        high: S.optionalWith(S.Finite, { exact: true }),
        deep: S.optionalWith(S.Finite, { exact: true }),
      }).annotations(CLOSED),
      { exact: true },
    ),
    sort_order: S.optionalWith(S.Finite, { exact: true }),
    position: S.optionalWith(
      S.Struct({ x: S.Finite, y: S.Finite, z: S.Finite }).annotations(CLOSED),
      { exact: true },
    ),
    dimensions: S.optionalWith(
      S.Struct({
        width: S.Finite,
        height: S.Finite,
        depth: S.Finite,
      }).annotations(CLOSED),
      { exact: true },
    ),
  },
  OtherKeys,
);

// Equipment holds further equipment, so its type is written out for the
// recursion, and the compiler checks the table against it.
type TomlEquipment = TomlTable & {
  readonly type: string;
  readonly sort_order?: number;
  readonly position?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly dimensions?: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly equipment?: ReadonlyArray<TomlEquipment>;
  readonly sites?: ReadonlyArray<typeof TomlSite.Type>;
};

const TomlEquipment = S.Struct(
  {
    type: S.String,
    sort_order: S.optionalWith(S.Finite, { exact: true }),
    position: S.optionalWith(
      S.Struct({ x: S.Finite, y: S.Finite, z: S.Finite }).annotations(CLOSED),
      { exact: true },
    ),
    dimensions: S.optionalWith(
      S.Struct({
        width: S.Finite,
        height: S.Finite,
        depth: S.Finite,
      }).annotations(CLOSED),
      { exact: true },
    ),
    equipment: S.optionalWith(
      S.Array(S.suspend((): S.Schema<TomlEquipment> => TomlEquipment)),
      { exact: true },
    ),
    sites: S.optionalWith(S.Array(TomlSite), { exact: true }),
  },
  OtherKeys,
);

/**
 * The tables of a 0.3.0 `.vazen.toml` file: one schema written out in full and
 * shared with nothing, so the shape a 0.3.0 file has stays fixed here for as
 * long as the package reads and writes the version. Encoded equals Type: it is
 * the file's data and no more. `VazenProjectFromVazenTomlProjectV0_3_0` reads
 * it into a project and writes it from one.
 */
export const VazenTomlProjectV0_3_0 = S.Struct(
  {
    schema: S.Literal('vazen/spec', 'vazen/layout'),
    schema_version: S.Literal('0.3.0'),
    name: S.optionalWith(S.String, { exact: true }),
    products: S.optionalWith(
      S.Array(
        S.Struct(
          {
            ref: S.optionalWith(S.String, { exact: true }),
            name: S.String,
            description: S.optionalWith(S.String, { exact: true }),
            gtin: S.optionalWith(S.String.pipe(S.pattern(GTIN)), {
              exact: true,
            }),
            dimensions: S.optionalWith(
              S.Struct({
                width: S.Finite,
                height: S.Finite,
                depth: S.Finite,
              }).annotations(CLOSED),
              { exact: true },
            ),
            form: S.optionalWith(S.String, { exact: true }),
            images: S.optionalWith(
              S.Struct({
                front: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
                back: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
                left: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
                right: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
                top: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
                base: S.optionalWith(
                  S.Union(S.String, S.Struct({ url: S.String }, OtherKeys)),
                  { exact: true },
                ),
              }).annotations(CLOSED),
              { exact: true },
            ),
          },
          OtherKeys,
        ),
      ),
      { exact: true },
    ),
    fixtures: S.optionalWith(
      S.Array(
        S.Struct(
          {
            id: S.optionalWith(S.String, { exact: true }),
            name: S.optionalWith(S.String, { exact: true }),
            dimensions: S.optionalWith(
              S.Struct({
                width: S.Finite,
                height: S.Finite,
                depth: S.Finite,
              }).annotations(CLOSED),
              { exact: true },
            ),
            sort_order: S.optionalWith(S.Finite, { exact: true }),
            equipment: S.optionalWith(S.Array(TomlEquipment), { exact: true }),
          },
          OtherKeys,
        ),
      ),
      { exact: true },
    ),
  },
  OtherKeys,
).annotations({ identifier: 'VazenTomlProjectV0_3_0' });

export type VazenTomlProjectV0_3_0 = typeof VazenTomlProjectV0_3_0.Type;
