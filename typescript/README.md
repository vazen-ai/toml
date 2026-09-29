# @vazen-ai/toml

`@vazen-ai/toml` 0.1.0 reads and writes [Vazen TOML](https://toml.vazen.com/)
0.3.0 files, `vazen/spec` and `vazen/layout`, as TOML or as JSON. It reads
ProSpace PSA files of any version, and writes the versions `PsaVersion` lists,
2017.1.0 to 2024.4.0. Each file reads as the tables of a 0.3.0 file. A writer
writes 0.3.0, or PSA 2024.4.0, unless another version is asked for.
[Reading and writing](#reading-and-writing) says what each function reads and
writes, and what reading does not check.

```js
import {
  decodeVazenProjectFromTomlFile,
  encodeJsonFileFromVazenProject,
} from '@vazen-ai/toml';

const { project, source } =
  decodeVazenProjectFromTomlFile(`schema = "vazen/spec"
schema_version = "0.3.0"

[[products]]
name = "Vazen Planflakes breakfast cereal 400 g"
gtin = "884400062451"
brand = "Vazen"

[[fixtures]]

[[fixtures.equipment]]
type = "shelf"

[[fixtures.equipment.sites]]
product = { gtin = "884400062451" }
facings = { wide = 3, deep = 4 }
`);
console.log(project.fixtures[0].equipment[0].sites[0].facings.wide);
// 3
console.log(source);
// { declaredVersion: '0.3.0', format: 'vazen-toml' }
console.log(encodeJsonFileFromVazenProject({ project }).includes('"wide": 3'));
// true
```

## What a project holds

A project is the tables of a 0.3.0 file, `VazenTomlProjectV0_3_0`: `products`
and `fixtures`, each fixture's `equipment`, and each piece of equipment's
`sites`. When the file gives no value for a key, the key is absent. Keys the
specification does not define sit beside the standard keys, as in the file. A
reader returns the file's format and declared version as `source`, beside the
project. The source is not part of the project, because a writer writes the
project alone. Reading checks the shape of the file. It does not check the
specification's rules of a whole file, nor its spatial rules.

## JSON

The tables also read and write as JSON, in a `.vazen.json` file. The JSON has
the same keys and the same values. JSON has no date, so the JSON writer writes a
date as text, such as `"2026-09-27T09:30:00.000Z"`, `"2026-09-27"` or
`"09:30:00.000"`. The JSON reader reads text in exactly that form as a date, but
only in an attribute or a product selector. JSON cannot hold `nan` or `inf`, so
the JSON writer refuses them. The JSON reader refuses an integer beyond
JavaScript's safe range, as the TOML reader does.

## PSA files

A PSA file reads as the tables of a 0.3.0 layout. Each planogram is a fixture,
each fixture row is its equipment, and each position is a site. Every length is
in millimetres. A value with a standard key takes that key. Every other value
the file gives becomes a `_psa__` key on its object, unless the column's default
already implies it. So the project writes back as the same PSA records, also
after a trip through TOML or JSON.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import {
  decodeVazenProjectFromPsaFile,
  encodeTomlFileFromVazenProject,
} from '@vazen-ai/toml';

const { project } = decodeVazenProjectFromPsaFile(
  readFileSync('end-of-aisle.psa'),
);
writeFileSync(
  'end-of-aisle.vazen.toml',
  encodeTomlFileFromVazenProject({ project }),
);
```

## Reading and writing

Each format has a pair of file functions. `decodeVazenProjectFromTomlFile` and
`encodeTomlFileFromVazenProject` read and write TOML text.
`decodeVazenProjectFromJsonFile` and `encodeJsonFileFromVazenProject` read and
write JSON text. `decodeVazenProjectFromPsaFile` and
`encodePsaFileFromVazenProject` read and write PSA bytes. The TOML and JSON
readers take the versions `VazenVersion` lists. The PSA reader takes a file of
any version. A project read from a PSA file drops what the records reader lists
in `compromises`, such as a cell its column could not read.
`decodePsaDataFromPsaFile` shows them. The TOML and JSON writers write 0.3.0.
The PSA writer writes 2024.4.0. The `version` option names another version that
`VazenVersion` or `PsaVersion` lists:
`encodePsaFileFromVazenProject({ project, version: '2017.2.0' })`. A writer
refuses a project that a reader would refuse as a file. The PSA writer also
refuses a value that a column of the named version cannot hold. Each function
throws a `ParseError` saying what it could not read or write.

The Effect schemas behind the file functions are exported for a caller who wants
an `Either` or an `Effect`: `VazenProjectFromTomlText`,
`VazenProjectFromJsonText`, `VazenProjectFromPsaBytes`,
`VazenProjectFromPsaText` and `VazenProjectFromPsaData`. Each schema reads a
file into `VazenProject`. In a `VazenProject`, an optional value is an Effect
`Option`, the keys the specification does not define live in each object's
`attributes`, and `source` is part of the project. So the PSA schemas write the
version of the PSA file the project came from, when that version can hold the
project.

The functions above read a file as a project. To edit the columns of a PSA file,
read its records instead. `decodePsaDataFromPsaFile` returns `PsaData`, the rows
of the file as records. `encodePsaFileFromPsaData` writes the records back to a
file.
[The PSA README](https://github.com/vazen-ai/toml/blob/main/typescript/src/psa/README.md)
says which values the reader loses and which values the writer keeps.

The package is ESM only, for Node.js 24 or later. It needs Effect 3.14.8 or a
later 3.x release as a peer dependency. To work on the package, run `npm ci`
then `npm run verify` here. Licensing is in
[LICENSING.md](https://github.com/vazen-ai/toml/blob/main/LICENSING.md).
