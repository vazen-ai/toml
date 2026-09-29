import { Array as A, Option, ParseResult, Schema as S } from 'effect';

import { groupUnderHeads } from './group-under-heads';
import { hasPsaTag, PsaRecords } from './psa-records';
import { PsaSections } from './psa-sections';

/**
 * A file's sections, from its records: the project, which comes first, the
 * products, and the rest grouped under the planogram before them.
 */
export const PsaSectionsFromPsaRecords: S.Schema<PsaSections, PsaRecords> =
  S.transformOrFail(PsaRecords, PsaSections, {
    decode: ({ compromises, declaredVersion, records }, _, ast) => {
      const fail = (message: string) =>
        ParseResult.fail(new ParseResult.Type(ast, records.length, message));
      const [project, ...rest] = records;
      if (project?._tag !== 'Project') {
        return fail(
          Option.match(Option.fromNullable(project), {
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
        hasPsaTag('Fixture', 'Performance', 'Planogram', 'Position', 'Segment'),
      );
      const { groups: planograms, leading } = groupUnderHeads({
        isHead: isPlanogram,
        items: planogramRecords,
        toGroup: (planogram, records) => ({ planogram, records }),
      });
      return Option.match(A.head(leading), {
        onNone: () =>
          ParseResult.succeed({
            compromises,
            declaredVersion,
            planograms,
            products: A.filter(rest, hasPsaTag('Product')),
            project,
          }),
        onSome: ({ _tag }) => fail(`a ${_tag} row before any Planogram row`),
      });
    },
    encode: ({ compromises, declaredVersion, planograms, products, project }) =>
      ParseResult.succeed({
        compromises,
        declaredVersion,
        records: [
          project,
          ...products,
          ...planograms.flatMap(({ planogram, records }) => [
            planogram,
            ...records,
          ]),
        ],
      }),
    strict: true,
  }).annotations({ identifier: 'PsaSectionsFromPsaRecords' });

// Outside the call, since inside it the tag would widen to every record type.
const isPlanogram = hasPsaTag('Planogram');
