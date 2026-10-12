import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Array as A, Effect, Option, String as Str } from 'effect';
import { afterAll, describe, expect, it } from 'vitest';

import { decodeVazenProjectFromJsonFile } from './vazen-project-from-json-text';
import { decodeVazenProjectFromTomlFile } from './vazen-project-from-toml-text';
import { runVazenTomlCli } from './vazen-toml-cli.server';

// Everything here ships publicly, so the files are made up.
const twoPlanograms = fileURLToPath(
  new URL('psa/.test-data/v2024.4.0-two-planograms.psa', import.meta.url),
);
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'vazen-toml-'));
const temporaryFile = ({
  contents,
  name,
}: Readonly<{ contents: string; name: string }>) => {
  const file = join(temporaryDirectory, name);
  writeFileSync(file, contents, 'latin1');
  return file;
};
const tomlFile = temporaryFile({
  contents: `schema = "vazen/spec"
schema_version = "0.3.0"

[[products]]
name = "Product 01"
_score = nan
`,
  name: 'nan.vazen.toml',
});

const run = (args: ReadonlyArray<string>) =>
  Effect.runPromise(runVazenTomlCli(args));

const diagnostics = (stderr: string): ReadonlyArray<unknown> =>
  Str.split(stderr, '\n')
    .filter(Str.isNonEmpty)
    .map((line) => JSON.parse(line));

