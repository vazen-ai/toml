import {
  Array as A,
  Effect,
  Option,
  Result,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
  String as Str,
} from 'effect';

const windows1252 = new TextDecoder('windows-1252');
const utf8 = new TextDecoder('utf-8', { fatal: true });

const BYTE_ORDER_MARK = [0xef, 0xbb, 0xbf];
// Windows-1252's characters for bytes 0x80 to 0x9F, which some Node.js
// releases, 24.0.0 among them, decode as control characters. The five bytes
// Windows-1252 leaves undefined decode as the control character of the same
// number.
const CHARACTERS_FOR_0X80_TO_0X9F =
  '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
const CONTROL_CHARACTER = /[\u0080-\u009F]/gu;
const decodeWindows1252 = (bytes: Uint8Array): string =>
  windows1252
    .decode(bytes)
    .replaceAll(CONTROL_CHARACTER, (character) =>
      CHARACTERS_FOR_0X80_TO_0X9F.charAt(character.charCodeAt(0) - 0x80),
    );
// Built from the decoder, so writing is exactly the inverse of reading.
const BYTE_BY_CHARACTER = new Map(
  A.makeBy(
    256,
    (byte) => [decodeWindows1252(Uint8Array.of(byte)), byte] as const,
  ),
);
const REPLACEMENT_CHARACTER = '\uFFFD';
const NON_ASCII_RUN = /[\u0080-\u{10FFFF}]+/u;

/**
 * A PSA file's text. Files are read as UTF-8 when they start with a byte-order
 * mark or are valid UTF-8, since many that declare Windows-1252 are UTF-8, and
 * as Windows-1252 otherwise; one with a byte-order mark that is not valid UTF-8
 * is refused. They are always written as Windows-1252, so text whose
 * Windows-1252 bytes are also valid UTF-8, such as `Ã©`, is refused: it
 * would read back as other text.
 */
export const TextFromBytes = S.Uint8Array.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transformEffect((bytes, _) => {
      const marked = BYTE_ORDER_MARK.every(
        (byte, index) => bytes[index] === byte,
      );
      const body = marked ? bytes.subarray(BYTE_ORDER_MARK.length) : bytes;
      const text = Result.try(() => utf8.decode(body));
      return marked
        ? Effect.fromResult(
            Result.mapError(
              text,
              () =>
                new SchemaIssue.InvalidValue(
                  {
                    message:
                      'the file starts with a UTF-8 byte-order mark but is not valid UTF-8',
                  },
                  bytes,
                ),
            ),
          )
        : Effect.succeed(Result.getOrElse(text, () => decodeWindows1252(body)));
    }),
    encode: SchemaGetter.transformEffect((text, _) => {
      const written = normalisePsaText(text);
      // Each character Windows-1252 holds is one UTF-16 code unit and one byte.
      const encoded = new Uint8Array(written.length);
      let index = 0;
      let line = 1;
      for (const character of written) {
        const byte = Option.fromNullishOr(BYTE_BY_CHARACTER.get(character));
        if (Option.isNone(byte)) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(
              {
                message: `line ${line} holds "${character}", which Windows-1252, the encoding a PSA file is written in, cannot hold`,
              },
              character,
            ),
          );
        }
        if (character === '\n') {
          line += 1;
        }
        encoded[index] = byte.value;
        index += 1;
      }
      return Result.match(
        Result.try(() => utf8.decode(encoded)),
        {
          onFailure: () => Effect.succeed(encoded),
          onSuccess: (readBack) =>
            readBack === written
              ? Effect.succeed(encoded)
              : Effect.fail(
                  new SchemaIssue.InvalidValue(
                    { message: ambiguity({ readBack, written }) },
                    text,
                  ),
                ),
        },
      );
    }),
  }),
).annotate({ identifier: 'TextFromBytes' });

/** Composes text for Windows-1252 and replaces U+FFFD with `?`. */
export const normalisePsaText = (text: string): string =>
  text.normalize('NFC').replaceAll(REPLACEMENT_CHARACTER, '?');

// The first line that would read back as other text, with the characters on
// it that would and what they would read back as. A line break is ASCII, so
// the lines of the two texts pair up.
const ambiguity = ({
  readBack,
  written,
}: Readonly<{ readBack: string; written: string }>): string => {
  const run = (text: string) => NON_ASCII_RUN.exec(text)?.[0] ?? '';
  const lines = A.zip(Str.split(written, '\n'), Str.split(readBack, '\n'));
  const index = lines.findIndex(([line, reads]) => line !== reads);
  const [line, reads] = lines[index] ?? ['', ''];
  return `line ${index + 1} holds "${run(line)}", whose Windows-1252 bytes are also valid UTF-8 and would be read back as "${run(reads)}"`;
};
