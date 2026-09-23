import { toPsaFixture, type PsaFixture } from './fixture';
import { toPsaPlanogram, type PsaPlanogram } from './planogram';
import { toPsaPosition, type PsaPosition } from './position';
import { toPsaProduct, type PsaProduct } from './product';
import { toPsaProject, type PsaProject } from './project';
import { toPsaSegment, type PsaSegment } from './segment';

type Stringify = (input: Array<unknown>) => string;

const prepareCsv = (
  data: Array<Array<number | string>>,
  stringify: Stringify,
) => {
  const fileDef = [
    ['PROSPACE SCHEMATIC FILE'],
    ['; Version 2017.2.0'],
    ['; Codepage=1252'],
  ];

  return stringify([...fileDef, ...data]);
};

export const getPsaFile = ({
  planograms,
  products,
  project,
  stringify,
}: Readonly<{
  planograms: Array<
    {
      fixtures?: Array<PsaFixture>;
      positions?: Array<PsaPosition>;
      segments?: Array<PsaSegment>;
    } & PsaPlanogram
  >;
  products: Array<PsaProduct>;
  project: PsaProject;
  stringify: Stringify;
}>) => {
  const projectRow = toPsaProject(project);
  const productRows = products.map((product) => toPsaProduct(product));
  const planogramRows: Array<Array<number | string>> = [];

  planograms.forEach((planogram) => {
    const fixtureRows: Array<Array<string>> = [];
    const segmentRows: Array<Array<string>> = [];
    planogramRows.push(toPsaPlanogram(planogram));

    planogram.segments?.forEach((segment) => {
      segmentRows.push(toPsaSegment(segment));
    });
    planogram.fixtures?.forEach((fixture) => {
      fixtureRows.push(toPsaFixture(fixture));
      fixture.positions?.forEach((position) => {
        fixtureRows.push(toPsaPosition(position));
      });
    });
    planogramRows.push(...segmentRows, ...fixtureRows);
  });

  const result = [projectRow, ...productRows, ...planogramRows];
  return prepareCsv(result, stringify);
};
