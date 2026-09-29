import { Option, pipe, Schema as S } from 'effect';

import type { PsaData } from './psa-data';
import { PsaDataFromPsaSections } from './psa-data-from-psa-sections';
import { PsaLinesFromText } from './psa-lines-from-text';
import type { PsaRecord } from './psa-records';
import {
  PsaRecordsFromPsaRows,
  psaVersionHolds,
} from './psa-records-from-psa-rows';
import { PsaRowsFromPsaLines } from './psa-rows-from-psa-lines';
import { PsaSectionsFromPsaRecords } from './psa-sections-from-psa-records';
import { PsaVersion } from './psa-versions';
import { TextFromBytes } from './text-from-bytes';

// Each schema of the chain, and each file function, is typed by name: an
// inferred type would spell out every stage's records, making the package's
// declarations megabytes long.

/**
 * Reads a PSA file of any version, and writes it as the version its data
 * declares, 2024.4.0 when it declares none or one `PsaVersion` does not list.
 */
export const PsaDataFromPsaText: S.Schema<PsaData, string> = pipe(
  PsaLinesFromText,
  S.compose(PsaRowsFromPsaLines),
  S.compose(PsaRecordsFromPsaRows),
  S.compose(PsaSectionsFromPsaRecords),
  S.compose(PsaDataFromPsaSections),
).annotations({ identifier: 'PsaDataFromPsaText' });

/** Reads a PSA file's bytes, and writes them as `PsaDataFromPsaText` does. */
export const PsaDataFromPsaBytes: S.Schema<PsaData, Uint8Array> = pipe(
  TextFromBytes,
  S.compose(PsaDataFromPsaText),
).annotations({ identifier: 'PsaDataFromPsaBytes' });

/**
 * Reads a PSA file's bytes as its records. Throws a `ParseError` saying what it
 * could not read.
 */
export const decodePsaDataFromPsaFile: (bytes: Uint8Array) => PsaData =
  S.decodeSync(PsaDataFromPsaBytes);

/**
 * Writes PSA data as a file's bytes: the version given, else the version the
 * data declares when `PsaVersion` lists it and its rows hold every value, else
 * 2024.4.0. Throws a `ParseError` saying what it could not write, such as a
 * value in a column the version given does not have.
 */
export const encodePsaFileFromPsaData = ({
  data,
  version,
}: Readonly<{ data: PsaData; version?: PsaVersion }>): Uint8Array =>
  S.encodeSync(PsaDataFromPsaBytes)({
    ...data,
    declaredVersion: Option.orElse(Option.fromNullable(version), () =>
      Option.filter(
        data.declaredVersion,
        (declared) =>
          S.is(PsaVersion)(declared) &&
          psaVersionHolds({ records: recordsOf(data), version: declared }),
      ),
    ),
  });

// Every record of the data, in the order a file holds them.
const recordsOf = (data: PsaData): ReadonlyArray<PsaRecord> => [
  data.project,
  ...data.products,
  ...data.planograms.flatMap(
    ({ fixtures, performance, planogram, segments }) => [
      planogram,
      ...segments,
      ...performance,
      ...fixtures.flatMap(({ fixture, positions }) => [fixture, ...positions]),
    ],
  ),
];
