import { Schema as S } from 'effect';

import {
  encodePsaFileFromPsaData,
  PsaDataFromPsaBytes,
  PsaDataFromPsaText,
  type PsaVersion,
} from './psa';
import type { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import type { VazenProject } from './vazen-project';
import { VazenProjectFromPsaData } from './vazen-project-from-psa-data';
import {
  vazenProjectReadFromVazenProject,
  type VazenProjectRead,
} from './vazen-project-from-vazen-toml-project';
import { VazenProjectFromVazenTomlProjectV0_3_0 } from './vazen-project-from-vazen-toml-project-v0-3-0';

/**
 * Reads a PSA file of any version as a project, and writes a project as the
 * version of the PSA file it came from, or 2024.4.0 when it came from none or
 * from a version `PsaVersion` does not list.
 */
export const VazenProjectFromPsaText: S.Schema<VazenProject, string> =
  S.compose(PsaDataFromPsaText, VazenProjectFromPsaData).annotations({
    identifier: 'VazenProjectFromPsaText',
  });

/**
 * Reads a PSA file's bytes as a project, and writes them as
 * `VazenProjectFromPsaText` does.
 */
export const VazenProjectFromPsaBytes: S.Schema<VazenProject, Uint8Array> =
  S.compose(PsaDataFromPsaBytes, VazenProjectFromPsaData).annotations({
    identifier: 'VazenProjectFromPsaBytes',
  });

/**
 * Reads a PSA file's bytes as the tables of a 0.3.0 layout. Drops what the
 * records reader lists in `compromises`. Throws a `ParseError` saying what it
 * could not read.
 */
export const decodeVazenProjectFromPsaFile = (
  bytes: Uint8Array,
): VazenProjectRead =>
  vazenProjectReadFromVazenProject(
    S.decodeSync(VazenProjectFromPsaBytes)(bytes),
  );

/**
 * Writes a project's tables as a PSA file's bytes. It writes 2024.4.0, unless
 * `version` names another version `PsaVersion` lists. Throws a `ParseError`
 * saying what it could not write, such as a value in a column the version does
 * not have.
 */
export const encodePsaFileFromVazenProject = ({
  project,
  ...options
}: Readonly<{
  project: VazenTomlProjectV0_3_0;
  version?: PsaVersion;
}>): Uint8Array =>
  encodePsaFileFromPsaData({
    ...options,
    data: S.encodeSync(VazenProjectFromPsaData)(
      S.decodeSync(VazenProjectFromVazenTomlProjectV0_3_0)(project),
    ),
  });