describe('runVazenTomlCli', () => {
  afterAll(() => {
    rmSync(temporaryDirectory, { recursive: true });
  });

  it("inspects a PSA file: its format, version, encoding, plans and each record type's rows", async () => {
    const { exitCode, stderr, stdout } = await run(['inspect', twoPlanograms]);
    expect([exitCode, stderr]).toEqual([0, '']);
    expect(JSON.parse(stdout)).toEqual({
      encoding: 'windows-1252',
      format: 'psa',
      messages: [],
      plans: [
        { equipment: 13, id: 'PG-6', name: 'Aisle 6', number: 1, sites: 36 },
        { equipment: 4, id: 'PG-6B', name: 'End 6', number: 2, sites: 10 },
      ],
      records: {
        Fixture: 17,
        Performance: 46,
        Planogram: 2,
        Position: 46,
        Product: 36,
        Project: 1,
        Segment: 5,
      },
      version: '2024.4.0',
    });
  });

  it('inspects a Vazen TOML file', async () => {
    const { exitCode, stdout } = await run(['inspect', tomlFile]);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      encoding: 'utf-8',
      format: 'vazen-toml',
      messages: [],
      plans: [],
      records: { equipment: 0, fixtures: 0, products: 1, sites: 0 },
      version: '0.3.0',
    });
  });

  it('counts equipment nested in equipment, and its sites', async () => {
    const file = temporaryFile({
      contents: `schema = "vazen/layout"
schema_version = "0.3.0"

[[fixtures]]
id = "AISLE-12-END"

[[fixtures.equipment]]
type = "bay"

[[fixtures.equipment.equipment]]
type = "shelf"

[[fixtures.equipment.equipment.sites]]
product = { gtin = "5000000000012" }

[[fixtures.equipment.equipment]]
type = "shelf"

[[fixtures.equipment.equipment.sites]]
product = { gtin = "5000000000029" }
`,
      name: 'bay.vazen.toml',
    });
    const { stdout } = await run(['inspect', file]);
    const { plans, records } = JSON.parse(stdout);
    expect([plans[0], records]).toEqual([
      { equipment: 3, id: 'AISLE-12-END', number: 1, sites: 2 },
      { equipment: 3, fixtures: 1, products: 0, sites: 2 },
    ]);
  });

  it('converts one plan as TOML, as a file of only that plan and every product, and leaves the file unchanged', async () => {
    const before = readFileSync(twoPlanograms);
    const lines = Str.split(before.toString('latin1'), '\r\n');
    const secondPlan = temporaryFile({
      contents: [
        ...lines.slice(0, lines.findIndex(Str.startsWith('Planogram,'))),
        ...lines.slice(lines.findLastIndex(Str.startsWith('Planogram,'))),
      ].join('\r\n'),
      name: 'second-plan.psa',
    });
    const { exitCode, stdout } = await run([
      'convert',
      twoPlanograms,
      '--to',
      'toml',
      '--plan',
      '2',
    ]);
    const alone = await run(['convert', secondPlan, '--to', 'toml']);
    expect(exitCode).toBe(0);
    expect(
      decodeVazenProjectFromTomlFile(stdout).project.fixtures?.map(
        ({ id }) => id,
      ),
    ).toEqual(['PG-6B']);
    expect(stdout).toBe(alone.stdout);
    expect(readFileSync(twoPlanograms)).toEqual(before);
  });

  it('converts one plan when another cannot be read as a project', async () => {
    const lines = Str.split(readFileSync(twoPlanograms, 'latin1'), '\r\n');
    const second = lines.findLastIndex(Str.startsWith('Planogram,'));
    const fixture = lines.findIndex(
      (line, index) => index > second && line.startsWith('Fixture,'),
    );
    // No version lists 99 as a fixture type.
    const file = temporaryFile({
      contents: lines
        .map((line, index) =>
          index === fixture
            ? line.replace(/^Fixture,\d+/u, 'Fixture,99')
            : line,
        )
        .join('\r\n'),
      name: 'unlisted-fixture-type.psa',
    });
    const first = await run(['convert', file, '--to', 'json', '--plan', '1']);
    const other = await run(['convert', file, '--to', 'json', '--plan', '2']);
    expect(first.exitCode).toBe(0);
    expect(
      decodeVazenProjectFromJsonFile(first.stdout).project.fixtures?.map(
        ({ id }) => id,
      ),
    ).toEqual(['PG-6']);
    expect([other.exitCode, diagnostics(other.stderr)]).toEqual([
      3,
      [
        {
          kind: 'unreadable',
          message: expect.stringContaining('code 99 is not listed'),
        },
      ],
    ]);
  });

  it('converts a file whose reading reported messages, exits 4, and lists them', async () => {
    const file = temporaryFile({
      contents: [
        'PROSPACE SCHEMATIC FILE',
        '; Version 2024.4.0',
        `Project,Tiny${','.repeat(216)}`,
        'Product,1,2',
        '',
      ].join('\r\n'),
      name: 'short-row.psa',
    });
    const { exitCode, stderr, stdout } = await run([
      'convert',
      file,
      '--to',
      'toml',
    ]);
    expect(exitCode).toBe(4);
    expect(
      decodeVazenProjectFromTomlFile(stdout).project.products,
    ).toHaveLength(1);
    expect(diagnostics(stderr)).toEqual([
      {
        kind: 'UnlistedWidth',
        message: expect.stringContaining('1 Product rows have 2 cells'),
        rows: [1],
        type: 'Product',
        width: 2,
      },
    ]);
  });

  it('counts the rows reading ignored', async () => {
    const lines = Str.split(readFileSync(twoPlanograms, 'latin1'), '\r\n');
    const position = Option.getOrThrow(
      A.findFirst(lines, Str.startsWith('Position,')),
    );
    // A position before its planogram's first fixture has no place in it.
    const file = temporaryFile({
      contents: lines
        .flatMap((line) =>
          Str.startsWith('Planogram,')(line) ? [line, position] : [line],
        )
        .join('\r\n'),
      name: 'early-positions.psa',
    });
    const { exitCode, stderr, stdout } = await run(['inspect', file]);
    expect(exitCode).toBe(4);
    expect(JSON.parse(stdout).records.Position).toBe(48);
    expect(diagnostics(stderr)).toEqual([
      {
        kind: 'IgnoredRows',
        message: expect.stringContaining('2 Position rows'),
        rows: [expect.any(Number), expect.any(Number)],
        type: 'Position',
      },
    ]);
  });

  it.each([
    ['is missing', join(temporaryDirectory, 'missing.psa')],
    [
      'is not a PSA file',
      temporaryFile({ contents: 'Not a PSA file', name: 'not.psa' }),
    ],
  ])('exits 3 when the file %s', async (_, file) => {
    const { exitCode, stderr, stdout } = await run(['inspect', file]);
    expect([exitCode, stdout]).toEqual([3, '']);
    expect(diagnostics(stderr)).toEqual([
      { kind: 'unreadable', message: expect.any(String) },
    ]);
  });

  it('exits 5 when the project cannot be written in the format asked for', async () => {
    const { exitCode, stderr, stdout } = await run([
      'convert',
      tomlFile,
      '--to',
      'json',
    ]);
    expect([exitCode, stdout]).toEqual([5, '']);
    expect(diagnostics(stderr)).toEqual([
      { kind: 'unwritable', message: expect.stringContaining('NaN') },
    ]);
  });

  it.each([
    [[]],
    [['inspect']],
    [['inspect', twoPlanograms, twoPlanograms]],
    [['open', twoPlanograms]],
    [['inspect', twoPlanograms, '--to', 'json']],
    [['inspect', twoPlanograms, '--unknown']],
    [['inspect', 'plan.txt']],
    [['convert', twoPlanograms]],
    [['convert', twoPlanograms, '--to', 'psa']],
    [['convert', twoPlanograms, '--to', 'toml', '--plan', 'two']],
    [['convert', twoPlanograms, '--to', 'toml', '--plan', '0']],
    [['convert', twoPlanograms, '--to', 'toml', '--plan', '3']],
  ])('exits 2 for the arguments %j', async (args) => {
    const { exitCode, stderr, stdout } = await run(args);
    expect([exitCode, stdout]).toEqual([2, '']);
    expect(diagnostics(stderr)).toEqual([
      { kind: 'usage', message: expect.stringContaining('vazen-toml --help') },
    ]);
    // No terminal colour codes, which JSON escapes as \u001b.
    expect(stderr).not.toContain(String.raw`\u001b`);
  });

  it('converts text holding terminal control characters unchanged', async () => {
    // U+009B, a terminal's control sequence introducer, then `31m`.
    const file = temporaryFile({
      contents: String.raw`{"products": [{"name": "Mock \u009b31mproduct"}], "schema": "vazen/spec", "schema_version": "0.3.0"}`,
      name: 'control.vazen.json',
    });
    const { stdout } = await run(['convert', file, '--to', 'json']);
    expect(
      decodeVazenProjectFromJsonFile(stdout).project.products?.[0]?.name,
    ).toBe('Mock \u009B31mproduct');
  });

  it('prints its help as plain text, with the exit codes', async () => {
    const { exitCode, stderr, stdout } = await run(['--help']);
    expect([exitCode, stderr]).toEqual([0, '']);
    expect(stdout).toContain(
      'The file cannot be written in the format asked for.',
    );
    expect(stdout).not.toContain('\u001B');
  });
});
