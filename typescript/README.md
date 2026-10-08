# @vazen-ai/toml

`@vazen-ai/toml` reads and writes [Vazen TOML](https://toml.vazen.com/) 0.3.0
files, `vazen/spec` and `vazen/layout`, as TOML or as JSON. It reads ProSpace
PSA files of any version, and writes the versions `PsaVersion` lists, 2017.1.0
to 2024.4.0. Each file reads as the tables of a 0.3.0 file. A writer writes
0.3.0, or PSA 2024.4.0, unless another version is asked for.
[Reading and writing](#reading-and-writing) says what each function reads and
writes, and what reading does not check.

The [changelog](CHANGELOG.md) records package changes separately from the file
format's versions.

```js
import {
  decodeVazenProjectFromTomlFile,
  encodeJsonFileFromVazenProject,
} from '@vazen-ai/toml';

const { project, source, messages } =
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
console.log(messages);
// []
console.log(encodeJsonFileFromVazenProject({ project }).includes('"wide": 3'));
// true
```

## What a project holds

A project is the tables of a 0.3.0 file, `VazenTomlProjectV0_3_0`: `products`
and `fixtures`, each fixture's `equipment`, and each piece of equipment's
`sites`. When the file gives no value for a key, the key is absent. Keys the
specification does not define sit beside the standard keys, as in the file. A
reader returns `{ project, source, messages }`. The source gives the file's
format and declared version. The messages are structured findings from reading
or processing the project, with a `_tag` identifying each kind and details such
as affected records and columns. An empty list means none were reported. Writers
write the project alone, so these messages are not stored in converted files.

Readers return data that satisfies the project schema. This checks field types
and allowed values, not full planogram validity or spatial rules. The schemas
refuse an own `__proto__` key anywhere in a project, when reading or writing.
This keeps attribute keys safe to copy between JavaScript objects.

## JSON

The tables also read and write as JSON, in a `.vazen.json` file. The JSON has
the same keys and the same values. JSON has no date, so the JSON writer writes a
date as text, such as `"2026-09-27T09:30:00.000Z"`, `"2026-09-27"` or
`"09:30:00.000"`. The JSON reader reads text in exactly that form as a date, but
only in an attribute or a product selector. Text under a `_psa__` key stays
text, since it holds a PSA cell, and so does a selector's text under a product's
standard key, such as `name`, since the product's is text. So a `label` of
`"2026-09-27"` and a `label` of the date `2026-09-27` both read back as the
date. A selector for the text then matches both products, and the PSA writer
refuses it. JSON cannot hold `nan` or `inf`, so the JSON writer refuses them.
The JSON reader refuses an integer beyond JavaScript's safe range, as the TOML
reader does.

## PSA files

A PSA file reads as the tables of a 0.3.0 layout. Each planogram is a fixture,
each fixture row is its equipment, and each position is a site. A product that a
position places as a tray, a case, a display or an alternate also reads as one
more product for each of those styles, as the specification asks. Each one has
the style as its `form`, the style's dimensions, and the number of units it
holds as `_vazen__unit_count`. When written, they go back onto the same PSA
product row. Every length is in millimetres. A value with a standard key takes
that key. Every other value the file gives becomes a `_psa__` key on its object,
unless the column's default already implies it. With no reported messages, the
project writes back as the same PSA records, also after a trip through TOML or
JSON.

The PSA bridge matches products using the project's primary key: UPC alone, ID
alone, or the exact pair for Both. An absent primary-key cell defaults to UPC.
Identifier text is compared exactly, and a missing component compares as empty.
Both may have one empty component; each placed product and position must have at
least one identifier. Duplicate primary keys and positions with no match are
refused. There is no fallback to the secondary identifier.

When a position's unused identifier differs from its product's, its site keeps
the original cell in `_psa__id` or `_psa__upc`; an empty string means a blank
cell. These attributes survive TOML and JSON and write back to the position. An
export is refused if an edit makes them conflict with the selected product under
the current primary key.

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

[Read and convert ProSpace PSA planogram files](https://toml.vazen.com/psa)
shows each conversion with a made-up PSA file to try.

## Reading and writing

Each format has a pair of file functions. `decodeVazenProjectFromTomlFile` and
`encodeTomlFileFromVazenProject` read and write TOML text.
`decodeVazenProjectFromJsonFile` and `encodeJsonFileFromVazenProject` read and
write JSON text. `decodeVazenProjectFromPsaFile` and
`encodePsaFileFromVazenProject` read and write PSA bytes. The TOML and JSON
readers take the versions `VazenVersion` lists. The PSA reader takes a file of
any version on a best-effort basis. Recoverable problems, such as an unreadable
cell treated as empty or an unfamiliar row width, are reported in `messages`.
Reading fails when it cannot produce a project that satisfies the schema. The
TOML and JSON writers write 0.3.0. The PSA writer writes 2024.4.0. The `version`
option names another version that `VazenVersion` or `PsaVersion` lists:
`encodePsaFileFromVazenProject({ project, version: '2017.2.0' })`. A writer
refuses a project that a reader would refuse as a file. The PSA writer also
refuses a value that a column of the named version cannot hold. Each function
throws a `SchemaError` saying what it could not read or write.

The Effect schemas behind the file functions are exported for a caller who wants
a `Result` or an `Effect`: `VazenProjectFromTomlText`,
`VazenProjectFromJsonText`, `VazenProjectFromPsaBytes`,
`VazenProjectFromPsaText` and `VazenProjectFromPsaData`. Each schema reads a
file into `VazenProject`. In a `VazenProject`, an optional value is an Effect
`Option`, the keys the specification does not define live in each object's
`attributes`, and `source` and `messages` are part of the project. So the PSA
schemas write the version of the PSA file the project came from, when that
version can hold the project.

The functions above read a file as a project. To edit the columns of a PSA file,
read its records instead. `decodePsaDataFromPsaFile` returns `PsaData`, the rows
of the file as records. `encodePsaFileFromPsaData` writes the records back to a
file.
[The PSA README](https://github.com/vazen-ai/toml/blob/main/typescript/src/psa/README.md)
says which values the reader loses and which values the writer keeps.

The package is ESM only, for Node.js 24 or later. It needs Effect 4.0.0 or a
later 4.x release as a peer dependency. To work on the package, run `npm ci`
then `npm run verify` here. Licensing is in
[LICENSING.md](https://github.com/vazen-ai/toml/blob/main/LICENSING.md).
