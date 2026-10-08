# Orientation

We regularly need to describe the orientation of a product on a shelf. If, on an
abstract level, a product can be thought of as a
[rectangular cuboid](https://en.wikipedia.org/wiki/Rectangular_cuboid) in 3d
space, then there are 24 ways to orient it - 6 possibilities for the face
oriented towards the viewer times 4 possibilities for the face oriented towards
the shelf (or floor).

## Orientation Names

Orientation naming is based on the names of the faces of the product cuboid, and
on the names of its rotations. The faces of the product cuboid are named from
the perspective of the viewer. The rotations are also named from the perspective
of the viewer. The orientation name is a **combination of the face name facing
the viewer, and a rotation value around the axis directed towards the viewer**
(applied on a _global_ axis).

### Vazen Names

We use the following names for the faces of the product cuboid, based on Rubik's
cube notation (such as to also get a unique 1-letter abbreviation):

- **F**ront (face usually facing the viewer)
- **B**ack (face on the opposite side)
- **L**eft (face on the left hand side from the perspective of the viewer)
- **R**ight (face on the right hand side from the perspective of the viewer)
- **U**p (face on the top of the product)
- **D**own (face on the bottom of the product)

We use the following names for the rotations around the axis oriented towards
the viewer:

- (empty) (or **d**own or **d**efault) - no rotation (product was left with the
  down side facing down)
- **l**eft - 90 degrees anti-clockwise when looking at the product (product was
  rotated onto its left side)
- **r**ight - 90 degrees clockwise when looking at the product (product was
  rotated onto its right side)
- **u**pside-down - 180 degree rotation when looking at the product (product was
  flipped upside-down)

This gives 24 combinations of 1-2-letter codes: **F**, **Fl**, **Fr**, **Fu**,
**B**, **Bl**, **Br**, **Bu**, **L**, **Ll**, **Lr**, **Lu**, **R**, **Rl**,
**Rr**, **Ru**, **U**, **Ul**, **Ur**, **Uu**, **D**, **Dl**, **Dr**, **Du**,
where the first uppercase letter indicates the face that is facing the viewer,
and the second lowercase letter indicates the side that the product was then
rotated onto.

### JDA Names

In JDA, the product faces are known as **Front**, **Back**, **Side**, **Right**,
**Top**, and **Bottom**. The rotation values are known as (empty), **90**,
**270**, and **180**. The rotations are clockwise rotation degree values from
the perspective of the viewer. No public source states that direction, and it
has not been checked in ProSpace.

The full name then looks like `Front|Side|Top|Back|Right|Base` + `|90|180|270`.

Here is the conversion table from JDA names to Vazen names:

| JDA Name | Vazen Name    |
| -------- | ------------- |
| Front    | F(ront)       |
| Back     | B(ack)        |
| Side     | L(eft)        |
| Right    | R(ight)       |
| Top      | U(p)          |
| Bottom   | D(own)        |
| (empty)  | (empty/down)  |
| 90       | r(ight)       |
| 180      | u(pside-down) |
| 270      | l(eft)        |

Additionally, JDA uses integers (`0-23`) to represent these orientations
internally (see psa's `PsaOrientationFromCode`), as well as the integer `-1`
which represents a "missing value" in certain circumstances.

## Overview Table

| JDA integer | JDA Name  | Vazen Name | Side Facing Viewer | Side Facing Down |
| ----------- | --------- | ---------- | ------------------ | ---------------- |
| `0`         | Front     | F          | Front              | Bottom           |
| `1`         | Front 90  | Fr         | Front              | Right            |
| `2`         | Side      | L          | Left               | Bottom           |
| `3`         | Side 90   | Lr         | Left               | Front            |
| `4`         | Top       | U          | Top                | Front            |
| `5`         | Top 90    | Ur         | Top                | Right            |
| `6`         | Back      | B          | Back               | Bottom           |
| `7`         | Back 90   | Br         | Back               | Left             |
| `8`         | Right     | R          | Right              | Bottom           |
| `9`         | Right 90  | Rr         | Right              | Back             |
| `10`        | Base      | D          | Bottom             | Back             |
| `11`        | Base 90   | Dr         | Bottom             | Right            |
| `12`        | Front 180 | Fu         | Front              | Top              |
| `13`        | Front 270 | Fl         | Front              | Left             |
| `14`        | Side 180  | Lu         | Left               | Top              |
| `15`        | Side 270  | Ll         | Left               | Back             |
| `16`        | Top 180   | Uu         | Top                | Back             |
| `17`        | Top 270   | Ul         | Top                | Left             |
| `18`        | Back 180  | Bu         | Back               | Top              |
| `19`        | Back 270  | Bl         | Back               | Right            |
| `20`        | Right 180 | Ru         | Right              | Top              |
| `21`        | Right 270 | Rl         | Right              | Front            |
| `22`        | Base 180  | Du         | Bottom             | Front            |
| `23`        | Base 270  | Dl         | Bottom             | Left             |

## Mathematics

### Axes

We follow the conventions of [three.js](https://threejs.org/) with the axes
being oriented thus:

```txt

     Y axis
        ^
        |
        |
        |
        o -----> X axis
       /
      /
     L
   Z axis

```

The X axis is positive towards the right of the screen. The Y axis is positive
towards the top of the screen. The Z axis is positive towards the viewer (coming
out of the screen).

### Extrinsic vs Intrinsic rotation

An extrinsic rotation is a rotation around one of the global coordinate system
axes which stay fixed after every rotation. An intrinsic rotation is a rotation
around the local coordinate system of an object and also rotates the other two
axes.

The first rotation is the same for an extrinsic and intrinsic rotation (because
initially the local axes match the global ones). The next rotations will usually
be different, because the local axes were rotated together with the object and
do not usually match the global axes any more.

You can think of an intrinsic rotation as a combination of "yaw", "pitch", and
"roll" from the perspective of the object. If you think of the object as an
airplane headed into the screen, then yaw is rotation the Y axis, pitch is
rotation around the X axis, and roll is rotation around the Z axis.

We follow the conventions of [three.js](https://threejs.org/) with rotations
always being **intrinsic** (i.e. from the perspective of the object).

### Angle Direction

We follow the conventions of [three.js](https://threejs.org/) with angles
defined according to the right-hand rule. A **positive** angle represents a
rotation that appears **clockwise** when looking in the _positive_ direction of
the axis, and a **negative** angle represents a rotation that appears
**counter-clockwise** when looking in the _positive_ direction of the axis.

Coming back to our airplane analogy:

- a rotation of 90 degrees around the Y axis is equivalent to a yaw turn to the
  left (counter-clockwise when looking from above, but clockwise when looking
  from below according to the direction of the Y axis)
- a rotation of -90 degrees around the Y axis is equivalent to a yaw turn to the
  right
- a rotation of 90 degrees around the X axis is equivalent to a pitch up towards
  the sky
- a rotation of -90 degrees around the X axis is equivalent to a pitch down
  towards the ground
- a rotation of 90 degrees around the Z axis is equivalent to a roll onto the
  left side (counter-clockwise as looking into the screen / airplane heading,
  but clockwise when looking the other way in the direction of the Z axis)
- a rotation of -90 degrees around the Z axis is equivalent to a roll onto the
  right side

### Euler Angles

We follow the conventions of
[three.js](https://threejs.org/docs/#api/en/math/Euler).

An Euler Angle is composed of 3 numbers and an optional string :
`[X, Y, Z, Order?]` where:

- `X` is the angle (in degrees) around the X axis
- `Y` is the angle (in degrees) around the Y axis
- `Z` is the angle (in degrees) around the Z axis
- `Order` is one of `XYZ`, `XZY`, `YXZ`, `YZX`, `ZXY`, `ZYX` representing the
  order these (intrinsic) rotations are applied in (with `XYZ` being the
  default).

An intrinsic rotation with angles `X, Y, Z` and axes order of `A1, A2, A3` can
be converted into an extrinsic rotation with angles `X, Y, Z` by reversing the
axes order to `A3, A2, A1`.

#### Example

For our example here we shall use degrees for convenience rather than radians
(as required by three.js).

For example, an intrinsic rotation of `[0, 90, 270, 'ZYX']` (i.e. rotate by 270
degrees around Z (local and global) axis, then rotate by 90 degrees around the
local Y axis [which is now pointing in the direction of the global X axis]) is
the same as an extrinsic rotation of `[0, 90, 270, 'XYZ']`, (i.e. first rotate
by 90 degrees around the global Y axis, then by 270 degrees around the global Z
axis). Both result in the `Lr` orientation (left side facing viewer, front side
facing shelf).

We can thus start by defining an extrinsic rotation (which is much easier to
visualise), and then reverse the axes order to convert it to an intrinsic
rotation as required by three.js.
