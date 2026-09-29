import { Array as A, Option, Record, Schema as S, Struct } from 'effect';

import { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import { TomlTable, TomlValue } from './toml-from-text';
import { VAZEN_KNOWN_KEYS_ONLY, VazenAttributes } from './vazen-attributes';
import type { VazenEquipment } from './vazen-equipment';
import { VazenDimensions, VazenPosition } from './vazen-geometry';
import { VazenGtin, VazenProductImage } from './vazen-product';
import { VazenProject } from './vazen-project';
import { VazenOrientation, VazenProductSelector } from './vazen-site';

const VERSION = '0.3.0' as const;

// An optional key read as an Option: absent is none, and none is not written.
const AS_OPTION = { as: 'Option', exact: true } as const;

// Any key a table's schema does not name.
const OtherKeys = S.Record({ key: S.String, value: TomlValue });

// Each table's schema, reached through the file's, so the keys treated as
// standard and the shapes read and written are the file's own.
const TomlProject = VazenTomlProjectV0_3_0;
const TomlProduct = TomlProject.fields.products.from.value;
const TomlProductImages = TomlProduct.fields.images.from;
const TomlProductImage = TomlProductImages.fields.front.from;
const TomlProductImageTable = TomlProductImage.members[1];
const TomlFixture = TomlProject.fields.fixtures.from.value;
const TomlEquipment = TomlFixture.fields.equipment.from.value;
const TomlSite = TomlEquipment.fields.sites.from.value;

// Reads a table's keys beyond `fields` into `attributes`, and writes them back
// beside the fields, refusing an attribute named for a field, which would
// overwrite it. The table's own schema, composed before this, checks what is
// written and puts its fields in the file's order.
const withAttributes = (fields: S.Struct.Fields) => {
  const isField = (key: string) => Record.has(fields, key);
  return S.transform(
    TomlTable,
    S.Struct({ attributes: TomlTable }, OtherKeys).pipe(
      S.filter(({ attributes }) =>
        A.findFirst(Record.keys(attributes), isField).pipe(
          Option.map(
            (key) =>
              `an attribute named "${key}" would overwrite the standard key`,
          ),
          Option.getOrElse(() => true),
        ),
      ),
    ),
    {
      decode: (table) => {
        const [attributes, standard] = Record.partition(table, (_, key) =>
          isField(key),
        );
        return { ...standard, attributes };
      },
      encode: ({ attributes, ...standard }) => ({ ...standard, ...attributes }),
      strict: true,
    },
  );
};

// Reads an absent list as empty and writes an empty list as absent, since the
// specification says they mean the same.
const optionalList = <Item, Encoded>(item: S.Schema<Item, Encoded>) =>
  S.optionalToRequired(S.Array(item), S.Array(S.typeSchema(item)), {
    decode: Option.getOrElse(() => []),
    encode: (items) => Option.liftPredicate(items, A.isNonEmptyReadonlyArray),
  });

const VazenFacingsFromTomlFacings = S.Struct({
  deep: S.optionalWith(S.Finite, AS_OPTION),
  high: S.optionalWith(S.Finite, AS_OPTION),
  wide: S.optionalWith(S.Finite, AS_OPTION),
}).annotations(VAZEN_KNOWN_KEYS_ONLY);

const VazenSiteFromTomlSite = TomlSite.pipe(
  S.compose(withAttributes(TomlSite.fields)),
  S.compose(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.optionalWith(VazenDimensions, AS_OPTION),
      facings: S.optionalWith(VazenFacingsFromTomlFacings, AS_OPTION),
      orientation: S.optionalWith(VazenOrientation, AS_OPTION),
      position: S.optionalWith(VazenPosition, AS_OPTION),
      product: VazenProductSelector,
      sortOrder: S.optionalWith(S.Finite, AS_OPTION).pipe(
        S.fromKey('sort_order'),
      ),
    }).annotations(VAZEN_KNOWN_KEYS_ONLY),
  ),
);

const VazenEquipmentFromTomlEquipment: S.Schema<
  VazenEquipment,
  typeof TomlEquipment.Encoded
