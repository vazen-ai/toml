import { Array as A, Either, Option, ParseResult, Schema as S } from 'effect';

const windows1252 = new TextDecoder('windows-1252');

const BYTE_ORDER_MARK = [0xef, 0xbb, 0xbf];
// Built from the decoder, so writing is exactly the inverse of reading,
// including the five bytes Windows-1252 leaves undefined.
const BYTE_BY_CHARACTER = new Map(
  A.makeBy(
    256,
    (byte) => [windows1252.decode(Uint8Array.of(byte)), byte] as const,
  ),
);
const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * A PSA file's text. Files are read as UTF-8 when they start with a byte-order
 * mark or are valid UTF-8, since many that declare Windows-1252 are UTF-8, and
 * as Windows-1252 otherwise; one with a byte-order mark that is not valid UTF-8
 * is refused. They are always written as Windows-1252.
 */
export const TextFromBytes = S.transformOrFail(S.Uint8ArrayFromSelf, S.String, {
  decode: (bytes, _, ast) => {
    const marked = BYTE_ORDER_MARK.every(
      (byte, index) => bytes[index] === byte,
    );
    const body = marked ? bytes.subarray(BYTE_ORDER_MARK.length) : bytes;
    const utf8 = Either.try(() =>
      new TextDecoder('utf-8', { fatal: true }).decode(body),
    );
    return marked
      ? Either.mapLeft(
          utf8,
          () =>
            new ParseResult.Type(
              ast,
              bytes,
              'the file starts with a UTF-8 byte-order mark but is not valid UTF-8',
            ),
        )
      : ParseResult.succeed(
          Either.getOrElse(utf8, () => windows1252.decode(body)),
        );
  },
  // A combining accent is folded into the single letter Windows-1252 has, and
  // a replacement character, marking one an earlier tool already lost, is
  // written as `?`.
  encode: (text, _, ast) => {
    const bytes: Array<number> = [];
    let line = 1;
    for (const character of text
      .normalize('NFC')
      .replaceAll(REPLACEMENT_CHARACTER, '?')) {
      const byte = Option.fromNullable(BYTE_BY_CHARACTER.get(character));
      if (Option.isNone(byte)) {
        return ParseResult.fail(
          new ParseResult.Type(
            ast,
            character,
            `line ${line} holds "${character}", which Windows-1252, the encoding a PSA file is written in, cannot hold`,
          ),
        );
      }
      if (character === '\n') {
        line += 1;
      }
      bytes.push(byte.value);
    }
    return ParseResult.succeed(Uint8Array.from(bytes));
  },
  strict: true,
}).annotations({ identifier: 'TextFromBytes' });
