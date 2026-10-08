import {
  Array as A,
  Effect,
  Match,
  Option,
  pipe,
  Record,
  Result,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
  String as Str,
} from 'effect';

import { PsaFixture, PsaFixtureFromPsaRow } from './psa-fixture';
import type { PsaMessage } from './psa-messages';
import { PsaPerformance, PsaPerformanceFromPsaRow } from './psa-performance';
import { PsaPlanogram, PsaPlanogramFromPsaRow } from './psa-planogram';
import { PsaPosition, PsaPositionFromPsaRow } from './psa-position';
import { PsaProduct, PsaProductFromPsaRow } from './psa-product';
import { PsaProject, PsaProjectFromPsaRow } from './psa-project';
import { PsaRecords, type PsaRecord } from './psa-records';
import { columnNamesOfPsaRecord, PsaRows, type PsaRow } from './psa-rows';
import { PsaSegment, PsaSegmentFromPsaRow } from './psa-segment';
import {
  PSA_DEFAULT_WRITTEN_VERSION,
  PSA_VERSION_COLUMN_COUNTS,
  PsaVersion,
} from './psa-versions';

// Each row is read, and each record written, by its type's row schema.
const RECORD_FROM_ROW = {
  Fixture: SchemaParser.decodeUnknownResult(PsaFixtureFromPsaRow),
  Performance: SchemaParser.decodeUnknownResult(PsaPerformanceFromPsaRow),
  Planogram: SchemaParser.decodeUnknownResult(PsaPlanogramFromPsaRow),
  Position: SchemaParser.decodeUnknownResult(PsaPositionFromPsaRow),
  Product: SchemaParser.decodeUnknownResult(PsaProductFromPsaRow),
  Project: SchemaParser.decodeUnknownResult(PsaProjectFromPsaRow),
  Segment: SchemaParser.decodeUnknownResult(PsaSegmentFromPsaRow),
};
const ROW_FROM_RECORD = {
  Fixture: SchemaParser.encodeResult(PsaFixtureFromPsaRow),
  Performance: SchemaParser.encodeResult(PsaPerformanceFromPsaRow),
  Planogram: SchemaParser.encodeResult(PsaPlanogramFromPsaRow),
  Position: SchemaParser.encodeResult(PsaPositionFromPsaRow),
  Product: SchemaParser.encodeResult(PsaProductFromPsaRow),
  Project: SchemaParser.encodeResult(PsaProjectFromPsaRow),
  Segment: SchemaParser.encodeResult(PsaSegmentFromPsaRow),
};
const COLUMN_NAMES = {
  Fixture: columnNamesOfPsaRecord(PsaFixture),
  Performance: columnNamesOfPsaRecord(PsaPerformance),
  Planogram: columnNamesOfPsaRecord(PsaPlanogram),
  Position: columnNamesOfPsaRecord(PsaPosition),
  Product: columnNamesOfPsaRecord(PsaProduct),
  Project: columnNamesOfPsaRecord(PsaProject),
  Segment: columnNamesOfPsaRecord(PsaSegment),
};
// A row of a width no listed version gives its type is read by position, so
// its values may be in the wrong columns.
const LISTED_WIDTHS = Record.map(
  COLUMN_NAMES,
  (_, type): ReadonlyArray<number> =>
    Record.values(PSA_VERSION_COLUMN_COUNTS).map((counts) => counts[type]),
);

/**
 * Reads a file's records from its rows, each by its type's columns, and keeps
 * the version the file declares as `declaredVersion`. A cell past a row's last
 * column is dropped, and a cell its column cannot read is read as empty; both
 * are listed in `messages`, as are rows of a width no listed version gives.
 * Writes the records as the version `declaredVersion` holds, 2024.4.0 when it
 * holds none or one `PsaVersion` does not list, with that version's header and
 * row widths, and refuses a value in a column the version does not have.
 */