> = TomlEquipment.pipe(
  S.compose(withAttributes(TomlEquipment.fields)),
  S.compose(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.optionalWith(VazenDimensions, AS_OPTION),
      equipment: optionalList(S.suspend(() => VazenEquipmentFromTomlEquipment)),
      position: S.optionalWith(VazenPosition, AS_OPTION),
      sites: optionalList(VazenSiteFromTomlSite),
      sortOrder: S.optionalWith(S.Finite, AS_OPTION).pipe(
        S.fromKey('sort_order'),
      ),
      type: S.String,
    }).annotations(VAZEN_KNOWN_KEYS_ONLY),
  ),
);

const VazenFixtureFromTomlFixture = TomlFixture.pipe(
  S.compose(withAttributes(TomlFixture.fields)),
  S.compose(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.optionalWith(VazenDimensions, AS_OPTION),
      equipment: optionalList(VazenEquipmentFromTomlEquipment),
      id: S.optionalWith(S.String, AS_OPTION),
      name: S.optionalWith(S.String, AS_OPTION),
      sortOrder: S.optionalWith(S.Finite, AS_OPTION).pipe(
        S.fromKey('sort_order'),
      ),
    }).annotations(VAZEN_KNOWN_KEYS_ONLY),
  ),
);

const VazenProductImageFromTomlProductImageTable = TomlProductImageTable.pipe(
  S.compose(withAttributes(TomlProductImageTable.fields)),
  S.compose(
    S.Struct({ attributes: TomlTable, url: S.String }).annotations(
      VAZEN_KNOWN_KEYS_ONLY,
    ),
  ),
);

// An image with nothing but its URL is written as the URL alone.
const VazenProductImageFromTomlProductImage = S.Union(
  S.transform(
    S.String,
    VazenProductImage.pipe(
      S.filter((image) => Record.isEmptyRecord(image.attributes)),
    ),
    {
      decode: (url) => ({ attributes: {}, url }),
      encode: ({ url }) => url,
      strict: true,
    },
  ),
  VazenProductImageFromTomlProductImageTable,
);

const VazenProductImagesFromTomlProductImages = S.Struct({
  back: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
  base: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
  front: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
  top: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
  right: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
  left: S.optionalWith(VazenProductImageFromTomlProductImage, AS_OPTION),
}).annotations(VAZEN_KNOWN_KEYS_ONLY);

// `description` is a standard key of the file and an attribute of the project.
const VazenProductFromTomlProduct = TomlProduct.pipe(
  S.compose(withAttributes(Struct.omit(TomlProduct.fields, 'description'))),
  S.compose(
    S.Struct({
      attributes: VazenAttributes,
      dimensions: S.optionalWith(VazenDimensions, AS_OPTION),
      form: S.optionalWith(S.String, AS_OPTION),
      gtin: S.optionalWith(VazenGtin, AS_OPTION),
      images: S.optionalWith(
        VazenProductImagesFromTomlProductImages,
        AS_OPTION,
      ),
      name: S.String,
      ref: S.optionalWith(S.String, AS_OPTION),
    }).annotations(VAZEN_KNOWN_KEYS_ONLY),
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
  S.compose(withAttributes(TomlProject.fields)),
  S.compose(
    S.Struct({
      attributes: VazenAttributes,
      fixtures: optionalList(VazenFixtureFromTomlFixture),
      name: S.optionalWith(S.String, AS_OPTION),
      products: optionalList(VazenProductFromTomlProduct),
      // Read, the version is the file's source; written, it is this version,
      // whatever the project's source.
      source: S.propertySignature(
        S.transform(S.Literal(VERSION), VazenProject.fields.source, {
          decode: (declaredVersion) =>
            Option.some({
              declaredVersion: Option.some(declaredVersion),
              format: 'vazen-toml',
            }),
          encode: () => VERSION,
          strict: true,
        }),
      ).pipe(S.fromKey('schema_version')),
      // `schema` is the stage under the `vazen/` prefix.
      stage: S.propertySignature(
        S.transformLiterals(['vazen/spec', 'spec'], ['vazen/layout', 'layout']),
      ).pipe(S.fromKey('schema')),
    }).annotations(VAZEN_KNOWN_KEYS_ONLY),
  ),
  S.annotations({ identifier: 'VazenProjectFromVazenTomlProjectV0_3_0' }),
);
