import { Schema as S } from 'effect';

import { PsaRecordType } from './psa-versions';

// `rows` counts the rows of `type` in the file's order, from 1.
const UnlistedWidth = S.TaggedStruct('UnlistedWidth', {
  rows: S.Array(S.Number),
  type: PsaRecordType,
  width: S.Number,
});
const DroppedCells = S.TaggedStruct('DroppedCells', {
  rows: S.Array(S.Number),
  type: PsaRecordType,
});
const UnreadCells = S.TaggedStruct('UnreadCells', {
  column: S.String,
  rows: S.Array(S.Number),
  type: PsaRecordType,
});
const IgnoredRows = S.TaggedStruct('IgnoredRows', {
  rows: S.Array(S.Number),
  type: PsaRecordType,
});

/**
 * Findings from reading a PSA file:
 *
 * - `UnlistedWidth`: rows with a number of cells no listed version gives their
 *   type, read by position, so their values may be in the wrong columns.
 * - `DroppedCells`: values in cells past a row's last column, dropped.
 * - `UnreadCells`: cells their column cannot read, read as empty.
 * - `IgnoredRows`: rows with no place in `PsaData`, such as positions before
 *   any fixture in their planogram, ignored.
 */
export const PsaMessage = S.Union([
  UnlistedWidth,
  DroppedCells,
  UnreadCells,
  IgnoredRows,
]).annotate({ identifier: 'PsaMessage' });
export type PsaMessage = typeof PsaMessage.Type;
