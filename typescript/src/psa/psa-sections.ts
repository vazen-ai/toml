import { Schema as S } from 'effect';

import { PsaFixture } from './psa-fixture';
import { PsaMessage } from './psa-messages';
import { PsaPerformance } from './psa-performance';
import { PsaPlanogram } from './psa-planogram';
import { PsaPosition } from './psa-position';
import { PsaProduct } from './psa-product';
import { PsaProject } from './psa-project';
import { PsaSegment } from './psa-segment';

/**
 * A planogram and the records after it, up to the next, in the file's order.
 */
const PsaPlanogramRecords = S.Struct({
  planogram: S.toType(PsaPlanogram),
  records: S.Array(
    S.Union([
      S.toType(PsaFixture),
      S.toType(PsaPerformance),
      S.toType(PsaPosition),
      S.toType(PsaSegment),
    ]),
  ),
}).annotate({ identifier: 'PsaPlanogramRecords' });

/** A file's project, its products, and each planogram with its records. */
export const PsaSections = S.Struct({
  declaredVersion: S.Option(S.String),
  messages: S.Array(PsaMessage),
  planograms: S.Array(PsaPlanogramRecords),
  products: S.Array(S.toType(PsaProduct)),
  project: S.toType(PsaProject),
}).annotate({ identifier: 'PsaSections' });
export type PsaSections = typeof PsaSections.Type;
