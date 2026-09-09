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
- Custom fields and namespaced attributes for carrying your own data through
  the file.

The format uses TOML, so files are readable as text and can be parsed with
existing libraries across languages.

## Project status

The specification is currently **0.3.0, draft** and is open for feedback.
Planned tooling includes the `@vazen-ai/toml` npm package, Python packages,
JSON Schemas, and a web converter and visualiser. See
[the website](https://toml.vazen.com/) for the current roadmap.

## Get involved

Working with planogram data? Share your use case or feedback at
[toml@vazen.com](mailto:toml@vazen.com).

Built and maintained by [Vazen](https://www.vazen.com/).
