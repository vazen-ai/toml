import { readFileSync } from 'node:fs';
import { ParseResult } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  decodeVazenProjectFromJsonFile,
  encodeJsonFileFromVazenProject,
} from './vazen-project-from-json-text';
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

  it('reports the file it read beside the tables, and writes JSON indented by two spaces', () => {
    const { project, source } = decodeVazenProjectFromJsonFile(
      JSON.stringify(SPEC),
    );

    expect(source).toEqual({ declaredVersion: '0.3.0', format: 'vazen-json' });
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
  ])('throws a ParseError reading %s', (_, text) => {
    expect(() => decodeVazenProjectFromJsonFile(text)).toThrow(
      ParseResult.ParseError,
    );
  });

  it.each([NaN, Infinity])(
    'throws a ParseError writing %s, which a TOML number can be and JSON cannot hold',
    (count) => {
      const { project } = decodeVazenProjectFromJsonFile(JSON.stringify(SPEC));

      expect(() =>
        encodeJsonFileFromVazenProject({ project: { ...project, count } }),
      ).toThrow(ParseResult.ParseError);
    },
  );
});
