import { Schema as S } from 'effect';

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
// prettier-ignore
export const Orientation = S.Literals(['B', 'Bl', 'Br', 'Bu', 'D', 'Dl', 'Dr', 'Du', 'F', 'Fl', 'Fr', 'Fu', 'L', 'Ll', 'Lr', 'Lu', 'R', 'Rl', 'Rr', 'Ru', 'U', 'Ul', 'Ur', 'Uu']).annotate({ identifier: 'Orientation' });

export type Orientation = typeof Orientation.Type;
