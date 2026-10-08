import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Array as A, Option, Result, Schema as S, String as Str } from 'effect';
import { describe, expect, it } from 'vitest';

import type { PsaData } from './psa-data';
import {
  encodePsaFileFromPsaData,
  PsaDataFromPsaBytes,
  PsaDataFromPsaText,
} from './psa-data-from-psa-text';
import {
  PSA_VERSION_COLUMN_COUNTS,
  type PsaRecordType,
  type PsaVersion,
} from './psa-versions';

// The version `PsaDataFromPsaText` writes, so a file made at it is written back
// as it was.
const VERSION = '2024.4.0';

const decodeSync = S.decodeUnknownSync(PsaDataFromPsaText);
const decodeEither = S.decodeUnknownResult(PsaDataFromPsaText);
const encodeSync = S.encodeSync(PsaDataFromPsaText);

// Everything in src/psa ships publicly, so the test files are made up.
const readTestData = (name: string) =>
  readFileSync(join(import.meta.dirname, '.test-data', name), 'latin1');

// A made-up 2020.1.0 file with each kind of row, in the order the writer
// writes them.
const sample = readTestData('v2020.1.0.psa');

// A cell holding a number, in the shortest form that number is written in.
const normaliseNumber = (cell: string) =>
  Str.isNonEmpty(Str.trim(cell)) && !Number.isNaN(Number(cell))
    ? String(Number(cell))
    : cell;

const header = (version: string) => [
  'PROSPACE SCHEMATIC FILE',
  `; Version ${version}`,
  '; Codepage=1252',
];

// A row as wide as the version gives for its type, with the cells named by
// index set and the rest empty.
const row = ({
  _tag,
  cells = {},
  version = VERSION,
}: Readonly<{
  _tag: PsaRecordType;
  cells?: Readonly<Record<number, string>>;
  version?: PsaVersion;
}>) =>
  [
    _tag,
    ...A.makeBy(
      PSA_VERSION_COLUMN_COUNTS[version][_tag],
      (index) => cells[index] ?? '',
    ),
  ].join(',');

const fileFromRows = (...rows: ReadonlyArray<string>): string =>
  [
    ...header(VERSION),
    row({ _tag: 'Project', cells: { 0: 'Tiny' } }),
    ...rows,
    '',
  ].join('\r\n');

const getLine = ({
  _tag,
  text,
}: Readonly<{ _tag: string; text: string }>): string | undefined =>
  Str.split(text, '\r\n').find((line) => line.startsWith(`${_tag},`));

const getMessage = (text: string): string =>
  Result.match(decodeEither(text), {
    onFailure: (error) => error.message,
    onSuccess: () => '',
  });

