import { Array, Schema as S, String as Str } from 'effect';

const Version = S.String.pipe(
  S.trimmed(),
  S.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
);
const Package = S.Struct({
  name: S.Literal('@vazen-ai/toml'),
  repository: S.Struct({
    url: S.Literal('git+https://github.com/vazen-ai/toml.git'),
  }),
  version: Version,
});
const Registry = S.Struct({
  'dist-tags': S.Struct({ latest: Version }),
  name: S.Literal('@vazen-ai/toml'),
  versions: S.Record({ key: S.String, value: S.Unknown }),
});

/** Refuses invalid releases and registry failures; an existing version is a no-op. */
export const checkRelease = async (manifest: unknown) => {
  const { version } = S.decodeUnknownSync(Package)(manifest);
  if (version === '0.0.0') {
    throw new Error('A development version cannot be published.');
  }
  const response = await fetch('https://registry.npmjs.org/@vazen-ai%2Ftoml', {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`npm registry returned HTTP ${response.status}.`);
  }
  const registry = S.decodeUnknownSync(Registry)(await response.json());
  if (Object.hasOwn(registry.versions, version)) {
    return { publish: false, version };
  }
  const difference =
    Array.zip(
      Str.split(version, '.'),
      Str.split(registry['dist-tags'].latest, '.'),
    )
      .map(([next, previous]) => BigInt(next) - BigInt(previous))
      .find((part) => part !== 0n) ?? 0n;
  if (difference <= 0n) {
    throw new Error(
      `Release ${version} must be newer than latest ${registry['dist-tags'].latest}.`,
    );
  }
  return { publish: true, version };
};
