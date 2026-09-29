import { Array as A, Schema as S, String as Str } from 'effect';

import { PsaLines } from './psa-lines';

/**
 * A file's lines, from its text, split at CRLF or LF. Every line, the last
 * included, is written with CRLF, as all but a handful of the files in Vazen's
 * PSA corpus (README.md) end.
 */
export const PsaLinesFromText = S.transform(S.String, PsaLines, {
  decode: (text) => {
    const lines = Str.split(text, /\r?\n/);
    return lines.at(-1) === '' ? A.dropRight(lines, 1) : lines;
  },
  encode: (lines) => `${A.join(lines, '\r\n')}\r\n`,
  strict: true,
}).annotations({ identifier: 'PsaLinesFromText' });
