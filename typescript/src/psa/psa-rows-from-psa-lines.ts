import {
  Array as A,
  Effect,
  Option,
  pipe,
  Record,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  String as Str,
} from 'effect';

import { groupUnderHeads } from './group-under-heads';
import { PsaLines } from './psa-lines';
import { PsaRows } from './psa-rows';
import { PsaRecordType } from './psa-versions';

const FIRST_LINE = 'PROSPACE SCHEMATIC FILE';
// Some files write the first line with trailing spaces, which are dropped, or
// with the version after it.
const FIRST_LINE_PATTERN = /^PROSPACE SCHEMATIC FILE(?: *|; Version .*)$/;
const VERSION_PREFIX = '; Version ';
// The version, on a line of its own or after the first line's text; older
// files write it as `;V8.0.1.2`.
const VERSION_PATTERN =
  /^(?:PROSPACE SCHEMATIC FILE)?(?:; Version |;V(?=\d))(.*)$/;
// Every file is written in Windows-1252, whatever the file read declared.
const CODEPAGE_LINE = '; Codepage=1252';
// The escapes ProSpace writes, by the character after the backslash: a
// generator's action list, for one, holds its line breaks as `\r\n`.
const CHARACTER_BY_ESCAPE: Record.ReadonlyRecord<string, string> = {
  '"': '"',
  ',': ',',
  '\\': '\\',
  n: '\n',
  r: '\r',
  t: '\t',
};
const ESCAPE_BY_CHARACTER = Record.fromEntries(
  Record.toEntries(CHARACTER_BY_ESCAPE).map(
    ([escape, character]) => [character, `\\${escape}`] as const,
  ),
);
const ESCAPED_CHARACTERS = /[\t\n\r",\\]/g;

/**
 * A file's rows, from its lines: the header's version, if it gives one, and
 * each later line split into its type and cells. A row of a type this package
 * does not read is kept with the row before it, so it is written back there.
 * Comment lines other than the header's, and blank lines, are dropped.
 */
export const PsaRowsFromPsaLines = PsaLines.pipe(
  S.decodeTo(PsaRows, {
    decode: SchemaGetter.transformEffect((lines, _) => {
      const fail = (message: string) =>
        Effect.fail(
          new SchemaIssue.InvalidValue({ message }, lines.slice(0, 3)),
        );
      if (!FIRST_LINE_PATTERN.test(lines[0] ?? '')) {
        return fail(`not a PSA file: the first line must be "${FIRST_LINE}"`);
      }
      const { groups, leading } = groupUnderHeads({
        isHead: isKnownRow,
        items: lines.slice(1).filter(isRow).map(splitCells),
        toGroup: ([_tag, ...cells], unknownRows) => ({
          _tag,
          cells,
          unknownRowsAfter: unknownRows.map(
            ([unknownTag = '', ...unknownCells]) => ({
              _tag: unknownTag,
              cells: unknownCells,
            }),
          ),
        }),
      });
      return Option.match(A.head(leading), {
        onNone: () =>
          Effect.succeed({
            declaredVersion: pipe(
              A.findFirst(lines, (line) =>
                Option.fromNullishOr(VERSION_PATTERN.exec(line)?.[1]),
              ),
              Option.map(Str.trim),
              Option.filter(Str.isNonEmpty),
            ),
            rows: groups,
          }),
        onSome: ([_tag = '']) => fail(`a ${_tag} row before the Project row`),
      });
    }),
    encode: SchemaGetter.transformEffect(({ declaredVersion, rows }) =>
      Effect.succeed([
        FIRST_LINE,
        ...Option.toArray(
          Option.map(declaredVersion, (text) => `${VERSION_PREFIX}${text}`),
        ),
        CODEPAGE_LINE,
        ...rows.flatMap((row) =>
          [row, ...row.unknownRowsAfter].map(({ _tag, cells }) =>
            joinCells([_tag, ...cells]),
          ),
        ),
      ]),
    ),
  }),
).annotate({ identifier: 'PsaRowsFromPsaLines' });

const isRecordType = S.is(PsaRecordType);

const isRow = (line: string) => line !== '' && !line.startsWith(';');

const isKnownRow = (
  cells: Array<string>,
): cells is [PsaRecordType, ...Array<string>] => isRecordType(cells[0]);

// A PSA row is comma-separated but not CSV: values are never quoted, and a
// comma, backslash, quote, tab or line break inside a value is written as a
// backslash escape. An escape ProSpace does not write keeps its backslash.
const splitCells = (line: string): Array<string> => {
  const cells: Array<string> = [];
  const boundaries = /[,\\]/g;
  let parts: Array<string> = [];
  let start = 0;
  for (let boundary; (boundary = boundaries.exec(line));) {
    const index = boundary.index;
    parts.push(line.slice(start, index));
    if (boundary[0] === ',') {
      cells.push(parts.join(''));
      parts = [];
      start = index + 1;
    } else {
      parts.push(
        CHARACTER_BY_ESCAPE[line[index + 1] ?? ''] ??
          line.slice(index, index + 2),
      );
      start = Math.min(index + 2, line.length);
      boundaries.lastIndex = start;
    }
  }
  parts.push(line.slice(start));
  cells.push(parts.join(''));
  return cells;
};

const joinCells = (cells: ReadonlyArray<string>): string =>
  cells
    .map((cell) =>
      cell.replaceAll(
        ESCAPED_CHARACTERS,
        (character) => ESCAPE_BY_CHARACTER[character] ?? character,
      ),
    )
    .join(',');
