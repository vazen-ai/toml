import { Option } from 'effect';

import { PSA_PROJECT_DEFAULTS, type PsaProject } from './psa-project';

// A metric file holds lengths in centimetres, an imperial one in inches.
const MILLIMETRES_PER_CENTIMETRE = 10;
const MILLIMETRES_PER_INCH = 25.4;
// A double holds fifteen significant digits exactly, so keeping that many
// drops the noise of multiplying or dividing by the factor,
// `218.00000000000003` and `134.90000000000002`, and nothing else. Both
// directions keep the same digits, so a length survives a trip either way.
const SIGNIFICANT_DIGITS = 15;

const millimetresPerPsaUnit = (
  measurement: PsaProject['measurement'],
): number =>
  Option.getOrElse(measurement, () => PSA_PROJECT_DEFAULTS.measurement) ===
  'imperial'
    ? MILLIMETRES_PER_INCH
    : MILLIMETRES_PER_CENTIMETRE;

/**
 * A length in millimetres from one in the file's unit, by the Project's
 * `measurement`. Only the noise of the multiplication is dropped, so
 * `21.8 * 10` is `218`.
 */
export const makeMillimetresFromPsaLength = (
  measurement: PsaProject['measurement'],
): ((length: number) => number) => {
  const factor = millimetresPerPsaUnit(measurement);
  return (length) => Number((length * factor).toPrecision(SIGNIFICANT_DIGITS));
};

/**
 * A length in the file's unit from millimetres, by the Project's
 * `measurement`. Not rounded to the two decimals real files write, so a
 * length made in Studio is written whole and a length read from a file is
 * written back as it was.
 */
export const makePsaLengthFromMillimetres = (
  measurement: PsaProject['measurement'],
): ((millimetres: number) => number) => {
  const factor = millimetresPerPsaUnit(measurement);
  return (millimetres) =>
    Number((millimetres / factor).toPrecision(SIGNIFICANT_DIGITS));
};
