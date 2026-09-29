import { Record, Schema as S } from 'effect';

import {
  VAZEN_KNOWN_KEYS_ONLY,
  VazenAttributes,
  VazenAttributeScalar,
} from './vazen-attributes';
import { VazenDimensions, VazenFacings, VazenPosition } from './vazen-geometry';

/**
 * What an omitted `orientation` or facing count means in a spec. A layout
 * writes every one.
 */
export const VAZEN_SITE_DEFAULTS = {
  facings: { deep: 1, high: 1, wide: 1 },
  orientation: 'F',
} as const satisfies {
  facings: Readonly<Record<keyof VazenFacings, number>>;
  orientation: VazenOrientation;
};

/**
 * The face of the product cuboid turned towards the shopper, and a twist of
 * that face as the shopper sees it. The capital letter is the face shown -
 * Front, Back, Left, Right, Up (the top), Down (the base) - and the lowercase
 * letter turns the top of that face to the shopper's left (`l`) or right (`r`),
 * or upside down (`u`). A cuboid has exactly these 24 distinct orientations.
 *
 * `"F"` is a front-facing upright product. It is the default in a spec, and is
 * written out like any other value in a layout.
 */
export const VazenOrientation = S.Literal(
  'F',
  'Fl',
  'Fr',
  'Fu',
  'B',
  'Bl',
  'Br',
  'Bu',
  'L',
  'Ll',
  'Lr',
  'Lu',
  'R',
  'Rl',
  'Rr',
  'Ru',
  'U',
  'Ul',
  'Ur',
  'Uu',
  'D',
  'Dl',
  'Dr',
  'Du',
).annotations({ identifier: 'VazenOrientation' });

export type VazenOrientation = typeof VazenOrientation.Type;

/**
 * Names the product a site places: the product whose fields match every key
 * given. Any product key may be used, standard or descriptive, provided its
 * value is a scalar. That it resolves to exactly one product is a rule of the
 * whole file, which only a check holding the file can apply.
 */
export const VazenProductSelector = S.Record({
  key: S.String,
  value: VazenAttributeScalar,
})
  .pipe(
    S.filter((selector) => !Record.isEmptyReadonlyRecord(selector), {
      message: () => 'a product selector needs at least one field',
    }),
  )
  .annotations({ identifier: 'VazenProductSelector' });

export type VazenProductSelector = typeof VazenProductSelector.Type;

/**
 * A placement of one product on a piece of equipment, with facing counts and,
 * in a layout, a position and the space allocated to it. `dimensions` is never
 * smaller than the facings block and sometimes larger, so it is authoritative
 * for space where the facings are authoritative for count.
 */
export const VazenSite = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.OptionFromSelf(VazenDimensions),
  facings: S.OptionFromSelf(VazenFacings),
  orientation: S.OptionFromSelf(VazenOrientation),
  position: S.OptionFromSelf(VazenPosition),
  product: VazenProductSelector,
  sortOrder: S.OptionFromSelf(S.Finite),
}).annotations({ identifier: 'VazenSite', ...VAZEN_KNOWN_KEYS_ONLY });

export type VazenSite = typeof VazenSite.Type;
