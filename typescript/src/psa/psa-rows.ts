import {
  Array as A,
  Either,
  ParseResult,
  pipe,
  Record,
  Schema as S,
  type Option,
} from 'effect';

import { PsaRecordType } from './psa-versions';

/** A row of a type this package does not read, kept as its text. */
export const PsaUnknownRow = S.Struct({
  // A row of a type this package reads would be read back as a record, and
  // one starting `;` as a comment, which reading drops.
  _tag: S.String.pipe(
    S.filter(
      (type) =>
        !S.is(PsaRecordType)(type) ||
        `a ${type} row is read as a record, so it cannot be kept as a row of a type this package does not read`,
    ),
    S.filter(
      (type) =>
        !type.startsWith(';') ||
        'a row starting ";" is read as a comment, so it cannot be kept as a row',
    ),
  ),
  cells: S.Array(S.String),
})
  .pipe(
    // An empty row would be written as a blank line, which reading drops.
    S.filter(
      ({ _tag, cells }) =>
        _tag !== '' ||
        cells.length > 0 ||
        'an empty row is read as a blank line, so it cannot be kept as a row',
    ),
  )
  .annotations({ identifier: 'PsaUnknownRow' });
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
}).annotations({ identifier: 'PsaRow' });
export type PsaRow = typeof PsaRow.Type;

/**
 * The version a file's header declares, if it gives one, and its rows in order.
 */
export const PsaRows = S.Struct({
  declaredVersion: S.OptionFromSelf(S.String),
  rows: S.Array(PsaRow),
}).annotations({ identifier: 'PsaRows' });
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

  // Declared, as `FromWorkSheetRowsFor` is: TypeScript cannot type cells placed
  // by position into any record's columns, so each side is decoded instead.
  return S.declare([S.Struct({ ...PsaRow.fields, _tag: tag }), record], {
    decode: (rowSchema, recordSchema) => (input, options, ast) =>
      pipe(
        ParseResult.decodeUnknownEither(rowSchema, options)(input),
        Either.filterOrLeft(
          ({ cells }) => cells.length <= names.length,
          ({ _tag, cells }) =>
            new ParseResult.Type(
              ast,
              input,
              `a ${_tag} row has ${cells.length} cells, more than the ${names.length} columns a ${_tag} has`,
            ),
        ),
        Either.flatMap(({ _tag, cells, unknownRowsAfter }) =>
          ParseResult.decodeUnknownEither(
            recordSchema,
            options,
          )({
            ...Record.fromEntries(
              names.map((name, index) => [name, cells[index] ?? '']),
            ),
            _tag,
            unknownRowsAfter,
          }),
        ),
      ),
    encode: (rowSchema, recordSchema) => (input, options) =>
      pipe(
        ParseResult.encodeUnknownEither(recordSchema, options)(input),
        Either.flatMap((encoded) => {
          const textByName: Record.ReadonlyRecord<string, unknown> = encoded;
          return ParseResult.decodeUnknownEither(
            rowSchema,
            options,
          )({
            _tag: textByName._tag,
            cells: names.map((name) => textByName[name]),
            unknownRowsAfter: textByName.unknownRowsAfter,
          });
        }),
      ),
  });
};

/** A record's columns, in the order a row holds their cells. */
export const columnNamesOfPsaRecord = (
  record: Readonly<{ fields: S.Struct.Fields }>,
) =>
  A.filter(
    Record.keys(record.fields),
    (name) => name !== '_tag' && name !== 'unknownRowsAfter',
  );
