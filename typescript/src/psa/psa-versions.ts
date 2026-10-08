import { Record, Schema as S } from 'effect';

/**
 * The versions a file can be written as, each with its rows' cells after the
 * type, by record type. ProSpace only ever appends columns, so each record
 * schema reads a file of any version. Every count was read off real files of
 * that version in Vazen's PSA corpus (README.md). ProSpace's field definitions
 * list one column more in every type, custom data, which no real file has.
 */
// prettier-ignore
export const PSA_VERSION_COLUMN_COUNTS = {
  '2017.1.0': { Fixture: 166, Performance: 149, Planogram: 262, Position: 166, Product: 273, Project: 215, Segment: 51 },
  '2017.2.0': { Fixture: 166, Performance: 149, Planogram: 262, Position: 166, Product: 273, Project: 215, Segment: 51 },
  '2019.1.0': { Fixture: 166, Performance: 150, Planogram: 264, Position: 166, Product: 273, Project: 215, Segment: 51 },
  '2019.1.1': { Fixture: 166, Performance: 150, Planogram: 264, Position: 166, Product: 273, Project: 215, Segment: 51 },
  '2020.1.0': { Fixture: 166, Performance: 153, Planogram: 271, Position: 166, Product: 274, Project: 217, Segment: 51 },
  '2020.1.1': { Fixture: 166, Performance: 153, Planogram: 271, Position: 166, Product: 274, Project: 217, Segment: 51 },
  '2021.1.2': { Fixture: 169, Performance: 153, Planogram: 271, Position: 166, Product: 274, Project: 217, Segment: 51 },
  '2023.1.0': { Fixture: 169, Performance: 153, Planogram: 271, Position: 166, Product: 274, Project: 217, Segment: 51 },
  '2024.1.0': { Fixture: 169, Performance: 153, Planogram: 271, Position: 166, Product: 274, Project: 217, Segment: 51 },
  '2024.4.0': { Fixture: 169, Performance: 176, Planogram: 288, Position: 166, Product: 326, Project: 217, Segment: 51 },
} as const;

/** The version written when the data declares none, or one not listed here. */
export const PSA_DEFAULT_WRITTEN_VERSION: PsaVersion = '2024.4.0';

/**
 * A PSA record type this package reads; a row of any other type is kept as it
 * is.
 */
export const PsaRecordType = S.Literals(
  Record.keys(PSA_VERSION_COLUMN_COUNTS['2017.1.0']),
);
export type PsaRecordType = typeof PsaRecordType.Type;

/** A version a file can be written as. */
export const PsaVersion = S.Literals(
  Record.keys(PSA_VERSION_COLUMN_COUNTS),
).annotate({ identifier: 'PsaVersion' });
export type PsaVersion = typeof PsaVersion.Type;
