import { Schema as S } from 'effect';

import { PsaFixture } from './psa-fixture';
import { PsaMessage } from './psa-messages';
import { PsaPerformance } from './psa-performance';
import { PsaPlanogram } from './psa-planogram';
import { PsaPosition } from './psa-position';
import { PsaProduct } from './psa-product';
import { PsaProject } from './psa-project';
import { PsaSegment } from './psa-segment';

const PsaFixtureSection = S.Struct({
  fixture: S.toType(PsaFixture),
  positions: S.Array(S.toType(PsaPosition)),
}).annotate({ identifier: 'PsaFixtureSection' });

const PsaPlanogramSection = S.Struct({
  fixtures: S.Array(PsaFixtureSection),
  performance: S.Array(S.toType(PsaPerformance)),
  planogram: S.toType(PsaPlanogram),
  segments: S.Array(S.toType(PsaSegment)),
}).annotate({ identifier: 'PsaPlanogramSection' });

/** A PSA file: its project, its products, then each planogram in turn. */
export const PsaData = S.Struct({
  /** Findings from reading the file; never written. */
  messages: S.Array(PsaMessage),

  planograms: S.Array(PsaPlanogramSection),
  products: S.Array(S.toType(PsaProduct)),
  project: S.toType(PsaProject),
  /**
   * The version the file declares, if it gives one. Writing writes this
   * version, or 2024.4.0 when there is none or `PsaVersion` does not list it.
   */
  declaredVersion: S.Option(S.String),
}).annotate({ identifier: 'PsaData' });
export type PsaData = typeof PsaData.Type;

export type PsaFixtureSection = typeof PsaFixtureSection.Type;
export type PsaPlanogramSection = typeof PsaPlanogramSection.Type;
