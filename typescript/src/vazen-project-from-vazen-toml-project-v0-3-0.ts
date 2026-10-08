import {
  Array as A,
  flow,
  Option,
  Record,
  Result,
  Schema as S,
  SchemaGetter,
  Struct,
} from 'effect';

import { Orientation as VazenOrientation } from './orientation';
import { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import { TomlTable, TomlValue } from './toml-from-text';
import { knownKeysOnly, VazenAttributes } from './vazen-attributes';
import type { VazenEquipment } from './vazen-equipment';
import { VazenDimensions, VazenPosition } from './vazen-geometry';
import { VazenGtin, VazenProductImage } from './vazen-product';
import { VazenProject } from './vazen-project';
import { VazenProductSelector } from './vazen-site';

const VERSION = '0.3.0' as const;

// Any key a table's schema does not name.
const OtherKeys = S.Record(S.String, TomlValue);

// Each table's schema, reached through the file's, so the keys treated as
// standard and the shapes read and written are the file's own.
const TomlProject = VazenTomlProjectV0_3_0;
const TomlProduct = TomlProject.schema.fields.products.schema.value;
const TomlProductImages = TomlProduct.schema.fields.images.schema;
const TomlProductImage = TomlProductImages.fields.front.schema;
const TomlProductImageTable = TomlProductImage.members[1];
const TomlFixture = TomlProject.schema.fields.fixtures.schema.value;
const TomlEquipment = TomlFixture.schema.fields.equipment.schema.value;
const TomlSite = TomlEquipment.schema.fields.sites.schema.value;

// Reads a table's keys beyond `fields` into `attributes`, and writes them back
// beside the fields, refusing an attribute named for a field, which would
// overwrite it. The table's own schema, composed before this, checks what is
// written and puts its fields in the file's order.
const withAttributes = (fields: S.Struct.Fields) => {
  const isField = (key: string) => Record.has(fields, key);
  return TomlTable.pipe(
    S.decodeTo(
      S.StructWithRest(S.Struct({ attributes: TomlTable }), [OtherKeys]).pipe(
        S.check(
          S.makeFilter(({ attributes }) =>
            A.findFirst(Record.keys(attributes), isField).pipe(
              Option.map(
                (key) =>
                  `an attribute named "${key}" would overwrite the standard key`,
              ),
              Option.getOrElse(() => true),
            ),
          ),
        ),
      ),
      {
        decode: SchemaGetter.transform((table) => {
          const [standard, attributes] = Record.partition(
            table,
            (value, key) =>
              isField(key) ? Result.succeed(value) : Result.fail(value),
          );
          return { ...standard, attributes };
        }),
        encode: SchemaGetter.transform(({ attributes, ...standard }) => ({
          ...standard,
          ...attributes,
        })),
      },
    ),
  );
};

// Reads an absent list as empty and writes an empty list as absent, since the
// specification says they mean the same.
const optionalList = <Item, Encoded>(item: S.Codec<Item, Encoded>) =>
  S.optionalKey(S.Array(item)).pipe(
    S.decodeTo(S.Array(S.toType(item)), {
      decode: SchemaGetter.transformOptional(
        flow(
          Option.getOrElse(() => []),
          Option.some,
        ),
      ),
      encode: SchemaGetter.transformOptional(
        Option.flatMap((items) =>
          Option.liftPredicate(items, A.isReadonlyArrayNonEmpty),
        ),
      ),
    }),
  );

const VazenFacingsFromTomlFacings = S.Struct({
  deep: S.OptionFromOptionalKey(S.Finite),
  high: S.OptionFromOptionalKey(S.Finite),
  wide: S.OptionFromOptionalKey(S.Finite),
}).pipe(knownKeysOnly);

const VazenSiteFromTomlSite = TomlSite.pipe(
  S.decodeTo(withAttributes(TomlSite.schema.fields)),
  S.decodeTo(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.OptionFromOptionalKey(VazenDimensions),
      facings: S.OptionFromOptionalKey(VazenFacingsFromTomlFacings),
      orientation: S.OptionFromOptionalKey(VazenOrientation),
      position: S.OptionFromOptionalKey(VazenPosition),
      product: VazenProductSelector,
      sortOrder: S.OptionFromOptionalKey(S.Finite),
    })
      .pipe(knownKeysOnly)
      .pipe(S.encodeKeys({ sortOrder: 'sort_order' })),
  ),
);

const VazenEquipmentFromTomlEquipment: S.Codec<
  VazenEquipment,
  typeof TomlEquipment.Encoded
> = TomlEquipment.pipe(
  S.decodeTo(withAttributes(TomlEquipment.schema.fields)),
  S.decodeTo(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.OptionFromOptionalKey(VazenDimensions),
      equipment: optionalList(S.suspend(() => VazenEquipmentFromTomlEquipment)),
      position: S.OptionFromOptionalKey(VazenPosition),
      sites: optionalList(VazenSiteFromTomlSite),
      sortOrder: S.OptionFromOptionalKey(S.Finite),
      type: S.String,
    })
      .pipe(knownKeysOnly)
      .pipe(S.encodeKeys({ sortOrder: 'sort_order' })),
  ),
);

