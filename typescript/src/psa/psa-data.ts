import { Schema as S } from 'effect';

import { PsaCompromise } from './psa-compromises';
import { PsaFixture } from './psa-fixture';
import { PsaPerformance } from './psa-performance';
import { PsaPlanogram } from './psa-planogram';
import { PsaPosition } from './psa-position';
import { PsaProduct } from './psa-product';
import { PsaProject } from './psa-project';
import { PsaSegment } from './psa-segment';

const PsaFixtureSection = S.Struct({
  fixture: S.typeSchema(PsaFixture),
  positions: S.Array(S.typeSchema(PsaPosition)),
}).annotations({ identifier: 'PsaFixtureSection' });

const PsaPlanogramSection = S.Struct({
  fixtures: S.Array(PsaFixtureSection),
  performance: S.Array(S.typeSchema(PsaPerformance)),
  planogram: S.typeSchema(PsaPlanogram),
  segments: S.Array(S.typeSchema(PsaSegment)),
}).annotations({ identifier: 'PsaPlanogramSection' });

/** A PSA file: its project, its products, then each planogram in turn. */
export const PsaData = S.Struct({
  /** What reading the file gave up; never written. */
  compromises: S.Array(PsaCompromise),
  planograms: S.Array(PsaPlanogramSection),
  products: S.Array(S.typeSchema(PsaProduct)),
  project: S.typeSchema(PsaProject),
  /**
   * The version the file declares, if it gives one. Writing writes this
   * version, or 2024.4.0 when there is none or `PsaVersion` does not list it.
   */
  declaredVersion: S.OptionFromSelf(S.String),
}).annotations({ identifier: 'PsaData' });
export type PsaData = typeof PsaData.Type;

export type PsaFixtureSection = typeof PsaFixtureSection.Type;
export type PsaPlanogramSection = typeof PsaPlanogramSection.Type;
