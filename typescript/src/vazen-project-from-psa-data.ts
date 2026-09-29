import {
  Array as A,
  Equal,
  Option,
  Record,
  Schema as S,
  String as Str,
} from 'effect';

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
} from './psa';
import { TomlTable, TomlValue } from './toml-from-text';
import type { VazenAttributeScalar } from './vazen-attributes';
import { VazenEquipment } from './vazen-equipment';
import { VazenFixture } from './vazen-fixture';
import type { VazenDimensions, VazenPosition } from './vazen-geometry';
import { VazenGtin, VazenProduct } from './vazen-product';
import { VazenProject } from './vazen-project';
import {
  VazenOrientation,
  VazenSite,
  type VazenProductSelector,
} from './vazen-site';

// The key a PSA column takes among an object's attributes, and the keys a
// planogram's lists and a record's following rows take beside the columns.
const PSA_KEY_PREFIX = '_psa__';
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

// The segment columns a bay's position and dimensions write.
const BAY_GEOMETRY_ATTRIBUTES = new Set(
  ['x', 'y', 'z', 'width', 'height', 'depth'].map(
    (column) => `${PSA_KEY_PREFIX}${column}`,
  ),
);

// The id of a planogram without a key, numbered by its place in the file.
const MADE_UP_ID_PREFIX = 'planogram-';

// FNV-1a over the UPC and ID, 64 bits in base 36: a ref is short and opaque,
// and a position computes the same one as its product.
const FNV_OFFSET_BASIS = 0xcb_f2_9c_e4_84_22_23_25n;
const FNV_PRIME = 0x1_00_00_00_01_b3n;
const SIXTY_FOUR_BITS = (1n << 64n) - 1n;

// PSA's "side" is the left face. Which way its quarter turns go follows the
// mapping Vazen's own converters have used, 90 turning the top of the face to
// the shopper's right; the test pins that choice, and no check against
// ProSpace has been made.
const VazenOrientationFromPsaOrientation = S.transformLiterals(
  ['front', 'F'],
  ['front_90', 'Fr'],
  ['front_180', 'Fu'],
  ['front_270', 'Fl'],
  ['back', 'B'],
  ['back_90', 'Br'],
  ['back_180', 'Bu'],
  ['back_270', 'Bl'],
  ['side', 'L'],
  ['side_90', 'Lr'],
  ['side_180', 'Lu'],
  ['side_270', 'Ll'],
  ['right', 'R'],
  ['right_90', 'Rr'],
  ['right_180', 'Ru'],
  ['right_270', 'Rl'],
  ['top', 'U'],
  ['top_90', 'Ur'],
  ['top_180', 'Uu'],
  ['top_270', 'Ul'],
  ['base', 'D'],
  ['base_90', 'Dr'],
  ['base_180', 'Du'],
  ['base_270', 'Dl'],
);

