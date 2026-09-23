import { Predicate, Record as R } from 'effect';

export const FOUR_NINES = 9999;
export const FIVE_NINES = 99_999;
export const SIX_NINES = 999_999;
export const SEVEN_NINES = 9_999_999;
export const EIGHT_NINES = 99_999_999;
export const TEN_NINES = 999_999_999_999;

export type Result<T> =
  { isValid: false; message: string } | { isValid: true; value: T };

type BaseColumn<T> = {
  defaultValue?: T | undefined;
  name: string;
  processValue: (value: unknown) => string;
};

type FixedValueColumn<T extends number | string> = {
  value: T;
} & BaseColumn<T>;

type BooleanColumn = BaseColumn<boolean>;

type RegularColumn<T> = {
  value?: T;
} & BaseColumn<T>;

type EnumColumn<T extends number | string> = {
  options: Array<T>;
  value?: T;
} & BaseColumn<T>;

export type Column =
  | BooleanColumn
  | EnumColumn<number | string>
  | FixedValueColumn<number | string>
  | RegularColumn<number>
  | RegularColumn<string>;

export type PsaDefinition<T extends Array<Column>> = {
  [key in T[number]['name'] as Uncapitalize<key>]: number | string;
};

const getCaseInsensitiveValue = <T>(
  obj: Readonly<Record<string, T>>,
  key: string,
): T | undefined => {
  const lowerCaseKey = key.toLowerCase();
  return R.toEntries(obj).find(([k]) => k.toLowerCase() === lowerCaseKey)?.[1];
};

/**
 * Creates a column specifically for handling boolean values.
 *
 * Example usage:
 * ```ts
 * const drawBackColumn = createBooleanColumn({ name: 'DrawBack', defaultValue: true })
 * ```
 * */

export const createBooleanColumn = ({
  defaultValue = false,
  name,
}: Readonly<{ defaultValue?: boolean; name: string }>): BooleanColumn => ({
  defaultValue,
  name,
  processValue: (value: unknown) => {
    const validValue = typeof value === 'boolean' ? value : defaultValue;
    return validValue ? 'Yes' : 'No';
  },
});

/**
 * Creates a column with a fixed value. The value of this column cannot be changed once set.
 *
 * Example usage:
 * ```ts
 * const typeColumn = createFixedValueColumn({ name: 'Type', value: 'Position' });
 * ```
 */

export const createFixedValueColumn = <T extends number | string>({
  name,
  value,
}: Readonly<{ name: string; value: T }>): FixedValueColumn<T> => ({
  name,
  processValue: () => String(value),
  value,
});

/**
 * Creates a column that handles string values.
 *
 * Example usage:
 * ```ts
 * const nameColumn = createStringColumn({ name: 'name', maxLength: 50 });
 * ```
 */
export const createStringColumn = ({
  defaultValue,
  maxLength,
  name,
}: Readonly<{
  defaultValue?: string;
  maxLength: number;
  name: string;
}>): RegularColumn<string> => ({
  defaultValue,

  name,
  processValue: (value: unknown) => {
    if (typeof value === 'string' && value.length <= maxLength) {
      return value;
    }
    return Predicate.isNotUndefined(defaultValue) ? defaultValue : '';
  },
});

/**
 * Creates a column that handles integer values.
 *
 * Example usage:
 * ```ts
 * const pegSpan = createIntegerColumn({ name: 'PegSpan', min: 0, max: 10, defaultValue: 0 });
 * ```
 */
export const createIntegerColumn = ({
  defaultValue,
  max,
  min,
  name,
}: Readonly<{
  defaultValue?: number;
  max: number;
  min: number;
  name: string;
}>): RegularColumn<number> => ({
  defaultValue,
  name,
  processValue: (value: unknown) => {
    const numValue = Number(value);
    if (Number.isInteger(numValue) && numValue >= min && numValue <= max) {
      return String(numValue);
    }
    return Predicate.isNotUndefined(defaultValue) ? String(defaultValue) : '';
  },
});

/**
 * Creates an EnumColumn. The 'enum' parameter should be a TypeScript enum.
 *
 * Example usage:
 * ```ts
 * enum FixtureType {
 *   Shelf = 0,
 *   Chest = 1,
 * }
 *
 * const statusColumn = createEnumColumn({
    name: 'Type',
    enum: FixtureType,
    defaultValue: FixtureType.Shelf,
  });
 * ```
 */
export const createEnumColumn = <T extends number | string>({
  defaultValue,
  enum: enumObject,
  name,
}: Readonly<{
  defaultValue?: T;
  enum: Record<string, T>;
  name: string;
}>): EnumColumn<T> => {
  const options = Object.values(enumObject).filter(
    (v) => typeof v === 'string' || typeof v === 'number',
  );

  return {
    defaultValue,
    name,
    options,
    processValue: (value: unknown) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime value is unknown and asserted to the enum member type T to test membership before stringifying
      if (options.includes(value as T)) {
        return String(value);
      }
      return Predicate.isNotUndefined(defaultValue) ? String(defaultValue) : '';
    },
  };
};

/**
 * Creates a column specifically for handling flag values, which are binary (0 or 1).
 *
 * Example usage:
 * ```ts
 * const flagColumn = createFlagColumn({ name: 'Flag1', defaultValue: 0 });
 * ```
 */
export const createFlagColumn = ({
  defaultValue,
  name,
}: Readonly<{ defaultValue: 0 | 1; name: string }>): RegularColumn<number> => ({
  defaultValue,
  name,
  processValue: (value: unknown) => {
    const numValue = Number(value);
    if ([0, 1].includes(numValue)) {
      return String(numValue);
    }
    return String(defaultValue);
  },
});

/**
 * Creates a column for handling floating-point numbers with customizable precision and value range.
 *
 * Example usage:
 * ```ts
 * const priceColumn = createFloatColumn({
 *   name: 'Price',
 *   defaultValue: 0,
 *   min: -1,
 *   max: 9999999,
 * });
 * ```
 */
export const createFloatColumn = ({
  defaultValue,
  max,
  min,
  name,
  precision = 2,
}: Readonly<{
  defaultValue?: number;
  max?: number;
  min?: number;
  name: string;
  precision?: number;
}>): RegularColumn<number> => ({
  defaultValue,
  name,
  processValue: (value: unknown) => {
    const numValue = Number(value);
    const roundedValue = Number(numValue.toFixed(precision));
    if (
      (Predicate.isUndefined(min) || roundedValue >= min) &&
      (Predicate.isUndefined(max) || roundedValue <= max)
    ) {
      return roundedValue.toFixed(precision);
    }
    return Predicate.isNotUndefined(defaultValue) ? String(defaultValue) : '';
  },
});

/**
 * Converts a data record into an array of strings based on the provided columns.
 *
 * Example usage:
 * ```ts
 * const typeColumn = createFixedValueColumn({ name: 'Type', value: 'Project' })
 * const nameColumn = createStringColumn({
 *   name: 'Name',
 *   defaultValue: 'Project exported from Vazen',
 *   maxLength: 100,
 * })
 * const row = toPsaRow(someData, [typeColumn, nameColumn]);
 * ```
 */
export const toPsaRow = (
  data: Record<string, unknown>,
  columns: Array<Column>,
): Array<string> =>
  columns.map((column) => {
    const value = getCaseInsensitiveValue(data, column.name);
    return column.processValue(value);
  });
