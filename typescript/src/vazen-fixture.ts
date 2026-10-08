import { Schema as S } from 'effect';

import { knownKeysOnly, VazenAttributes } from './vazen-attributes';
import { VazenEquipment } from './vazen-equipment';
import { VazenDimensions } from './vazen-geometry';

/**
 * A self-contained physical unit of shelving, such as one gondola or one end of
 * aisle. A layout requires `id` and `dimensions`; a layout engine assigns an
 * `id` to any fixture that arrives without one.
 */
export const VazenFixture = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.Option(VazenDimensions),
  equipment: S.Array(VazenEquipment),
  id: S.Option(S.String),
  name: S.Option(S.String),
  sortOrder: S.Option(S.Finite),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenFixture' });

export type VazenFixture = typeof VazenFixture.Type;
