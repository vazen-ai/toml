import { Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import { PackageReleaseNotes } from './package-release-notes';

const NOTES = '### Fixed\n\n- Keep product rows distinct.';
const ENTRY = `## [0.2.0] - 2026-10-05\n\n${NOTES}\n`;

const decode = S.decodeUnknownSync(PackageReleaseNotes);

describe('PackageReleaseNotes', () => {
  it.each(['\n', '\r\n'])(
    'accepts the package version among other entries with %j line endings',
    (newline) => {
      const changelog = `# Changelog\n\n## [Unreleased]\n\n- Later change.\n\n${ENTRY}\n## [0.1.0] - 2026-09-29\n\nFirst release.\n`;
      expect(() =>
        decode({
          changelog: changelog.replaceAll('\n', () => newline),
          version: '0.2.0',
        }),
      ).not.toThrow();
    },
  );

  it.each([
    '0.0.0',
    '0.0.0-development',
    '0.2.0-rc.1',
    '0.2.0+build',
    'v0.2.0',
    '0.2',
    '00.2.0',
    ' 0.2.0',
    '0.2.0\n',
    2,
  ])('rejects an invalid release version %j', (version) => {
    expect(() => decode({ changelog: ENTRY, version })).toThrow();
  });

  it.each([
    ['only unreleased notes', '## [Unreleased]\n\n- Fix.'],
    ['only format-version notes', '## [0.3.0] - 2026-10-05\n\n- Fix.'],
    ['a version without a heading', '[0.2.0] - 2026-10-05\n\n- Fix.'],
    ['duplicate entries', `${ENTRY}\n${ENTRY}`],
    ['a duplicate without a date', `${ENTRY}\n## [0.2.0]\n\n- Fix.`],
  ])('rejects %s', (_, changelog) => {
    expect(() => decode({ changelog, version: '0.2.0' })).toThrow(
      'exactly one heading',
    );
  });

  it.each(['', ' - unreleased', ' - 2026-1-05'])(
    'requires a date in YYYY-MM-DD form, rejecting %j',
    (suffix) => {
      expect(() =>
        decode({
          changelog: `## [0.2.0]${suffix}\n\n${NOTES}`,
          version: '0.2.0',
        }),
      ).toThrow('YYYY-MM-DD');
    },
  );

  it.each(['', '  \n'])(
    'rejects empty notes %j without borrowing the next release',
    (notes) => {
      expect(() =>
        decode({
          changelog: `## [0.2.0] - 2026-10-05\n${notes}\n## [0.1.0] - 2026-09-29\nFirst release.`,
          version: '0.2.0',
        }),
      ).toThrow('no release notes');
    },
  );
});
