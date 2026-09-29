import { Schema as S } from 'effect';

import { TomlTable } from './toml-from-text';
import { VAZEN_KNOWN_KEYS_ONLY, VazenAttributes } from './vazen-attributes';
import { VazenDimensions } from './vazen-geometry';

const GTIN_PATTERN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

/**
 * A string of 8, 12, 13 or 14 digits. Not required to be unique within a file:
 * a shelf test can hold two variants of one GTIN.
 */
export const VazenGtin = S.String.pipe(S.pattern(GTIN_PATTERN)).annotations({
  identifier: 'VazenGtin',
});

export type VazenGtin = typeof VazenGtin.Type;

/**
 * An image of one product face, shown head-on and upright: its URL, and
 * whatever else its producer gives it, such as `crop = { x = 200 }`, which the
 * specification leaves to them.
 */
export const VazenProductImage = S.Struct({
  attributes: TomlTable,
  url: S.String,
}).annotations({ identifier: 'VazenProductImage', ...VAZEN_KNOWN_KEYS_ONLY });

export type VazenProductImage = typeof VazenProductImage.Type;

/** Images keyed by the face they show, named as under Orientation. */
export const VazenProductImages = S.Struct({
  back: S.OptionFromSelf(VazenProductImage),
  base: S.OptionFromSelf(VazenProductImage),
  front: S.OptionFromSelf(VazenProductImage),
  top: S.OptionFromSelf(VazenProductImage),
  right: S.OptionFromSelf(VazenProductImage),
  left: S.OptionFromSelf(VazenProductImage),
}).annotations({ identifier: 'VazenProductImages', ...VAZEN_KNOWN_KEYS_ONLY });

export type VazenProductImages = typeof VazenProductImages.Type;

/**
 * Something that can be placed: defined once, referenced from any number of
 * sites. A packaging level such as a tray, case or display is its own
 * self-describing product, not a relation to the unit inside it. A layout
 * requires `ref`, and `dimensions` for a product a site selects. A file's
 * `description` is kept in `attributes`, with the keys the specification does
 * not define.
 */
export const VazenProduct = S.Struct({
  attributes: VazenAttributes,
  dimensions: S.OptionFromSelf(VazenDimensions),
  form: S.OptionFromSelf(S.String),
  gtin: S.OptionFromSelf(VazenGtin),
  images: S.OptionFromSelf(VazenProductImages),
  name: S.String,
  ref: S.OptionFromSelf(S.String),
}).annotations({ identifier: 'VazenProduct', ...VAZEN_KNOWN_KEYS_ONLY });

export type VazenProduct = typeof VazenProduct.Type;
