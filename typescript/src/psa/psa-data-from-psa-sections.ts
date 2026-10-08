import { Array as A, Effect, Schema as S, SchemaGetter } from 'effect';

import { groupUnderHeads } from './group-under-heads';
import { PsaData } from './psa-data';
import { hasPsaTag } from './psa-records';
import { PsaSections } from './psa-sections';

/**
 * A file's data, from its sections: each planogram's records nested as its
 * performance rows, its segments, and its fixtures, each with the positions
 * after it. Positions before a planogram's first fixture have no fixture to
 * belong to, so they are ignored, with the rows after them, and listed in
 * `messages`.
 */
export const PsaDataFromPsaSections: S.Codec<PsaData, PsaSections> =
  PsaSections.pipe(
    S.decodeTo(PsaData, {
      decode: SchemaGetter.transformEffect(
        ({ declaredVersion, messages, planograms, products, project }) => {
          const nested = planograms.map(({ planogram, records }) => {
            const fixturesAndPositions = A.filter(
              records,
              hasPsaTag('Fixture', 'Position'),
            );
            const { groups: fixtures, leading } = groupUnderHeads({
              isHead: isFixture,
              items: fixturesAndPositions,
              toGroup: (fixture, positions) => ({ fixture, positions }),
            });
            return {
              ignored: leading,
              section: {
                fixtures,
                performance: A.filter(records, hasPsaTag('Performance')),
                planogram,
                segments: A.filter(records, hasPsaTag('Segment')),
              },
            };
          });
          // The ignored positions are the first of their planogram's, so each is
          // counted from the positions of the planograms before it.
          const [, ignoredRows] = A.mapAccum(
            planograms,
            0,
            (before, { records }, index) => [
              before + A.filter(records, hasPsaTag('Position')).length,
              (nested[index]?.ignored ?? []).map(
                (_, offset) => before + offset + 1,
              ),
            ],
          );
          const rows = ignoredRows.flat();
          return Effect.succeed({
            declaredVersion,
            messages: A.isReadonlyArrayNonEmpty(rows)
              ? [
                  ...messages,
                  {
                    _tag: 'IgnoredRows' as const,
                    rows,
                    type: 'Position' as const,
                  },
                ]
              : messages,
            planograms: nested.map(({ section }) => section),
            products,
            project,
          });
        },
      ),
      encode: SchemaGetter.transformEffect(
        ({ declaredVersion, messages, planograms, products, project }) =>
          Effect.succeed({
            declaredVersion,
            messages,
            planograms: planograms.map(
              ({ fixtures, performance, planogram, segments }) => ({
                planogram,
                records: [
                  ...performance,
                  ...segments,
                  ...fixtures.flatMap(({ fixture, positions }) => [
                    fixture,
                    ...positions,
                  ]),
                ],
              }),
            ),
            products,
            project,
          }),
      ),
    }),
  ).annotate({ identifier: 'PsaDataFromPsaSections' });

// Outside the call, since inside it the tag would widen to every record type.
const isFixture = hasPsaTag('Fixture');
