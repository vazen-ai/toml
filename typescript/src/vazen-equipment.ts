import { Schema as S, type Option } from 'effect';

import { knownKeysOnly, VazenAttributes } from './vazen-attributes';
import { VazenDimensions, VazenPosition } from './vazen-geometry';
import { VazenSite } from './vazen-site';

// Written out, because equipment holds further equipment and a type cannot be
// inferred from itself.
export type VazenEquipment = {
  readonly attributes: VazenAttributes;
  readonly dimensions: Option.Option<VazenDimensions>;
  readonly equipment: ReadonlyArray<VazenEquipment>;
  readonly position: Option.Option<VazenPosition>;
  readonly sites: ReadonlyArray<VazenSite>;
  readonly sortOrder: Option.Option<number>;
  readonly type: string;
};

/**
 * A part a fixture is built from, such as a bay, a shelf or a peg. The set of
 * types is open, so a consumer accepts values it does not recognise. Equipment
 * holds further equipment, and the sites where products are placed.
 */
export const VazenEquipment = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.Option(VazenDimensions),
  equipment: S.Array(S.suspend((): S.Codec<VazenEquipment> => VazenEquipment)),
  position: S.Option(VazenPosition),
  sites: S.Array(VazenSite),
  sortOrder: S.Option(S.Finite),
  type: S.String,
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenEquipment' });
