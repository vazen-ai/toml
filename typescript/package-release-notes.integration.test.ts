import { readFileSync } from 'node:fs';
import { Schema as S } from 'effect';
import { expect, it } from 'vitest';

import { PackageReleaseNotes } from './package-release-notes';
import manifest from './package.json' with { type: 'json' };

it('the package version has release notes in its changelog', () => {
  expect(() =>
    S.decodeUnknownSync(PackageReleaseNotes)({
      changelog: readFileSync(new URL('CHANGELOG.md', import.meta.url), 'utf8'),
      version: manifest.version,
    }),
  ).not.toThrow();
});
