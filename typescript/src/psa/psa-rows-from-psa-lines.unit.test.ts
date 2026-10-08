import { Schema as S } from 'effect';
import { expect, it } from 'vitest';

import { PsaRowsFromPsaLines } from './psa-rows-from-psa-lines';

const decode = S.decodeUnknownSync(PsaRowsFromPsaLines);

it('preserves escape meanings and empty cells at boundaries', () => {
  const result = decode([
    'PROSPACE SCHEMATIC FILE',
    'Project,,a\\,b,\\\\,\\",\\t,\\r\\n,\\q,\\😀,tail\\',
  ]);
  expect(result.rows[0]?.cells).toEqual([
    '',
    'a,b',
    '\\',
    '"',
    '\t',
    '\r\n',
    String.raw`\q`,
    String.raw`\😀`,
    'tail\\',
  ]);
});
