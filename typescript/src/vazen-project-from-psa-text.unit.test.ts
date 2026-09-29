import { readFileSync } from 'node:fs';
import { ParseResult, String as Str } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  decodeVazenProjectFromPsaFile,
  encodePsaFileFromVazenProject,
} from './vazen-project-from-psa-text';

// Everything in src/psa ships publicly, so the test file is made up.
const madeUpFile: Uint8Array = readFileSync(
  new URL('psa/.test-data/v2017.2.0.psa', import.meta.url),
);

// The header's version line.
const versionLine = (bytes: Uint8Array) =>
  Str.split(Buffer.from(bytes).toString('latin1'), '\r\n')[1];

describe('decodeVazenProjectFromPsaFile and encodePsaFileFromVazenProject', () => {
  it('reads a file of any version as the tables of a 0.3.0 layout, with the file it came from beside them, and writes them as 2024.4.0 or the version given', () => {
    const { project, source } = decodeVazenProjectFromPsaFile(madeUpFile);
    expect([project.schema, project.schema_version]).toEqual([
      'vazen/layout',
      '0.3.0',
    ]);
    expect(project.products).toHaveLength(36);
    expect(source).toEqual({ declaredVersion: '2017.2.0', format: 'psa' });
    expect(versionLine(encodePsaFileFromVazenProject({ project }))).toBe(
      '; Version 2024.4.0',
    );
    expect(
      versionLine(
        encodePsaFileFromVazenProject({ project, version: '2017.2.0' }),
      ),
    ).toBe('; Version 2017.2.0');
  });

  it('throws a ParseError for a file it cannot read', () => {
    expect(() =>
      decodeVazenProjectFromPsaFile(new TextEncoder().encode('not a PSA file')),
    ).toThrow(ParseResult.ParseError);
  });
});
