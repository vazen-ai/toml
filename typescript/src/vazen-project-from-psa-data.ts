import {
  Array as A,
  Effect,
  Equal,
  Option,
  Predicate,
  Record,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  String as Str,
  Struct,
} from 'effect';
import { TomlDate } from 'smol-toml';

import {
  Orientation as VazenOrientation,
  OrientationFromPsaOrientation as VazenOrientationFromPsaOrientation,
} from './orientation';
import {
  PSA_FIXTURE_DEFAULTS,
  PSA_PERFORMANCE_DEFAULTS,
  PSA_PLANOGRAM_DEFAULTS,
  PSA_POSITION_DEFAULTS,
  PSA_PRODUCT_DEFAULTS,
  PSA_PROJECT_DEFAULTS,
  PSA_SEGMENT_DEFAULTS,
  PsaData,
  PsaFixtureTypeFromCode,
  PsaUnlistedCode,
  type PsaMerchandisingStyleFromCode,
  type PsaPrimaryKeyFromCode,
} from './psa';
import { normalisePsaText } from './psa/text-from-bytes';
import { TomlTable, TomlValue } from './toml-from-text';
import { PSA_KEY_PREFIX, type VazenAttributeScalar } from './vazen-attributes';
import { VazenEquipment } from './vazen-equipment';
import { VazenFixture } from './vazen-fixture';
import type { VazenDimensions, VazenPosition } from './vazen-geometry';
import { VazenGtin, VazenProduct } from './vazen-product';
import { VazenProject } from './vazen-project';
import { VazenSite, type VazenProductSelector } from './vazen-site';

// The keys a planogram's lists and a record's following rows take beside the
// columns.
const PERFORMANCE_KEY = 'performance';
const SEGMENTS_KEY = 'segments';
const UNKNOWN_ROWS_KEY = 'unknown_rows_after';

// PSA's metric files are in centimetres and its imperial files in inches.
// Reading rounds to nine decimals of a millimetre: fine enough to keep the
// digits a file writes, coarse enough to drop the floating-point noise of
// multiplying by the factor. Writing keeps the fifteen significant digits a
// double holds exactly, so the value written is the one read, without the noise
// of dividing, and reads back as the same millimetres.
const MILLIMETRES_PER_CENTIMETRE = 10;
const MILLIMETRES_PER_INCH = 25.4;
const DECIMALS = 1e9;
const SIGNIFICANT_DIGITS = 15;

// What PSA calls Vazen equipment it has no type for: a bay is a segment, a peg
// is a rod, which holds one position in every real file, and anything else is
// what an empty type cell means, a shelf.
type PsaFixtureType = typeof PsaFixtureTypeFromCode.Type;
const BAY = 'bay';
const SHELF = 'shelf' satisfies PsaFixtureType;
const PSA_FIXTURE_TYPE_BY_VAZEN_TYPE: Readonly<Record<string, PsaFixtureType>> =
  { peg: 'rod' };

// The segment columns a bay's position and dimensions write. Real files keep a
// segment's x at 0 and its place in `offset_x`.
const BAY_GEOMETRY_ATTRIBUTES = new Set(
  ['offset_x', 'y', 'z', 'width', 'height', 'depth'].map(
    (column) => `${PSA_KEY_PREFIX}${column}`,
  ),
);

// The merchandising styles that place an object with its own columns on the
// product row, as `tray_width`, and so read as a product of that form. A loose
// or log stack position arranges units, so it places the unit.
type PsaMerchandisingStyle = typeof PsaMerchandisingStyleFromCode.Type;
const PACKAGING_STYLES = [
  'tray',
  'case',
  'display',
  'alternate',
] as const satisfies ReadonlyArray<PsaMerchandisingStyle>;
type PackagingStyle = (typeof PACKAGING_STYLES)[number];

// A packaging style's columns: those its product's standard keys write, and
// those it keeps as `_psa__` attributes.
const PACKAGING_STANDARD_COLUMNS = ['width', 'height', 'depth', 'total_number'];
const PACKAGING_OTHER_COLUMNS = [
  'number_wide',
  'number_high',
  'number_deep',
  'max_high',
];
const PACKAGING_COLUMNS = [
  ...PACKAGING_STANDARD_COLUMNS,
  ...PACKAGING_OTHER_COLUMNS,
];

const MERCHANDISING_STYLE_KEY = `${PSA_KEY_PREFIX}merch_style`;
const UNIT_COUNT_KEY = '_vazen__unit_count';

// What PSA names a product by, which each of its packaging levels holds too.
const IDENTITY_KEYS = new Set([`${PSA_KEY_PREFIX}id`, `${PSA_KEY_PREFIX}upc`]);

// The id of a planogram without a key, numbered by its place in the file.
const MADE_UP_ID_PREFIX = 'planogram-';

// FNV-1a over the UPC and ID, 64 bits in base 36: a ref is short and opaque.
const FNV_OFFSET_BASIS = 0xcb_f2_9c_e4_84_22_23_25n;
const FNV_PRIME = 0x1_00_00_00_01_b3n;
const SIXTY_FOUR_BITS = (1n << 64n) - 1n;

// An unlisted code cannot choose units, a primary key, a type or an orientation.
const PsaDataWithListedCodes = PsaData.pipe(
  S.check(
    S.makeFilter((data) => [
      ...unlistedCodeIssues({
        cell: data.project.measurement,
        path: ['project', 'measurement'],
      }),
      ...unlistedCodeIssues({
        cell: data.project.primary_key,
        path: ['project', 'primary_key'],
      }),
      ...data.planograms.flatMap((section, planogram) =>
        section.fixtures.flatMap(({ fixture, positions }, index) => [
          ...unlistedCodeIssues({
            cell: fixture.type,
            path: [
              'planograms',
              planogram,
              'fixtures',
              index,
              'fixture',
              'type',
            ],
          }),
          ...positions.flatMap((position, place) =>
            unlistedCodeIssues({
              cell: position.orientation,
              path: [
                'planograms',
                planogram,
                'fixtures',
                index,
                'positions',
                place,
                'orientation',
              ],
            }),
          ),
        ]),
      ),
    ]),
  ),
).annotate({ identifier: 'PsaDataWithListedCodes' });

