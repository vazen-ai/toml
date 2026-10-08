import {
  Effect,
  Option,
  pipe,
  Result,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
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
// Files write a code as `0.00` as often as `0`.
const ZERO_FRACTION = /^(-?\d+)\.0+$/;

/** A code its column's list does not have, kept as the file writes it. */
export const PsaUnlistedCode = S.TaggedStruct('UnlistedCode', {
  code: S.String,
}).annotate({ identifier: 'PsaUnlistedCode' });
export type PsaUnlistedCode = typeof PsaUnlistedCode.Type;

// An empty cell is absent, not the column's default: a reader that wants an
// effective value takes that from its record's defaults map. The value's own
// schema reads any other text, so a code list is checked against its codes.
const OptionFromCell = <A, I extends string>({
  isEmpty,
  value,
}: Readonly<{
  isEmpty: (text: string) => boolean;
  value: S.Codec<A, I>;
}>) =>
  S.String.pipe(
    S.decodeTo(S.Option(S.toType(value)), {
      decode: SchemaGetter.transformEffect((text, options) =>
        isEmpty(text)
          ? Effect.succeed(Option.none())
          : Effect.fromResult(
              Result.map(
                SchemaParser.decodeUnknownResult(value, options)(text),
                Option.some,
              ),
            ),
      ),
      encode: SchemaGetter.transformEffect((option, options) =>
        Option.match(option, {
          onNone: () => Effect.succeed(''),
          onSome: SchemaParser.encodeEffect(value, options),
        }),
      ),
    }),
  );

const OptionalFromPsaCell = <A, I extends string>(
  value: S.Codec<A, I>,
): S.Codec<Option.Option<A>, string> =>
  OptionFromCell({ isEmpty: Str.isEmpty, value }).annotate({
    identifier: 'PsaCell',
  });

const UnlistedCodeFromText = S.String.pipe(
  S.check(S.isPattern(UNLISTED_CODE)),
).pipe(
  S.decodeTo(PsaUnlistedCode, {
    decode: SchemaGetter.transform((code) => ({
      _tag: 'UnlistedCode' as const,
      code,
    })),
    encode: SchemaGetter.transform(({ code }) => code),
  }),
);

// A code spelt with a zero fraction is read as the whole number it is, and
// written back as that. The text is left alone otherwise, so a fraction that
// is not zero still fails as not a code.
const WholeNumberFromZeroFraction = S.String.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transform((text) => text.replace(ZERO_FRACTION, '$1')),
    encode: SchemaGetter.transform((text) => text),
  }),
);

// Real files contain `-0`; it reads as `0` so a value written back compares
// equal to the one read. `Number` reads a cell of only spaces as `0`, so that
// is refused.
const NumberFromText = S.String.pipe(
  S.decodeTo(S.Finite, {
    decode: SchemaGetter.transformEffect((text, _) =>
      pipe(Number(text), (value) =>
        Str.isNonEmpty(Str.trim(text)) && Number.isFinite(value)
          ? Effect.succeed(value === 0 ? 0 : value)
          : Effect.fail(
              new SchemaIssue.InvalidValue(
                { message: `"${text}" is not a number` },
                text,
              ),
            ),
      ),
    ),
    encode: SchemaGetter.transformEffect((value) =>
      Effect.succeed(String(value)),
    ),
  }),
);

// Every real file writes booleans as `0` and `1`; ProSpace's field definitions
// name them `Yes` and `No`, so those are read as well.
const FlagFromText = S.Literals(['0', '1', 'No', 'Yes']).pipe(
  S.decodeTo(S.Boolean, {
    decode: SchemaGetter.transform((text) => text === '1' || text === 'Yes'),
    encode: SchemaGetter.transform((value) => (value ? '1' : '0')),
  }),
);

export const TextFromPsaCell = OptionalFromPsaCell(
  S.String.pipe(
    // Empty text would be written as an empty cell, which reads as absent.
    S.check(
      S.makeFilter(
        (text) =>
          Str.isNonEmpty(text) ||
          'empty text is read as an empty cell, so it cannot be kept as text',
      ),
    ),
  ),
).annotate({ identifier: 'PsaTextCell' });

export const NumberFromPsaCell = OptionalFromPsaCell(NumberFromText).annotate({
  identifier: 'PsaNumberCell',
});

/**
 * A cell holding one of a code list's codes, or a code the list does not have.
 */
export const CodeFromPsaCell = <A, I extends string>(list: S.Codec<A, I>) => {
  const isListed = S.is(S.toEncoded(list));
  return OptionalFromPsaCell(
    WholeNumberFromZeroFraction.pipe(
      S.decodeTo(
        S.Union([
          list,
          // A listed code would be read back as the list's value.
          UnlistedCodeFromText.pipe(
            S.check(
              S.makeFilter(
                ({ code }) =>
                  !isListed(code) ||
                  `${code} is one of its column's codes, so it cannot be kept as an unlisted one`,
              ),
            ),
          ),
        ]),
      ),
    ),
  ).annotate({ identifier: 'PsaCodeCell' });
};

export const FlagFromPsaCell = OptionFromCell({
  isEmpty: (text) => Str.isEmpty(text) || text === INHERITED_CELL,
  value: FlagFromText,
}).annotate({ identifier: 'PsaFlagCell' });
