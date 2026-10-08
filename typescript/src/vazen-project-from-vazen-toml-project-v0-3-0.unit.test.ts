import { readFileSync } from 'node:fs';
import { Option, Result, Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import type { VazenProject } from './vazen-project';
import { VazenProjectFromTomlText } from './vazen-project-from-toml-text';
import { VazenProjectFromVazenTomlProjectV0_3_0 } from './vazen-project-from-vazen-toml-project-v0-3-0';

// Hand-written, as the record of what 0.3.0 writes: the package must write it
// byte for byte and read it back, so a change to what 0.3.0 writes fails here
// until the example is changed on purpose.
const EVERY_FIELD_LAYOUT = readFileSync(
  new URL(
    '../../examples/0.3.0/every-field-layout.vazen.toml',
    import.meta.url,
  ),
  'utf8',
);

// A layout giving every field the specification defines, with a piece of
// equipment holding nothing, and each kind of attribute: a descriptive scalar
// and array, and a namespaced table.
const EVERY_FIELD: VazenProject = {
  attributes: {
    _example_org__plan: {
      approved: true,
      reviewed: new Date('2026-09-27T09:30:00Z'),
      revision: 3,
    },
    category: 'Breakfast cereals',
  },
  fixtures: [
    {
      attributes: {
        _example_org__store: 'Example Store 12',
        tags: ['end-of-aisle', 'promotional'],
      },
      dimensions: Option.some({ width: 1250, height: 2000, depth: 570 }),
      equipment: [
        {
          attributes: { _example_org__bay: 1 },
          dimensions: Option.some({ width: 1250, height: 2000, depth: 570 }),
          equipment: [
            {
              attributes: {},
              dimensions: Option.some({ width: 1250, height: 400, depth: 570 }),
              equipment: [],
              position: Option.some({ x: 0, y: 260, z: 0 }),
              sites: [
                {
                  attributes: {
                    _example_org__facing_note: 'lead item',
                    highlighted: true,
                  },
                  dimensions: Option.some({
                    width: 780,
                    height: 260,
                    depth: 480,
                  }),
                  facings: Option.some({
                    deep: Option.some(4),
                    high: Option.some(1),
                    wide: Option.some(3),
                  }),
                  orientation: Option.some('F'),
                  position: Option.some({ x: 25, y: 300, z: 0 }),
                  product: { ref: 'p_planflakes_400' },
                  sortOrder: Option.some(1),
                },
                {
                  attributes: {},
                  dimensions: Option.some({
                    width: 420,
                    height: 260,
                    depth: 520,
                  }),
                  facings: Option.some({
                    deep: Option.some(2),
                    high: Option.some(2),
                    wide: Option.some(1.5),
                  }),
                  orientation: Option.some('Fl'),
                  position: Option.some({ x: 830, y: 300, z: 0 }),
                  product: { gtin: '10884400062458' },
                  sortOrder: Option.some(2),
                },
              ],
              sortOrder: Option.some(1),
              type: 'shelf',
            },
            {
              attributes: {},
              dimensions: Option.some({ width: 200, height: 20, depth: 300 }),
              equipment: [],
              position: Option.some({ x: 525, y: 1500, z: 0 }),
              sites: [],
              sortOrder: Option.some(2),
              type: 'peg',
            },
          ],
          position: Option.some({ x: 0, y: 0, z: 0 }),
          sites: [],
          sortOrder: Option.some(1),
          type: 'bay',
        },
      ],
      id: Option.some('AISLE-12-END'),
      name: Option.some('Aisle 12 End'),
      sortOrder: Option.some(1),
    },
  ],
  messages: [],
  name: Option.some('Every Field'),
  products: [
    {
      attributes: {
        _example_org__supplier: { code: 'SUP-001', lead_time_days: 3 },
        brand: 'Vazen',
        description: 'Vazen Planflakes breakfast cereal, 400 g box',
      },
      dimensions: Option.some({ width: 190, height: 280, depth: 70 }),
      form: Option.some('box'),
      gtin: Option.some('884400062451'),
      images: Option.some({
        back: Option.some({
          attributes: { crop: { x: 200, y: 0 } },
          url: 'https://example.org/planflakes-400/back.png',
        }),
        base: Option.some({
          attributes: {},
          url: 'https://example.org/planflakes-400/base.png',
        }),
        front: Option.some({
          attributes: {},
          url: 'https://example.org/planflakes-400/front.png',
        }),
        top: Option.some({
          attributes: {},
          url: 'https://example.org/planflakes-400/top.png',
        }),
        right: Option.some({
          attributes: {},
          url: 'https://example.org/planflakes-400/right.png',
        }),
        left: Option.some({
          attributes: {},
          url: 'https://example.org/planflakes-400/left.png',
        }),
      }),
      name: 'Vazen Planflakes breakfast cereal 400 g',
      ref: Option.some('p_planflakes_400'),
    },
    {
      attributes: { _vazen__unit_count: 6, brand: 'Vazen' },
      dimensions: Option.some({ width: 400, height: 290, depth: 220 }),
      form: Option.some('tray'),
      gtin: Option.some('10884400062458'),
      images: Option.none(),
      name: 'Vazen Planflakes breakfast cereal 400 g, tray of 6',
      ref: Option.some('p_planflakes_400_tray'),
    },
  ],
  source: Option.none(),
  stage: 'layout',
};

// Written and read as text, since the example is a file: these tables under
// `TomlFromText`.
const decode = S.decodeResult(VazenProjectFromTomlText);
const encode = S.encodeResult(VazenProjectFromTomlText);

describe('VazenProjectFromVazenTomlProjectV0_3_0', () => {
  it('refuses an own `__proto__` key when encoding through the schema directly', () => {
    expect(() =>
      S.encodeSync(VazenProjectFromVazenTomlProjectV0_3_0)({
        ...EVERY_FIELD,
        attributes: JSON.parse(
          '{"_example_org__data":[{"__proto__":"Dummy"}]}',
        ),
      }),
    ).toThrow('["__proto__"]');
  });

  it('should write the project holding every field as the every-field example, byte for byte', () => {
    expect(encode(EVERY_FIELD)).toEqual(Result.succeed(EVERY_FIELD_LAYOUT));
  });

  it('should read the every-field example back as that project', () => {
    expect(decode(EVERY_FIELD_LAYOUT)).toEqual(
      Result.succeed({
        ...EVERY_FIELD,
        source: Option.some({
          declaredVersion: Option.some('0.3.0'),
          format: 'vazen-toml',
        }),
      }),
    );
  });
});