describe('PsaDataFromPsaText', () => {
  it('reads the header, the project and every product', () => {
    const file = decodeSync(sample);
    expect(file.declaredVersion).toEqual(Option.some('2020.1.0'));
    expect(file.project.primary_key).toEqual(Option.some('id'));
    expect(file.products).toHaveLength(36);
    expect(file.products[0]).toMatchObject({
      id: Option.some('7000001'),
      name: Option.some('Product 01'),
      upc: Option.some('5000000000001'),
    });
  });

  it('nests performance, segments and fixtures under their planogram and positions under their fixture', () => {
    const [planogram] = decodeSync(sample).planograms;
    expect(planogram?.performance).toHaveLength(36);
    expect(planogram?.segments).toHaveLength(4);
    expect(
      planogram?.fixtures.map(({ positions }) => positions.length),
    ).toEqual([3, 2, 3, 2, 3, 2, 3, 2, 6, 3, 2, 3, 2]);
  });

  it('reads the two-planogram file: performance rows per planogram, a product placed as a tray and as a unit, and two products under one UPC', () => {
    const file = decodeSync(readTestData('v2024.4.0-two-planograms.psa'));
    expect(
      file.planograms.map(({ performance, planogram }) => [
        Option.getOrThrow(planogram.key),
        performance.length,
      ]),
    ).toEqual([
      ['PG-6', 36],
      ['PG-6B', 10],
    ]);
    expect(
      file.planograms.map(({ fixtures }) =>
        fixtures
          .flatMap(({ positions }) => positions)
          .filter(({ upc }) => Option.contains(upc, '5000000000001'))
          .map((position) => position.merch_style),
      ),
    ).toEqual([[Option.some('tray')], [Option.some('unit')]]);
    expect(
      file.products
        .filter(({ upc }) => Option.contains(upc, '0500000000035'))
        .map(({ id }) => id),
    ).toEqual([Option.some('7000035'), Option.some('7000036')]);
  });

  it.each([
    'v2017.2.0.psa',
    'v2019.1.0.psa',
    'v2020.1.0.psa',
    'v2021.1.2.psa',
    'v2024.4.0.psa',
    'v2024.4.0-two-planograms.psa',
  ])(
    'writes %s back as it was read, bar how its numbers are written',
    (name) => {
      const text = readTestData(name);
      const file = decodeSync(text);
      expect(file.messages).toEqual([]);
      const writtenText = encodeSync(file);
      // The lines below compare every cell as a number where it reads as one,
      // so this is what holds text such as `0123` exactly.
      expect(decodeSync(writtenText)).toEqual(file);
      const written = Str.split(writtenText, '\r\n');
      const original = Str.split(text, '\r\n');
      expect(written).toHaveLength(original.length);
      for (const [index, line] of original.entries()) {
        expect(
          Str.split(written[index] ?? '', ',').map(normaliseNumber),
        ).toEqual(Str.split(line, ',').map(normaliseNumber));
      }
    },
  );

  it('writes data declaring a version whose rows cannot hold a value as 2024.4.0, unless that version is asked for', () => {
    const file = decodeSync(readTestData('v2017.2.0.psa'));
    // `service_level` is column 274, which a 2017.2.0 file's Product rows lack.
    const data = {
      ...file,
      products: file.products.map((product) => ({
        ...product,
        service_level: Option.some(0.5),
      })),
    };
    const written = S.decodeUnknownSync(PsaDataFromPsaBytes)(
      encodePsaFileFromPsaData({ data }),
    );
    expect(written.declaredVersion).toEqual(Option.some('2024.4.0'));
    expect(written.products.map((product) => product.service_level)).toEqual(
      file.products.map(() => Option.some(0.5)),
    );
    expect(() =>
      encodePsaFileFromPsaData({ data, version: '2017.2.0' }),
    ).toThrow('column 274');
  });

  it('reads an escaped comma and backslash inside a cell, and writes them back escaped', () => {
    expect(decodeSync(sample).products[0]?.desc_5).toEqual(
      Option.some('desc, with comma'),
    );
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Product', cells: { 0: '1', 2: String.raw`a\,b\\c` } }),
      ),
    );
    expect(file.products[0]?.name).toEqual(Option.some(String.raw`a,b\c`));
    expect(
      getLine({ _tag: 'Product', text: encodeSync(file) })?.startsWith(
        String.raw`Product,1,,a\,b\\c,`,
      ),
    ).toBe(true);
  });

  it('reads the line breaks, tabs and quotes ProSpace escapes, and writes them back escaped', () => {
    const text = fileFromRows(
      row({
        _tag: 'Planogram',
        cells: { 239: String.raw`Step 1\r\n\tSay \"hi\"` },
      }),
    );
    const file = decodeSync(text);
    expect(file.planograms[0]?.planogram.pg_action_list).toEqual(
      Option.some('Step 1\r\n\tSay "hi"'),
    );
    expect(encodeSync(file)).toBe(text);
  });

  it('keeps the backslash of an escape ProSpace does not write', () => {
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Product', cells: { 0: '1', 2: String.raw`A\B` } }),
      ),
    );
    expect(file.products[0]?.name).toEqual(Option.some(String.raw`A\B`));
    expect(decodeSync(encodeSync(file))).toEqual(file);
  });

  it('keeps text verbatim with its spaces, reads -0 as zero and -1 in a boolean as inherit', () => {
    // Product columns: 0 UPC, 1 ID, 2 Name, 3 Key, 4 Width … 213 Flag 1.
    const file = decodeSync(
      fileFromRows(
        row({
          _tag: 'Product',
          cells: { 0: '1', 2: ' Small ', 4: '-0', 213: '-1' },
        }),
      ),
    );
    const [product] = file.products;
    expect(product?.name).toEqual(Option.some(' Small '));
    expect(product?.width).toEqual(Option.some(0));
    expect(product?.flag_1).toEqual(Option.none());
    const written = Str.split(
      getLine({ _tag: 'Product', text: encodeSync(file) }) ?? '',
      ',',
    );
    expect(written.slice(3, 6)).toEqual([' Small ', '', '0']);
    expect(written[214]).toBe('');
  });

  it('reads Yes and No in a yes/no column, and writes them as 1 and 0', () => {
    // Product columns 213 and 214 are Flag 1 and Flag 2.
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Product', cells: { 0: '1', 213: 'Yes', 214: 'No' } }),
      ),
    );
    const [product] = file.products;
    expect(product?.flag_1).toEqual(Option.some(true));
    expect(product?.flag_2).toEqual(Option.some(false));
    const written = Str.split(
      getLine({ _tag: 'Product', text: encodeSync(file) }) ?? '',
      ',',
    );
    expect(written.slice(214, 216)).toEqual(['1', '0']);
  });

  it('keeps each row of a type it does not read after the row it follows', () => {
    const text = fileFromRows(
      'Project2,more',
      row({ _tag: 'Product', cells: { 0: '1' } }),
      'ProductCalc,1',
      row({ _tag: 'Planogram' }),
      row({ _tag: 'Fixture' }),
      row({ _tag: 'Position', cells: { 0: '1' } }),
      'PositionCalc,2',
      'Drawing,3',
    );
    const file = decodeSync(text);
    expect(file.project.unknownRowsAfter).toEqual([
      { _tag: 'Project2', cells: ['more'] },
    ]);
    expect(
      file.planograms[0]?.fixtures[0]?.positions[0]?.unknownRowsAfter,
    ).toEqual([
      { _tag: 'PositionCalc', cells: ['2'] },
      { _tag: 'Drawing', cells: ['3'] },
    ]);
    expect(encodeSync(file)).toBe(text);
  });

  it("drops comment lines other than the header's, and blank lines", () => {
    const planogram = row({ _tag: 'Planogram' });
    expect(
      encodeSync(decodeSync(fileFromRows('; A comment', '', planogram))),
    ).toBe(fileFromRows(planogram));
  });

  it('reads a file of any version, with rows of any width, and lists the widths no listed version gives', () => {
    // The version's space is trimmed.
    const file = decodeSync(
      [
        ...header('2018.1 '),
        `Project,Tiny${','.repeat(209)}`,
        `Product,1${','.repeat(279)}`,
        'Product,2,3',
        row({ _tag: 'Product', cells: { 0: '4' } }),
        '',
      ].join('\r\n'),
    );
    expect(file.declaredVersion).toEqual(Option.some('2018.1'));
    expect(file.products.map(({ upc }) => upc)).toEqual([
      Option.some('1'),
      Option.some('2'),
      Option.some('4'),
    ]);
    expect(file.messages).toEqual([
      { _tag: 'UnlistedWidth', rows: [1], type: 'Project', width: 210 },
      { _tag: 'UnlistedWidth', rows: [1], type: 'Product', width: 280 },
      { _tag: 'UnlistedWidth', rows: [2], type: 'Product', width: 2 },
    ]);
  });

  it.each([
    ['on a line of its own', header('2021.1.2'), Option.some('2021.1.2')],
    [
      'after the first line',
      ['PROSPACE SCHEMATIC FILE; Version 2021.1.2'],
      Option.some('2021.1.2'),
    ],
    [
      'as an older file writes it',
      ['PROSPACE SCHEMATIC FILE', ';V8.0.1.2'],
      Option.some('8.0.1.2'),
    ],
    ['nowhere', ['PROSPACE SCHEMATIC FILE'], Option.none()],
    [
      'as an empty declaration',
      ['PROSPACE SCHEMATIC FILE', '; Version '],
      Option.none(),
    ],
  ])('reads a version given %s', (_, headerLines, declaredVersion) => {
    expect(
      decodeSync([...headerLines, row({ _tag: 'Project' }), ''].join('\r\n'))
        .declaredVersion,
    ).toEqual(declaredVersion);
  });

  it("keeps a code its column's list does not have, and writes it back", () => {
    // Fixture column 0 is its type.
    const text = fileFromRows(
      row({ _tag: 'Planogram' }),
      row({ _tag: 'Fixture', cells: { 0: '99' } }),
    );
    const file = decodeSync(text);
    expect(file.planograms[0]?.fixtures[0]?.fixture.type).toEqual(
      Option.some({ _tag: 'UnlistedCode', code: '99' }),
    );
    expect(file.messages).toEqual([]);
    expect(encodeSync(file)).toBe(text);
  });

  // Position column 56 is Merch X Size: 0 is default and 1 is normal.
  const positionsSized = (...sizes: ReadonlyArray<string>) =>
    fileFromRows(
      row({ _tag: 'Planogram' }),
      row({ _tag: 'Fixture' }),
      ...sizes.map((size) => row({ _tag: 'Position', cells: { 56: size } })),
    );
  const sizesOf = (file: PsaData) =>
    file.planograms[0]?.fixtures[0]?.positions.map(
      (position) => position.merch_x_size,
    );

  it('reads a code spelt with a zero fraction as the whole number, and writes it back as that', () => {
    const file = decodeSync(positionsSized('0.00', '1.00', '99.00'));
    expect(sizesOf(file)).toEqual([
      Option.some('default'),
      Option.some('normal'),
      Option.some({ _tag: 'UnlistedCode', code: '99' }),
    ]);
    expect(file.messages).toEqual([]);
    expect(encodeSync(file)).toBe(positionsSized('0', '1', '99'));
  });

  it('reads a code with a fraction that is not zero, or no digit after its point, as unreadable', () => {
    const file = decodeSync(positionsSized('0.50', '1.'));
    expect(sizesOf(file)).toEqual([Option.none(), Option.none()]);
    expect(file.messages).toEqual([
      {
        _tag: 'UnreadCells',
        column: 'merch_x_size',
        rows: [1, 2],
        type: 'Position',
      },
    ]);
  });

  it('reads a cell its column cannot read as empty, and lists it', () => {
    // Product columns: 4 Width, 213 Flag 1, 268 Automatic Model.
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Product', cells: { 0: '1' } }),
        row({
          _tag: 'Product',
          cells: { 0: '2', 4: ' ', 213: '2', 268: 'model' },
        }),
      ),
    );
    expect(file.products[1]).toMatchObject({
      automatic_model: Option.none(),
      flag_1: Option.none(),
      upc: Option.some('2'),
      width: Option.none(),
    });
    expect(file.messages).toEqual([
      { _tag: 'UnreadCells', column: 'width', rows: [2], type: 'Product' },
      { _tag: 'UnreadCells', column: 'flag_1', rows: [2], type: 'Product' },
      {
        _tag: 'UnreadCells',
        column: 'automatic_model',
        rows: [2],
        type: 'Product',
      },
    ]);
  });

  it("drops the cells past a row's last column, and lists those that held a value", () => {
    const file = decodeSync(
      fileFromRows(
        `Product,1${','.repeat(326)}x`,
        `Product,2${','.repeat(326)}`,
      ),
    );
    expect(file.products).toHaveLength(2);
    expect(file.messages).toEqual([
      { _tag: 'UnlistedWidth', rows: [1, 2], type: 'Product', width: 327 },
      { _tag: 'DroppedCells', rows: [1], type: 'Product' },
    ]);
  });

  it('ignores positions before any fixture in their planogram, and lists them', () => {
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Planogram' }),
        row({ _tag: 'Fixture' }),
        row({ _tag: 'Position', cells: { 0: '1' } }),
        row({ _tag: 'Planogram' }),
        row({ _tag: 'Position', cells: { 0: '2' } }),
        'PositionCalc,2',
        row({ _tag: 'Fixture' }),
        row({ _tag: 'Position', cells: { 0: '3' } }),
      ),
    );
    expect(
      file.planograms.map(({ fixtures }) =>
        fixtures.flatMap(({ positions }) => positions.map(({ upc }) => upc)),
      ),
    ).toEqual([[Option.some('1')], [Option.some('3')]]);
    expect(file.messages).toEqual([
      { _tag: 'IgnoredRows', rows: [2], type: 'Position' },
    ]);
  });

  it.each([
    ['no version', Option.none()],
    ['a version PsaVersion does not list', Option.some('2018.1')],
  ])(
    'writes 2024.4.0 when the data declares %s, with its header and row widths',
    (_, declaredVersion) => {
      const file = { ...decodeSync(sample), declaredVersion };
      const text = encodeSync(file);
      const lines = Str.split(text, '\r\n');
      expect(lines[1]).toBe('; Version 2024.4.0');
      const getCellCounts = (type: string) =>
        new Set(
          lines
            .filter((line) => line.startsWith(`${type},`))
            .map((line) => Str.split(line, /(?<!\\),/u).length - 1),
        );
      expect(getCellCounts('Product')).toEqual(new Set([326]));
      expect(getCellCounts('Fixture')).toEqual(new Set([169]));
      expect(decodeSync(text)).toEqual({
        ...file,
        declaredVersion: Option.some('2024.4.0'),
      });
    },
  );

  it('accepts a first line with trailing spaces', () => {
    const [, ...lines] = Str.split(fileFromRows(), '\r\n');
    expect(
      decodeSync(['PROSPACE SCHEMATIC FILE ', ...lines].join('\r\n'))
        .declaredVersion,
    ).toEqual(Option.some(VERSION));
  });

  it.each([
    ['without the PSA first line', [row({ _tag: 'Project' })], /first line/],
    [
      'with a tab after the first line',
      [
        'PROSPACE SCHEMATIC FILE\t',
        ...header(VERSION).slice(1),
        row({ _tag: 'Project' }),
      ],
      /first line/,
    ],
    ['without a Project row', header(VERSION), /no Project row/],
    [
      'with a row before the Project row',
      [...header(VERSION), 'Drawing,1', row({ _tag: 'Project' })],
      /a Drawing row before the Project row/,
    ],
    [
      'with a second Project row',
      [...header(VERSION), row({ _tag: 'Project' }), row({ _tag: 'Project' })],
      /a second Project row/,
    ],
    [
      'with a fixture before any planogram',
      [...header(VERSION), row({ _tag: 'Project' }), row({ _tag: 'Fixture' })],
      /a Fixture row before any Planogram row/,
    ],
  ])('refuses a file %s and says why', (_, lines, message) => {
    expect(getMessage([...lines, ''].join('\r\n'))).toMatch(message);
  });

  it('refuses to write a value in a column the version it writes does not have', () => {
    // 2017 Fixture rows have 166 columns and 2024's 169.
    const file = decodeSync(
      fileFromRows(
        row({ _tag: 'Planogram' }),
        row({ _tag: 'Fixture', cells: { 168: '1' } }),
      ),
    );
    expect(
      Result.getFailure(
        S.encodeResult(PsaDataFromPsaText)({
          ...file,
          declaredVersion: Option.some('2017.2.0'),
        }),
      ).pipe(Option.map(({ message }) => message)),
    ).toEqual(
      Option.some(
        expect.stringMatching(
          /Fixture row 1 holds a value in column 169, which a 2017.2.0 file's Fixture rows do not have/,
        ),
      ),
    );
  });

  it.each([
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        project: {
          ...file.project,
          unknownRowsAfter: [{ _tag: 'Product', cells: [] }],
        },
      }),
      message: /a Product row is read as a record/,
      written: 'a Product row as an unknown row',
    },
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        project: {
          ...file.project,
          unknownRowsAfter: [{ _tag: ';note', cells: [] }],
        },
      }),
      message: /a row starting ";" is read as a comment/,
      written: 'a comment as an unknown row',
    },
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        project: {
          ...file.project,
          unknownRowsAfter: [{ _tag: '', cells: [] }],
        },
      }),
      message: /an empty row is read as a blank line/,
      written: 'a blank line as an unknown row',
    },
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        products: file.products.map((product) => ({
          ...product,
          name: Option.some(''),
        })),
      }),
      message: /empty text is read as an empty cell/,
      written: 'empty text as a value',
    },
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        products: file.products.map((product) => ({
          ...product,
          width: Option.some(NaN),
        })),
      }),
      message: /Expected a finite number/,
      written: 'a number that is not finite',
    },
    {
      change: (file: PsaData): PsaData => ({
        ...file,
        planograms: file.planograms.map((planogram) => ({
          ...planogram,
          fixtures: planogram.fixtures.map((section) => ({
            ...section,
            fixture: {
              ...section.fixture,
              type: Option.some({ _tag: 'UnlistedCode' as const, code: '0' }),
            },
          })),
        })),
      }),
      message: /0 is one of its column's codes/,
      written: 'a listed code as an unlisted one',
    },
  ])(
    'refuses to write $written, which would read back as something else',
    ({ change, message }) => {
      const file = decodeSync(
        fileFromRows(
          row({ _tag: 'Product' }),
          row({ _tag: 'Planogram' }),
          row({ _tag: 'Fixture' }),
        ),
      );
      expect(
        Result.getFailure(
          S.encodeResult(PsaDataFromPsaText)(change(file)),
        ).pipe(Option.map(({ message }) => message)),
      ).toEqual(Option.some(expect.stringMatching(message)));
    },
  );
});

