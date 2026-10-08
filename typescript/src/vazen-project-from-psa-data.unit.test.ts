import { readFileSync } from 'node:fs';
import { Option, Record, Result, Schema as S, String as Str } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  PSA_FIXTURE_DEFAULTS,
  PSA_PERFORMANCE_DEFAULTS,
  PSA_PLANOGRAM_DEFAULTS,
  PSA_POSITION_DEFAULTS,
  PSA_PRODUCT_DEFAULTS,
  PSA_PROJECT_DEFAULTS,
  PSA_SEGMENT_DEFAULTS,
  PsaData,
  PsaDataFromPsaBytes,
  PsaDataFromPsaText,
  type PsaMessage,
  type PsaRecordType,
} from './psa';
import { TomlTable } from './toml-from-text';
import type { VazenProduct } from './vazen-product';
import type { VazenProject } from './vazen-project';
import { VazenProjectFromJsonText } from './vazen-project-from-json-text';
import { VazenProjectFromPsaData } from './vazen-project-from-psa-data';
import {
  decodeVazenProjectFromPsaFile,
  encodePsaFileFromVazenProject,
} from './vazen-project-from-psa-text';
import { VazenProjectFromTomlText } from './vazen-project-from-toml-text';

// Everything in src/psa ships publicly, so the test files are made up.
const MADE_UP_FILES = [
  'v2017.2.0.psa',
  'v2019.1.0.psa',
  'v2020.1.0.psa',
  'v2021.1.2.psa',
  'v2024.4.0.psa',
  'v2024.4.0-two-planograms.psa',
];

const PACKAGING_STYLES: ReadonlySet<string> = new Set([
  'alternate',
  'case',
  'display',
  'tray',
]);

const DEFAULTS_BY_TYPE: Record<
  PsaRecordType,
  Readonly<Record<string, unknown>>
> = {
  Fixture: PSA_FIXTURE_DEFAULTS,
  Performance: PSA_PERFORMANCE_DEFAULTS,
  Planogram: PSA_PLANOGRAM_DEFAULTS,
  Position: PSA_POSITION_DEFAULTS,
  Product: PSA_PRODUCT_DEFAULTS,
  Project: PSA_PROJECT_DEFAULTS,
  Segment: PSA_SEGMENT_DEFAULTS,
};

// A layout built in code, with a bay holding a shelf, a peg and a type of
// equipment PSA lacks, and a product selected by GTIN.
const BUILT_IN_CODE: VazenProject = {
  attributes: { category: 'Cereals' },
  fixtures: [
    {
      attributes: {},
      dimensions: Option.some({ width: 1000, height: 2000, depth: 500 }),
      equipment: [
        {
          attributes: { _psa__door: true },
          dimensions: Option.some({ width: 1000, height: 2000, depth: 500 }),
          equipment: [
            {
              attributes: {},
              dimensions: Option.some({ width: 1000, height: 300, depth: 500 }),
              equipment: [],
              position: Option.some({ x: 0, y: 200, z: 0 }),
              sites: [
                {
                  attributes: {},
                  dimensions: Option.none(),
                  facings: Option.some({
                    deep: Option.none(),
                    high: Option.none(),
                    wide: Option.some(3),
                  }),
                  orientation: Option.some('Fl'),
                  position: Option.some({ x: 10, y: 220, z: 0 }),
                  product: { gtin: '884400062451' },
                  sortOrder: Option.none(),
                },
              ],
              sortOrder: Option.none(),
              type: 'shelf',
            },
            {
              attributes: {},
              dimensions: Option.some({ width: 20, height: 20, depth: 200 }),
              equipment: [],
              position: Option.some({ x: 500, y: 1500, z: 0 }),
              sites: [],
              sortOrder: Option.none(),
              type: 'peg',
            },
            {
              attributes: {},
              dimensions: Option.none(),
              equipment: [],
              position: Option.none(),
              sites: [],
              sortOrder: Option.none(),
              type: 'basket',
            },
          ],
          position: Option.some({ x: 0, y: 0, z: 0 }),
          sites: [],
          sortOrder: Option.none(),
          type: 'bay',
        },
      ],
      id: Option.some('END-12'),
      name: Option.some('Aisle 12 end'),
      sortOrder: Option.none(),
    },
  ],
  messages: [],
  name: Option.some('Built in code'),
  products: [
    {
      attributes: { brand: 'Vazen' },
      dimensions: Option.some({ width: 190, height: 280, depth: 70 }),
      form: Option.some('box'),
      gtin: Option.some('884400062451'),
      images: Option.none(),
      name: 'Vazen Planflakes 400 g',
      ref: Option.some('p1'),
    },
  ],
  source: Option.none(),
  stage: 'layout',
};

const decodeData = S.decodeSync(PsaDataFromPsaBytes);
const decode = S.decodeSync(VazenProjectFromPsaData);
const decodeEither = S.decodeResult(VazenProjectFromPsaData);
const encode = S.encodeSync(VazenProjectFromPsaData);
const encodeEither = S.encodeResult(VazenProjectFromPsaData);

const readMadeUpFile = (name: string): Uint8Array =>
  readFileSync(new URL(`psa/.test-data/${name}`, import.meta.url));

// A record with the given cells and every other column empty.
const record = ({
  _tag,
  cells,
}: Readonly<{
  _tag: PsaRecordType;
  cells: Readonly<Record<string, unknown>>;
}>) => ({
  _tag,
  ...Record.map(DEFAULTS_BY_TYPE[_tag], () => Option.none()),
  ...Record.map(cells, Option.some),
  unknownRowsAfter: [],
});

