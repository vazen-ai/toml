import { Schema as S } from 'effect';

import { PsaFixture } from './psa-fixture';
import { PsaMessage } from './psa-messages';
import { PsaPerformance } from './psa-performance';
import { PsaPlanogram } from './psa-planogram';
import { PsaPosition } from './psa-position';
import { PsaProduct } from './psa-product';
import { PsaProject } from './psa-project';
import { PsaSegment } from './psa-segment';

/** A row read by its type's columns. */
export const PsaRecord = S.Union([
  S.toType(PsaFixture),
  S.toType(PsaPerformance),
  S.toType(PsaPlanogram),
  S.toType(PsaPosition),
  S.toType(PsaProduct),
  S.toType(PsaProject),
  S.toType(PsaSegment),
]).annotate({ identifier: 'PsaRecord' });
export type PsaRecord = typeof PsaRecord.Type;

/**
 * The version a file declares, its records in the file's order, and what
 * reading them gave up.
 */
export const PsaRecords = S.Struct({
  declaredVersion: S.Option(S.String),
  messages: S.Array(PsaMessage),
  records: S.Array(PsaRecord),
}).annotate({ identifier: 'PsaRecords' });
export type PsaRecords = typeof PsaRecords.Type;

/** Whether a record is of one of the given types. */
export const hasPsaTag =
  <Tag extends PsaRecord['_tag']>(...tags: ReadonlyArray<Tag>) =>
  (record: PsaRecord): record is Extract<PsaRecord, { readonly _tag: Tag }> => {
    const types: ReadonlyArray<PsaRecord['_tag']> = tags;
    return types.includes(record._tag);
  };
