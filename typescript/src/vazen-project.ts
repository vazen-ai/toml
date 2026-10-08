import { Schema as S } from 'effect';

import { PsaMessage } from './psa';
import { knownKeysOnly, VazenAttributes } from './vazen-attributes';
import { VazenFixture } from './vazen-fixture';
import { VazenProduct } from './vazen-product';

/** The file a project was read from. */
export const VazenProjectSource = S.Struct({
  /**
   * The version the file declares, if it gives one. A file is written as the
   * version its schema writes, whatever this holds.
   */
  declaredVersion: S.Option(S.String),
  /**
   * The file's format, such as `'vazen-toml'` or `'psa'`: an open string, so a
   * reader for another format can name its own.
   */
  format: S.String,
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenProjectSource' });

/**
 * A project: its products and fixtures, whatever format and version it was read
 * from. It holds no format version, since it lasts only as long as the program
 * using it; to keep one, write it to a file, which carries its format's
 * version. `stage` says whether it is a spec, which is intent and may omit any
 * position or dimensions for a layout engine to fill in, or a layout, which the
 * specification requires to be complete, so it can be drawn, measured or
 * analysed as it is. Reading does not check that it is.
 */
export const VazenProject = S.Struct({
  attributes: VazenAttributes,
  fixtures: S.Array(VazenFixture),
  /** Findings from reading or processing the project. Writers do not store them. */
  messages: S.Array(PsaMessage),

  name: S.Option(S.String),
  products: S.Array(VazenProduct),
  /** The file the project was read from, if it was read from one. */
  source: S.Option(VazenProjectSource),
  stage: S.Literals(['spec', 'layout']),
})
  .pipe(knownKeysOnly)
  .annotate({ identifier: 'VazenProject' });

export type VazenProject = typeof VazenProject.Type;
export type VazenProjectSource = typeof VazenProjectSource.Type;
