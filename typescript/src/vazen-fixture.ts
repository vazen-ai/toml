import { Schema as S } from 'effect';

import { VAZEN_KNOWN_KEYS_ONLY, VazenAttributes } from './vazen-attributes';
import { VazenEquipment } from './vazen-equipment';
import { VazenDimensions } from './vazen-geometry';

/**
 * A self-contained physical unit of shelving, such as one gondola or one end of
 * aisle. A layout requires `id` and `dimensions`; a layout engine assigns an
 * `id` to any fixture that arrives without one.
 */
export const VazenFixture = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.OptionFromSelf(VazenDimensions),
  equipment: S.Array(VazenEquipment),
  id: S.OptionFromSelf(S.String),
  name: S.OptionFromSelf(S.String),
  sortOrder: S.OptionFromSelf(S.Finite),
}).annotations({ identifier: 'VazenFixture', ...VAZEN_KNOWN_KEYS_ONLY });

export type VazenFixture = typeof VazenFixture.Type;
