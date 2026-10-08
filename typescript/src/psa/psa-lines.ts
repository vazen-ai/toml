import { Schema as S } from 'effect';

/** A PSA file's lines, without their line endings. */
export const PsaLines = S.Array(S.String).annotate({
  identifier: 'PsaLines',
});