// PSA data with one planogram holding the given fixture rows and positions. The
// planogram has a key unless given otherwise, so its id is its own.
const dataWith = ({
  fixtures = [],
  planogram = { key: 'P1' },
  products = [],
  project = {},
}: Readonly<{
  fixtures?: ReadonlyArray<{
    fixture: Readonly<Record<string, unknown>>;
    positions: ReadonlyArray<Readonly<Record<string, unknown>>>;
  }>;
  planogram?: Readonly<Record<string, unknown>>;
  products?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  project?: Readonly<Record<string, unknown>>;
}>): PsaData =>
  S.decodeUnknownSync(PsaData)({
    declaredVersion: Option.none(),
    messages: [],
    planograms: [
      {
        fixtures: fixtures.map(({ fixture, positions }) => ({
          fixture: record({ _tag: 'Fixture', cells: fixture }),
          positions: positions.map((cells) =>
            record({ _tag: 'Position', cells }),
          ),
        })),
        performance: [],
        planogram: record({ _tag: 'Planogram', cells: planogram }),
        segments: [],
      },
    ],
    products: products.map((cells) => record({ _tag: 'Product', cells })),
    project: record({ _tag: 'Project', cells: project }),
  });

// A product placed as a unit, a tray and loose, with a case no position uses.
const PLACED_THREE_WAYS = dataWith({
  fixtures: [
    {
      fixture: {},
      positions: [
        { id: '7', upc: '5000000000001' },
        { id: '7', merch_style: 'tray', upc: '5000000000001' },
        { id: '7', merch_style: 'loose', upc: '5000000000001' },
      ],
    },
  ],
  products: [
    {
      case_width: 30,
      id: '7',
      name: 'Dummy cereal',
      tray_depth: 12,
      tray_height: 11,
      tray_number_wide: 3,
      tray_total_number: 6,
      tray_width: 19.5,
      upc: '5000000000001',
      width: 6.5,
      height: 11,
      depth: 6,
    },
  ],
});

// A record with every column filled in as ProSpace reads it, so a cell holding
// its column's default compares equal to an empty one.
const effective = (
  psaRecord: Readonly<{ _tag: PsaRecordType }> &
    Readonly<Record<string, unknown>>,
) => ({
  ...psaRecord,
  ...Record.map(DEFAULTS_BY_TYPE[psaRecord._tag], (value, column) => {
    const cell = psaRecord[column];
    return Option.isOption(cell) ? Option.getOrElse(cell, () => value) : cell;
  }),
});

const effectiveRecords = ({ planograms, products, project }: PsaData) => ({
  planograms: planograms.map(
    ({ fixtures, performance, planogram, segments }) => ({
      fixtures: fixtures.map(({ fixture, positions }) => ({
        fixture: effective(fixture),
        positions: positions.map((position) => effective(position)),
      })),
      performance: performance.map((row) => effective(row)),
      planogram: effective(planogram),
      segments: segments.map((segment) => effective(segment)),
    }),
  ),
  products: products.map((product) => effective(product)),
  project: effective(project),
});

const sitesOf = (project: VazenProject) =>
  project.fixtures.flatMap((fixture) =>
    fixture.equipment.flatMap((piece) => piece.sites),
  );

const projectWithDates = ({
  dates,
  selector,
}: Readonly<{ dates: ReadonlyArray<string>; selector: string }>) =>
  S.decodeSync(VazenProjectFromTomlText)(`schema = "vazen/layout"
schema_version = "0.3.0"
${dates
  .map(
    (date, index) => `
[[products]]
name = "Dummy product ${index + 1}"
gtin = "0000000${index + 1}"
launch = ${date}
`,
  )
  .join('')}
[[fixtures]]
[[fixtures.equipment]]
type = "shelf"
[[fixtures.equipment.sites]]
product = { launch = ${selector} }
`);

const messageOf = (result: Result.Result<unknown, { message: string }>) =>
  Result.match(result, {
    onFailure: (error) => error.message,
    onSuccess: () => '',
  });

