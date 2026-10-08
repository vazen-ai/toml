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
export const VazenProjectFromPsaText: S.Codec<VazenProject, string> =
  PsaDataFromPsaText.pipe(S.decodeTo(VazenProjectFromPsaData)).annotate({
    identifier: 'VazenProjectFromPsaText',
  });

/**
 * Reads a PSA file's bytes as a project, and writes them as
 * `VazenProjectFromPsaText` does.
 */
export const VazenProjectFromPsaBytes: S.Codec<VazenProject, Uint8Array> =
  PsaDataFromPsaBytes.pipe(S.decodeTo(VazenProjectFromPsaData)).annotate({
    identifier: 'VazenProjectFromPsaBytes',
  });

/**
 * Reads a PSA file's bytes as the tables of a 0.3.0 layout, with losses and
 * uncertain interpretations in `messages`. Throws a `SchemaError`
 * when it cannot produce a project satisfying the schema.
 */
export const decodeVazenProjectFromPsaFile = (
  bytes: Uint8Array,
): VazenProjectRead =>
  vazenProjectReadFromVazenProject(
    S.decodeSync(VazenProjectFromPsaBytes)(bytes),
  );

/**
 * Writes a project's tables as a PSA file's bytes. It writes 2024.4.0, unless
 * `version` names another version `PsaVersion` lists. Throws a `SchemaError`
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