// A code the list does not have cannot become a type or an orientation, nor
// choose the file's units, so a file holding one is refused rather than read as
// something it does not say.
const PsaDataWithListedCodes = PsaData.pipe(
  S.filter((data) => [
    ...unlistedCodeIssues({
      cell: data.project.measurement,
      path: ['project', 'measurement'],
    }),
    ...data.planograms.flatMap((section, planogram) =>
      section.fixtures.flatMap(({ fixture, positions }, index) => [
        ...unlistedCodeIssues({
          cell: fixture.type,
          path: ['planograms', planogram, 'fixtures', index, 'fixture', 'type'],
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
).annotations({ identifier: 'PsaDataWithListedCodes' });

// A project PSA can hold: no two products share a UPC and ID, which PSA could
// not tell apart and which read as one ref, each site's selector names exactly
// one product, as the specification requires, and that product has a UPC or an
// ID for its position to name it by.
const VazenProjectPsaCanHold = VazenProject.pipe(
  S.filter((project) => {
    const refs = project.products.map((product) =>
      refFromPsaIdentity(psaIdentityFromVazenProduct(product)),
    );
    const byRef = A.groupBy(refs, (ref) => ref);
    return [
      ...refs.flatMap((ref, index) => {
        const sharing = Option.getOrElse(
          Option.map(Record.get(byRef, ref), A.length),
          () => 1,
        );
        return sharing === 1
          ? []
          : [
              {
                message: `the product's UPC and ID are shared by ${sharing} products, which PSA could not tell apart`,
                path: ['products', index],
              },
            ];
      }),
      ...sitesOf(project.fixtures).flatMap(({ path, site }) => {
        const matches = productsMatching({
          products: project.products,
          selector: site.product,
        });
        if (matches.length !== 1) {
          return [
            {
              message: `the product selector matches ${matches.length} products, not one`,
              path,
            },
          ];
        }
        return matches.every((product) => {
          const { id, upc } = psaIdentityFromVazenProduct(product);
          return Option.isSome(id) || Option.isSome(upc);
        })
          ? []
          : [
              {
                message:
                  'the product has neither a UPC nor an ID, so a position could not name it',
                path,
              },
            ];
      }),
    ];
  }),
).annotations({ identifier: 'VazenProjectPsaCanHold' });

// A cell holding a code from its column's list, read by name, or a code the
// list does not have, which `PsaDataWithListedCodes` refuses before a noun
// reads it.
const PsaFixtureTypeCell = S.OptionFromSelf(
  S.Union(S.typeSchema(PsaFixtureTypeFromCode), PsaUnlistedCode),
);
const PsaOrientationCell = S.OptionFromSelf(
  S.Union(VazenOrientationFromPsaOrientation, PsaUnlistedCode),
);

// A column a noun reads by name, as its record reads it: a text or a number,
// or empty.
const PsaTextColumn = S.OptionFromSelf(S.String);
const PsaNumberColumn = S.OptionFromSelf(S.Finite);

// The columns a noun does not read by name, each an Option of the TOML value
// its `_psa__` attribute holds, or the record's tag and the rows after it.
// `PsaData`, composed before the nouns, reads a written column with the
// column's own schema.
const PsaOtherColumns = S.Record({
  key: S.String,
  value: S.Union(S.OptionFromSelf(TomlValue), TomlValue),
});

// What each noun reads from its record by name, and so what its `_psa__`
// attributes may not name.
const PsaProjectColumns = S.Struct(
  {
    _tag: S.Literal('Project'),
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
  },
  PsaOtherColumns,
).annotations({ identifier: 'PsaProjectColumns' });
const PsaProductColumns = S.Struct(
  {
    _tag: S.Literal('Product'),
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  },
  PsaOtherColumns,
).annotations({ identifier: 'PsaProductColumns' });
const PsaPlanogramColumns = S.Struct(
  {
    _tag: S.Literal('Planogram'),
    key: PsaTextColumn,
    name: PsaTextColumn,
    unknownRowsAfter: TomlValue,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  },
  PsaOtherColumns,
).annotations({ identifier: 'PsaPlanogramColumns' });
const PsaFixtureColumns = S.Struct(
  {
    _tag: S.Literal('Fixture'),
    type: PsaFixtureTypeCell,
    unknownRowsAfter: TomlValue,
    x: PsaNumberColumn,
    y: PsaNumberColumn,
    z: PsaNumberColumn,
    width: PsaNumberColumn,
    height: PsaNumberColumn,
    depth: PsaNumberColumn,
  },
  PsaOtherColumns,
).annotations({ identifier: 'PsaFixtureColumns' });
const PsaPositionColumns = S.Struct(
  {
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
  },
  PsaOtherColumns,
).annotations({ identifier: 'PsaPositionColumns' });
const PsaSegmentColumns = S.Struct(
  { _tag: S.Literal('Segment'), unknownRowsAfter: TomlValue },
  PsaOtherColumns,
).annotations({ identifier: 'PsaSegmentColumns' });
const PsaPerformanceColumns = S.Struct(
  { _tag: S.Literal('Performance'), unknownRowsAfter: TomlValue },
  PsaOtherColumns,
).annotations({ identifier: 'PsaPerformanceColumns' });

const isTables = S.is(S.Array(TomlTable));
const isRows = S.is(S.NonEmptyArray(TomlValue));
const isVazenGtin = S.is(VazenGtin);
const isVazenOrientation = S.is(VazenOrientation);
const isListedFixtureType = S.is(S.typeSchema(PsaFixtureTypeFromCode));

// Whether every key of a table names a column of the record it writes, or the
// rows after the record.
const psaColumnsOnly = (columns: Iterable<string>) => {
  const named = new Set([...columns, UNKNOWN_ROWS_KEY]);
  return (table: TomlTable): ReadonlyArray<S.FilterIssue> =>
    Record.keys(table)
      .filter((key) => !named.has(key))
      .map((key) => ({ message: `${key} names no PSA column`, path: [key] }));
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
  }: Readonly<{ attributes: TomlTable }>): ReadonlyArray<S.FilterIssue> =>
    Record.keys(attributes)
      .filter((key) => key.startsWith(PSA_KEY_PREFIX))
      .flatMap((key) => {
        const column = key.slice(PSA_KEY_PREFIX.length);
        if (Record.has(fields, column)) {
          return [
            {
              message: `${key} names a column its standard key writes`,
              path: ['attributes', key],
            },
          ];
        }
        return named.has(column)
          ? []
          : [
              {
                message: `${key} names no PSA column`,
                path: ['attributes', key],
              },
            ];
      });
};

// A segment or performance row as a table of its columns, kept in a list on
// its planogram's fixture.
const TomlTableFromPsaSegment = S.transform(
  PsaSegmentColumns,
  TomlTable.pipe(S.filter(psaColumnsOnly(Record.keys(PSA_SEGMENT_DEFAULTS)))),
  {
    decode: (segment) =>
      tableFromPsaColumns({
        columns: segment,
        defaults: PSA_SEGMENT_DEFAULTS,
        fields: PsaSegmentColumns.fields,
      }),
    encode: (table) =>
      psaColumnsFromTable({
        _tag: 'Segment',
        defaults: PSA_SEGMENT_DEFAULTS,
        table,
      }),
    strict: true,
  },
).annotations({ identifier: 'TomlTableFromPsaSegment' });

const TomlTableFromPsaPerformance = S.transform(
  PsaPerformanceColumns,
  TomlTable.pipe(
    S.filter(psaColumnsOnly(Record.keys(PSA_PERFORMANCE_DEFAULTS))),
  ),
  {
    decode: (performance) =>
      tableFromPsaColumns({
        columns: performance,
        defaults: PSA_PERFORMANCE_DEFAULTS,
        fields: PsaPerformanceColumns.fields,
      }),
    encode: (table) =>
      psaColumnsFromTable({
        _tag: 'Performance',
        defaults: PSA_PERFORMANCE_DEFAULTS,
        table,
      }),
    strict: true,
  },
).annotations({ identifier: 'TomlTableFromPsaPerformance' });

// A site names its product by the position's UPC and ID, which the project
// turns into the product's ref once it holds the products.
const VazenSiteFromPsaPosition = S.transform(
  PsaPositionColumns,
  VazenSite.pipe(
    S.filter(
      psaAttributesOnly({
        columns: Record.keys(PSA_POSITION_DEFAULTS),
        fields: PsaPositionColumns.fields,
      }),
    ),
  ),
  {
    decode: (position) => ({
      attributes: prefixed(
        tableFromPsaColumns({
          columns: position,
          defaults: PSA_POSITION_DEFAULTS,
          fields: PsaPositionColumns.fields,
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
    }),
    encode: (site) => ({
      ...psaColumnsFromTable({
        _tag: 'Position',
        defaults: PSA_POSITION_DEFAULTS,
        table: unprefixed(site.attributes),
      }),
      ...pointColumns(site.position),
      ...boxColumns(site.dimensions),
      d_facings: Option.flatMap(site.facings, ({ deep }) => deep),
      h_facings: Option.flatMap(site.facings, ({ wide }) => wide),
      id: Option.filter(Record.get(site.product, 'id'), Str.isString),
      orientation: site.orientation,
      upc: Option.filter(Record.get(site.product, 'upc'), Str.isString),
      v_facings: Option.flatMap(site.facings, ({ high }) => high),
    }),
    strict: true,
  },
).annotations({ identifier: 'VazenSiteFromPsaPosition' });

// A fixture row with the positions after it read as sites.
const PsaFixtureSectionWithSites = S.Struct({
  fixture: PsaFixtureColumns,
  positions: S.Array(VazenSiteFromPsaPosition),
}).annotations({ identifier: 'PsaFixtureSectionWithSites' });

// A fixture row and the positions after it are a piece of equipment holding
// its sites; a type of equipment PSA lacks is written as a shelf.
const VazenEquipmentFromPsaFixtureSection = S.transform(
  PsaFixtureSectionWithSites,
  VazenEquipment.pipe(
    S.filter(
      psaAttributesOnly({
        columns: Record.keys(PSA_FIXTURE_DEFAULTS),
        fields: PsaFixtureColumns.fields,
      }),
    ),
  ),
  {
    decode: ({ fixture, positions }) => ({
      attributes: prefixed(
        tableFromPsaColumns({
          columns: fixture,
          defaults: PSA_FIXTURE_DEFAULTS,
          fields: PsaFixtureColumns.fields,
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
    }),
    encode: (piece) => ({
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
    }),
    strict: true,
  },
).annotations({ identifier: 'VazenEquipmentFromPsaFixtureSection' });

// A planogram row with the rows after it read as equipment and tables.
const PsaPlanogramSectionWithEquipment = S.Struct({
  fixtures: S.Array(VazenEquipmentFromPsaFixtureSection),
  performance: S.Array(TomlTableFromPsaPerformance),
  planogram: PsaPlanogramColumns,
  segments: S.Array(TomlTableFromPsaSegment),
}).annotations({ identifier: 'PsaPlanogramSectionWithEquipment' });

// A planogram and the rows after it are a fixture: its fixture rows its
// equipment, its segment and performance rows lists of tables among its
// attributes. Written, the equipment goes in reading order, a piece before
// what it holds, as PSA lists fixture rows, and a bay goes as a segment after
// those the file had; so a bay holding sites is refused, a segment holding no
// positions, and so is a bay attribute named for a column its position or
// dimensions write.
const VazenFixtureFromPsaPlanogramSection = S.transform(
  PsaPlanogramSectionWithEquipment,
  VazenFixture.pipe(
    S.filter(
      psaAttributesOnly({
        columns: [
          ...Record.keys(PSA_PLANOGRAM_DEFAULTS),
          PERFORMANCE_KEY,
          SEGMENTS_KEY,
        ],
        fields: PsaPlanogramColumns.fields,
      }),
    ),
    S.filter((fixture) =>
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
                      message: `${PSA_KEY_PREFIX}${key} holds a list of tables, one per row`,
                      path: ['attributes', `${PSA_KEY_PREFIX}${key}`],
                    },
                  ],
          },
        ),
      ),
    ),
    S.filter((fixture) =>
      equipmentIn({ equipment: fixture.equipment, path: ['equipment'] })
        .filter(({ piece }) => piece.type === BAY)
        .flatMap(({ path, piece }) => [
          ...(piece.sites.length > 0
            ? [
                {
                  message:
                    'a bay is written as a segment, which holds no positions, so its sites would be lost',
                  path: [...path, 'sites'],
                },
              ]
            : []),
          ...Record.keys(piece.attributes)
            .filter((key) => BAY_GEOMETRY_ATTRIBUTES.has(key))
            .map((key) => ({
              message: `${key} names a column its standard key writes`,
              path: [...path, 'attributes', key],
            })),
        ]),
    ),
  ),
  {
    decode: ({ fixtures, performance, planogram, segments }) => ({
      attributes: prefixed({
        ...tableFromPsaColumns({
          columns: planogram,
          defaults: PSA_PLANOGRAM_DEFAULTS,
          fields: PsaPlanogramColumns.fields,
        }),
        ...Record.filter(
          { [PERFORMANCE_KEY]: performance, [SEGMENTS_KEY]: segments },
          A.isNonEmptyReadonlyArray,
        ),
      }),
      dimensions: boxFromColumns(planogram),
      equipment: fixtures,
      id: planogram.key,
      name: planogram.name,
      sortOrder: Option.none(),
    }),
    encode: (fixture) => {
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
                ...pointColumns(bay.position),
                ...boxColumns(bay.dimensions),
              }),
            })),
        ],
      };
    },
    strict: true,
  },
).annotations({ identifier: 'VazenFixtureFromPsaPlanogramSection' });

