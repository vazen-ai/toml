import { readFileSync } from 'node:fs';
import { Either, Option, ParseResult, Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import type { VazenProject } from './vazen-project';
import {
  decodeVazenProjectFromTomlFile,
  encodeTomlFileFromVazenProject,
  VazenProjectFromTomlText,
} from './vazen-project-from-toml-text';

const example = (fileName: string) =>
  readFileSync(
    new URL(`../../examples/0.3.0/${fileName}`, import.meta.url),
    'utf8',
  );

// The worked example published in specification/0.3.0.md, verbatim, and the
// same plan as intent.
const LAYOUT = example('end-of-aisle-layout.vazen.toml');
const SPEC = example('end-of-aisle-spec.vazen.toml');

const decode = S.decodeEither(VazenProjectFromTomlText);
const encode = S.encodeEither(VazenProjectFromTomlText);

describe('VazenProjectFromTomlText', () => {
  it.each([LAYOUT, SPEC])(
    'should write a project it read so that it reads back the same',
    (text) => {
      const project = Either.getOrThrow(decode(text));

      expect(decode(Either.getOrThrow(encode(project)))).toEqual(
        Either.right(project),
      );
    },
  );

  it('should gather the keys beside the standard fields into attributes', () => {
    const [unit, tray] = Either.getOrThrow(decode(SPEC)).products;

    expect([unit?.attributes, tray?.attributes]).toEqual([
      { _vazen__group: 'dishwasher-tablets-50', brand: 'Example Brand' },
      {
        _vazen__group: 'dishwasher-tablets-50',
        _vazen__unit_count: 4,
        brand: 'Example Brand',
      },
    ]);
  });

  it('should record the file it read as the source, and write its own version whatever the source', () => {
    const project = Either.getOrThrow(decode(LAYOUT));

    expect([project.stage, project.source]).toEqual([
      'layout',
      Option.some({
        declaredVersion: Option.some('0.3.0'),
        format: 'vazen-toml',
      }),
    ]);
    expect(
      Either.getOrThrow(
        encode({
          ...project,
          source: Option.some({
            declaredVersion: Option.some('2024.4.0'),
            format: 'psa',
          }),
        }),
      ),
    ).toContain('schema_version = "0.3.0"');
  });

  it('should write a file in its own style back unchanged', () => {
    const text = `schema = "vazen/layout"
schema_version = "0.3.0"

[[fixtures]]
id = "F1"

[[fixtures.equipment]]
type = "shelf"

[[fixtures.equipment.sites]]
orientation = "Fl"

[fixtures.equipment.sites.product]
ref = "p_1"

[fixtures.equipment.sites.facings]
wide = 2
high = 1
deep = 3
`;

    expect(encode(Either.getOrThrow(decode(text)))).toEqual(Either.right(text));
  });

  it('should read an image as a URL or a table, and write one with nothing but its URL as the URL alone', () => {
    const text = SPEC.replace(
      'brand = "Example Brand"',
      'brand = "Example Brand"\nimages = { front = "https://example.org/front.png", back = { url = "https://example.org/back.png", crop = { x = 200 } } }',
    );
    const project = Either.getOrThrow(decode(text));
    const written = Either.getOrThrow(encode(project));

    expect(project.products[0]?.images).toEqual(
      Option.some({
        back: Option.some({
          attributes: { crop: { x: 200 } },
          url: 'https://example.org/back.png',
        }),
        base: Option.none(),
        front: Option.some({
          attributes: {},
          url: 'https://example.org/front.png',
        }),
        top: Option.none(),
        right: Option.none(),
        left: Option.none(),
      }),
    );
    expect(written).toContain('front = "https://example.org/front.png"');
    expect(decode(written)).toEqual(Either.right(project));
  });

  // The specification's rules of a whole file, and its spatial rules, are
  // checked separately.
  it.each([
    [
      'an equipment type it does not recognise',
      LAYOUT.replace('type = "shelf"', 'type = "wine_cradle"'),
    ],
    [
      'a table under a namespaced key',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = "Example Brand"\n_example_org__codes = { case = "C-1" }',
      ),
    ],
    [
      'a table under a namespaced key whose domain holds a hyphen',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = "Example Brand"\n_example-shop_org__codes = { case = "C-1" }',
      ),
    ],
    [
      'a table under a namespace that is a generic word',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = "Example Brand"\n_data__codes = { case = "C-1" }',
      ),
    ],
    [
      'a layout site without a position',
      LAYOUT.replace('position = { x = 25, y = 300, z = 0 }\n', ''),
    ],
    [
      'a dimension of zero',
      LAYOUT.replace('width = 1250, height = 2000', 'width = 0, height = 2000'),
    ],
  ])('should read %s', (_, text) => {
    expect(Either.isRight(decode(text))).toBe(true);
  });

  it('should name the version of a file it cannot read', () => {
    const decoded = decode(
      LAYOUT.replace('schema_version = "0.3.0"', 'schema_version = "0.2.0"'),
    );

    expect(Either.isLeft(decoded) && decoded.left.message).toContain('"0.2.0"');
  });

  it('should read a file for a caller refusing excess properties', () => {
    expect(
      Either.isRight(
        S.decodeEither(VazenProjectFromTomlText)(LAYOUT, {
          onExcessProperty: 'error',
        }),
      ),
    ).toBe(true);
  });

  it.each([
    [
      'a key a position does not have',
      LAYOUT.replace(
        '{ x = 25, y = 300, z = 0 }',
        '{ x = 25, y = 300, z = 0, w = 1 }',
      ),
    ],
    [
      'an image of a face the specification does not name',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = "Example Brand"\nimages = { side = "https://example.org/side.png" }',
      ),
    ],
    [
      'a selector with no fields',
      LAYOUT.replace('product = { ref = "p_4t8rbn" }', 'product = {}'),
    ],
    [
      'a table under a namespace with no key',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = "Example Brand"\n_example_org__ = { case = "C-1" }',
      ),
    ],
    [
      'a table under a descriptive key',
      SPEC.replace(
        'brand = "Example Brand"',
        'brand = { name = "Example Brand" }',
      ),
    ],
  ])('should refuse %s', (_, text) => {
    expect(Either.isLeft(decode(text))).toBe(true);
  });

  it.each([
    [
      'an attribute named for a field',
      // A value the field itself accepts, so only the refusal stops it dropping
      // every product.
      (project: VazenProject) => ({ ...project, attributes: { products: [] } }),
    ],
    [
      'an image attribute named for its URL',
      (project: VazenProject) => ({
        ...project,
        products: project.products.map((product) => ({
          ...product,
          images: Option.some({
            back: Option.none(),
            base: Option.none(),
            front: Option.some({
              attributes: { url: 'https://example.org/other.png' },
              url: 'https://example.org/front.png',
            }),
            top: Option.none(),
            right: Option.none(),
            left: Option.none(),
          }),
        })),
      }),
    ],
    [
      'a product description that is not a string',
      (project: VazenProject) => ({
        ...project,
        products: project.products.map((product) => ({
          ...product,
          attributes: { ...product.attributes, description: 5 },
        })),
      }),
    ],
  ])('should refuse to write %s, which would overwrite it', (_, change) => {
    expect(Either.isLeft(encode(change(Either.getOrThrow(decode(SPEC)))))).toBe(
      true,
    );
  });

  // Built without TypeScript's checks, as a JavaScript caller might.
  it.each([
    [
      'a key a project does not have',
      (project: VazenProject): unknown => ({ ...project, version: '0.3.0' }),
    ],
    [
      'a key a product does not have',
      (project: VazenProject): unknown => ({
        ...project,
        products: project.products.map((product) => ({
          ...product,
          brand: 'Example Brand',
        })),
      }),
    ],
  ])(
    'should refuse to write a project built with %s, rather than dropping it',
    (_, build) => {
      expect(
        Either.isLeft(
          S.encodeUnknownEither(VazenProjectFromTomlText)(
            build(Either.getOrThrow(decode(SPEC))),
          ),
        ),
      ).toBe(true);
    },
  );
});

describe('decodeVazenProjectFromTomlFile and encodeTomlFileFromVazenProject', () => {
  it('reads a file as its tables, with the file it came from beside them, and writes them as the schema writes the project', () => {
    const { project, source } = decodeVazenProjectFromTomlFile(LAYOUT);

    expect(source).toEqual({ declaredVersion: '0.3.0', format: 'vazen-toml' });
    expect(
      project.fixtures?.[0]?.equipment?.[0]?.equipment?.[0]?.sites?.[0]?.facings
        ?.wide,
    ).toBe(2);
    expect(encodeTomlFileFromVazenProject({ project })).toBe(
      Either.getOrThrow(encode(Either.getOrThrow(decode(LAYOUT)))),
    );
  });

  it('throws a ParseError writing tables that reading would refuse', () => {
    const { project } = decodeVazenProjectFromTomlFile(SPEC);

    expect(() =>
      encodeTomlFileFromVazenProject({
        project: { ...project, brand: { name: 'Example Brand' } },
      }),
    ).toThrow(ParseResult.ParseError);
  });
});
