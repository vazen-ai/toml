# Vazen TOML

An open file format for planogram data.

Vazen TOML describes how products are arranged on retail fixtures in plain-text
`.vazen.toml` files. It gives engineers, analysts and AI tools a common way to
read, write and exchange shelf data without proprietary planning software.

[Explore the project at toml.vazen.com](https://toml.vazen.com/) or
[read the specification](https://toml.vazen.com/spec).

## What it describes

- Fixtures and nested equipment, including shelves, hooks and baskets, with
  positions and dimensions in millimetres.
- Products and placements, including attributes, image URLs, facings and
  orientation. Placements select products by their attributes, with an explicit
  reference available when needed.
- Both intent and resolved layouts. A spec describes what should go on the
  fixture; a layout includes the positions and dimensions needed to render it.
- Custom fields and namespaced attributes for carrying your own data through the
  file.

The format uses TOML, so files are readable as text and can be parsed with
existing libraries across languages.

## In this repository

- [`specification/`](specification/) holds every published version of the
  specification.
- [`examples/`](examples/) holds example files for each version, in a folder
  named after it.
- [`typescript/`](typescript/README.md) holds the `@vazen-ai/toml` npm package,
  versioned independently of the format.

The package is built on
[Effect Schema](https://effect.website/docs/v3/schema/introduction). Each format
is declared once as a schema, and that one declaration gives its TypeScript
types, a reader, a writer and, for a file that breaks a rule, an error naming
the path of the fault. Schemas compose, so a PSA file becomes a project through
the same declarations that read Vazen TOML. It is the best tool we know for
stating a format once and having the code follow it.

## Project status

The [current specification](https://toml.vazen.com/spec) is a draft and open for
feedback. The `@vazen-ai/toml` package reads and writes Vazen TOML 0.3.0 and
[PSA files](https://toml.vazen.com/psa). Planned tooling includes Python
packages, JSON Schemas, and a web converter and visualiser. See
[the website](https://toml.vazen.com/) for the current roadmap.

## Get involved

Working with planogram data? Share your use case or feedback at
[toml@vazen.com](mailto:toml@vazen.com). See [contributing](CONTRIBUTING.md) and
[licensing](LICENSING.md).

Built and maintained by [Vazen](https://www.vazen.com/).
