import { Schema as S, String as Str } from 'effect';

/** A stable package version with one dated, nonempty section in its changelog. */
export const PackageReleaseNotes = S.Struct({
  changelog: S.String,
  version: S.String.check(
    S.isTrimmed(),
    S.isPattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
    S.makeFilter(
      (version) => version !== '0.0.0' || 'Use a release version above 0.0.0.',
    ),
  ),
}).check(
  S.makeFilter(({ changelog, version }) => {
    const prefix = `[${version}]`;
    const matching = Str.split(changelog, /^## /m)
      .slice(1)
      .filter((section) => section.startsWith(prefix));
    if (matching.length !== 1) {
      return `CHANGELOG.md must contain exactly one heading for ${version}.`;
    }
    const [section = ''] = matching;
    const [heading, ...body] = Str.split(section, /\r?\n/);
    if (!/^ - \d{4}-\d{2}-\d{2}$/.test(heading.slice(prefix.length))) {
      return `Use ## [${version}] - YYYY-MM-DD in CHANGELOG.md.`;
    }
    return body.join('\n').trim().length > 0
      ? true
      : `CHANGELOG.md has no release notes for ${version}.`;
  }),
);
