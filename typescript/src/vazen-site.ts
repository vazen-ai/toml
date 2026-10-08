import { Record, Schema as S } from 'effect';

import { Orientation as VazenOrientation } from './orientation';
import { TomlKey } from './toml-from-text';
import {
  knownKeysOnly,
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
 * Names the product a site places: the product whose fields match every key
 * given. Any product key may be used, standard or descriptive, provided its
 * value is a scalar. That it resolves to exactly one product is a rule of the
 * whole file, which only a check holding the file can apply.
 */
export const VazenProductSelector = S.Record(S.String, VazenAttributeScalar)
  .check(S.isPropertyNames(TomlKey))
  .pipe(
    S.check(
      S.makeFilter((selector) => !Record.isEmptyReadonlyRecord(selector), {
        message: 'a product selector needs at least one field',
      }),
    ),
  )
  .annotate({ identifier: 'VazenProductSelector' });

export type VazenProductSelector = typeof VazenProductSelector.Type;

/**
 * A placement of one product on a piece of equipment, with facing counts and,
 * in a layout, a position and the space allocated to it. `dimensions` is never
 * smaller than the facings block and sometimes larger, so it is authoritative
 * for space where the facings are authoritative for count.
 */
export const VazenSite = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.Option(VazenDimensions),
  facings: S.Option(VazenFacings),
  orientation: S.Option(VazenOrientation),
  position: S.Option(VazenPosition),
  product: VazenProductSelector,
  sortOrder: S.Option(S.Finite),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenSite' });

export type VazenSite = typeof VazenSite.Type;