describe('PsaDataFromPsaBytes', () => {
  const decodeBytes = S.decodeUnknownSync(PsaDataFromPsaBytes);
  const encodeBytes = S.encodeSync(PsaDataFromPsaBytes);
  const productNamed = (name: string) =>
    fileFromRows(row({ _tag: 'Product', cells: { 0: '1', 2: name } }));

  it('reads Windows-1252 bytes above 0x7F, and writes them back', () => {
    // Bytes 0x80 to 0x9F are where Windows-1252 differs from Latin-1; five of
    // them are undefined.
    const [before, after] = Str.split(productNamed('Price §'), '§');
    const bytes = Uint8Array.from([
      ...Buffer.from(before, 'latin1'),
      ...A.range(0x80, 0x9f),
      ...Buffer.from(after ?? '', 'latin1'),
    ]);
    const file = decodeBytes(bytes);
    expect(file.products[0]?.name).toEqual(
      Option.some(
        'Price €\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ',
      ),
    );
    expect(encodeBytes(file)).toEqual(bytes);
  });

  it.each([
    ['without a byte-order mark', []],
    ['with a byte-order mark', [0xef, 0xbb, 0xbf]],
  ])(
    'reads UTF-8 %s though the file declares Windows-1252, and writes Windows-1252',
    (_, mark) => {
      const text = productNamed('Café');
      const file = decodeBytes(
        Uint8Array.from([...mark, ...Buffer.from(text, 'utf8')]),
      );
      expect(file.products[0]?.name).toEqual(Option.some('Café'));
      expect(encodeBytes(file)).toEqual(
        Uint8Array.from(Buffer.from(text, 'latin1')),
      );
    },
  );

  it('refuses a file with a byte-order mark that is not valid UTF-8', () => {
    // Windows-1252's é, 0xE9, is not valid UTF-8 on its own.
    const bytes = Uint8Array.from([
      0xef,
      0xbb,
      0xbf,
      ...Buffer.from(productNamed('Café'), 'latin1'),
    ]);
    expect(
      Result.getFailure(S.decodeUnknownResult(PsaDataFromPsaBytes)(bytes)).pipe(
        Option.map(({ message }) => message),
      ),
    ).toEqual(
      Option.some(
        expect.stringMatching(/byte-order mark but is not valid UTF-8/),
      ),
    );
  });

  it.each([
    ['a combining accent as the single letter', 'Cafe\u0301', 'Café'],
    ['a replacement character as a question mark', 'Caf\uFFFD', 'Caf?'],
  ])('writes %s', (_, name, written) => {
    const file = decodeBytes(
      Uint8Array.from(Buffer.from(productNamed(name), 'utf8')),
    );
    expect(encodeBytes(file)).toEqual(
      Uint8Array.from(Buffer.from(productNamed(written), 'latin1')),
    );
  });

  it('writes the version it is given', () => {
    const file = decodeBytes(
      Uint8Array.from(Buffer.from(productNamed('Café'), 'latin1')),
    );
    expect(
      Buffer.from(
        encodePsaFileFromPsaData({ data: file, version: '2017.2.0' }),
      ).toString('latin1'),
    ).toContain('\r\n; Version 2017.2.0\r\n');
  });

  it('refuses to write a character Windows-1252 cannot hold, naming its line', () => {
    const file = decodeBytes(
      Uint8Array.from(Buffer.from(productNamed('Łódź'), 'utf8')),
    );
    expect(
      Result.getFailure(S.encodeResult(PsaDataFromPsaBytes)(file)).pipe(
        Option.map(({ message }) => message),
      ),
    ).toEqual(Option.some(expect.stringMatching(/line 5 holds "Ł"/)));
  });
});
