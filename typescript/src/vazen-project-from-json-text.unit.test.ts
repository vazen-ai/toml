import { readFileSync } from 'node:fs';
import { Array as A, Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  PSA_VERSION_COLUMN_COUNTS,
  type PsaRecordType,
} from './psa/psa-versions';
import type { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import {
  decodeVazenProjectFromJsonFile,
  encodeJsonFileFromVazenProject,
} from './vazen-project-from-json-text';
import {
  decodeVazenProjectFromPsaFile,
  encodePsaFileFromVazenProject,
} from './vazen-project-from-psa-text';
import {
  decodeVazenProjectFromTomlFile,
  encodeTomlFileFromVazenProject,
} from './vazen-project-from-toml-text';

const EVERY_FIELD_LAYOUT = readFileSync(
  new URL(
    '../../examples/0.3.0/every-field-layout.vazen.toml',
    import.meta.url,
  ),
  'utf8',
);

// The every-field example's one date.
const REVIEWED = '2026-09-27T09:30:00.000Z';

const SPEC = {
  fixtures: [
    { equipment: [{ sites: [{ product: { ref: 'p1' } }], type: 'shelf' }] },
  ],
  products: [{ name: 'Product 1', ref: 'p1' }],
  schema: 'vazen/spec',
  schema_version: '0.3.0',
};

// A made-up 2024.4.0 PSA file of the rows given, each as wide as its type.
const psaRow = ({
  _tag,
  cells = {},
}: Readonly<{
  _tag: PsaRecordType;
  cells?: Readonly<Record<number, string>>;
}>) =>
  [
    _tag,
    ...A.makeBy(
      PSA_VERSION_COLUMN_COUNTS['2024.4.0'][_tag],
      (index) => cells[index] ?? '',
    ),
  ].join(',');
const psaFile = (...rows: ReadonlyArray<string>) =>
  new TextEncoder().encode(
    [
      'PROSPACE SCHEMATIC FILE',
      '; Version 2024.4.0',
      '; Codepage=1252',
      psaRow({ _tag: 'Project', cells: { 0: 'Tiny' } }),
      ...rows,
      '',
    ].join('\r\n'),
  );

describe('decodeVazenProjectFromJsonFile and encodeJsonFileFromVazenProject', () => {
  it('writes the every-field example as JSON that reads back and writes as the same TOML text', () => {
    const json = encodeJsonFileFromVazenProject(
      decodeVazenProjectFromTomlFile(EVERY_FIELD_LAYOUT),
    );

    expect(
      encodeTomlFileFromVazenProject(decodeVazenProjectFromJsonFile(json)),
    ).toBe(EVERY_FIELD_LAYOUT);
  });

  it('reads a file as plain data, which JSON holds as it is but for a date, held as its text', () => {
    const { project } = decodeVazenProjectFromTomlFile(EVERY_FIELD_LAYOUT);

    // eslint-disable-next-line unicorn/prefer-structured-clone -- JSON's own round trip is what is checked, and a clone would keep the date
    expect(JSON.parse(JSON.stringify(project))).toEqual({
      ...project,
      _example_org__plan: { approved: true, reviewed: REVIEWED, revision: 3 },
    });
  });

  it("reads text in the form JSON gives a date as a date, in an attribute or a product selector, and leaves other text, and a standard key's text, as text", () => {
    const { project } = decodeVazenProjectFromJsonFile(
      JSON.stringify({
        fixtures: [
          {
            equipment: [
              {
                sites: [{ product: { launched: '2026-09-27' } }],
                type: 'shelf',
              },
            ],
          },
        ],
        products: [
          {
            description: '2026-09-27',
            launched: '2026-09-27',
            name: '09:30:00.000',
          },
        ],
        reviewed: [REVIEWED, '2026-09-27T09:30:00Z'],
        schema: 'vazen/spec',
        schema_version: '0.3.0',
      }),
    );

    expect(project).toEqual({
      fixtures: [
        {
          equipment: [
            {
              sites: [{ product: { launched: new Date('2026-09-27') } }],
              type: 'shelf',
            },
          ],
        },
      ],
      products: [
        {
          description: '2026-09-27',
          launched: new Date('2026-09-27'),
          name: '09:30:00.000',
        },
      ],
      reviewed: [new Date(REVIEWED), '2026-09-27T09:30:00Z'],
      schema: 'vazen/spec',
      schema_version: '0.3.0',
    });
  });

  it('keeps the text of a PSA cell as text, so a PSA file read as JSON writes back as the same PSA file', () => {
    // Product columns 117 and 231 are Desc 5 and Brand; Performance column 9
    // is Desc 1. A Drawing row is one no record reads.
    const { project } = decodeVazenProjectFromPsaFile(
      psaFile(
        psaRow({
          _tag: 'Product',
          cells: {
            0: '1',
            2: 'Planflakes',
            117: '2026-09-27T09:30:00.000Z',
            231: '2026-09-27',
          },
        }),
        'Drawing,2026-09-27',
        psaRow({ _tag: 'Planogram', cells: { 0: '2026-09-27' } }),
        psaRow({ _tag: 'Performance', cells: { 0: '1', 9: '2026-09-27' } }),
        psaRow({ _tag: 'Segment', cells: { 0: '2026-09-27' } }),
        psaRow({ _tag: 'Fixture' }),
        psaRow({ _tag: 'Position', cells: { 0: '1' } }),
      ),
    );
    const read = decodeVazenProjectFromJsonFile(
      encodeJsonFileFromVazenProject({ project }),
    ).project;

    expect(read).toEqual(project);
    expect(read.products?.[0]).toMatchObject({
      _psa__brand: '2026-09-27',
      _psa__desc_5: '2026-09-27T09:30:00.000Z',
      _psa__unknown_rows_after: [{ _tag: 'Drawing', cells: ['2026-09-27'] }],
    });
    expect(encodePsaFileFromVazenProject({ project: read })).toEqual(
      encodePsaFileFromVazenProject({ project }),
    );
  });

  it("keeps a product selector's text under a standard key as text, as the product's is, so the selector still names it", () => {
    const { project } = decodeVazenProjectFromJsonFile(
      JSON.stringify({
        fixtures: [
          {
            equipment: [
              {
                sites: [
                  { product: { name: '2026-09-27' } },
                  { product: { ref: '2026-09-28' } },
                  { product: { form: '2026-09-29' } },
                  { product: { description: '09:30:00.000' } },
                  { product: { launched: '2026-09-30' } },
                ],
                type: 'shelf',
              },
            ],
          },
        ],
        products: [
          {
            description: '09:30:00.000',
            form: '2026-09-29',
            gtin: '884400062451',
            launched: '2026-09-30',
            name: '2026-09-27',
            ref: '2026-09-28',
          },
        ],
        schema: 'vazen/spec',
        schema_version: '0.3.0',
      }),
    );

    expect(
      project.fixtures?.[0]?.equipment?.[0]?.sites?.map(
        ({ product }) => product,
      ),
    ).toEqual([
      { name: '2026-09-27' },
      { ref: '2026-09-28' },
      { form: '2026-09-29' },
      { description: '09:30:00.000' },
      { launched: new Date('2026-09-30') },
    ]);
    expect(project.products?.[0]?.launched).toEqual(new Date('2026-09-30'));
    expect(() => encodePsaFileFromVazenProject({ project })).not.toThrow();
  });

  it('reads text in the form JSON gives a date as a date, so a selector for the text matches a product with the date too', () => {
    const { project } = decodeVazenProjectFromTomlFile(`schema = "vazen/spec"
schema_version = "0.3.0"
products = [
  { gtin = "5000000000012", name = "Product 1", label = "2026-09-27" },
  { gtin = "5000000000029", name = "Product 2", label = 2026-09-27 },
]

[[fixtures]]
equipment = [{ type = "shelf", sites = [{ product = { label = "2026-09-27" } }] }]
`);
    const read = decodeVazenProjectFromJsonFile(
      encodeJsonFileFromVazenProject({ project }),
    ).project;

    expect(() => encodePsaFileFromVazenProject({ project })).not.toThrow();
    expect(() => encodePsaFileFromVazenProject({ project: read })).toThrow(
      'the product selector matches 2 products, not one',
    );
  });

  it('reports the file it read beside the tables, and writes JSON indented by two spaces', () => {
    const { messages, project, source } = decodeVazenProjectFromJsonFile(
      JSON.stringify(SPEC),
    );

    expect(messages).toEqual([]);
    expect(source).toEqual({
      declaredVersion: '0.3.0',
      format: 'vazen-json',
    });
    expect(encodeJsonFileFromVazenProject({ project })).toContain(
      '\n  "schema": "vazen/spec",\n',
    );
  });

  it.each([
    ['text that is not JSON', 'schema = "vazen/spec"'],
    [
      'a null, which TOML cannot hold',
      JSON.stringify({ ...SPEC, brand: null }),
    ],
    [
      'an integer beyond the safe range, which reading JSON rounds',
      JSON.stringify(SPEC).replace('}', ', "count": 9007199254740993 }'),
    ],
    [
      '`__proto__` as a key',
      JSON.stringify(SPEC).replace(/}$/, ',"__proto__":"Dummy"}'),
    ],
    [
      '`__proto__` as a key of a nested table',
      JSON.stringify(SPEC).replace(
        '"ref":"p1"}',
        '"ref":"p1","__proto__":{"x":1}}',
      ),
    ],
  ])('throws a SchemaError reading %s', (_, text) => {
    expect(() => decodeVazenProjectFromJsonFile(text)).toThrow(
      Schema.SchemaError,
    );
  });

  it.each([NaN, Infinity])(
    'throws a SchemaError writing %s, which a TOML number can be and JSON cannot hold',
    (count) => {
      const { project } = decodeVazenProjectFromJsonFile(JSON.stringify(SPEC));

      expect(() =>
        encodeJsonFileFromVazenProject({ project: { ...project, count } }),
      ).toThrow(Schema.SchemaError);
    },
  );
});

describe.each([
  ['JSON', encodeJsonFileFromVazenProject],
  ['PSA', encodePsaFileFromVazenProject],
  ['TOML', encodeTomlFileFromVazenProject],
])('%s writer', (_, encode) => {
  it.each([
    ['at the top', '"__proto__":"Dummy"'],
    ['in a nested table', '"_example_org__data":{"__proto__":{"x":1}}'],
    ['in a list of tables', '"_example_org__data":[{"__proto__":"Dummy"}]'],
    [
      'in a product selector',
      '"fixtures":[{"equipment":[{"type":"shelf","sites":[{"product":{"ref":"p1","__proto__":"Dummy"}}]}]}]',
    ],
  ])('refuses an own `__proto__` key %s', (_, attribute) => {
    const project: VazenTomlProjectV0_3_0 = JSON.parse(
      `{"schema":"vazen/spec","schema_version":"0.3.0",${attribute}}`,
    );

    expect(() => encode({ project })).toThrow('["__proto__"]');
  });
});
