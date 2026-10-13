# Changelog

Changes to the `@vazen/toml` npm package, published as `@vazen-ai/toml` up to
0.3.0. Package versions are independent of the Vazen TOML file format's
`schema_version`.

<!-- Each version repeats the Added, Changed and Fixed headings. -->
<!-- markdownlint-configure-file { "MD024": { "siblings_only": true } } -->

## [Unreleased]

## [0.4.0] - 2026-10-13

### Changed

- Move the package from `@vazen-ai/toml` to `@vazen/toml`. Replace
  `@vazen-ai/toml` with `@vazen/toml` in imports and `package.json`.
  `@vazen-ai/toml` is deprecated, and its versions stay on npm.

### Fixed

- Report a planogram without a key, which reading gives an id such as
  `planogram-1` and writing puts in its key, as a `GeneratedIds` message. The
  `vazen-toml` command now exits 4 for such a file.

## [0.3.0] - 2026-10-12

### Added

- Inspect and convert PSA, TOML and JSON files with the `vazen-toml` CLI, as
  `npx @vazen-ai/toml inspect end-of-aisle.psa`. The README's Command line
  section lists its diagnostics and exit codes. The CLI adds
  `@effect/platform-node-shared` as a dependency.

## [0.2.1] - 2026-10-08

### Fixed

- Fix the npm release workflow, which stopped before publishing 0.2.0. The
  package code is unchanged from 0.2.0.

## [0.2.0] - 2026-10-06

### Added

- Read PSA tray, case, display and alternate merchandising styles as products
  with their own packaging dimensions and unit counts.
- Return structured processing messages alongside the project and source from
  file readers. PSA messages report recoverable problems; TOML and JSON readers
  return an empty list. Writers do not store messages in converted files.
- Include this changelog in the npm package.

### Changed

- Require Effect 4.0.0 or a later 4.x release as a peer dependency. Exported
  schemas and errors use Effect 4 types, including `SchemaError` in place of
  `ParseError`. Effect schema decoding uses `Result` instead of `Either`.
- Rename the PSA records API's `compromises` field to `messages`, and
  `PsaCompromise` to `PsaMessage`.
- Reduce temporary allocations when reading PSA cells and writing PSA bytes.

### Fixed

- Match PSA positions using the declared UPC, ID or combined primary key, and
  preserve unused position identifiers through TOML and JSON round trips. Keep
  separate PSA product rows distinct when writing.
- Keep reserved PSA text as text through JSON round trips. Distinguish TOML date
  kinds when matching product selectors.
- Read integer PSA codes written as decimals, such as `0.00`.
- Refuse ambiguous Windows-1252 output that would read back as different UTF-8
  text. Preserve Windows-1252 bytes `0x80` to `0x9F` on every supported Node.js
  version.
- Reject `__proto__` keys when reading or writing TOML and JSON, instead of
  allowing prototype changes or silently losing data.

## [0.1.0] - 2026-09-29

`@vazen-ai/toml` 0.1.0 is the first release of the package. It reads and writes
[Vazen TOML](https://toml.vazen.com/) 0.3.0 files, `vazen/spec` and
`vazen/layout`, as TOML or as JSON. It reads ProSpace PSA files of any version,
and writes PSA 2017.1.0 to 2024.4.0. Each file reads as the tables of a 0.3.0
file. A writer writes 0.3.0, or PSA 2024.4.0, unless another version is asked
for.

```sh
npm install @vazen-ai/toml
```

### What reading does not check

Reading checks the shape of a file. It does not check the specification's rules
of a whole file, nor its spatial rules. A project read from a PSA file drops
what the records reader lists as compromises, such as a cell its column could
not read; `decodePsaDataFromPsaFile` shows them.
[The package README](https://github.com/vazen/toml/blob/main/typescript/README.md)
says what each function reads and writes, and
[the PSA README](https://github.com/vazen/toml/blob/main/typescript/src/psa/README.md)
says which values the PSA reader loses and which the writer keeps.

### Requirements

The package is ESM only, for Node.js 24 or later. It needs Effect 3.14.8 or a
later 3.x release as a peer dependency. This release was published by hand and
carries no provenance.
