export const MEASURE_DIVISOR_METRIC = 10;
export const MEASURE_DIVISOR_IMPERIAL = 25.4;
export const convertMeasurementsBy =
  (divisor: number) =>
  (value: unknown): number =>
    typeof value === 'number' ? value / divisor : Number(value);
