import { Schema as S } from 'effect';

import { knownKeysOnly } from './vazen-attributes';

/**
 * A point in the fixture's frame, in millimetres. Every position is absolute,
 * measured from a single origin at the fixture's front-bottom-left corner: `x`
 * runs to the shopper's right, `y` up, `z` away from them into the fixture.
 */
export const VazenPosition = S.Struct({
  x: S.Finite,
  y: S.Finite,
  z: S.Finite,
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenPosition' });

export type VazenPosition = typeof VazenPosition.Type;

/**
 * A bounding box in millimetres, including the physical element itself: a
 * shelf's box spans from beneath its steel up to the space it governs. The
 * specification requires every dimension to be above zero, a spatial rule that
 * reading does not check.
 */
export const VazenDimensions = S.Struct({
  width: S.Finite,
  height: S.Finite,
  depth: S.Finite,
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenDimensions' });

export type VazenDimensions = typeof VazenDimensions.Type;

/**
 * How many facings a site places across, up and back. A count may be
 * fractional, and in a spec may be omitted for its default of 1.
 */
export const VazenFacings = S.Struct({
  deep: S.Option(S.Finite),
  high: S.Option(S.Finite),
  wide: S.Option(S.Finite),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenFacings' });

export type VazenFacings = typeof VazenFacings.Type;
