import { describe, expect, it } from 'vitest';

import {
  renameObjectKeys,
  transformObject,
  type MapperObject,
} from './object-transformer';

describe(renameObjectKeys, () => {
  it('should return the initial object if mapper is empty', () => {
    const inputObject = {
      bar: 2,
      foo: 1,
      foobar: 3,
    };

    const mapper = {};
    expect(renameObjectKeys(inputObject, mapper)).toMatchObject(inputObject);
  });

  it('should throw an error when the mapper is not passed', () => {
    const inputObject = {
      bar: 2,
      foo: 1,
      foobar: 3,
    };
    expect(() => {
      // @ts-expect-error will throw an error when mapper is not passed
      renameObjectKeys(inputObject);
    }).toThrow();
  });

  it('should throw an error when the inputObject is not passed', () => {
    const mapper = {};
    expect(() => {
      // @ts-expect-error will throw an error when inputObject is not passed
      renameObjectKeys(undefined, mapper);
    }).toThrow();
  });

  it('should return the initial object if the mapper keys do not match', () => {
    const inputObject = {
      bar: 2,
      foo: 1,
      foobar: 3,
    };

    const mapper = {
      a: 'b',
      b: 'c',
    };
    // @ts-expect-error will throw an error when mapper and inputObject keys dont match
    expect(renameObjectKeys(inputObject, mapper)).toMatchObject(inputObject);
  });

  it('should change the key names accordingly to the mapper object', () => {
    const inputObject = {
      bar: 2,
      foo: 1,
      foobar: 3,
    };

    const mapper = {
      bar: 'barbar',
      foo: 'foofoo',
    };

    const result = {
      barbar: 2,
      foobar: 3,
      foofoo: 1,
    };
    expect(renameObjectKeys(inputObject, mapper)).toMatchObject(result);
  });
});

describe(transformObject, () => {
  it('should correctly apply a function mapper', () => {
    type InputType = { a: number; b: number };
    const inputObject: InputType = { a: 1, b: 2 };
    const mapper: MapperObject<InputType> = { c: (obj) => obj.a + obj.b };
    const expected = { c: 3 };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should return fixed value from mapper', () => {
    type InputType = { a: number };
    const inputObject: InputType = { a: 1 };
    const mapper: MapperObject<InputType> = { b: 42 };
    const expected = { b: 42 };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should map a key from the input object', () => {
    type InputType = { a: string; b: string };
    const inputObject: InputType = { a: 'hello', b: 'world' };
    const mapper: MapperObject<InputType> = { c: 'a' };
    const expected = { c: 'hello' };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should correctly handle a mixed mapper', () => {
    type InputType = { a: number; b: number; c: string };
    const inputObject: InputType = { a: 5, b: 10, c: 'foo' };
    const mapper: MapperObject<InputType> = {
      x: 'c',
      y: (obj) => obj.a * 2,
      z: 100,
    };
    const expected = { x: 'foo', y: 10, z: 100 };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should handle an empty input object', () => {
    const inputObject = {};
    const mapper: MapperObject<typeof inputObject> = { a: 42 };
    const expected = { a: 42 };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should return an empty object when the mapper is empty', () => {
    type InputType = { a: number; b: number };
    const inputObject: InputType = { a: 1, b: 2 };
    const mapper: MapperObject<InputType> = {};
    const expected = {};
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should ignore invalid mapper keys', () => {
    type InputType = { a: number };
    const inputObject: InputType = { a: 1 };
    const mapper = { b: 'c' };
    const expected = { b: undefined };
    expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the test deliberately passes a mapper with a key absent from InputType, asserted to MapperObject to exercise invalid-key handling
      transformObject(inputObject, mapper as MapperObject<InputType>),
    ).toEqual(expected);
  });

  it('should preserve the types of mapped values', () => {
    type InputType = { a: string; b: number; c: boolean };
    const inputObject: InputType = { a: 'string', b: 123, c: true };
    const mapper: MapperObject<InputType> = { x: 'a', y: 'b', z: 'c' };
    const expected = { x: 'string', y: 123, z: true };
    expect(transformObject(inputObject, mapper)).toEqual(expected);
  });

  it('should not modify the input object', () => {
    type InputType = { a: number; b: number };
    const inputObject: InputType = { a: 1, b: 2 };
    const mapper: MapperObject<InputType> = { c: (obj) => obj.a + obj.b };
    transformObject(inputObject, mapper);
    expect(inputObject).toEqual({ a: 1, b: 2 });
  });
});
