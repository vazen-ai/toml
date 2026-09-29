import { Array as A, Option, Predicate, Record, Schema as S } from 'effect';
import { TomlDate } from 'smol-toml';

import type { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import type { TomlTable, TomlValue } from './toml-from-text';
import type { VazenAttributeScalar } from './vazen-attributes';
import type { VazenEquipment } from './vazen-equipment';
import { VazenProject } from './vazen-project';
import {
  VazenProjectFromVazenTomlProject,
  vazenProjectReadFromVazenProject,
  writtenVazenTomlProject,
  type VazenProjectRead,
  type VazenVersion,
} from './vazen-project-from-vazen-toml-project';

const FORMAT = 'vazen-json';

// A TOML number can be `nan` or `inf`, which JSON cannot hold, and
// `JSON.parse` rounds an integer beyond JavaScript's safe range, which the TOML
// reader refuses. Both are refused here, rather than written as `null` or read
// rounded.
const JsonFromText = S.parseJson({ space: 2 }).pipe(
  S.compose(
    S.Unknown.pipe(
      S.filter((value) =>
        A.match(inexactNumbersIn(value), {
          onEmpty: () => true,
          onNonEmpty: ([number]) => `${number} has no exact JSON form`,
        }),
      ),
    ),
  ),
);

/**
 * Reads a `.vazen.json` file of any version `VazenVersion` lists, and writes
 * one as 0.3.0. The file holds a Vazen TOML file's tables as JSON, which
 * `VazenProjectFromVazenTomlProject` reads and writes. JSON has no date, so a
 * date is written as RFC 3339 text with milliseconds, such as
 * `"2026-09-27T09:30:00.000Z"`, `"2026-09-27"` or `"09:30:00.000"`. Text in
 * exactly such a form reads as a date, but only in an attribute or a product
 * selector. Writing refuses `nan` and `inf`, which JSON cannot hold. Reading
 * refuses an integer beyond JavaScript's safe range.
 */
export const VazenProjectFromJsonText: S.Schema<VazenProject, string> =
  JsonFromText.pipe(
    S.compose(VazenProjectFromVazenTomlProject),
    S.compose(
      S.transform(VazenProject, VazenProject, {
        decode: (project) => ({
          ...withDates(project),
          source: Option.map(project.source, (source) => ({
            ...source,
            format: FORMAT,
          })),
        }),
        encode: (project) => project,
        strict: true,
      }),
    ),
  ).annotations({ identifier: 'VazenProjectFromJsonText' });

/**
 * Reads the text of a `.vazen.json` file as its tables. Throws a `ParseError`
 * saying what it could not read.
 */
export const decodeVazenProjectFromJsonFile = (
  text: string,
): VazenProjectRead =>
  vazenProjectReadFromVazenProject(
    S.decodeSync(VazenProjectFromJsonText)(text),
  );

/**
 * Writes a project's tables as the text of a `.vazen.json` file. It writes
 * 0.3.0, unless `version` names another version `VazenVersion` lists. Throws a
 * `ParseError` saying what it could not write.
 */
export const encodeJsonFileFromVazenProject = (
  options: Readonly<{
    project: VazenTomlProjectV0_3_0;
    version?: VazenVersion;
  }>,
): string => S.encodeSync(JsonFromText)(writtenVazenTomlProject(options));

const inexactNumbersIn = (value: unknown): ReadonlyArray<number> => {
  if (Predicate.isNumber(value)) {
    return Number.isFinite(value) &&
      (!Number.isInteger(value) || Number.isSafeInteger(value))
      ? []
      : [value];
  }
  return Predicate.isObject(value) && !Predicate.isDate(value)
    ? Object.values(value).flatMap(inexactNumbersIn)
    : [];
};

// The text is a date only when the date writes back as the same text, so
// reading and writing JSON changes no value.
const dateFromText = (text: string): string | Date => {
  const date = new TomlDate(text);
  return date.isValid() && date.toISOString() === text ? date : text;
};

const dateIn = (value: TomlValue): TomlValue => {
  if (Predicate.isString(value)) {
    return dateFromText(value);
  }
  if (Predicate.isDate(value) || !Predicate.isObject(value)) {
    return value;
  }
  return isList(value) ? value.map(dateIn) : datesIn(value);
};

// `Array.isArray` narrows a readonly array only when typed so.
const isList: (value: TomlValue) => value is ReadonlyArray<TomlValue> =
  Array.isArray;

const datesIn = (table: TomlTable): TomlTable => Record.map(table, dateIn);

const scalarDateIn = (value: VazenAttributeScalar): VazenAttributeScalar =>
  Predicate.isString(value) ? dateFromText(value) : value;

// Only attributes and product selectors hold dates. A standard key's text stays
// text.
const withDates = (project: VazenProject): VazenProject => ({
  ...project,
  attributes: datesIn(project.attributes),
  fixtures: project.fixtures.map((fixture) => ({
    ...fixture,
    attributes: datesIn(fixture.attributes),
    equipment: fixture.equipment.map(equipmentWithDates),
  })),
  products: project.products.map((product) => ({
    ...product,
    // `description` is a standard key of the file, held in the attributes.
    attributes: Record.map(product.attributes, (value, key) =>
      key === 'description' ? value : dateIn(value),
    ),
    images: Option.map(product.images, (images) =>
      Record.map(images, (image) =>
        Option.map(image, ({ attributes, url }) => ({
          attributes: datesIn(attributes),
          url,
        })),
      ),
    ),
  })),
});

const equipmentWithDates = (equipment: VazenEquipment): VazenEquipment => ({
  ...equipment,
  attributes: datesIn(equipment.attributes),
  equipment: equipment.equipment.map(equipmentWithDates),
  sites: equipment.sites.map((site) => ({
    ...site,
    attributes: datesIn(site.attributes),
    product: Record.map(site.product, scalarDateIn),
  })),
});
