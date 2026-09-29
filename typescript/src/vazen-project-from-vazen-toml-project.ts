import { Either, Option, ParseResult, pipe, Record, Schema as S } from 'effect';

import type { VazenTomlProjectV0_3_0 } from './specification/vazen-toml-project-v0-3-0';
import { VazenProject } from './vazen-project';
import { VazenProjectFromVazenTomlProjectV0_3_0 } from './vazen-project-from-vazen-toml-project-v0-3-0';

// Each version's tables, by the `schema_version` a file declares.
const VAZEN_PROJECT_FROM_VAZEN_TOML_PROJECT_BY_VERSION = {
  '0.3.0': VazenProjectFromVazenTomlProjectV0_3_0,
} as const;

// The version written when no other is given.
const DEFAULT_WRITTEN_VERSION = '0.3.0' satisfies VazenVersion;

/** A version of the specification a file can be read and written as. */
export const VazenVersion = S.Literal(
  ...Record.keys(VAZEN_PROJECT_FROM_VAZEN_TOML_PROJECT_BY_VERSION),
).annotations({ identifier: 'VazenVersion' });

export type VazenVersion = typeof VazenVersion.Type;

/**
 * What a file function returns: the project as the tables of a 0.3.0 file,
 * whatever the file's format, and beside them the source, the file the project
 * came from. A writer does not write the source.
 */
export type VazenProjectRead = Readonly<{
  project: VazenTomlProjectV0_3_0;
  source: Readonly<{
    /** The version the file declares, if it gives one. */
    declaredVersion?: string;
    /** The file's format, such as `'vazen-toml'`, `'vazen-json'` or `'psa'`. */
    format: string;
  }>;
}>;

/**
 * Reads the tables of a Vazen TOML file of any version `VazenVersion` lists,
 * whatever syntax they were written in, and writes a project as 0.3.0's
 * tables. A file that declares another `schema_version` is refused, and the
 * error names that version. Reading does not check the rules of a whole file,
 * such as a selector matching exactly one product, nor the spatial rules.
 */
export const VazenProjectFromVazenTomlProject: S.Schema<VazenProject, unknown> =
  S.transformOrFail(S.Unknown, VazenProject, {
    decode: (tables, options) =>
      pipe(
        ParseResult.decodeUnknownEither(DeclaredVersion)(tables, options),
        Either.flatMap(({ schema_version: declaredVersion }) =>
          ParseResult.decodeUnknownEither(
            VAZEN_PROJECT_FROM_VAZEN_TOML_PROJECT_BY_VERSION[declaredVersion],
          )(tables, options),
        ),
      ),
    encode: (project, options) =>
      ParseResult.encodeEither(
        VAZEN_PROJECT_FROM_VAZEN_TOML_PROJECT_BY_VERSION[
          DEFAULT_WRITTEN_VERSION
        ],
      )(project, options),
    strict: true,
  }).annotations({ identifier: 'VazenProjectFromVazenTomlProject' });

/** The project a file was read into, as a file function returns it. */
export const vazenProjectReadFromVazenProject = (
  project: VazenProject,
): VazenProjectRead => ({
  project: S.encodeSync(VazenProjectFromVazenTomlProjectV0_3_0)(project),
  // A file function's project always has the source its reader gave it.
  source: S.encodeSync(Source)(Option.getOrThrow(project.source)),
});

/**
 * The tables a file function writes. The tables given are read back into a
 * project, so every check that reading makes runs. Then the project is written
 * as the version given, or as 0.3.0 when none is.
 */
export const writtenVazenTomlProject = ({
  project,
  version = DEFAULT_WRITTEN_VERSION,
}: Readonly<{
  project: VazenTomlProjectV0_3_0;
  version?: VazenVersion;
}>): unknown =>
  S.encodeSync(VAZEN_PROJECT_FROM_VAZEN_TOML_PROJECT_BY_VERSION[version])(
    S.decodeSync(VazenProjectFromVazenTomlProjectV0_3_0)(project),
  );

// Read before the rest, so a file of another version is refused for that, not
// for what that version changed. The other keys are that version's tables' to
// check, so they are ignored here whatever the caller's `onExcessProperty`.
const DeclaredVersion = S.Struct({ schema_version: VazenVersion }).annotations({
  parseOptions: { onExcessProperty: 'ignore' },
});

const Source = S.Struct({
  declaredVersion: S.optionalWith(S.String, { as: 'Option', exact: true }),
  format: S.String,
});
