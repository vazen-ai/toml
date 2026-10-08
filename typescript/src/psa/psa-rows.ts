import {
  Array as A,
  Effect,
  Record,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
  type Option,
} from 'effect';

import { PsaRecordType } from './psa-versions';

/** A row of a type this package does not read, kept as its text. */
export const PsaUnknownRow = S.Struct({
  // A row of a type this package reads would be read back as a record, and
  // one starting `;` as a comment, which reading drops.
  _tag: S.String.pipe(
    S.check(
      S.makeFilter(
        (type) =>
          !S.is(PsaRecordType)(type) ||
          `a ${type} row is read as a record, so it cannot be kept as a row of a type this package does not read`,
      ),
    ),
    S.check(
      S.makeFilter(
        (type) =>
          !type.startsWith(';') ||
          'a row starting ";" is read as a comment, so it cannot be kept as a row',
      ),
    ),
  ),
  cells: S.Array(S.String),
})
  .pipe(
    // An empty row would be written as a blank line, which reading drops.
    S.check(
      S.makeFilter(
        ({ _tag, cells }) =>
          _tag !== '' ||
          cells.length > 0 ||
          'an empty row is read as a blank line, so it cannot be kept as a row',
      ),
    ),
  )
  .annotate({ identifier: 'PsaUnknownRow' });
export type PsaUnknownRow = typeof PsaUnknownRow.Type;

/**
 * A row of a type this package reads, as the text of its cells after the type.
 */
export const PsaRow = S.Struct({
  _tag: PsaRecordType,
  cells: S.Array(S.String),
  /**
   * The rows of types this package does not read, such as ProSpace's
   * calculated `PositionCalc` rows, that the file places straight after this
   * one. They are written back in the same place.
   */
  unknownRowsAfter: S.Array(PsaUnknownRow),
}).annotate({ identifier: 'PsaRow' });
export type PsaRow = typeof PsaRow.Type;

/**
 * The version a file's header declares, if it gives one, and its rows in order.
 */
export const PsaRows = S.Struct({
  declaredVersion: S.Option(S.String),
  rows: S.Array(PsaRow),
}).annotate({ identifier: 'PsaRows' });
export type PsaRows = typeof PsaRows.Type;

/**
 * What an empty cell means per column, following ProSpace's field definitions.
 */
export type PsaRowDefaults<Row extends Record.ReadonlyRecord<string, unknown>> =
  {
    readonly [
      Key in keyof Row as Row[Key] extends Option.Option<unknown> ? Key : never
    ]: Row[Key] extends Option.Option<infer Value> ? Value : never;
  };

/**
 * Reads a row's cells into the given record's columns by position, in the
 * newest version's column order. A row from an older version is shorter, so its
 * later columns read as empty; a row with more cells than the record has
 * columns is refused. The record also holds the row's `unknownRowsAfter`, so
 * those rows are written back after it.
 */
export const PsaRecordFromPsaRowFor = <
  Tag extends PsaRecordType,
  Fields extends S.Struct.Fields,
>(
  record: S.TaggedStruct<Tag, Fields>,
) => {
  // Annotated: typed through `Fields`, the row struct's TypeScript type does
  // not resolve.
  const tag: S.tag<Tag> = record.fields._tag;
  const names = columnNamesOfPsaRecord(record);

  const row = S.Struct({ ...PsaRow.fields, _tag: tag });
  return row.pipe(
    S.decodeTo(record, {
      decode: SchemaGetter.transformEffect((input, options) => {
        if (input.cells.length > names.length) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(
              {
                message: `a ${input._tag} row has ${input.cells.length} cells, more than the ${names.length} columns a ${input._tag} has`,
              },
              input,
            ),
          );
        }
        return SchemaParser.decodeUnknownEffect(
          S.toEncoded(record),
          options,
        )({
          ...Record.fromEntries(
            names.map((name, index) => [name, input.cells[index] ?? '']),
          ),
          _tag: input._tag,
          unknownRowsAfter: input.unknownRowsAfter,
        });
      }),
      encode: SchemaGetter.transformEffect((encoded, options) => {
        const textByName: Record.ReadonlyRecord<string, unknown> = encoded;
        return SchemaParser.decodeUnknownEffect(
          row,
          options,
        )({
          _tag: textByName._tag,
          cells: names.map((name) => textByName[name]),
          unknownRowsAfter: textByName.unknownRowsAfter,
        });
      }),
    }),
  );
};

/** A record's columns, in the order a row holds their cells. */
export const columnNamesOfPsaRecord = (
  record: Readonly<{ fields: S.Struct.Fields }>,
) =>
  A.filter(
    Record.keys(record.fields),
    (name) => name !== '_tag' && name !== 'unknownRowsAfter',
  );