const VazenFixtureFromTomlFixture = TomlFixture.pipe(
  S.decodeTo(withAttributes(TomlFixture.schema.fields)),
  S.decodeTo(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.OptionFromOptionalKey(VazenDimensions),
      equipment: optionalList(VazenEquipmentFromTomlEquipment),
      id: S.OptionFromOptionalKey(S.String),
      name: S.OptionFromOptionalKey(S.String),
      sortOrder: S.OptionFromOptionalKey(S.Finite),
    })
      .pipe(knownKeysOnly)
      .pipe(S.encodeKeys({ sortOrder: 'sort_order' })),
  ),
);

const VazenProductImageFromTomlProductImageTable = TomlProductImageTable.pipe(
  S.decodeTo(withAttributes(TomlProductImageTable.schema.fields)),
  S.decodeTo(
    S.Struct({ attributes: TomlTable, url: S.String }).pipe(knownKeysOnly),
  ),
);

// An image with nothing but its URL is written as the URL alone.
const VazenProductImageFromTomlProductImage = S.Union([
  S.String.pipe(
    S.decodeTo(
      VazenProductImage.pipe(
        S.check(
          S.makeFilter((image) => Record.isEmptyRecord(image.attributes)),
        ),
      ),
      {
        decode: SchemaGetter.transform((url) => ({ attributes: {}, url })),
        encode: SchemaGetter.transform(({ url }) => url),
      },
    ),
  ),
  VazenProductImageFromTomlProductImageTable,
]);

const VazenProductImagesFromTomlProductImages = S.Struct({
  back: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
  base: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
  front: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
  top: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
  right: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
  left: S.OptionFromOptionalKey(VazenProductImageFromTomlProductImage),
}).pipe(knownKeysOnly);

// `description` is a standard key of the file and an attribute of the project.
const VazenProductFromTomlProduct = TomlProduct.pipe(
  S.decodeTo(
    withAttributes(Struct.omit(TomlProduct.schema.fields, ['description'])),
  ),
  S.decodeTo(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.OptionFromOptionalKey(VazenDimensions),
      form: S.OptionFromOptionalKey(S.String),
      gtin: S.OptionFromOptionalKey(VazenGtin),
      images: S.OptionFromOptionalKey(VazenProductImagesFromTomlProductImages),
      name: S.String,
      ref: S.OptionFromOptionalKey(S.String),
    }).pipe(knownKeysOnly),
  ),
);

/**
 * A project from the tables of a 0.3.0 `.vazen.toml` file. Reading fills
 * nothing in: an absent key is `Option.none`, an absent list is empty, and a
 * product's `description` joins its attributes. Writing puts each object's
 * attributes after its standard keys, refusing an attribute named for one,
 * which would overwrite it, and writes no empty list. smol-toml then writes a
 * table's scalars before its sub-tables, so in the text an attribute such as
 * `brand` comes before a standard table such as `dimensions`.
 */
export const VazenProjectFromVazenTomlProjectV0_3_0 = TomlProject.pipe(
  S.decodeTo(withAttributes(TomlProject.schema.fields)),
  S.decodeTo(
    S.Struct({
      attributes: VazenAttributes,
      fixtures: optionalList(VazenFixtureFromTomlFixture),
      // Processing messages have no field in the file.
      messages: S.Never.pipe(
        S.optionalKey,
        S.decodeTo(VazenProject.fields.messages, {
          decode: SchemaGetter.transformOptional(() => Option.some([])),
          encode: SchemaGetter.transformOptional(() => Option.none()),
        }),
      ),
      name: S.OptionFromOptionalKey(S.String),
      products: optionalList(VazenProductFromTomlProduct),
      // Read, the version is the file's source; written, it is this version,
      // whatever the project's source.
      source: S.Literal(VERSION).pipe(
        S.decodeTo(VazenProject.fields.source, {
          decode: SchemaGetter.transform((declaredVersion) =>
            Option.some({
              declaredVersion: Option.some(declaredVersion),
              format: 'vazen-toml',
            }),
          ),
          encode: SchemaGetter.transform(() => VERSION),
        }),
      ),
      // `schema` is the stage under the `vazen/` prefix.
      stage: S.Literals(['vazen/spec', 'vazen/layout']).transform([
        'spec',
        'layout',
      ]),
    })
      .pipe(knownKeysOnly)
      .pipe(S.encodeKeys({ source: 'schema_version', stage: 'schema' })),
  ),
  S.annotate({ identifier: 'VazenProjectFromVazenTomlProjectV0_3_0' }),
);
