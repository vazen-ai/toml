import { Schema as S } from 'effect';

/**
 * A PSA orientation, as `PsaOrientationFromCode` names it, read as its
 * orientation. PSA's `side` is the product's left face. A `90` turns the top of
 * the shown face to the shopper's right, as Vazen's earlier converters did; no
 * public source states that direction, and it has not been checked in ProSpace.
 */
export const OrientationFromPsaOrientation = S.Literals([
  'front',
  'front_90',
  'front_180',
  'front_270',
  'back',
  'back_90',
  'back_180',
  'back_270',
  'side',
  'side_90',
  'side_180',
  'side_270',
  'right',
  'right_90',
  'right_180',
  'right_270',
  'top',
  'top_90',
  'top_180',
  'top_270',
  'base',
  'base_90',
  'base_180',
  'base_270',
])
  .transform([
    'F',
    'Fr',
    'Fu',
    'Fl',
    'B',
    'Br',
    'Bu',
    'Bl',
    'L',
    'Lr',
    'Lu',
    'Ll',
    'R',
    'Rr',
    'Ru',
    'Rl',
    'U',
    'Ur',
    'Uu',
    'Ul',
    'D',
    'Dr',
    'Du',
    'Dl',
  ])
  .annotate({ identifier: 'OrientationFromPsaOrientation' });