describe('VazenProjectFromPsaData', () => {
  it('retains every reported message with the project', () => {
    const messages: ReadonlyArray<PsaMessage> = [
      { _tag: 'DroppedCells', rows: [2], type: 'Product' },
      { _tag: 'IgnoredRows', rows: [1, 3], type: 'Position' },
      { _tag: 'UnlistedWidth', rows: [1], type: 'Product', width: 999 },
      { _tag: 'UnreadCells', column: 'width', rows: [2], type: 'Product' },
    ];
    const project = decode({ ...dataWith({}), messages });
    expect(project.messages).toEqual(messages);
    expect(encode(project).messages).toEqual([]);
  });

  it.each(MADE_UP_FILES)(
    'reads %s as a layout with a product per product row and per packaging style placed, a fixture per planogram, equipment per fixture row and a site per position',
    (name) => {
      const data = decodeData(readMadeUpFile(name));
      const project = decode(data);
      const packagingLevels = new Set(
        data.planograms
          .flatMap((section) => section.fixtures)
          .flatMap(({ positions }) => positions)
          .flatMap((position) =>
            Option.toArray(
              Option.filter(position.merch_style, Str.isString),
            ).flatMap((style) =>
              PACKAGING_STYLES.has(style)
                ? [
                    [
                      Option.getOrNull(position.upc),
                      Option.getOrNull(position.id),
                      style,
                    ].join(' '),
                  ]
                : [],
            ),
          ),
      );
      expect(project.stage).toBe('layout');
      expect(project.source).toEqual(
        Option.some({
          declaredVersion: data.declaredVersion,
          format: 'psa',
        }),
      );
      expect(project.products).toHaveLength(
        data.products.length + packagingLevels.size,
      );
      expect(project.fixtures).toHaveLength(data.planograms.length);
      expect(
        project.fixtures.flatMap((fixture) => fixture.equipment),
      ).toHaveLength(
        data.planograms.flatMap((section) => section.fixtures).length,
      );
      expect(sitesOf(project)).toHaveLength(
        data.planograms
          .flatMap((section) => section.fixtures)
          .flatMap(({ positions }) => positions).length,
      );
    },
  );

  it("reads the made-up 2024.4.0 file in millimetres, naming each site's product by ref, a tray site's its tray's, and keeping the other columns as _psa attributes", () => {
    const project = decode(decodeData(readMadeUpFile('v2024.4.0.psa')));
    const [product, tray] = project.products;
    const fixture = project.fixtures[0];
    const shelf = fixture?.equipment[0];
    const site = shelf?.sites[0];

    expect(project.name).toEqual(Option.some('Fictional Project 5'));
    expect(project.attributes).toMatchObject({
      _psa__key: 'PRJ-5',
      _psa__number_of_stores: 12,
      _psa__primary_key: 'id',
    });
    // Metric is the column's default, and so is the movement period of 7.
    expect(project.attributes).not.toHaveProperty('_psa__measurement');
    expect(project.attributes).not.toHaveProperty('_psa__movement_period');

    expect(product).toMatchObject({
      dimensions: Option.some({ width: 65, height: 120, depth: 60 }),
      gtin: Option.some('5000000000001'),
      name: 'Product 01',
    });
    expect(product?.attributes).toMatchObject({
      _psa__case_width: 19.5,
      _psa__color: 2_113_632,
      _psa__id: '7000001',
      _psa__unknown_rows_after: [
        { _tag: 'ProductCalc', cells: expect.any(Array) },
      ],
    });
    for (const key of [
      '_psa__upc',
      '_psa__name',
      '_psa__width',
      '_psa__tray_width',
    ]) {
      expect(product?.attributes).not.toHaveProperty(key);
    }
    // Placed only as a tray, the product is also its tray, and its case, which
    // no position places, stays in the unit's columns.
    expect(tray).toEqual({
      attributes: {
        _psa__id: '7000001',
        _psa__tray_number_deep: 2,
        _psa__tray_number_high: 1,
        _psa__tray_number_wide: 3,
        _vazen__unit_count: 6,
      },
      dimensions: Option.some({ width: 195, height: 110, depth: 120 }),
      form: Option.some('tray'),
      gtin: Option.some('5000000000001'),
      images: Option.none(),
      name: 'Product 01',
      ref: Option.map(product?.ref ?? Option.none(), (ref) => `${ref}_tray`),
    });

    expect(fixture).toMatchObject({
      dimensions: Option.some({ width: 4000, height: 1800, depth: 500 }),
      id: Option.some('PG-5'),
      name: Option.some('Aisle 5'),
    });
    const bays = S.decodeUnknownSync(S.Array(TomlTable))(
      fixture?.attributes._psa__segments,
    );
    expect(bays).toMatchObject([
      { key: 'B1', name: 'Bay 1', width: 100, height: 180 },
      { key: 'B2', offset_x: 100 },
      { key: 'B3', offset_x: 200 },
      { key: 'B4', offset_x: 300 },
    ]);
    // Every bay's x of 0, and the first bay's offset of 0, are the columns'
    // defaults, so neither is kept.
    expect(
      bays.flatMap((bay) =>
        Record.keys(bay).filter((key) => key === 'x' || key === 'offset_x'),
      ),
    ).toEqual(['offset_x', 'offset_x', 'offset_x']);

    expect(shelf).toMatchObject({
      dimensions: Option.some({ width: 1000, height: 20, depth: 450 }),
      position: Option.some({ x: 0, y: 100, z: 0 }),
      type: 'shelf',
    });
    expect(shelf?.attributes).toMatchObject({
      _psa__key: 'B1S1',
      _psa__name: 'Shelf 1',
    });

    expect(site).toMatchObject({
      dimensions: Option.some({ width: 65, height: 110, depth: 60 }),
      facings: Option.some({
        deep: Option.some(7),
        high: Option.some(2),
        wide: Option.some(2),
      }),
      orientation: Option.some('F'),
      position: Option.some({ x: 0, y: 120, z: 0 }),
    });
    expect(tray?.ref).toEqual(Option.some(site?.product.ref));
    expect(site?.attributes).not.toHaveProperty('_psa__merch_style');
  });

  it.each(MADE_UP_FILES)(
    'writes the project read from %s back as the same records, and reads them back as the same project',
    (name) => {
      const data = decodeData(readMadeUpFile(name));
      const project = decode(data);
      const written = encode(project);
      expect(written.declaredVersion).toEqual(data.declaredVersion);
      expect(effectiveRecords(written)).toEqual(effectiveRecords(data));
      expect(decode(written)).toEqual(project);
    },
  );

  it.each(MADE_UP_FILES)(
    'writes the project read from %s as 0.3.0 TOML text, then as JSON, that reads back and writes the same records',
    (name) => {
      const data = decodeData(readMadeUpFile(name));
      const toml = S.encodeSync(VazenProjectFromTomlText)(decode(data));
      const json = S.encodeSync(VazenProjectFromJsonText)(
        S.decodeSync(VazenProjectFromTomlText)(toml),
      );
      expect(
        effectiveRecords(encode(S.decodeSync(VazenProjectFromJsonText)(json))),
      ).toEqual(effectiveRecords(data));
    },
  );

  it('reads a product placed as a unit, a tray and loose as its unit and a tray product, and writes them back as one product row, also through TOML and JSON', () => {
    const project = decode(PLACED_THREE_WAYS);
    const refs = project.products.map(({ ref }) => Option.getOrThrow(ref));
    expect(project.products).toMatchObject([
      {
        attributes: { _psa__case_width: 30, _psa__id: '7' },
        dimensions: Option.some({ width: 65, height: 110, depth: 60 }),
        form: Option.none(),
      },
      {
        attributes: {
          _psa__id: '7',
          _psa__tray_number_wide: 3,
          _vazen__unit_count: 6,
        },
        dimensions: Option.some({ width: 195, height: 110, depth: 120 }),
        form: Option.some('tray'),
        gtin: Option.some('5000000000001'),
        name: 'Dummy cereal',
      },
    ]);
    expect(refs[1]).toBe(`${refs[0]}_tray`);
    expect(
      sitesOf(project).map(({ attributes, product }) => [product, attributes]),
    ).toEqual([
      [{ ref: refs[0] }, {}],
      [{ ref: refs[1] }, {}],
      [{ ref: refs[0] }, { _psa__merch_style: 'loose' }],
    ]);

    expect(effectiveRecords(encode(project))).toEqual(
      effectiveRecords(PLACED_THREE_WAYS),
    );
    expect(decode(encode(project))).toEqual(project);
    const json = S.encodeSync(VazenProjectFromJsonText)(
      S.decodeSync(VazenProjectFromTomlText)(
        S.encodeSync(VazenProjectFromTomlText)(project),
      ),
    );
    expect(
      effectiveRecords(encode(S.decodeSync(VazenProjectFromJsonText)(json))),
    ).toEqual(effectiveRecords(PLACED_THREE_WAYS));
  });

  it('writes a tray with no unit beside it as a product row of its own, sized in its tray columns, and its sites as trays', () => {
    const data = encode({
      ...BUILT_IN_CODE,
      products: BUILT_IN_CODE.products.map((product) => ({
        ...product,
        form: Option.some('tray'),
      })),
    });
    expect(data.products[0]).toMatchObject({
      tray_depth: Option.some(7),
      tray_height: Option.some(28),
      tray_width: Option.some(19),
      width: Option.none(),
    });
    expect(data.planograms[0]?.fixtures[0]?.positions[0]?.merch_style).toEqual(
      Option.some('tray'),
    );
  });

  it('writes a tray site that names its unit and gives _psa__merch_style, as @vazen-ai/toml 0.1.0 read it, as a tray, and reads it back with its tray as a product', () => {
    const project = S.decodeSync(
      VazenProjectFromTomlText,
    )(`schema = "vazen/layout"
schema_version = "0.3.0"

[[products]]
ref = "p1"
name = "Dummy cereal"
gtin = "5000000000001"
_psa__tray_width = 19.5

[[fixtures]]
id = "P1"

[[fixtures.equipment]]
type = "shelf"

[[fixtures.equipment.sites]]
product = { ref = "p1" }
_psa__merch_style = "tray"
`);
    const data = encode(project);
    expect(data.products[0]?.tray_width).toEqual(Option.some(19.5));
    expect(data.planograms[0]?.fixtures[0]?.positions[0]?.merch_style).toEqual(
      Option.some('tray'),
    );
    expect(decode(data).products.map(({ form }) => form)).toEqual([
      Option.none(),
      Option.some('tray'),
    ]);
  });

  it('reads a packaging level whose total is at its default of 0 with a unit count of 0, so that count writes and reads back', () => {
    const project = decode(PLACED_THREE_WAYS);
    const counted = {
      ...project,
      products: project.products.map((product) =>
        Option.isSome(product.form)
          ? {
              ...product,
              attributes: { ...product.attributes, _vazen__unit_count: 0 },
            }
          : product,
      ),
    };
    expect(decode(encode(counted))).toEqual(counted);
  });

  it('refuses writing a packaging level its row could not hold: a second tray, a name of its own, a UPC beside its GTIN, a column another product of the row writes, or a site giving its own merchandising style', () => {
    const project = decode(PLACED_THREE_WAYS);
    const withProduct = ({
      attributes,
      index,
    }: Readonly<{ attributes: TomlTable; index: number }>) => ({
      ...project,
      products: project.products.map((product, place) =>
        place === index
          ? { ...product, attributes: { ...product.attributes, ...attributes } }
          : product,
      ),
    });
    expect(
      messageOf(
        encodeEither({
          ...project,
          products: [...project.products, ...project.products.slice(1)],
        }),
      ),
    ).toContain('shared by 2 tray products');
    expect(
      messageOf(
        encodeEither({
          ...project,
          products: project.products.map((product, index) =>
            index === 1 ? { ...product, name: 'Dummy cereal tray' } : product,
          ),
        }),
      ),
    ).toContain(
      "the product's name differs from another's on its PSA product row",
    );
    // The unit names the row by `_psa__upc`, so only the tray's own check sees
    // its GTIN.
    const trayWithUpc = withProduct({
      attributes: { _psa__upc: 'other-upc' },
      index: 1,
    });
    expect(
      messageOf(
        encodeEither({
          ...trayWithUpc,
          products: trayWithUpc.products.map((product, index) =>
            index === 0
              ? {
                  ...product,
                  attributes: {
                    ...product.attributes,
                    _psa__upc: '5000000000001',
                  },
                  gtin: Option.none(),
                }
              : product,
          ),
        }),
      ),
    ).toContain('_psa__upc would be lost');
    expect(
      messageOf(
        encodeEither(
          withProduct({ attributes: { _psa__tray_width: 1 }, index: 0 }),
        ),
      ),
    ).toContain('_psa__tray_width names a column the tray product writes');
    expect(
      messageOf(
        encodeEither(
          withProduct({ attributes: { _psa__tray_width: 1 }, index: 1 }),
        ),
      ),
    ).toContain('_psa__tray_width names a column its standard key writes');
    expect(
      messageOf(
        encodeEither(withProduct({ attributes: { _psa__color: 1 }, index: 1 })),
      ),
    ).toContain('_psa__color names no column of a tray');
    expect(
      messageOf(
        encodeEither(
          withProduct({ attributes: { _vazen__unit_count: 'six' }, index: 1 }),
        ),
      ),
    ).toContain('_vazen__unit_count holds a number');
    expect(
      messageOf(
        encodeEither({
          ...project,
          fixtures: project.fixtures.map((fixture) => ({
            ...fixture,
            equipment: fixture.equipment.map((piece) => ({
              ...piece,
              sites: piece.sites.map((site) => ({
                ...site,
                attributes: { ...site.attributes, _psa__merch_style: 'case' },
              })),
            })),
          })),
        }),
      ),
    ).toContain("_psa__merch_style names a column its product's form writes");
  });

  it("maps each of PSA's 24 orientation codes onto one of the specification's 24", () => {
    const codes = [
      'front',
      'front_90',
      'front_180',
      'front_270',
      'back',
      'back_90',
      'back_180',
      'back_270',
      'side',
      'side_90',
      'side_180',
      'side_270',
      'right',
      'right_90',
      'right_180',
      'right_270',
      'top',
      'top_90',
      'top_180',
      'top_270',
      'base',
      'base_90',
      'base_180',
      'base_270',
    ];
    const project = decode(
      dataWith({
        fixtures: [
          {
            fixture: {},
            positions: codes.map((orientation) => ({ orientation, upc: '1' })),
          },
        ],
        products: [{ upc: '1' }],
      }),
    );
    const orientations = sitesOf(project).map(({ orientation }) =>
      Option.getOrThrow(orientation),
    );
    expect(new Set(orientations).size).toBe(24);
    expect(orientations.slice(0, 4)).toEqual(['F', 'Fr', 'Fu', 'Fl']);
    expect(orientations[8]).toBe('L');
    expect(orientations[23]).toBe('Dl');
    expect(
      encode(project).planograms[0]?.fixtures[0]?.positions.map(
        ({ orientation }) => Option.getOrThrow(orientation),
      ),
    ).toEqual(codes);
  });

  it('reads inches into millimetres for an imperial file, and writes them back', () => {
    const data = dataWith({
      products: [{ upc: '1', width: 2, height: 10.5, depth: 3 }],
      project: { measurement: 'imperial' },
    });
    const project = decode(data);
    expect(project.products[0]?.dimensions).toEqual(
      Option.some({ width: 50.8, height: 266.7, depth: 76.2 }),
    );
    expect(project.attributes).toMatchObject({ _psa__measurement: 'imperial' });
    expect(effectiveRecords(encode(project))).toEqual(effectiveRecords(data));
  });

  it('rounds a value to nine decimals of a millimetre when reading, and writes it back without floating-point noise', () => {
    const metric = dataWith({
      products: [{ upc: '1', width: 0.172222222222222, height: 1, depth: 2 }],
    });
    const project = decode(metric);
    expect(project.products[0]?.dimensions).toEqual(
      Option.some({ width: 1.722222222, height: 10, depth: 20 }),
    );
    expect(encode(project).products[0]?.width).toEqual(
      Option.some(0.1722222222),
    );
    expect(decode(encode(project))).toEqual(project);
    const imperial = dataWith({
      products: [
        {
          upc: '1',
          width: 4.0108267716535435,
          height: 3.2283464566929134,
          depth: 2,
        },
      ],
      project: { measurement: 'imperial' },
    });
    const inches = decode(imperial);
    expect(inches.products[0]?.dimensions).toEqual(
      Option.some({ width: 101.875, height: 82, depth: 50.8 }),
    );
    expect(encode(inches).products[0]?.width).toEqual(
      Option.some(4.01082677165354),
    );
    expect(decode(encode(inches))).toEqual(inches);
    const negativeZero = dataWith({
      fixtures: [{ fixture: {}, positions: [{ upc: '1', x: -0, y: 1, z: 2 }] }],
      products: [{ upc: '1' }],
    });
    expect(sitesOf(decode(negativeZero))[0]?.position).toEqual(
      Option.some({ x: 0, y: 10, z: 20 }),
    );
  });

  it("keeps a yes/no value that equals its default, since an empty yes/no cell means inherit, and drops another column's", () => {
    const data = dataWith({
      fixtures: [
        {
          fixture: {},
          positions: [{ angle: 1, slope: 0, upc: '1', x_cap_nested: false }],
        },
      ],
      products: [{ upc: '1' }],
    });
    const project = decode(data);
    expect(sitesOf(project)[0]?.attributes).toEqual({
      _psa__angle: 1,
      _psa__x_cap_nested: false,
    });
    const position = encode(project).planograms[0]?.fixtures[0]?.positions[0];
    expect(position?.x_cap_nested).toEqual(Option.some(false));
    expect(position?.slope).toEqual(Option.none());
  });

  it('refuses a position naming a product the file does not have, and two products with one UPC and ID', () => {
    expect(
      messageOf(
        decodeEither(
          dataWith({
            fixtures: [{ fixture: {}, positions: [{ upc: '2' }] }],
            products: [{ upc: '1' }],
          }),
        ),
      ),
    ).toContain('matches 0 products, not one');
    expect(
      messageOf(
        decodeEither(
          dataWith({
            fixtures: [{ fixture: {}, positions: [{ id: '9', upc: '1' }] }],
            products: [
              { id: '9', name: 'One', upc: '1' },
              { id: '9', name: 'Other', upc: '1' },
            ],
          }),
        ),
      ),
    ).toContain('matches 2 products, not one');
  });

  it.each([
    {
      key: undefined,
      position: { upc: '00000001' },
      product: { id: 'DUMMY-A', upc: '00000001' },
    },
    {
      key: 'upc',
      position: { id: 'DUMMY-B', upc: '00000001' },
      product: { id: 'DUMMY-A', upc: '00000001' },
    },
    {
      key: 'upc',
      position: { id: 'DUMMY-B', upc: '00000001' },
      product: { upc: '00000001' },
    },
    { key: 'upc', position: { id: 'DUMMY-B' }, product: { id: 'DUMMY-A' } },
    {
      key: 'id',
      position: { id: 'DUMMY-A' },
      product: { id: 'DUMMY-A', upc: '00000001' },
    },
    {
      key: 'id',
      position: { id: 'DUMMY-A', upc: '00000002' },
      product: { id: 'DUMMY-A', upc: '00000001' },
    },
    {
      key: 'id',
      position: { id: 'DUMMY-A', upc: '00000002' },
      product: { id: 'DUMMY-A' },
    },
    { key: 'id', position: { upc: '00000002' }, product: { upc: '00000001' } },
    {
      key: 'both',
      position: { id: 'DUMMY-A', upc: '00000001' },
      product: { id: 'DUMMY-A', upc: '00000001' },
    },
    {
      key: 'both',
      position: { upc: '00000001' },
      product: { upc: '00000001' },
    },
    { key: 'both', position: { id: 'DUMMY-A' }, product: { id: 'DUMMY-A' } },
  ])(
    'matches by $key and keeps the original position $position through TOML and JSON',
    ({ key, position, product }) => {
      const data = dataWith({
        fixtures: [{ fixture: {}, positions: [position] }],
        products: [
          { ...product, name: 'Dummy product 1' },
          { id: 'DUMMY-B', name: 'Dummy product 2', upc: '00000002' },
        ],
        project: key === undefined ? {} : { primary_key: key },
      });
      const project = decode(data);
      for (const restored of [
        project,
        S.decodeSync(VazenProjectFromTomlText)(
          S.encodeSync(VazenProjectFromTomlText)(project),
        ),
        S.decodeSync(VazenProjectFromJsonText)(
          S.encodeSync(VazenProjectFromJsonText)(project),
        ),
      ]) {
        expect(sitesOf(restored)[0]?.product).toEqual({
          ref: Option.getOrThrow(restored.products[0]?.ref ?? Option.none()),
        });
        expect(effectiveRecords(encode(restored))).toEqual(
          effectiveRecords(data),
        );
      }
    },
  );

  it.each(['upc', 'id', 'both'])(
    'does not fall back from a missing %s match to another identifier',
    (key) => {
      const position =
        key === 'id' ? { upc: '00000001' } : { id: 'DUMMY-A', upc: '00000002' };
      expect(
        messageOf(
          decodeEither(
            dataWith({
              fixtures: [{ fixture: {}, positions: [position] }],
              products: [{ id: 'DUMMY-A', upc: '00000001' }],
              project: { primary_key: key },
            }),
          ),
        ),
      ).toContain('matches 0 products, not one');
    },
  );

  it.each(['upc', 'id'])(
    'refuses duplicate %s keys even with different secondary identifiers and no positions',
    (key) => {
      const products = [
        { id: 'DUMMY-A', upc: '00000001' },
        key === 'upc'
          ? { id: 'DUMMY-B', upc: '00000001' }
          : { id: 'DUMMY-A', upc: '00000002' },
      ];
      expect(
        messageOf(
          decodeEither(dataWith({ products, project: { primary_key: key } })),
        ),
      ).toContain('shared by 2 products');
      const project = decode(
        dataWith({ products, project: { primary_key: 'both' } }),
      );
      expect(
        messageOf(
          encodeEither({ ...project, attributes: { _psa__primary_key: key } }),
        ),
      ).toContain('shared by 2 products');
    },
  );

  it('refuses colliding generated refs even without positions, and never uses a missing identity as a ref', () => {
    const products = [
      { id: 'C', upc: 'DUMMY-A\u0000B' },
      { id: 'B\u0000C', upc: 'DUMMY-A' },
    ];
    expect(
      messageOf(
        decodeEither(dataWith({ products, project: { primary_key: 'both' } })),
      ),
    ).toContain('ref shared by 2 products');
    expect(
      messageOf(
        decodeEither(
          dataWith({
            fixtures: [{ fixture: {}, positions: products.slice(1) }],
            products: products.slice(0, 1),
          }),
        ),
      ),
    ).toContain('matches 0 products, not one');
  });

  it.each(['upc', 'id', 'both'] as const)(
    'reads distinct %s keys exactly but refuses writing keys that normalise to the same text',
    (primaryKey) => {
      for (const identifiers of [
        ['DUMMY-\uFFFDA', 'DUMMY-?A'],
        ['DUMMY-cafe\u0301', 'DUMMY-café'],
      ]) {
        const data = dataWith({
          products: identifiers.map((identifier) => ({
            id: primaryKey === 'upc' ? 'DUMMY-ID' : identifier,
            name: 'Dummy product',
            upc: primaryKey === 'id' ? 'DUMMY-UPC' : identifier,
          })),
          project: { primary_key: primaryKey },
        });
        const { project } = decodeVazenProjectFromPsaFile(
          new TextEncoder().encode(S.encodeSync(PsaDataFromPsaText)(data)),
        );
        expect(project.products).toHaveLength(2);
        expect(() => encodePsaFileFromVazenProject({ project })).toThrow(
          'primary key after PSA text normalisation',
        );
      }
    },
  );

  it('keeps distinct Both keys when only their UPCs normalise to the same text', () => {
    const { project } = decodeVazenProjectFromPsaFile(
      encodePsaFileFromVazenProject({
        project: {
          _psa__primary_key: 'both',
          products: [
            {
              _psa__id: 'DUMMY-A',
              _psa__upc: 'DUMMY-cafe\u0301',
              name: 'Dummy unit',
            },
            {
              _psa__id: 'DUMMY-B',
              _psa__upc: 'DUMMY-café',
              form: 'tray',
              name: 'Dummy tray',
            },
          ],
          schema: 'vazen/layout',
          schema_version: '0.3.0',
        },
      }),
    );
    expect(
      project.products?.map((product) => [product._psa__upc, product._psa__id]),
    ).toEqual([
      ['DUMMY-café', 'DUMMY-A'],
      ['DUMMY-café', 'DUMMY-B'],
    ]);
  });

  it.each([
    {
      error: 'ref shared by 2 products',
      unitUpc: 'DUMMY-A\u0000B',
      upc: 'DUMMY-A',
    },
    {
      error: 'same ref after PSA text normalisation',
      unitUpc: 'DUMMY-cafe\u0301\u0000B',
      upc: 'DUMMY-café',
    },
  ])(
    'refuses colliding row refs across a unit and tray: $error',
    ({ error, unitUpc, upc }) => {
      expect(() =>
        encodePsaFileFromVazenProject({
          project: {
            _psa__primary_key: 'both',
            products: [
              {
                _psa__id: 'C',
                _psa__upc: unitUpc,
                name: 'Dummy product',
              },
              {
                _psa__id: 'B\u0000C',
                _psa__upc: upc,
                form: 'tray',
                name: 'Dummy product',
              },
            ],
            schema: 'vazen/layout',
            schema_version: '0.3.0',
          },
        }),
      ).toThrow(error);
    },
  );

  it.each(['upc', 'id'])(
    'refuses an export when the secondary identifier in %s mode becomes part of the primary key',
    (key) => {
      const column = key === 'upc' ? 'id' : 'upc';
      const value = key === 'upc' ? 'DUMMY-B' : '00000002';
      const project = decode(
        dataWith({
          fixtures: [
            {
              fixture: {},
              positions: [
                key === 'upc'
                  ? { id: value, upc: '00000001' }
                  : { id: 'DUMMY-A', upc: value },
              ],
            },
          ],
          products: [{ id: 'DUMMY-A', upc: '00000001' }],
          project: { primary_key: key },
        }),
      );
      expect(sitesOf(project)[0]?.attributes).toEqual({
        [`_psa__${column}`]: value,
      });
      expect(
        messageOf(
          encodeEither({
            ...project,
            attributes: { _psa__primary_key: 'both' },
          }),
        ),
      ).toContain('position identifiers do not match the selected product');
    },
  );

  it('refuses a position whose overrides leave both identifiers empty', () => {
    const project = S.decodeSync(
      VazenProjectFromTomlText,
    )(`schema = "vazen/layout"
schema_version = "0.3.0"
_psa__primary_key = "id"
[[products]]
name = "Dummy product"
gtin = "00000001"
[[fixtures]]
[[fixtures.equipment]]
type = "shelf"
[[fixtures.equipment.sites]]
product = { gtin = "00000001" }
_psa__upc = ""
`);
    expect(messageOf(encodeEither(project))).toContain(
      'the position has neither a UPC nor an ID',
    );
  });

  it.each([1, false])(
    'refuses a non-text preserved position identifier: %s',
    (value) => {
      const project = decode(
        dataWith({
          fixtures: [
            { fixture: {}, positions: [{ id: 'DUMMY-A', upc: '00000001' }] },
          ],
          products: [{ id: 'DUMMY-A', upc: '00000001' }],
        }),
      );
      expect(
        messageOf(
          encodeEither({
            ...project,
            fixtures: project.fixtures.map((fixture) => ({
              ...fixture,
              equipment: fixture.equipment.map((piece) => ({
                ...piece,
                sites: piece.sites.map((site) => ({
                  ...site,
                  attributes: { _psa__id: value },
                })),
              })),
            })),
          }),
        ),
      ).toContain('_psa__id must be text');
    },
  );

  it.each([
    ['local date', '2026-09-27', '2026-09-27T00:00:00Z'],
    ['local date-time', '2026-09-27T00:00:00', '2026-09-27'],
    ['local time', '00:00:00', '0000-01-01T00:00:00Z'],
    ['offset date-time', '2026-09-27T00:00:00Z', '2026-09-27T00:00:00'],
  ])(
    'resolves each %s selector only within its TOML kind',
    (_, date, other) => {
      const project = projectWithDates({
        dates: [date, other],
        selector: date,
      });
      expect(
        encode(project).planograms[0]?.fixtures[0]?.positions[0]?.upc,
      ).toEqual(Option.some('00000001'));
      expect(
        messageOf(
          encodeEither({ ...project, products: project.products.slice(1) }),
        ),
      ).toContain('matches 0 products, not one');
    },
  );

  it.each([
    ['2026-09-27T00:00:00Z', '2026-09-27T01:00:00+01:00'],
    ['2026-09-27T00:00:00-01:00', '2026-09-27T01:00:00Z'],
  ])(
    'matches offset date-times at the same instant: %s and %s',
    (date, selector) => {
      const project = projectWithDates({ dates: [date], selector });
      expect(
        encode(project).planograms[0]?.fixtures[0]?.positions[0]?.upc,
      ).toEqual(Option.some('00000001'));
    },
  );

  it('treats a plain JavaScript Date as an offset date-time', () => {
    const withPlainDate = (selector: string) => {
      const project = projectWithDates({
        dates: ['2026-09-27T00:00:00Z'],
        selector,
      });
      return {
        ...project,
        products: project.products.map((product) => ({
          ...product,
          attributes: { launch: new Date('2026-09-27T00:00:00Z') },
        })),
      };
    };
    expect(
      encode(withPlainDate('2026-09-27T01:00:00+01:00')).planograms[0]
        ?.fixtures[0]?.positions[0]?.upc,
    ).toEqual(Option.some('00000001'));
    expect(messageOf(encodeEither(withPlainDate('2026-09-27')))).toContain(
      'matches 0 products, not one',
    );
  });

  it('refuses writing two products sharing a UPC and ID, placed or not', () => {
    const twin: VazenProduct = {
      attributes: { _psa__upc: '884400062451' },
      dimensions: Option.none(),
      form: Option.none(),
      gtin: Option.none(),
      images: Option.none(),
      name: 'Twin',
      ref: Option.some('p2'),
    };
    expect(
      messageOf(
        encodeEither({
          ...BUILT_IN_CODE,
          products: [...BUILT_IN_CODE.products, twin],
        }),
      ),
    ).toContain('shared by 2 products');
  });

  it('refuses writing a site whose product has neither a UPC nor an ID', () => {
    const project = decode(
      dataWith({
        fixtures: [{ fixture: {}, positions: [{ upc: '1' }] }],
        products: [{ name: 'One', upc: '1' }],
      }),
    );
    expect(
      messageOf(
        encodeEither({
          ...project,
          products: project.products.map((product) => ({
            ...product,
            attributes: Record.remove(product.attributes, '_psa__upc'),
          })),
        }),
      ),
    ).toContain('neither a UPC nor an ID');
  });

  it('refuses writing a bay holding sites, since a segment holds no positions', () => {
    expect(
      messageOf(
        encodeEither({
          ...BUILT_IN_CODE,
          fixtures: BUILT_IN_CODE.fixtures.map((fixture) => ({
            ...fixture,
            equipment: fixture.equipment.map((bay) => ({
              ...bay,
              sites: bay.equipment.flatMap((piece) => piece.sites),
            })),
          })),
        }),
      ),
    ).toContain('a bay is written as a segment');
  });

  it('refuses a fixture type code the list does not have', () => {
    expect(
      messageOf(
        decodeEither(
          dataWith({
            fixtures: [
              {
                fixture: { type: { _tag: 'UnlistedCode', code: '99' } },
                positions: [],
              },
            ],
          }),
        ),
      ),
    ).toContain('code 99 is not listed for its column');
  });

  it('refuses an unlisted primary key instead of assuming UPC', () => {
    expect(
      messageOf(
        decodeEither(
          dataWith({
            fixtures: [{ fixture: {}, positions: [{ upc: '00000001' }] }],
            products: [{ id: 'DUMMY-A', upc: '00000001' }],
            project: { primary_key: { _tag: 'UnlistedCode', code: '99' } },
          }),
        ),
      ),
    ).toContain('code 99 is not listed for its column');
  });

  it('gives a planogram without a key an id, which is written back as its key, skipping a number a declared key uses', () => {
    const project = decode(dataWith({ planogram: { name: 'Keyless' } }));
    expect(project.fixtures[0]?.id).toEqual(Option.some('planogram-1'));
    expect(encode(project).planograms[0]?.planogram.key).toEqual(
      Option.some('planogram-1'),
    );
    const keyed = dataWith({ planogram: { key: 'planogram-2' } });
    const taken = decode({
      ...keyed,
      planograms: [
        ...keyed.planograms,
        ...dataWith({ planogram: {} }).planograms,
      ],
    });
    expect(taken.fixtures.map(({ id }) => id)).toEqual([
      Option.some('planogram-2'),
      Option.some('planogram-3'),
    ]);
  });

  it('writes a project built in code, a bay as a segment with its attributes as columns, a peg as a rod and other equipment as a shelf, dropping descriptive keys and form', () => {
    const data = encode(BUILT_IN_CODE);
    const [section] = data.planograms;
    expect(data.project.name).toEqual(Option.some('Built in code'));
    expect(data.products[0]).toMatchObject({
      brand: Option.none(),
      name: Option.some('Vazen Planflakes 400 g'),
      upc: Option.some('884400062451'),
      width: Option.some(19),
      height: Option.some(28),
      depth: Option.some(7),
    });
    expect(section?.planogram).toMatchObject({
      key: Option.some('END-12'),
      name: Option.some('Aisle 12 end'),
      width: Option.some(100),
    });
    expect(section?.segments).toMatchObject([
      {
        door: Option.some(true),
        offset_x: Option.some(0),
        x: Option.none(),
        width: Option.some(100),
        height: Option.some(200),
      },
    ]);
    expect(
      section?.fixtures.map(({ fixture }) => Option.getOrThrow(fixture.type)),
    ).toEqual(['shelf', 'rod', 'shelf']);
    expect(section?.fixtures[0]?.positions[0]).toMatchObject({
      h_facings: Option.some(3),
      id: Option.none(),
      orientation: Option.some('front_270'),
      upc: Option.some('884400062451'),
      v_facings: Option.none(),
      x: Option.some(1),
      y: Option.some(22),
    });
  });
  it('refuses to write an attribute PSA could not hold: named for a column it lacks or a standard key writes, on a bay too, a UPC beside a GTIN, or segments that are not tables', () => {
    const project = decode(dataWith({ products: [{ upc: '5000000000001' }] }));
    const withProductAttributes = (attributes: TomlTable) => ({
      ...project,
      products: project.products.map((product) => ({
        ...product,
        attributes: { ...product.attributes, ...attributes },
      })),
    });
    expect(
      messageOf(encodeEither(withProductAttributes({ _psa__nonsense: 1 }))),
    ).toContain('_psa__nonsense names no PSA column');
    expect(
      messageOf(encodeEither(withProductAttributes({ _psa__width: 1 }))),
    ).toContain('_psa__width names a column its standard key writes');
    expect(
      messageOf(
        encodeEither({
          ...BUILT_IN_CODE,
          fixtures: BUILT_IN_CODE.fixtures.map((fixture) => ({
            ...fixture,
            equipment: fixture.equipment.map((bay) => ({
              ...bay,
              attributes: { ...bay.attributes, _psa__offset_x: 5 },
            })),
          })),
        }),
      ),
    ).toContain('_psa__offset_x names a column its standard key writes');
    expect(
      messageOf(encodeEither(withProductAttributes({ _psa__upc: '1' }))),
    ).toContain('_psa__upc would be lost');
    expect(
      messageOf(
        encodeEither({
          ...project,
          fixtures: project.fixtures.map((fixture) => ({
            ...fixture,
            attributes: { ...fixture.attributes, _psa__segments: 1 },
          })),
        }),
      ),
    ).toContain('_psa__segments holds a list of tables');
  });
});
