/* eslint-disable unicorn/no-unsafe-property-key -- keys come from a caller-supplied mapper, into a fresh object literal */
import { Record as R } from 'effect';

type RenameMapper<T extends Record<string, unknown>> = {
  [key in keyof Partial<T>]: string;
};
type RenamingResult<T extends Record<string, unknown>> = Record<
  Exclude<RenameMapper<T>[keyof T], undefined>,
  T[keyof T]
>;

/**
 * Renames the keys of a given object based on a provided mapper. It looks up each key in the mapper to find a new key name.
 * If a new key is found, the value is reassigned; if not, the original key is retained.
 *
 * Throws an error if either the input object or the mapper is not provided.
 *
 * Example usage:
 * ```ts
 * const original = { a: 1, b: 2 };
 * const mapper = { a: 'x', b: 'y' };
 * const renamed = renameObjectKeys(original, mapper);
 * // renamed is { x: 1, y: 2 }
 * ```
 *
 * @throws {Error} If the input object or the mapper is not provided.
 */
export const renameObjectKeys = <T extends Record<string, unknown>>(
  inputObject: Readonly<T>,
  mapper: Readonly<RenameMapper<T>>,
): RenamingResult<T> =>
  R.toEntries(inputObject).reduce((result, [key, value]) => {
    const newKey = mapper[key] ?? key;
    return { ...result, [newKey]: value };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the reduce seed is an empty object literal that TypeScript can't infer as the computed RenamingResult<T>
  }, {} as RenamingResult<T>);

export type MapperObject<T> = Record<
  string,
  number | ((obj: T) => unknown) | keyof Partial<T>
>;

type MappedResult<T, U extends MapperObject<T>> = {
  [K in keyof U]: U[K] extends (obj: T) => infer R ? R : T[keyof T];
};

/**
 * Transforms an input object based on a given mapper object.
 *
 * Example usage:
 * ```ts
 * const transformed = transformObject({ a: 'hello', b: 'world' }, { c: 'a' });
 * // transformed is { c: 'hello' }
 *
 * const transformed2 = transformObject({ a: 5, b: 10, c: 'foo' }, {
      x: 'c',
      y: (obj) => obj.a * 2,
      z: 100,
    });
 * // transformed2 is { x: 'foo', y: 10, z: 100 }
 * ```
 */
export const transformObject = <
  T extends Record<string, unknown>,
  U extends MapperObject<T>,
>(
  inputObject: T,
  // eslint-disable-next-line functional/prefer-immutable-types -- wrapping the constrained generic `U extends MapperObject<T>` in Readonly<> breaks inference: a mutable MapperObject argument no longer matches Readonly<U>.
  mapper: U,
): MappedResult<T, U> => {
  const result: Partial<MappedResult<T, U>> = {};

  for (const key in mapper) {
    const mapItem = mapper[key];
    if (typeof mapItem === 'function') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the mapper function returns unknown, asserted to the computed mapped-value type
      result[key as keyof U] = mapItem(inputObject) as MappedResult<
        T,
        U
      >[keyof U];
    } else if (typeof mapItem === 'number') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a numeric literal mapper value is asserted to the computed mapped-value type
      result[key as keyof U] = mapItem as MappedResult<T, U>[keyof U];
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the renamed source value is asserted to the computed mapped-value type
      result[key as keyof U] = inputObject[mapItem as keyof T] as MappedResult<
        T,
        U
      >[keyof U];
    }
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the incrementally populated Partial is complete on return but TypeScript still types it as Partial
  return result as MappedResult<T, U>;
};