// Each PSA product row is unique under the project's primary key and each
// product's ref is unique, so a row holds one packaging level of each style; no
// product holds what another product of its row writes; each selector names one
// product, preserved position identifiers still name that product, and a site
// gives no merchandising style its product's form writes.
const VazenProjectPsaCanHold = VazenProject.pipe(
  S.check(
    S.makeFilter((project) => {
      const primaryKey = primaryKeyOf(project.attributes);
      const keyOf = (product: VazenProduct) =>
        psaMatchKey({
          identity: psaIdentityFromVazenProduct(product),
          primaryKey,
        });
      const byKey = A.groupBy(project.products, keyOf);
      const rows = A.groupBy(project.products, rowKeyOf);
      const refs = A.groupBy(project.products, rowRefOf);
      const levels = A.groupBy(project.products, levelRefOf);
      return [
        ...project.products.flatMap((product, index) => {
          // A row's packaging levels share its key, so rows are counted.
          const sharing = Option.getOrElse(
            Option.map(
              Record.get(byKey, keyOf(product)),
              (products) => new Set(products.map(rowKeyOf)).size,
            ),
            () => 1,
          );
          const sharingRowRef = Option.getOrElse(
            Option.map(
              Record.get(refs, rowRefOf(product)),
              (products) => new Set(products.map(rowKeyOf)).size,
            ),
            () => 1,
          );
          const sharingLevelRef = Option.getOrElse(
            Option.map(Record.get(levels, levelRefOf(product)), A.length),
            () => 1,
          );
          const sharingRef = Math.max(sharingRowRef, sharingLevelRef);
          const level =
            sharingRowRef > 1
              ? ''
              : Option.match(packagingStyleOf(product), {
                  onNone: () => '',
                  onSome: (style) => `${style} `,
                });
          return sharing === 1 && sharingRef === 1
            ? []
            : [
                {
                  issue:
                    sharing > 1
                      ? `the product's ${primaryKey} primary key is shared by ${sharing} products, which PSA could not tell apart`
                      : `the product's PSA identity produces a ref shared by ${sharingRef} ${level}products`,
                  path: ['products', index],
                },
              ];
        }),
        ...project.products.flatMap((product, index) =>
          rowIssues({
            product,
            row: Option.getOrElse(
              Record.get(rows, rowKeyOf(product)),
              () => [],
            ),
          }).map((issue) => ({
            ...issue,
            path: ['products', index, ...issue.path],
          })),
        ),
        ...sitesOf(project.fixtures).flatMap(({ path, site }) => {
          const invalidIdentifiers = ['id', 'upc'].flatMap((column) => {
            const key = `${PSA_KEY_PREFIX}${column}`;
            return Record.has(site.attributes, key) &&
              !Str.isString(site.attributes[key])
              ? [
                  {
                    issue: `${key} must be text`,
                    path: [...path, 'attributes', key],
                  },
                ]
              : [];
          });
          if (invalidIdentifiers.length > 0) {
            return invalidIdentifiers;
          }
          const matches = productsMatching({
            products: project.products,
            selector: site.product,
          });
          if (matches.length !== 1) {
            return [
              {
                issue: `the product selector matches ${matches.length} products, not one`,
                path: [...path, 'product'],
              },
            ];
          }
          return matches.flatMap((product) => {
            const identity = psaIdentityFromVazenProduct(product);
            if (Option.isNone(identity.id) && Option.isNone(identity.upc)) {
              return [
                {
                  issue:
                    'the product has neither a UPC nor an ID, so a position could not name it',
                  path: [...path, 'product'],
                },
              ];
            }
            const positionIdentity = psaIdentityFromSite({ identity, site });
            if (
              Option.isNone(positionIdentity.id) &&
              Option.isNone(positionIdentity.upc)
            ) {
              return [
                {
                  issue:
                    'the position has neither a UPC nor an ID, so it could not name a product',
                  path: [...path, 'product'],
                },
              ];
            }
            return [
              ...(psaMatchKey({ identity: positionIdentity, primaryKey }) ===
              psaMatchKey({ identity, primaryKey })
                ? []
                : [
                    {
                      issue:
                        'position identifiers do not match the selected product under the primary key',
                      path: [...path, 'product'],
                    },
                  ]),
              ...(Option.isSome(packagingStyleOf(product)) &&
              Record.has(site.attributes, MERCHANDISING_STYLE_KEY)
                ? [
                    {
                      issue: `${MERCHANDISING_STYLE_KEY} names a column its product's form writes`,
                      path: [...path, 'attributes', MERCHANDISING_STYLE_KEY],
                    },
                  ]
                : []),
            ];
          });
        }),
      ];
    }),
  ),
).annotate({ identifier: 'VazenProjectPsaCanHold' });

// A cell holding a code from its column's list, read by name, or a code the
// list does not have, which `PsaDataWithListedCodes` refuses before a noun
// reads it.
const PsaFixtureTypeCell = S.Option(
  S.Union([S.toType(PsaFixtureTypeFromCode), PsaUnlistedCode]),
);
const PsaOrientationCell = S.Option(
  S.Union([VazenOrientationFromPsaOrientation, PsaUnlistedCode]),
);

// A column a noun reads by name, as its record reads it: a text or a number,
// or empty.
const PsaTextColumn = S.Option(S.String);
const PsaNumberColumn = S.Option(S.Finite);

// The columns a noun does not read by name, each an Option of the TOML value
// its `_psa__` attribute holds, or the record's tag and the rows after it.
// `PsaData`, composed before the nouns, reads a written column with the
// column's own schema.
const PsaOtherColumns = S.Record(
  S.String,
  S.Union([S.Option(TomlValue), TomlValue]),
);