export const PsaRecordsFromPsaRows: S.Codec<PsaRecords, PsaRows> = PsaRows.pipe(
  S.decodeTo(PsaRecords, {
    decode: SchemaGetter.transformEffect(({ declaredVersion, rows }) =>
      Effect.fromResult(
        pipe(
          rows.map(readRow),
          Result.all,
          Result.map((read) => {
            const [, ordinals] = A.mapAccum(
              rows,
              Record.empty<string, number>(),
              (counts, { _tag }) => {
                const ordinal = (counts[_tag] ?? 0) + 1;
                return [{ ...counts, [_tag]: ordinal }, ordinal];
              },
            );
            const facts = read.map((fact, index) => ({
              ...fact,
              ordinal: ordinals[index] ?? 0,
            }));
            const messages: ReadonlyArray<PsaMessage> = [
              ...groupRows({
                key: ({ type, width }) => `${type} ${width}`,
                rows: facts.filter(
                  ({ type, width }) => !LISTED_WIDTHS[type].includes(width),
                ),
              }).map(({ first: { type, width }, rows }) => ({
                _tag: 'UnlistedWidth' as const,
                rows,
                type,
                width,
              })),
              ...groupRows({
                key: ({ type }) => type,
                rows: facts.filter(({ dropped }) => dropped),
              }).map(({ first: { type }, rows }) => ({
                _tag: 'DroppedCells' as const,
                rows,
                type,
              })),
              ...groupRows({
                key: ({ column, type }) => `${type} ${column}`,
                rows: facts.flatMap((fact) =>
                  fact.unread.map((column) => ({ ...fact, column })),
                ),
              }).map(({ first: { column, type }, rows }) => ({
                _tag: 'UnreadCells' as const,
                column,
                rows,
                type,
              })),
            ];
            return {
              declaredVersion,
              messages,
              records: facts.map(({ record }) => record),
            };
          }),
        ),
      ),
    ),
    encode: SchemaGetter.transformEffect(({ declaredVersion, records }, _) => {
      const version = pipe(
        declaredVersion,
        Option.flatMap(S.decodeUnknownOption(PsaVersion)),
        Option.getOrElse(() => PSA_DEFAULT_WRITTEN_VERSION),
      );
      return Effect.fromResult(
        pipe(
          records.map((record, index) =>
            Result.gen(function* () {
              const row = yield* Match.valueTags(record, ROW_FROM_RECORD);
              const columnCount =
                PSA_VERSION_COLUMN_COUNTS[version][record._tag];
              const extra = A.findFirstIndex(
                row.cells.slice(columnCount),
                (cell) => cell !== '',
              );
              if (Option.isSome(extra)) {
                return yield* Result.fail(
                  new SchemaIssue.InvalidValue(
                    {
                      message: `${record._tag} row ${ordinalOf({ index, items: records })} holds a value in column ${columnCount + extra.value + 1}, which a ${version} file's ${record._tag} rows do not have`,
                    },
                    record,
                  ),
                );
              }
              return { ...row, cells: row.cells.slice(0, columnCount) };
            }),
          ),
          Result.all,
          Result.map((rows) => ({
            declaredVersion: Option.some(version),
            rows,
          })),
        ),
      );
    }),
  }),
).annotate({ identifier: 'PsaRecordsFromPsaRows' });

/**
 * Whether every value the records hold sits in a column a `version` file's
 * rows have, so they can be written as that version.
 */
export const psaVersionHolds = ({
  records,
  version,
}: Readonly<{
  records: ReadonlyArray<PsaRecord>;
  version: PsaVersion;
}>): boolean =>
  records.every((record) => {
    // Typed as a record of its cells, since a column name indexes any record.
    const cells: Record.ReadonlyRecord<string, unknown> = record;
    return COLUMN_NAMES[record._tag]
      .slice(PSA_VERSION_COLUMN_COUNTS[version][record._tag])
      .every(
        (column) =>
          !Option.exists(
            Record.get(cells, column),
            (cell) => Option.isOption(cell) && Option.isSome(cell),
          ),
      );
  });

// Reads a row, dropping the cells past its type's last column.
const readRow = (row: PsaRow) => {
  const columnCount = COLUMN_NAMES[row._tag].length;
  return Result.map(
    readCells(
      row.cells.length > columnCount
        ? { ...row, cells: row.cells.slice(0, columnCount) }
        : row,
    ),
    ({ record, unread }) => ({
      dropped: A.some(row.cells.slice(columnCount), Str.isNonEmpty),
      record,
      type: row._tag,
      unread,
      width: row.cells.length,
    }),
  );
};

// Reads a row's cells into its record. When a cell cannot be read, every cell
// its column cannot read is found in one more pass, and read as empty.
const readCells = (row: PsaRow) =>
  pipe(
    Match.valueTags(row, RECORD_FROM_ROW),
    Result.map((record) => ({ record, unread: A.empty<string>() })),
    Result.orElse(() => {
      const names = COLUMN_NAMES[row._tag];
      const everyIssue: Result.Result<PsaRecord, SchemaIssue.Issue> =
        RECORD_FROM_ROW[row._tag](row, { errors: 'all' });
      const failing = new Set(
        pipe(
          Result.getFailure(everyIssue),
          Option.map(
            (issue) =>
              SchemaIssue.makeFormatterStandardSchemaV1()(issue).issues,
          ),
          Option.getOrElse(() => []),
          A.map(({ path }) => {
            const first = path?.[0];
            return typeof first === 'object' ? first.key : first;
          }),
        ),
      );
      return Result.map(
        Match.valueTags(
          {
            ...row,
            cells: row.cells.map((cell, index) =>
              failing.has(names[index] ?? '') ? '' : cell,
            ),
          },
          RECORD_FROM_ROW,
        ),
        (record) => ({
          record,
          unread: A.filter(names, (name) => failing.has(name)),
        }),
      );
    }),
  );

// Groups rows by `key`, in the order each group first appears, with the
// ordinals of its rows.
const groupRows = <Row extends Readonly<{ ordinal: number }>>({
  key,
  rows,
}: Readonly<{
  key: (row: Row) => string;
  rows: ReadonlyArray<Row>;
}>) =>
  Record.values(A.groupBy(rows, key)).map((group) => ({
    first: group[0],
    rows: group.map(({ ordinal }) => ordinal),
  }));

// Which row of its type the row at `index` is, counting from 1.
const ordinalOf = ({
  index,
  items,
}: Readonly<{
  index: number;
  items: ReadonlyArray<{ readonly _tag: string }>;
}>) =>
  A.filter(items.slice(0, index + 1), ({ _tag }) => _tag === items[index]?._tag)
    .length;
