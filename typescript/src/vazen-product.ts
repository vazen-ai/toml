import { Schema as S } from 'effect';

import { TomlTable } from './toml-from-text';
import { knownKeysOnly, VazenAttributes } from './vazen-attributes';
import { VazenDimensions } from './vazen-geometry';

const GTIN_PATTERN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

/**
 * A string of 8, 12, 13 or 14 digits. Not required to be unique within a file:
 * a shelf test can hold two variants of one GTIN.
 */
export const VazenGtin = S.String.pipe(
  S.check(S.isPattern(GTIN_PATTERN)),
).annotate({
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
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenProductImage' });

export type VazenProductImage = typeof VazenProductImage.Type;

/** Images keyed by the face they show, named as under Orientation. */
export const VazenProductImages = S.Struct({
  back: S.Option(VazenProductImage),
  base: S.Option(VazenProductImage),
  front: S.Option(VazenProductImage),
  top: S.Option(VazenProductImage),
  right: S.Option(VazenProductImage),
  left: S.Option(VazenProductImage),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenProductImages' });

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
  dimensions: S.Option(VazenDimensions),
  form: S.Option(S.String),
  gtin: S.Option(VazenGtin),
  images: S.Option(VazenProductImages),
  name: S.String,
  ref: S.Option(S.String),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenProduct' });

export type VazenProduct = typeof VazenProduct.Type;
