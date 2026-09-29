import {
  Either,
  Option,
  ParseResult,
  pipe,
  Schema as S,
  String as Str,
} from 'effect';

// `-1` is the file's "inherit from the parent", what an empty cell means, so a
// boolean column reads it as absent too. Only booleans: in a numeric column
// `-1` is a value in its own right, which `color` uses and the tags stage
// reads.
const INHERITED_CELL = '-1';
// A whole number a column's code list does not have, such as a code a later
// ProSpace added, is kept; any other text in a code column is not a code.
const UNLISTED_CODE = /^-?\d+$/;

/** A code its column's list does not have, kept as the file writes it. */
export const PsaUnlistedCode = S.TaggedStruct('UnlistedCode', {
  code: S.String,
}).annotations({ identifier: 'PsaUnlistedCode' });
export type PsaUnlistedCode = typeof PsaUnlistedCode.Type;

// An empty cell is absent, not the column's default: a reader that wants an
// effective value takes that from its record's defaults map. The value's own
// schema reads any other text, so a code list is checked against its codes.
const OptionFromCell = <A, I extends string>({
  isEmpty,
  value,
}: Readonly<{
  isEmpty: (text: string) => boolean;
  value: S.Schema<A, I>;
}>) =>
  S.transformOrFail(S.String, S.OptionFromSelf(S.typeSchema(value)), {
    decode: (text, options) =>
      isEmpty(text)
        ? ParseResult.succeed(Option.none())
        : Either.map(
            ParseResult.decodeUnknownEither(value, options)(text),
            Option.some,
          ),
    encode: (option, options) =>
      Option.match(option, {
        onNone: () => ParseResult.succeed(''),
        onSome: ParseResult.encodeEither(value, options),
      }),
    strict: true,
  });

const OptionalFromPsaCell = <A, I extends string>(
  value: S.Schema<A, I>,
): S.Schema<Option.Option<A>, string> =>
  OptionFromCell({ isEmpty: Str.isEmpty, value }).annotations({
    identifier: 'PsaCell',
  });

const UnlistedCodeFromText = S.transform(
  S.String.pipe(S.pattern(UNLISTED_CODE)),
  PsaUnlistedCode,
  {
    decode: (code) => ({ _tag: 'UnlistedCode' as const, code }),
    encode: ({ code }) => code,
    strict: true,
  },
);

// Real files contain `-0`; it reads as `0` so a value written back compares
// equal to the one read. `Number` reads a cell of only spaces as `0`, so that
// is refused.
const NumberFromText = S.transformOrFail(S.String, S.Finite, {
  decode: (text, _, ast) =>
    pipe(Number(text), (value) =>
      Str.isNonEmpty(Str.trim(text)) && Number.isFinite(value)
        ? ParseResult.succeed(value === 0 ? 0 : value)
        : ParseResult.fail(
            new ParseResult.Type(ast, text, `"${text}" is not a number`),
          ),
    ),
  encode: (value) => ParseResult.succeed(String(value)),
  strict: true,
});

// Every real file writes booleans as `0` and `1`; ProSpace's field definitions
// name them `Yes` and `No`, so those are read as well.
const FlagFromText = S.transform(S.Literal('0', '1', 'No', 'Yes'), S.Boolean, {
  decode: (text) => text === '1' || text === 'Yes',
  encode: (value) => (value ? '1' : '0'),
  strict: true,
});

export const TextFromPsaCell = OptionalFromPsaCell(
  S.String.pipe(
    // Empty text would be written as an empty cell, which reads as absent.
    S.filter(
      (text) =>
        Str.isNonEmpty(text) ||
        'empty text is read as an empty cell, so it cannot be kept as text',
    ),
  ),
).annotations({ identifier: 'PsaTextCell' });

export const NumberFromPsaCell = OptionalFromPsaCell(
  NumberFromText,
).annotations({
  identifier: 'PsaNumberCell',
});

/**
 * A cell holding one of a code list's codes, or a code the list does not have.
 */
export const CodeFromPsaCell = <A, I extends string>(list: S.Schema<A, I>) => {
  const isListed = S.is(S.encodedSchema(list));
  return OptionalFromPsaCell(
    S.Union(
      list,
      // A listed code would be read back as the list's value.
      UnlistedCodeFromText.pipe(
        S.filter(
          ({ code }) =>
            !isListed(code) ||
            `${code} is one of its column's codes, so it cannot be kept as an unlisted one`,
        ),
      ),
    ),
  ).annotations({ identifier: 'PsaCodeCell' });
};

export const FlagFromPsaCell = OptionFromCell({
  isEmpty: (text) => Str.isEmpty(text) || text === INHERITED_CELL,
  value: FlagFromText,
}).annotations({ identifier: 'PsaFlagCell' });
