import {
  Array as A,
  Effect,
  Option,
  Schema as S,
  SchemaGetter,
  SchemaIssue,
} from 'effect';

import { groupUnderHeads } from './group-under-heads';
import { hasPsaTag, PsaRecords } from './psa-records';
import { PsaSections } from './psa-sections';

/**
 * A file's sections, from its records: the project, which comes first, the
 * products, and the rest grouped under the planogram before them.
 */
export const PsaSectionsFromPsaRecords: S.Codec<PsaSections, PsaRecords> =
  PsaRecords.pipe(
    S.decodeTo(PsaSections, {
      decode: SchemaGetter.transformEffect(
        ({ declaredVersion, messages, records }, _) => {
          const fail = (message: string) =>
            Effect.fail(
              new SchemaIssue.InvalidValue({ message }, records.length),
            );
          const [project, ...rest] = records;
          if (project?._tag !== 'Project') {
            return fail(
              Option.match(Option.fromNullishOr(project), {
                onNone: () => 'no Project row',
                onSome: ({ _tag }) => `a ${_tag} row before the Project row`,
              }),
            );
          }
          if (A.some(rest, hasPsaTag('Project'))) {
            return fail('a second Project row');
          }
          const planogramRecords = A.filter(
            rest,
            hasPsaTag(
              'Fixture',
              'Performance',
              'Planogram',
              'Position',
              'Segment',
            ),
          );
          const { groups: planograms, leading } = groupUnderHeads({
            isHead: isPlanogram,
            items: planogramRecords,
            toGroup: (planogram, records) => ({ planogram, records }),
          });
          return Option.match(A.head(leading), {
            onNone: () =>
              Effect.succeed({
                declaredVersion,
                messages,
                planograms,
                products: A.filter(rest, hasPsaTag('Product')),
                project,
              }),
            onSome: ({ _tag }) =>
              fail(`a ${_tag} row before any Planogram row`),
          });
        },
      ),
      encode: SchemaGetter.transformEffect(
        ({ declaredVersion, messages, planograms, products, project }) =>
          Effect.succeed({
            declaredVersion,
            messages,
            records: [
              project,
              ...products,
              ...planograms.flatMap(({ planogram, records }) => [
                planogram,
                ...records,
              ]),
            ],
          }),
      ),
    }),
  ).annotate({ identifier: 'PsaSectionsFromPsaRecords' });

// Outside the call, since inside it the tag would widen to every record type.
const isPlanogram = hasPsaTag('Planogram');