// What each noun reads from its record by name, and so what its `_psa__`
// attributes may not name.
const PsaProjectColumns = S.StructWithRest(
  S.Struct({
    _tag: S.Literal('Project'),
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
  }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaProjectColumns' });
const PsaProductColumns = S.StructWithRest(
  S.Struct({
    _tag: S.Literal('Product'),
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaProductColumns' });
const PsaPlanogramColumns = S.StructWithRest(
  S.Struct({
    _tag: S.Literal('Planogram'),
    key: PsaTextColumn,
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaPlanogramColumns' });
const PsaFixtureColumns = S.StructWithRest(
  S.Struct({
    _tag: S.Literal('Fixture'),
    type: PsaFixtureTypeCell,
    unknownRowsAfter: TomlValue,
    x: PsaNumberColumn,
    y: PsaNumberColumn,
    z: PsaNumberColumn,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaFixtureColumns' });
const PsaPositionColumns = S.StructWithRest(
  S.Struct({
    _tag: S.Literal('Position'),
    d_facings: PsaNumberColumn,
    h_facings: PsaNumberColumn,
    id: PsaTextColumn,
    orientation: PsaOrientationCell,
    unknownRowsAfter: TomlValue,
    upc: PsaTextColumn,
    v_facings: PsaNumberColumn,
    x: PsaNumberColumn,
    y: PsaNumberColumn,
    z: PsaNumberColumn,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaPositionColumns' });
const PsaSegmentColumns = S.StructWithRest(
  S.Struct({ _tag: S.Literal('Segment'), unknownRowsAfter: TomlValue }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaSegmentColumns' });
const PsaPerformanceColumns = S.StructWithRest(
  S.Struct({ _tag: S.Literal('Performance'), unknownRowsAfter: TomlValue }),
  [PsaOtherColumns],
).annotate({ identifier: 'PsaPerformanceColumns' });

const isTables = S.is(S.Array(TomlTable));
const isRows = S.is(S.NonEmptyArray(TomlValue));
const isVazenGtin = S.is(VazenGtin);
const isVazenOrientation = S.is(VazenOrientation);
const isListedFixtureType = S.is(S.toType(PsaFixtureTypeFromCode));
const isPackagingStyle = S.is(S.Literals(PACKAGING_STYLES));

// Whether every key of a table names a column of the record it writes, or the
// rows after the record.
const psaColumnsOnly = (columns: Iterable<string>) => {
  const named = new Set([...columns, UNKNOWN_ROWS_KEY]);
  return (
    table: TomlTable,
  ): ReadonlyArray<{
    readonly issue: string;
    readonly path: ReadonlyArray<PropertyKey>;
  }> =>
    Record.keys(table)
      .filter((key) => !named.has(key))
      .map((key) => ({ issue: `${key} names no PSA column`, path: [key] }));
};

// Whether every `_psa__` attribute of a noun names a column of the record it
// writes that the noun does not read by name, or the rows after the record.
const psaAttributesOnly = ({
  columns,
  fields,
}: Readonly<{ columns: Iterable<string>; fields: S.Struct.Fields }>) => {
  const named = new Set([...columns, UNKNOWN_ROWS_KEY]);
  return ({
    attributes,
  }: Readonly<{ attributes: TomlTable }>): ReadonlyArray<{
    readonly issue: string;
    readonly path: ReadonlyArray<PropertyKey>;
  }> =>
    Record.keys(attributes)
      .filter((key) => key.startsWith(PSA_KEY_PREFIX))
      .flatMap((key) => {
        const column = key.slice(PSA_KEY_PREFIX.length);
        if (Record.has(fields, column)) {
          return [
            {
              issue: `${key} names a column its standard key writes`,
              path: ['attributes', key],
            },
          ];
        }
        return named.has(column)
          ? []
          : [
              {
                issue: `${key} names no PSA column`,
                path: ['attributes', key],
              },
            ];
      });
};

// A segment or performance row as a table of its columns, kept in a list on
// its planogram's fixture.
const TomlTableFromPsaSegment = PsaSegmentColumns.pipe(
  S.decodeTo(
    TomlTable.pipe(
      S.check(S.makeFilter(psaColumnsOnly(Record.keys(PSA_SEGMENT_DEFAULTS)))),
    ),
    {
      decode: SchemaGetter.transform((segment) =>
        tableFromPsaColumns({
          columns: segment,
          defaults: PSA_SEGMENT_DEFAULTS,
          fields: PsaSegmentColumns.schema.fields,
        }),
      ),
      encode: SchemaGetter.transform((table) =>
        psaColumnsFromTable({
          _tag: 'Segment',
          defaults: PSA_SEGMENT_DEFAULTS,
          table,
        }),
      ),
    },
  ),
).annotate({ identifier: 'TomlTableFromPsaSegment' });

const TomlTableFromPsaPerformance = PsaPerformanceColumns.pipe(
  S.decodeTo(
    TomlTable.pipe(
      S.check(
        S.makeFilter(psaColumnsOnly(Record.keys(PSA_PERFORMANCE_DEFAULTS))),
      ),
    ),
    {
      decode: SchemaGetter.transform((performance) =>
        tableFromPsaColumns({
          columns: performance,
          defaults: PSA_PERFORMANCE_DEFAULTS,
          fields: PsaPerformanceColumns.schema.fields,
        }),
      ),
      encode: SchemaGetter.transform((table) =>
        psaColumnsFromTable({
          _tag: 'Performance',
          defaults: PSA_PERFORMANCE_DEFAULTS,
          table,
        }),
      ),
    },
  ),
).annotate({ identifier: 'TomlTableFromPsaPerformance' });

// A site names its product by the position's UPC and ID, which the project
// turns into the product's ref once it holds the products.
const VazenSiteFromPsaPosition = PsaPositionColumns.pipe(
  S.decodeTo(
    VazenSite.pipe(
      S.check(
        S.makeFilter(
          psaAttributesOnly({
            columns: Record.keys(PSA_POSITION_DEFAULTS),
            fields: Record.remove(
              Record.remove(PsaPositionColumns.schema.fields, 'id'),
              'upc',
            ),
          }),
        ),
      ),
    ),
    {
      decode: SchemaGetter.transform((position) => ({
        attributes: prefixed(
          tableFromPsaColumns({
            columns: position,
            defaults: PSA_POSITION_DEFAULTS,
            fields: PsaPositionColumns.schema.fields,
          }),
        ),
        dimensions: boxFromColumns(position),
        facings: A.some(
          [position.h_facings, position.v_facings, position.d_facings],
          Option.isSome,
        )
          ? Option.some({
              deep: position.d_facings,
              high: position.v_facings,
              wide: position.h_facings,
            })
          : Option.none(),
        orientation: Option.filter(position.orientation, isVazenOrientation),
        position: pointFromColumns(position),
        product: Record.getSomes({ id: position.id, upc: position.upc }),
        sortOrder: Option.none(),
      })),
      encode: SchemaGetter.transform((site) => ({
        ...psaColumnsFromTable({
          _tag: 'Position',
          defaults: PSA_POSITION_DEFAULTS,
          table: unprefixed(site.attributes),
        }),
        ...pointColumns(site.position),
        ...boxColumns(site.dimensions),
        d_facings: Option.flatMap(site.facings, ({ deep }) => deep),
        h_facings: Option.flatMap(site.facings, ({ wide }) => wide),
        ...psaIdentityFromSite({
          identity: psaIdentityFromSelector(site.product),
          site,
        }),
        orientation: site.orientation,
        v_facings: Option.flatMap(site.facings, ({ high }) => high),
      })),
    },
  ),
).annotate({ identifier: 'VazenSiteFromPsaPosition' });

// A fixture row with the positions after it read as sites.
const PsaFixtureSectionWithSites = S.Struct({
  fixture: PsaFixtureColumns,
  positions: S.Array(VazenSiteFromPsaPosition),
}).annotate({ identifier: 'PsaFixtureSectionWithSites' });

// A fixture row and the positions after it are a piece of equipment holding
// its sites; a type of equipment PSA lacks is written as a shelf.
const VazenEquipmentFromPsaFixtureSection = PsaFixtureSectionWithSites.pipe(
  S.decodeTo(
    VazenEquipment.pipe(
      S.check(
        S.makeFilter(
          psaAttributesOnly({
            columns: Record.keys(PSA_FIXTURE_DEFAULTS),
            fields: PsaFixtureColumns.schema.fields,
          }),
        ),
      ),
    ),
    {
      decode: SchemaGetter.transform(({ fixture, positions }) => ({
        attributes: prefixed(
          tableFromPsaColumns({
            columns: fixture,
            defaults: PSA_FIXTURE_DEFAULTS,
            fields: PsaFixtureColumns.schema.fields,
          }),
        ),
        dimensions: boxFromColumns(fixture),
        equipment: [],
        position: pointFromColumns(fixture),
        sites: positions,
        sortOrder: Option.none(),
        type: Option.getOrElse(
          Option.filter(fixture.type, Str.isString),
          () => SHELF,
        ),
      })),
      encode: SchemaGetter.transform((piece) => ({
        fixture: {
          ...psaColumnsFromTable({
            _tag: 'Fixture',
            defaults: PSA_FIXTURE_DEFAULTS,
            table: unprefixed(piece.attributes),
          }),
          ...pointColumns(piece.position),
          ...boxColumns(piece.dimensions),
          type: Option.some(psaFixtureTypeFromVazenType(piece.type)),
        },
        positions: piece.sites,
      })),
    },
  ),
).annotate({ identifier: 'VazenEquipmentFromPsaFixtureSection' });

// A planogram row with the rows after it read as equipment and tables.
const PsaPlanogramSectionWithEquipment = S.Struct({
  fixtures: S.Array(VazenEquipmentFromPsaFixtureSection),
  performance: S.Array(TomlTableFromPsaPerformance),
  planogram: PsaPlanogramColumns,
  segments: S.Array(TomlTableFromPsaSegment),
}).annotate({ identifier: 'PsaPlanogramSectionWithEquipment' });

// A planogram and the rows after it are a fixture: its fixture rows its
// equipment, its segment and performance rows lists of tables among its
// attributes. Written, the equipment goes in reading order, a piece before
// what it holds, as PSA lists fixture rows, and a bay goes as a segment after
// those the file had, its x as the segment's offset; so a bay holding sites is
// refused, a segment holding no positions, and so is a bay attribute named for
// a column its position or dimensions write.
const VazenFixtureFromPsaPlanogramSection =
  PsaPlanogramSectionWithEquipment.pipe(
    S.decodeTo(
      VazenFixture.pipe(
        S.check(
          S.makeFilter(
            psaAttributesOnly({
              columns: [
                ...Record.keys(PSA_PLANOGRAM_DEFAULTS),
                PERFORMANCE_KEY,
                SEGMENTS_KEY,
              ],
              fields: PsaPlanogramColumns.schema.fields,
            }),
          ),
        ),
        S.check(
          S.makeFilter((fixture) =>
            [PERFORMANCE_KEY, SEGMENTS_KEY].flatMap((key) =>
              Option.match(
                Record.get(fixture.attributes, `${PSA_KEY_PREFIX}${key}`),
                {
                  onNone: () => [],
                  onSome: (value) =>
                    isTables(value)
                      ? []
                      : [
                          {
                            issue: `${PSA_KEY_PREFIX}${key} holds a list of tables, one per row`,
                            path: ['attributes', `${PSA_KEY_PREFIX}${key}`],
                          },
                        ],
                },
              ),
            ),
          ),
        ),
        S.check(
          S.makeFilter((fixture) =>
            equipmentIn({ equipment: fixture.equipment, path: ['equipment'] })
              .filter(({ piece }) => piece.type === BAY)
              .flatMap(({ path, piece }) => [
                ...(piece.sites.length > 0
                  ? [
                      {
                        issue:
                          'a bay is written as a segment, which holds no positions, so its sites would be lost',
                        path: [...path, 'sites'],
                      },
                    ]
                  : []),
                ...Record.keys(piece.attributes)
                  .filter((key) => BAY_GEOMETRY_ATTRIBUTES.has(key))
                  .map((key) => ({
                    issue: `${key} names a column its standard key writes`,
                    path: [...path, 'attributes', key],
                  })),
              ]),
          ),
        ),
      ),
      {
        decode: SchemaGetter.transform(
          ({ fixtures, performance, planogram, segments }) => ({
            attributes: prefixed({
              ...tableFromPsaColumns({
                columns: planogram,
                defaults: PSA_PLANOGRAM_DEFAULTS,
                fields: PsaPlanogramColumns.schema.fields,
              }),
              ...Record.filter(
                { [PERFORMANCE_KEY]: performance, [SEGMENTS_KEY]: segments },
                A.isReadonlyArrayNonEmpty,
              ),
            }),
            dimensions: boxFromColumns(planogram),
            equipment: fixtures,
            id: planogram.key,
            name: planogram.name,
            sortOrder: Option.none(),
          }),
        ),
        encode: SchemaGetter.transform((fixture) => {
          const table = unprefixed(fixture.attributes);
          const pieces = flattened(fixture.equipment);
          return {
            fixtures: pieces.filter((piece) => piece.type !== BAY),
            performance: tablesIn({ key: PERFORMANCE_KEY, table }),
            planogram: {
              ...psaColumnsFromTable({
                _tag: 'Planogram',
                defaults: PSA_PLANOGRAM_DEFAULTS,
                table: Record.filter(
                  table,
                  (_, key) => key !== PERFORMANCE_KEY && key !== SEGMENTS_KEY,
                ),
              }),
              ...boxColumns(fixture.dimensions),
              key: fixture.id,
              name: fixture.name,
            },
            segments: [
              ...tablesIn({ key: SEGMENTS_KEY, table }),
              ...pieces
                .filter((piece) => piece.type === BAY)
                .map((bay) => ({
                  ...unprefixed(bay.attributes),
                  ...Record.getSomes({
                    ...Record.remove(pointColumns(bay.position), 'x'),
                    ...boxColumns(bay.dimensions),
                    offset_x: Option.map(bay.position, ({ x }) => x),
                  }),
                })),
            ],
          };
        }),
      },
    ),
  ).annotate({ identifier: 'VazenFixtureFromPsaPlanogramSection' });

// A UPC that is a GTIN is the product's; one that is not stays a column, so it
// is not lost, and is written back unless a GTIN is given.
const VazenProductFromPsaProduct = PsaProductColumns.pipe(
  S.decodeTo(
    VazenProduct.pipe(
      S.check(
        S.makeFilter(
          psaAttributesOnly({
            columns: Record.keys(PSA_PRODUCT_DEFAULTS),
            fields: PsaProductColumns.schema.fields,
          }),
        ),
      ),
    ),
    {
      decode: SchemaGetter.transform((product) => {
        const table = tableFromPsaColumns({
          columns: product,
          defaults: PSA_PRODUCT_DEFAULTS,
          fields: PsaProductColumns.schema.fields,
        });
        const upc = Option.filter(Record.get(table, 'upc'), Str.isString);
        const gtin = Option.filter(upc, isVazenGtin);
        return {
          attributes: prefixed(
            Option.isSome(gtin) ? Record.remove(table, 'upc') : table,
          ),
          dimensions: boxFromColumns(product),
          form: Option.none(),
          gtin,
          images: Option.none(),
          name: Option.getOrElse(product.name, () => ''),
          ref: Option.some(
            refFromPsaIdentity({
              id: Option.filter(Record.get(table, 'id'), Str.isString),
              upc,
            }),
          ),
        };
      }),
      encode: SchemaGetter.transform((product) => {
        const table = unprefixed(product.attributes);
        return {
          ...psaColumnsFromTable({
            _tag: 'Product',
            defaults: PSA_PRODUCT_DEFAULTS,
            table,
          }),
          ...boxColumns(product.dimensions),
          name: Option.liftPredicate(product.name, Str.isNonEmpty),
          upc: Option.orElse(product.gtin, () => Record.get(table, 'upc')),
        };
      }),
    },
  ),
).annotate({ identifier: 'VazenProductFromPsaProduct' });

const VazenProjectFieldsFromPsaProject = PsaProjectColumns.pipe(
  S.decodeTo(
    VazenProject.mapFields(Struct.pick(['attributes', 'name'])).pipe(
      S.check(
        S.makeFilter(
          psaAttributesOnly({
            columns: Record.keys(PSA_PROJECT_DEFAULTS),
            fields: PsaProjectColumns.schema.fields,
          }),
        ),
      ),
    ),
    {
      decode: SchemaGetter.transform((project) => ({
        attributes: prefixed(
          tableFromPsaColumns({
            columns: project,
            defaults: PSA_PROJECT_DEFAULTS,
            fields: PsaProjectColumns.schema.fields,
          }),
        ),
        name: project.name,
      })),
      encode: SchemaGetter.transform((project) => ({
        ...psaColumnsFromTable({
          _tag: 'Project',
          defaults: PSA_PROJECT_DEFAULTS,
          table: unprefixed(project.attributes),
        }),
        name: Option.filter(project.name, Str.isNonEmpty),
      })),
    },
  ),
).annotate({ identifier: 'VazenProjectFieldsFromPsaProject' });

// A file's data with each section read as its noun.
const PsaDataWithNouns = S.Struct({
  declaredVersion: PsaData.fields.declaredVersion,
  messages: PsaData.fields.messages,
  planograms: S.Array(VazenFixtureFromPsaPlanogramSection),
  products: S.Array(VazenProductFromPsaProduct),
  project: VazenProjectFieldsFromPsaProject,
}).annotate({ identifier: 'PsaDataWithNouns' });

/**
 * A project from a PSA file's data, and the data back from a project. Reading
 * takes the file's units into millimetres, a planogram as a fixture, each
 * fixture row as its equipment and each position as a site naming its product
 * by `ref`, and keeps every other value the file gives, that its column's
 * default does not imply, as a `_psa__` attribute. The project retains the data's
 * `messages`. A product placed as a tray, case, display or alternate is
 * also read as a product of that `form`, as the specification's packaging
 * levels are, with that style's dimensions, `_vazen__unit_count` and columns,
 * and its unit's ref followed by `_tray` or the like. Writing merges those
 * products back onto their unit's row, puts each standard key into its column
 * and each `_psa__` attribute back, refuses an attribute named for a column PSA
 * does not have or another key writes, products of one row with different
 * names, a site whose product has neither a UPC nor an ID, or a bay holding
 * sites, and drops a project's descriptive keys, any other `form`, `images`
 * and any type of equipment PSA lacks, which becomes a shelf. Either way,
 * duplicate primary keys are refused, and so are two packaging levels of one
 * style on a row. Writing also refuses keys or refs made identical by text
 * normalisation.
 */
export const VazenProjectFromPsaData: S.Codec<VazenProject, PsaData> =
  PsaDataWithListedCodes.pipe(
    S.decodeTo(
      // The nouns are read in the file's units, each site naming its product by
      // UPC and ID; the project, which holds the units and the products, scales
      // every length and names each product by its ref. A planogram without a
      // key is the file's Nth, since a layout needs an id. A packaging level is
      // split from its row before scaling, and merged back after, so its
      // dimensions are scaled as the row's are.
      PsaDataWithNouns.pipe(
        S.decodeTo(VazenProjectPsaCanHold, {
          decode: SchemaGetter.transformEffect(
            ({ declaredVersion, messages, planograms, products, project }) => {
              const factor = millimetresPerUnit(project.attributes);
              const millimetres: Scale = (value) => round(value * factor);
              const primaryKey = primaryKeyOf(project.attributes);
              const byKey = A.groupBy(products, (product) =>
                psaMatchKey({
                  identity: psaIdentityFromVazenProduct(product),
                  primaryKey,
                }),
              );
              // A site names its product by ref: its unit's, or a packaging level's,
              // whose form then holds the site's merchandising style.
              const resolveSite = (site: VazenSite): VazenSite => {
                const original = psaIdentityFromSelector(site.product);
                return Option.match(
                  Option.flatMap(
                    Record.get(
                      byKey,
                      psaMatchKey({ identity: original, primaryKey }),
                    ),
                    A.head,
                  ),
                  {
                    // Leave a missing product for the project's selector check to refuse.
                    onNone: () => ({
                      ...site,
                      product: { ref: 'unmatched-psa-product' },
                    }),
                    onSome: (product) => {
                      const identity = psaIdentityFromVazenProduct(product);
                      const ref = refFromPsaIdentity(identity);
                      const attributes = {
                        ...site.attributes,
                        ...Record.fromEntries(
                          (['id', 'upc'] as const).flatMap((column) =>
                            Equal.equals(original[column], identity[column])
                              ? []
                              : [
                                  [
                                    `${PSA_KEY_PREFIX}${column}`,
                                    Option.getOrElse(
                                      original[column],
                                      () => '',
                                    ),
                                  ],
                                ],
                          ),
                        ),
                      };
                      return Option.match(
                        Option.filter(
                          Record.get(site.attributes, MERCHANDISING_STYLE_KEY),
                          isPackagingStyle,
                        ),
                        {
                          onNone: () => ({
                            ...site,
                            attributes,
                            product: { ref },
                          }),
                          onSome: (style) => ({
                            ...site,
                            attributes: Record.remove(
                              attributes,
                              MERCHANDISING_STYLE_KEY,
                            ),
                            product: { ref: packagingRef({ ref, style }) },
                          }),
                        },
                      );
                    },
                  },
                );
              };
              const fixtures = withMadeUpIds(planograms).map((fixture) =>
                fixtureWith({
                  fixture,
                  mapSite: resolveSite,
                  scale: millimetres,
                }),
              );
              const placed = new Set(
                sitesOf(fixtures).flatMap(({ site }) =>
                  Option.toArray(Record.get(site.product, 'ref')),
                ),
              );
              return Effect.succeed<VazenProject>({
                ...project,
                fixtures,
                messages,
                products: products
                  .flatMap((product) =>
                    withPackagingLevels({ placed, product }),
                  )
                  .map((product) =>
                    productWith({ product, scale: millimetres }),
                  ),
                source: Option.some({ declaredVersion, format: 'psa' }),
                stage: 'layout',
              });
            },
          ),
          encode: SchemaGetter.transformEffect((project, _) => {
            const factor = millimetresPerUnit(project.attributes);
            const fileUnits: Scale = (value) => withoutNoise(value / factor);
            const products = productRows(
              project.products.map((product) =>
                productWith({ product, scale: fileUnits }),
              ),
            );
            const primaryKey = primaryKeyOf(project.attributes);
            const keys = new Set<string>();
            const refs = new Set<string>();
            for (const product of products) {
              const identity = Record.map(
                psaIdentityFromVazenProduct(product),
                Option.map(normalisePsaText),
              );
              const key = psaMatchKey({ identity, primaryKey });
              const ref = refFromPsaIdentity(identity);
              if (keys.has(key) || refs.has(ref)) {
                return Effect.fail(
                  new SchemaIssue.InvalidValue(
                    {
                      message: keys.has(key)
                        ? `different product rows share a ${primaryKey} primary key after PSA text normalisation`
                        : 'different product rows produce the same ref after PSA text normalisation',
                    },
                    project,
                  ),
                );
              }
              keys.add(key);
              refs.add(ref);
            }
            // A site names the one product its selector names, which the filter
            // has checked, by UPC and ID, and a packaging level by its style too.
            const siteNamedByPsa = (site: VazenSite): VazenSite =>
              Option.match(
                A.head(
                  productsMatching({
                    products: project.products,
                    selector: site.product,
                  }),
                ),
                {
                  onNone: () => site,
                  onSome: (product) => ({
                    ...site,
                    attributes: Option.match(packagingStyleOf(product), {
                      onNone: () => site.attributes,
                      onSome: (style) => ({
                        ...site.attributes,
                        [MERCHANDISING_STYLE_KEY]: style,
                      }),
                    }),
                    product: Record.getSomes(
                      psaIdentityFromVazenProduct(product),
                    ),
                  }),
                },
              );
            return Effect.succeed({
              declaredVersion: Option.flatMap(project.source, (source) =>
                source.format === 'psa'
                  ? source.declaredVersion
                  : Option.none(),
              ),
              messages: [],
              planograms: project.fixtures.map((fixture) =>
                fixtureWith({
                  fixture,
                  mapSite: siteNamedByPsa,
                  scale: fileUnits,
                }),
              ),
              products,
              project: { attributes: project.attributes, name: project.name },
            });
          }),
        }),
      ),
    ),
  ).annotate({ identifier: 'VazenProjectFromPsaData' });

type Scale = (value: number) => number;

// What PSA names a product by.
type PsaIdentity = Readonly<{
  id: Option.Option<string>;
  upc: Option.Option<string>;
}>;

type PsaPrimaryKey = typeof PsaPrimaryKeyFromCode.Type;

const primaryKeyOf = (attributes: TomlTable): PsaPrimaryKey => {
  const key = attributes[`${PSA_KEY_PREFIX}primary_key`];
  return key === 'id' || key === 'both' ? key : 'upc';
};

// Exact text, with absent components compared as empty; never fall back to the
// secondary identifier. JSON keeps pairs distinct even if text contains NUL.
const psaMatchKey = ({
  identity,
  primaryKey,
}: Readonly<{ identity: PsaIdentity; primaryKey: PsaPrimaryKey }>): string => {
  const columns: ReadonlyArray<keyof PsaIdentity> =
    primaryKey === 'both' ? ['upc', 'id'] : [primaryKey];
  return JSON.stringify(
    columns.map((column) => Option.getOrElse(identity[column], () => '')),
  );
};

const psaIdentityFromSelector = (
  selector: VazenProductSelector,
): PsaIdentity => ({
  id: Option.filter(Record.get(selector, 'id'), Str.isString),
  upc: Option.filter(Record.get(selector, 'upc'), Str.isString),
});

// A site's override preserves the source cell, including an empty cell, when
// the position's unused identifier differs from its product's.
const psaIdentityFromSite = ({
  identity,
  site,
}: Readonly<{ identity: PsaIdentity; site: VazenSite }>): PsaIdentity => {
  const cell = (column: keyof PsaIdentity) =>
    Option.filter(
      Option.filter(
        Option.orElse(
          Record.get(site.attributes, `${PSA_KEY_PREFIX}${column}`),
          () => identity[column],
        ),
        Str.isString,
      ),
      Str.isNonEmpty,
    );
  return { id: cell('id'), upc: cell('upc') };
};

// The columns a record holds beside those its noun reads by name, holding the
// value the file gives when the column's default does not already imply it. A
// yes/no column keeps every value, since an empty cell there means inherit.
const tableFromPsaColumns = ({
  columns,
  defaults,
  fields,
}: Readonly<{
  columns: Readonly<Record<string, Option.Option<TomlValue> | TomlValue>>;
  defaults: Readonly<Record<string, unknown>>;
  fields: S.Struct.Fields;
}>): TomlTable => {
  const table = Record.getSomes(
    Record.map(columns, (value, column) =>
      Option.isOption(value) && !Record.has(fields, column)
        ? Option.filter(
            value,
            (cell) =>
              typeof cell === 'boolean' ||
              !Equal.equals(cell, defaults[column]),
          )
        : Option.none(),
    ),
  );
  const rows = columns.unknownRowsAfter;
  return isRows(rows) ? { ...table, [UNKNOWN_ROWS_KEY]: rows } : table;
};

// A record's columns from a table: every column empty, then the table's
// values; the noun puts its standard keys' values over those.
const psaColumnsFromTable = <Tag extends string>({
  _tag,
  defaults,
  table,
}: Readonly<{
  _tag: Tag;
  defaults: Readonly<Record<string, unknown>>;
  table: TomlTable;
}>) => ({
  _tag,
  ...Record.map(defaults, () => Option.none()),
  ...Record.map(Record.remove(table, UNKNOWN_ROWS_KEY), Option.some),
  unknownRowsAfter: table[UNKNOWN_ROWS_KEY] ?? [],
});

const prefixed = (table: TomlTable): TomlTable =>
  Record.mapKeys(table, (column) => `${PSA_KEY_PREFIX}${column}`);

const unprefixed = (attributes: TomlTable): TomlTable =>
  Record.mapKeys(
    Record.filter(attributes, (_, key) => key.startsWith(PSA_KEY_PREFIX)),
    (key) => key.slice(PSA_KEY_PREFIX.length),
  );

// The tables a planogram's list holds; the fixture's filter has checked that
// the list is one.
const tablesIn = ({
  key,
  table,
}: Readonly<{ key: string; table: TomlTable }>): ReadonlyArray<TomlTable> =>
  Option.getOrElse(Option.filter(Record.get(table, key), isTables), () => []);

const unlistedCodeIssues = ({
  cell,
  path,
}: Readonly<{
  cell: Option.Option<string | PsaUnlistedCode>;
  path: ReadonlyArray<PropertyKey>;
}>): ReadonlyArray<{
  readonly issue: string;
  readonly path: ReadonlyArray<PropertyKey>;
}> =>
  Option.match(cell, {
    onNone: () => [],
    onSome: (code) =>
      Str.isString(code)
        ? []
        : [
            {
              issue: `code ${code.code} is not listed for its column, so it cannot be read as a project`,
              path,
            },
          ],
  });

const refFromPsaIdentity = ({ id, upc }: PsaIdentity) => {
  const identity = new TextEncoder().encode(
    `${Option.getOrElse(upc, () => '')}\u0000${Option.getOrElse(id, () => '')}`,
  );
  let hash = FNV_OFFSET_BASIS;
  for (const byte of identity) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & SIXTY_FOUR_BITS;
  }
  return `p_${hash.toString(36)}`;
};

// PSA names a product by its UPC and ID: the GTIN, or the UPC kept as an
// attribute because it was not one, and the ID kept as an attribute.
const psaIdentityFromVazenProduct = (product: VazenProduct): PsaIdentity => ({
  id: Option.filter(
    Record.get(product.attributes, `${PSA_KEY_PREFIX}id`),
    Str.isString,
  ),
  upc: Option.orElse(product.gtin, () =>
    Option.filter(
      Record.get(product.attributes, `${PSA_KEY_PREFIX}upc`),
      Str.isString,
    ),
  ),
});

// The ref of the product row a product is written on, its unit's.
const rowRefOf = (product: VazenProduct): string =>
  refFromPsaIdentity(psaIdentityFromVazenProduct(product));

// Group packaging levels by their exact pair; a ref's hash can collide.
const rowKeyOf = (product: VazenProduct): string =>
  psaMatchKey({
    identity: psaIdentityFromVazenProduct(product),
    primaryKey: 'both',
  });

// The ref a product reads back with: its row's, or its packaging level's.
const levelRefOf = (product: VazenProduct): string =>
  Option.match(packagingStyleOf(product), {
    onNone: () => rowRefOf(product),
    onSome: (style) => packagingRef({ ref: rowRefOf(product), style }),
  });

const packagingStyleOf = (
  product: VazenProduct,
): Option.Option<PackagingStyle> =>
  Option.filter(product.form, isPackagingStyle);

const packagingRef = ({
  ref,
  style,
}: Readonly<{ ref: string; style: PackagingStyle }>) => `${ref}_${style}`;

const packagingKey = ({
  column,
  style,
}: Readonly<{ column: string; style: PackagingStyle }>) =>
  `${PSA_KEY_PREFIX}${style}_${column}`;

const isColumnOf = ({
  columns,
  key,
  style,
}: Readonly<{
  columns: ReadonlyArray<string>;
  key: string;
  style: PackagingStyle;
}>) => columns.some((column) => key === packagingKey({ column, style }));

// Geometry from three columns, absent when all three cells are; PSA's geometry
// columns all default to zero.
const pointFromColumns = ({
  x,
  y,
  z,
}: Readonly<
  Record<'x' | 'y' | 'z', Option.Option<number>>
>): Option.Option<VazenPosition> =>
  A.some([x, y, z], Option.isSome)
    ? Option.some({
        x: Option.getOrElse(x, () => 0),
        y: Option.getOrElse(y, () => 0),
        z: Option.getOrElse(z, () => 0),
      })
    : Option.none();

const boxFromColumns = ({
  width,
  height,
  depth,
}: Readonly<
  Record<'width' | 'height' | 'depth', Option.Option<number>>
>): Option.Option<VazenDimensions> =>
  A.some([width, height, depth], Option.isSome)
    ? Option.some({
        width: Option.getOrElse(width, () => 0),
        height: Option.getOrElse(height, () => 0),
        depth: Option.getOrElse(depth, () => 0),
      })
    : Option.none();

const pointColumns = (position: Option.Option<VazenPosition>) => ({
  x: Option.map(position, ({ x }) => x),
  y: Option.map(position, ({ y }) => y),
  z: Option.map(position, ({ z }) => z),
});

const boxColumns = (dimensions: Option.Option<VazenDimensions>) => ({
  width: Option.map(dimensions, ({ width }) => width),
  height: Option.map(dimensions, ({ height }) => height),
  depth: Option.map(dimensions, ({ depth }) => depth),
});

// The file's units, from the project's measurement column; metric, its
// default, has no attribute.
const millimetresPerUnit = (attributes: TomlTable): number =>
  attributes[`${PSA_KEY_PREFIX}measurement`] === 'imperial'
    ? MILLIMETRES_PER_INCH
    : MILLIMETRES_PER_CENTIMETRE;

// Adding zero turns a negative zero, which a file can hold, into zero.
const round = (value: number): number =>
  Math.round(value * DECIMALS) / DECIMALS + 0;

const withoutNoise = (value: number): number =>
  Number(value.toPrecision(SIGNIFICANT_DIGITS));

const scaledPoint =
  (scale: Scale) =>
  ({ x, y, z }: VazenPosition): VazenPosition => ({
    x: scale(x),
    y: scale(y),
    z: scale(z),
  });

const scaledBox =
  (scale: Scale) =>
  ({ width, height, depth }: VazenDimensions): VazenDimensions => ({
    width: scale(width),
    height: scale(height),
    depth: scale(depth),
  });

const productWith = ({
  product,
  scale,
}: Readonly<{ product: VazenProduct; scale: Scale }>): VazenProduct => ({
  ...product,
  dimensions: Option.map(product.dimensions, scaledBox(scale)),
});

// A product row read as its unit and, for each packaging style a site places
// it in, a product of that form, which takes that style's columns.
const withPackagingLevels = ({
  placed,
  product,
}: Readonly<{
  placed: ReadonlySet<VazenAttributeScalar>;
  product: VazenProduct;
}>): ReadonlyArray<VazenProduct> => {
  const ref = rowRefOf(product);
  const styles = PACKAGING_STYLES.filter((style) =>
    placed.has(packagingRef({ ref, style })),
  );
  return [
    {
      ...product,
      attributes: Record.filter(
        product.attributes,
        (_, key) =>
          !styles.some((style) =>
            isColumnOf({ columns: PACKAGING_COLUMNS, key, style }),
          ),
      ),
    },
    ...styles.map((style): VazenProduct => {
      const cell = (column: string) =>
        Record.get(product.attributes, packagingKey({ column, style }));
      const length = (column: string) =>
        Option.filter(cell(column), Predicate.isNumber);
      return {
        attributes: {
          ...Record.filter(product.attributes, (_, key) =>
            IDENTITY_KEYS.has(key),
          ),
          ...Record.filter(product.attributes, (_, key) =>
            isColumnOf({ columns: PACKAGING_OTHER_COLUMNS, key, style }),
          ),
          // A total at its default is still a count, which the specification
          // asks of every packaging level.
          [UNIT_COUNT_KEY]: Option.getOrElse(
            cell('total_number'),
            () => PSA_PRODUCT_DEFAULTS[`${style}_total_number`],
          ),
        },
        dimensions: boxFromColumns({
          width: length('width'),
          height: length('height'),
          depth: length('depth'),
        }),
        form: Option.some(style),
        gtin: product.gtin,
        images: Option.none(),
        name: product.name,
        ref: Option.some(packagingRef({ ref, style })),
      };
    }),
  ];
};

// The product rows of the products: each row's packaging levels merge onto its
// unit, or onto a row of their own when it has none.
const productRows = (
  products: ReadonlyArray<VazenProduct>,
): ReadonlyArray<VazenProduct> =>
  Record.values(A.groupBy(products, rowKeyOf)).map((row) => {
    const unit = Option.getOrElse(
      A.findFirst(row, (product) => Option.isNone(packagingStyleOf(product))),
      () => ({ ...A.headNonEmpty(row), dimensions: Option.none() }),
    );
    return {
      ...unit,
      attributes: row.reduce(
        (attributes, product) => ({
          ...attributes,
          ...packagingColumns(product),
        }),
        unit.attributes,
      ),
    };
  });

// The columns a packaging level writes on its row: its `_psa__` attributes,
// and its standard keys in its style's columns.
const packagingColumns = (product: VazenProduct): TomlTable =>
  Option.match(packagingStyleOf(product), {
    onNone: () => ({}),
    onSome: (style) => ({
      ...Record.filter(product.attributes, (_, key) =>
        key.startsWith(PSA_KEY_PREFIX),
      ),
      ...Record.mapKeys(
        Record.getSomes({
          ...boxColumns(product.dimensions),
          total_number: Record.get(product.attributes, UNIT_COUNT_KEY),
        }),
        (column) => packagingKey({ column, style }),
      ),
    }),
  });

// What a product's row could not hold beside its other products: a name of its
// own, a `_psa__upc` beside a GTIN, which the row's UPC holds, and `_psa__`
// attributes another product writes. A packaging level holds only the UPC, the
// ID and the columns of its style that its standard keys do not write, and a
// unit holds no column of a packaging level its row has.
const rowIssues = ({
  product,
  row,
}: Readonly<{
  product: VazenProduct;
  row: ReadonlyArray<VazenProduct>;
}>): ReadonlyArray<{
  readonly issue: string;
  readonly path: ReadonlyArray<PropertyKey>;
}> => {
  const issue = ({
    key,
    message,
  }: Readonly<{ key: string; message: string }>) => ({
    issue: `${key} ${message}`,
    path: ['attributes', key],
  });
  const keys = Record.keys(product.attributes).filter((key) =>
    key.startsWith(PSA_KEY_PREFIX),
  );
  return [
    ...(row.every(({ name }) => name === product.name)
      ? []
      : [
          {
            issue:
              "the product's name differs from another's on its PSA product row, which holds one name",
            path: ['name'],
          },
        ]),
    ...(Option.isSome(product.gtin) &&
    Record.has(product.attributes, `${PSA_KEY_PREFIX}upc`)
      ? [
          {
            issue: `the GTIN is written as the UPC, so ${PSA_KEY_PREFIX}upc would be lost`,
            path: ['attributes', `${PSA_KEY_PREFIX}upc`],
          },
        ]
      : []),
    ...Option.match(packagingStyleOf(product), {
      onNone: () => {
        const levels = row.flatMap((other) =>
          Option.toArray(packagingStyleOf(other)),
        );
        return keys.flatMap((key) =>
          Option.match(
            A.findFirst(levels, (style) =>
              isColumnOf({ columns: PACKAGING_COLUMNS, key, style }),
            ),
            {
              onNone: () => [],
              onSome: (style) => [
                issue({
                  key,
                  message: `names a column the ${style} product writes`,
                }),
              ],
            },
          ),
        );
      },
      onSome: (style) => [
        ...keys.flatMap((key) => {
          if (
            IDENTITY_KEYS.has(key) ||
            isColumnOf({ columns: PACKAGING_OTHER_COLUMNS, key, style })
          ) {
            return [];
          }
          return [
            issue({
              key,
              message: isColumnOf({
                columns: PACKAGING_STANDARD_COLUMNS,
                key,
                style,
              })
                ? 'names a column its standard key writes'
                : `names no column of a ${style}`,
            }),
          ];
        }),
        ...Option.match(Record.get(product.attributes, UNIT_COUNT_KEY), {
          onNone: () => [],
          onSome: (count) =>
            Predicate.isNumber(count)
              ? []
              : [issue({ key: UNIT_COUNT_KEY, message: 'holds a number' })],
        }),
      ],
    }),
  ];
};

// A fixture with every length scaled and each site transformed.
const fixtureWith = ({
  fixture,
  mapSite,
  scale,
}: Readonly<{
  fixture: VazenFixture;
  mapSite: (site: VazenSite) => VazenSite;
  scale: Scale;
}>): VazenFixture => ({
  ...fixture,
  dimensions: Option.map(fixture.dimensions, scaledBox(scale)),
  equipment: fixture.equipment.map((piece) =>
    equipmentWith({ mapSite, piece, scale }),
  ),
});

// A planogram without a key is the file's Nth, skipping a number a declared key
// or an earlier made-up id already uses, since a fixture's id is unique.
const withMadeUpIds = (
  fixtures: ReadonlyArray<VazenFixture>,
): ReadonlyArray<VazenFixture> => {
  const declared = new Set(fixtures.flatMap(({ id }) => Option.toArray(id)));
  const free = (number: number): number =>
    declared.has(`${MADE_UP_ID_PREFIX}${number}`) ? free(number + 1) : number;
  return A.mapAccum(
    fixtures,
    1,
    (next, fixture, index): [number, VazenFixture] =>
      Option.match(fixture.id, {
        onNone: () => {
          const number = free(Math.max(next, index + 1));
          return [
            number + 1,
            { ...fixture, id: Option.some(`${MADE_UP_ID_PREFIX}${number}`) },
          ];
        },
        onSome: () => [next, fixture],
      }),
  )[1];
};

const equipmentWith = ({
  mapSite,
  piece,
  scale,
}: Readonly<{
  mapSite: (site: VazenSite) => VazenSite;
  piece: VazenEquipment;
  scale: Scale;
}>): VazenEquipment => ({
  ...piece,
  dimensions: Option.map(piece.dimensions, scaledBox(scale)),
  equipment: piece.equipment.map((child) =>
    equipmentWith({ mapSite, piece: child, scale }),
  ),
  position: Option.map(piece.position, scaledPoint(scale)),
  sites: piece.sites.map((site) => ({
    ...mapSite(site),
    dimensions: Option.map(site.dimensions, scaledBox(scale)),
    position: Option.map(site.position, scaledPoint(scale)),
  })),
});

const flattened = (
  equipment: ReadonlyArray<VazenEquipment>,
): ReadonlyArray<VazenEquipment> =>
  equipment.flatMap((piece) => [piece, ...flattened(piece.equipment)]);

const psaFixtureTypeFromVazenType = (type: string): PsaFixtureType =>
  isListedFixtureType(type)
    ? type
    : Option.getOrElse(
        Record.get(PSA_FIXTURE_TYPE_BY_VAZEN_TYPE, type),
        () => SHELF,
      );

// The products a selector names: those whose fields match every key given, as
// the specification resolves it.
const productsMatching = ({
  products,
  selector,
}: Readonly<{
  products: ReadonlyArray<VazenProduct>;
  selector: VazenProductSelector;
}>): ReadonlyArray<VazenProduct> =>
  products.filter((product) =>
    Record.toEntries(selector).every(([key, value]) =>
      Option.exists(fieldOf({ key, product }), (field) =>
        isSameScalar({ field, value }),
      ),
    ),
  );

const fieldOf = ({
  key,
  product,
}: Readonly<{
  key: string;
  product: VazenProduct;
}>): Option.Option<TomlValue> => {
  switch (key) {
    case 'form': {
      return product.form;
    }
    case 'gtin': {
      return product.gtin;
    }
    case 'name': {
      return Option.some(product.name);
    }
    case 'ref': {
      return product.ref;
    }
    default: {
      return Record.get(product.attributes, key);
    }
  }
};

const isSameScalar = ({
  field,
  value,
}: Readonly<{ field: TomlValue; value: VazenAttributeScalar }>): boolean => {
  if (field instanceof Date && value instanceof Date) {
    // Local values have no instant; their TOML forms retain their date/time kinds.
    return (field instanceof TomlDate && field.isLocal()) ||
      (value instanceof TomlDate && value.isLocal())
      ? field.toISOString() === value.toISOString()
      : field.getTime() === value.getTime();
  }
  return field === value;
};

// Every site under the fixtures, with its path in the project.
const sitesOf = (fixtures: ReadonlyArray<VazenFixture>) =>
  fixtures.flatMap((fixture, index) =>
    equipmentIn({
      equipment: fixture.equipment,
      path: ['fixtures', index, 'equipment'],
    }).flatMap(({ path, piece }) =>
      piece.sites.map((site, place) => ({
        path: [...path, 'sites', place],
        site,
      })),
    ),
  );

// Every piece of equipment, a piece before what it holds, with its path.
const equipmentIn = ({
  equipment,
  path,
}: Readonly<{
  equipment: ReadonlyArray<VazenEquipment>;
  path: ReadonlyArray<PropertyKey>;
}>): ReadonlyArray<{
  path: ReadonlyArray<PropertyKey>;
  piece: VazenEquipment;
}> =>
  equipment.flatMap((piece, index) => [
    { path: [...path, index], piece },
    ...equipmentIn({
      equipment: piece.equipment,
      path: [...path, index, 'equipment'],
    }),
  ]);
