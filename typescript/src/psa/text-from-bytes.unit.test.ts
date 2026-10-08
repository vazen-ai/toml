import { Option, Result, Schema as S } from 'effect';
import { describe, expect, it } from 'vitest';

import { TextFromBytes } from './text-from-bytes';

const decode = S.decodeUnknownSync(TextFromBytes);
const encode = S.encodeSync(TextFromBytes);
const encodeEither = S.encodeResult(TextFromBytes);

describe('TextFromBytes', () => {
  it.each([
    ['ASCII', 'Project,Tiny'],
    // é is 0xE9 and € is 0x80: neither starts a valid UTF-8 sequence.
    ['Windows-1252', 'Project,Café €'],
    [
      'a mix whose bytes are not valid UTF-8 as a whole',
      'Project,Ã©\r\nProduct,é',
    ],
  ])('writes %s and reads it back unchanged', (_, text) => {
    expect(decode(encode(text))).toBe(text);
  });

  it('reads UTF-8 bytes, writes Windows-1252, and reads that back unchanged', () => {
    const text = 'Project,Café';
    const read = decode(Uint8Array.from(Buffer.from(text, 'utf8')));
    expect(read).toBe(text);
    expect(encode(read)).toEqual(Uint8Array.from(Buffer.from(text, 'latin1')));
    expect(decode(encode(read))).toBe(text);
  });

  it.each([
    ['Ã©', 'é'],
    ['Â£', '£'],
  ])(
    'refuses to write "%s", whose Windows-1252 bytes would be read back as "%s"',
    (text, readBack) => {
      expect(
        Result.getFailure(encodeEither(`Project,Tiny\r\nProduct,${text}`)).pipe(
          Option.map(({ message }) => message),
        ),
      ).toEqual(
        Option.some(
          expect.stringContaining(
            `line 2 holds "${text}", whose Windows-1252 bytes are also valid UTF-8 and would be read back as "${readBack}"`,
          ),
        ),
      );
    },
  );
});