// A UPC that is a GTIN is the product's; one that is not stays a column, so it
// is not lost, and is written back unless a GTIN is given.
const VazenProductFromPsaProduct = S.transform(
  PsaProductColumns,
  VazenProduct.pipe(
    S.filter(
      psaAttributesOnly({
        columns: Record.keys(PSA_PRODUCT_DEFAULTS),
        fields: PsaProductColumns.fields,
      }),
    ),
    S.filter(
      (product) =>
        Option.isNone(product.gtin) ||
        !Record.has(product.attributes, `${PSA_KEY_PREFIX}upc`) ||
        `the GTIN is written as the UPC, so ${PSA_KEY_PREFIX}upc would be lost`,
    ),
  ),
  {
    decode: (product) => {
      const table = tableFromPsaColumns({
        columns: product,
        defaults: PSA_PRODUCT_DEFAULTS,
        fields: PsaProductColumns.fields,
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
    },
    encode: (product) => {
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
    },
    strict: true,
  },
).annotations({ identifier: 'VazenProductFromPsaProduct' });

const VazenProjectFieldsFromPsaProject = S.transform(
  PsaProjectColumns,
  VazenProject.pick('attributes', 'name').pipe(
    S.filter(
      psaAttributesOnly({
        columns: Record.keys(PSA_PROJECT_DEFAULTS),
        fields: PsaProjectColumns.fields,
      }),
    ),
  ),
  {
    decode: (project) => ({
      attributes: prefixed(
        tableFromPsaColumns({
          columns: project,
          defaults: PSA_PROJECT_DEFAULTS,
          fields: PsaProjectColumns.fields,
        }),
      ),
      name: project.name,
    }),
    encode: (project) => ({
      ...psaColumnsFromTable({
        _tag: 'Project',
        defaults: PSA_PROJECT_DEFAULTS,
        table: unprefixed(project.attributes),
      }),
      name: Option.filter(project.name, Str.isNonEmpty),
    }),
    strict: true,
  },
).annotations({ identifier: 'VazenProjectFieldsFromPsaProject' });

// A file's data with each section read as its noun.
const PsaDataWithNouns = S.Struct({
  compromises: PsaData.fields.compromises,
  declaredVersion: PsaData.fields.declaredVersion,
  planograms: S.Array(VazenFixtureFromPsaPlanogramSection),
  products: S.Array(VazenProductFromPsaProduct),
  project: VazenProjectFieldsFromPsaProject,
}).annotations({ identifier: 'PsaDataWithNouns' });

/**
 * A project from a PSA file's data, and the data back from a project. Reading
 * takes the file's units into millimetres, a planogram as a fixture, each
 * fixture row as its equipment and each position as a site naming its product
 * by `ref`, and keeps every other value the file gives, that its column's
 * default does not imply, as a `_psa__` attribute, and drops the data's
 * `compromises`. Writing puts each standard
 * key into its column and each `_psa__` attribute back, refuses an attribute
 * named for a column PSA does not have or a standard key writes, a site whose
 * product has neither a UPC nor an ID, or a bay holding sites, and drops a
 * project's descriptive keys, `form`, `images` and any type of equipment PSA
 * lacks, which becomes a shelf. Either way, two products sharing a UPC and ID
 * are refused: PSA could not tell them apart, and they would read as one ref.
 */
export const VazenProjectFromPsaData: S.Schema<VazenProject, PsaData> =
  S.compose(
    PsaDataWithListedCodes,
    // The nouns are read in the file's units, each site naming its product by
    // UPC and ID; the project, which holds the units and the products, scales
    // every length and names each product by its ref. A planogram without a
    // key is the file's Nth, since a layout needs an id.
    S.transform(PsaDataWithNouns, VazenProjectPsaCanHold, {
      decode: ({
        declaredVersion,
        planograms,
        products,
        project,
      }): VazenProject => {
        const factor = millimetresPerUnit(project.attributes);
        const millimetres: Scale = (value) => round(value * factor);
        const ref = (selector: VazenProductSelector) => ({
          ref: refFromPsaIdentity({
            id: Option.filter(Record.get(selector, 'id'), Str.isString),
            upc: Option.filter(Record.get(selector, 'upc'), Str.isString),
          }),
        });
        return {
          ...project,
          fixtures: withMadeUpIds(planograms).map((fixture) =>
            fixtureWith({ fixture, product: ref, scale: millimetres }),
          ),
          products: products.map((product) =>
            productWith({ product, scale: millimetres }),
          ),
          source: Option.some({ declaredVersion, format: 'psa' }),
          stage: 'layout',
        };
      },
      encode: (project) => {
        const factor = millimetresPerUnit(project.attributes);
        const fileUnits: Scale = (value) => withoutNoise(value / factor);
        // The one product the selector names, which the filter has checked.
        const identity = (selector: VazenProductSelector) =>
          Record.getSomes(
            Option.match(
              A.head(
                productsMatching({ products: project.products, selector }),
              ),
              {
                onNone: (): PsaIdentity => ({
                  id: Option.none(),
                  upc: Option.none(),
                }),
                onSome: psaIdentityFromVazenProduct,
              },
            ),
          );
        return {
          compromises: [],
          declaredVersion: Option.flatMap(project.source, (source) =>
            source.format === 'psa' ? source.declaredVersion : Option.none(),
          ),
          planograms: project.fixtures.map((fixture) =>
            fixtureWith({ fixture, product: identity, scale: fileUnits }),
          ),
          products: project.products.map((product) =>
            productWith({ product, scale: fileUnits }),
          ),
          project: { attributes: project.attributes, name: project.name },
        };
      },
      strict: true,
    }),
  ).annotations({ identifier: 'VazenProjectFromPsaData' });

type Scale = (value: number) => number;

// What PSA names a product by.
type PsaIdentity = Readonly<{
  id: Option.Option<string>;
  upc: Option.Option<string>;
}>;

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
  const table = Record.filterMap(columns, (value, column) =>
    Option.isOption(value) && !Record.has(fields, column)
      ? Option.filter(
          value,
          (cell) =>
            typeof cell === 'boolean' || !Equal.equals(cell, defaults[column]),
        )
      : Option.none(),
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
}>): ReadonlyArray<S.FilterIssue> =>
  Option.match(cell, {
    onNone: () => [],
    onSome: (code) =>
      Str.isString(code)
        ? []
        : [
            {
              message: `code ${code.code} is not listed for its column, so it cannot be read as a project`,
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

// A fixture with every length scaled and each site's product renamed.
const fixtureWith = ({
  fixture,
  product,
  scale,
}: Readonly<{
  fixture: VazenFixture;
  product: (selector: VazenProductSelector) => VazenProductSelector;
  scale: Scale;
}>): VazenFixture => ({
  ...fixture,
  dimensions: Option.map(fixture.dimensions, scaledBox(scale)),
  equipment: fixture.equipment.map((piece) =>
    equipmentWith({ piece, product, scale }),
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
  piece,
  product,
  scale,
}: Readonly<{
  piece: VazenEquipment;
  product: (selector: VazenProductSelector) => VazenProductSelector;
  scale: Scale;
}>): VazenEquipment => ({
  ...piece,
  dimensions: Option.map(piece.dimensions, scaledBox(scale)),
  equipment: piece.equipment.map((child) =>
    equipmentWith({ piece: child, product, scale }),
  ),
  position: Option.map(piece.position, scaledPoint(scale)),
  sites: piece.sites.map((site) => ({
    ...site,
    dimensions: Option.map(site.dimensions, scaledBox(scale)),
    position: Option.map(site.position, scaledPoint(scale)),
    product: product(site.product),
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
}: Readonly<{ field: TomlValue; value: VazenAttributeScalar }>): boolean =>
  field instanceof Date && value instanceof Date
    ? field.getTime() === value.getTime()
    : field === value;

// Every site under the fixtures, with the path of its selector in the project.
const sitesOf = (fixtures: ReadonlyArray<VazenFixture>) =>
  fixtures.flatMap((fixture, index) =>
    equipmentIn({
      equipment: fixture.equipment,
      path: ['fixtures', index, 'equipment'],
    }).flatMap(({ path, piece }) =>
      piece.sites.map((site, place) => ({
        path: [...path, 'sites', place, 'product'],
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
