import { Schema as S } from 'effect';

import { PsaCompromise } from './psa-compromises';
import { PsaFixture } from './psa-fixture';
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
  planogram: S.typeSchema(PsaPlanogram),
  records: S.Array(
    S.Union(
      S.typeSchema(PsaFixture),
      S.typeSchema(PsaPerformance),
      S.typeSchema(PsaPosition),
      S.typeSchema(PsaSegment),
    ),
  ),
}).annotations({ identifier: 'PsaPlanogramRecords' });

/** A file's project, its products, and each planogram with its records. */
export const PsaSections = S.Struct({
  compromises: S.Array(PsaCompromise),
  declaredVersion: S.OptionFromSelf(S.String),
  planograms: S.Array(PsaPlanogramRecords),
  products: S.Array(S.typeSchema(PsaProduct)),
  project: S.typeSchema(PsaProject),
}).annotations({ identifier: 'PsaSections' });
export type PsaSections = typeof PsaSections.Type;
