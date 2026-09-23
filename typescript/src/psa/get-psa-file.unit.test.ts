import { Array as A, String as Str } from 'effect';
import { describe, expect, it } from 'vitest';

import { getPsaFile } from './get-psa-file';
import { psaStringify } from './psa-stringify';

describe(getPsaFile, () => {
  it('writes the header, the project, its products, then its planograms', () => {
    const file = getPsaFile({
      planograms: [{ name: 'Fictional plan' }],
      products: [{ id: 'fictional-product', name: 'Fictional item A' }],
      project: { name: 'Fictional project' },
      stringify: psaStringify,
    });

    expect(
      A.map(Str.split(file, '\n'), (row) => Str.split(row, ',')[0]),
    ).toEqual([
      'PROSPACE SCHEMATIC FILE',
      '; Version 2017.2.0',
      '; Codepage=1252',
      'Project',
      'Product',
      'Planogram',
    ]);
  });
});
