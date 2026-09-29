import { Schema as S, type Option } from 'effect';

import { VAZEN_KNOWN_KEYS_ONLY, VazenAttributes } from './vazen-attributes';
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
  dimensions: S.OptionFromSelf(VazenDimensions),
  equipment: S.Array(S.suspend((): S.Schema<VazenEquipment> => VazenEquipment)),
  position: S.OptionFromSelf(VazenPosition),
  sites: S.Array(VazenSite),
  sortOrder: S.OptionFromSelf(S.Finite),
  type: S.String,
}).annotations({ identifier: 'VazenEquipment', ...VAZEN_KNOWN_KEYS_ONLY });
