import { Schema as S } from 'effect';

import type { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import { TomlFromText } from './toml-from-text';
import type { VazenProject } from './vazen-project';
import {
  VazenProjectFromVazenTomlProject,
  vazenProjectReadFromVazenProject,
  writtenVazenTomlProject,
  type VazenProjectRead,
  type VazenVersion,
} from './vazen-project-from-vazen-toml-project';

/**
 * Reads a `.vazen.toml` file of any version `VazenVersion` lists, and writes
 * one as 0.3.0. `VazenProjectFromVazenTomlProject` reads and writes its tables.
 */
export const VazenProjectFromTomlText: S.Codec<VazenProject, string> =
  TomlFromText.pipe(S.decodeTo(VazenProjectFromVazenTomlProject)).annotate({
    identifier: 'VazenProjectFromTomlText',
  });

/**
 * Reads the text of a `.vazen.toml` file as its tables. Throws a `SchemaError`
 * saying what it could not read.
 */
export const decodeVazenProjectFromTomlFile = (
  text: string,
): VazenProjectRead =>
  vazenProjectReadFromVazenProject(
    S.decodeSync(VazenProjectFromTomlText)(text),
  );

/**
 * Writes a project's tables as the text of a `.vazen.toml` file. It writes
 * 0.3.0, unless `version` names another version `VazenVersion` lists. Throws a
 * `SchemaError` saying what it could not write.
 */
export const encodeTomlFileFromVazenProject = (
  options: Readonly<{
    project: VazenTomlProjectV0_3_0;
    version?: VazenVersion;
  }>,
): string => S.encodeSync(TomlFromText)(writtenVazenTomlProject(options));
