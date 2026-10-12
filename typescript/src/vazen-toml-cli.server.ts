import { extname } from 'node:path';
import {
  Array as A,
  Console,
  Effect,
  FileSystem,
  Layer,
  Option,
  Record,
  Ref,
  Result,
  Schema as S,
} from 'effect';
import {
  Argument,
  CliConfig,
  CliOutput,
  Command,
  Flag,
  GlobalFlag,
  type CliError,
} from 'effect/cli';
import {
  NodeChildProcessSpawner,
  NodeFileSystem,
  NodePath,
  NodeStdio,
  NodeTerminal,
} from '@effect/platform-node-shared';

import packageJson from '../package.json' with { type: 'json' };

import {
  PsaDataFromPsaText,
  psaTextFromBytes,
  type PsaData,
  type PsaEncoding,
  type PsaMessage,
} from './psa';
import type { VazenEquipment } from './vazen-equipment';
import type { VazenProject } from './vazen-project';
import { VazenProjectFromJsonText } from './vazen-project-from-json-text';
import { VazenProjectFromPsaData } from './vazen-project-from-psa-data';
import { VazenProjectFromTomlText } from './vazen-project-from-toml-text';

const EXIT_CODES = {
  done: 0,
  messages: 4,
  unreadable: 3,
  unwritable: 5,
  usage: 2,
} as const;

const FORMATS_BY_EXTENSION: Readonly<Record<string, 'psa' | VazenTextFormat>> =
  { '.json': 'json', '.psa': 'psa', '.toml': 'toml' };

const VAZEN_TEXT_FORMATS = ['json', 'toml'] as const;

const VAZEN_TEXT_SCHEMAS: Readonly<
  Record<VazenTextFormat, S.Codec<VazenProject, string>>
> = { json: VazenProjectFromJsonText, toml: VazenProjectFromTomlText };

const DESCRIPTION = `Reads a ProSpace PSA file (.psa), a Vazen TOML file (.toml) or the same tables as JSON (.json). It never changes the file, and nothing leaves the machine.

  Diagnostics go to stderr, one JSON object per line, each with a "kind" and a "message". The exit code says what happened:

  0  Done.
  1  Unexpected error.
  2  The arguments are wrong.
  3  The file cannot be read.
  4  Done, but reading the file reported messages, such as lost values. Each message is a diagnostic.
  5  The file cannot be written in the format asked for.`;

// The Node.js services effect/cli needs. @effect/platform-node gives the same,
// but needs Redis and HTTP clients installed.
const NodeServices = Layer.provideMerge(
  NodeChildProcessSpawner.layer,
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeStdio.layer,
    NodeTerminal.layer,
  ),
);

// Help and version only: --wizard waits for answers on stdin. Plain text, as
// the output may not be a terminal.
const CliSettings = Layer.mergeAll(
  CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
  CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
);

/**
 * Runs `vazen-toml` with the arguments after its name, and returns what it
 * printed and the code it exits with. It reads the file the arguments name and
 * never writes one.
 */
export const runVazenTomlCli = (
  args: ReadonlyArray<string>,
): Effect.Effect<VazenTomlCliResult> =>
  Effect.gen(function* () {
    const result = yield* Ref.make(Option.none<VazenTomlCliResult>());
    // effect/cli prints help after an argument error too, so what it prints is
    // kept, and reaches stdout only for --help and --version.
    const printed: Array<string> = [];
    const console = yield* Console.Console;
    const parsed = yield* Command.runWith(
      vazenToml((ran) => Ref.set(result, Option.some(ran))),
      { renderErrors: false, version: packageJson.version },
    )(args).pipe(
      Effect.provideService(Console.Console, {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- Node.js gives console its methods as its own properties.
        ...console,
        log: (...text) => {
          printed.push(text.join(' '));
        },
      }),
      Effect.result,
    );
    const ran = yield* Ref.get(result);
    return Result.match(parsed, {
      onFailure: (error) =>
        failure({ kind: 'usage', message: usageMessage(error) }),
      onSuccess: () =>
        Option.getOrElse(ran, () => ({
          exitCode: EXIT_CODES.done,
          stderr: '',
          stdout: lines(printed),
        })),
    });
  }).pipe(Effect.provide([NodeServices, CliSettings]));

// What a run printed, and the code it exits with.
type VazenTomlCliResult = Readonly<{
  exitCode: number;
  stderr: string;
  stdout: string;
}>;

type VazenTextFormat = (typeof VAZEN_TEXT_FORMATS)[number];

type Read = Readonly<{
  encoding: PsaEncoding;
  project: VazenProject;
  records: Readonly<Record<string, number>>;
}>;

// The commands, each handing its result to `respond`.
const vazenToml = (
  respond: (result: VazenTomlCliResult) => Effect.Effect<void>,
) => {
  const file = Argument.String('file').pipe(
    Argument.withDescription('A .psa, .toml or .json file.'),
  );
  const inspect = Command.make('inspect', { file }, ({ file }) =>
    readFile({ file, plan: Option.none() }).pipe(
      Effect.match({
        onFailure: (failed) => failed,
        onSuccess: (read) =>
          resultOf({ output: Result.succeed(inspection(read)), read }),
      }),
      Effect.flatMap(respond),
    ),
  ).pipe(
    Command.withDescription(
      "Print the file's format, version, encoding, messages, plans and the number of rows of each record type, as JSON.",
    ),
  );
  const convert = Command.make(
    'convert',
    {
      file,
      plan: Flag.Int('plan').pipe(
        Flag.optional,
        Flag.withDescription(
          'Print only this plan, numbered as inspect lists them, with every product.',
        ),
      ),
      to: Flag.ChoiceWithValue(
        'to',
        VAZEN_TEXT_FORMATS.map((format) => [format, format] as const),
      ).pipe(Flag.withDescription('The format to print.')),
    },
    ({ file, plan, to }) =>
      readFile({ file, plan }).pipe(
        Effect.match({
          onFailure: (failed) => failed,
          onSuccess: (read) =>
            resultOf({
              output: conversion({ format: to, plan, project: read.project }),
              read,
            }),
        }),
        Effect.flatMap(respond),
      ),
  ).pipe(Command.withDescription('Print the file as Vazen TOML or JSON.'));
  return Command.make('vazen-toml', {}, () =>
    respond(
      failure({ kind: 'usage', message: 'Give a command: inspect or convert' }),
    ),
  ).pipe(
    Command.withDescription(DESCRIPTION),
    Command.withSubcommands([inspect, convert]),
  );
};

const lines = (printed: ReadonlyArray<string>): string =>
  A.isReadonlyArrayNonEmpty(printed) ? `${printed.join('\n').trimEnd()}\n` : '';

// What was wrong with the arguments: effect/cli reports an argument error as a
// request for help that holds the errors.
const usageMessage = (error: CliError.CliError): string =>
  error._tag === 'ShowHelp'
    ? error.errors.map(({ message }) => message).join('. ')
    : error.message;

const failure = ({
  kind,
  message,
}: Readonly<{
  kind: 'unreadable' | 'unwritable' | 'usage';
  message: string;
}>): VazenTomlCliResult => ({
  exitCode: EXIT_CODES[kind],
  stderr: diagnostic({
    kind,
    message:
      kind === 'usage' ? `${message}. vazen-toml --help says how` : message,
  }),
  stdout: '',
});

const diagnostic = ({
  details = {},
  kind,
  message,
}: Readonly<{
  details?: Readonly<Record<string, unknown>>;
  kind: string;
  message: string;
}>): string => `${JSON.stringify({ kind, message, ...details })}\n`;

// A command's result: its output, after a diagnostic for each message reading
// the file reported, whose `_tag` is its kind.
const resultOf = ({
  output,
  read,
}: Readonly<{
  output: Result.Result<string, VazenTomlCliResult>;
  read: Read;
}>): VazenTomlCliResult => {
  const { messages } = read.project;
  const reported = messages
    .map((message) => {
      const { _tag, ...details } = message;
      return diagnostic({ details, kind: _tag, message: sentence(message) });
    })
    .join('');
  return Result.match(output, {
    onFailure: (failed) => ({ ...failed, stderr: reported + failed.stderr }),
    onSuccess: (printed) => ({
      exitCode: A.isReadonlyArrayNonEmpty(messages)
        ? EXIT_CODES.messages
        : EXIT_CODES.done,
      stderr: reported,
      stdout: printed,
    }),
  });
};

const readFile = ({
  file,
  plan,
}: Readonly<{
  file: string;
  plan: Option.Option<number>;
}>): Effect.Effect<Read, VazenTomlCliResult, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const format = yield* Effect.fromResult(
      Result.fromOption(
        Record.get(FORMATS_BY_EXTENSION, extname(file).toLowerCase()),
        () =>
          failure({
            kind: 'usage',
            message: 'The file must end in .psa, .toml or .json',
          }),
      ),
    );
    const fileSystem = yield* FileSystem.FileSystem;
    const bytes = yield* Effect.mapError(
      fileSystem.readFile(file),
      ({ message }) => failure({ kind: 'unreadable', message }),
    );
    return yield* Effect.fromResult(
      Result.mapError(
        format === 'psa'
          ? readPsa({ bytes, plan })
          : readVazenText({ bytes, schema: VAZEN_TEXT_SCHEMAS[format] }),
        (reason) => failure({ kind: 'unreadable', message: reason }),
      ),
    );
  });

const utf8 = new TextDecoder('utf-8', { fatal: true });

const readVazenText = ({
  bytes,
  schema,
}: Readonly<{
  bytes: Uint8Array;
  schema: S.Codec<VazenProject, string>;
}>): Result.Result<Read, string> =>
  Result.gen(function* () {
    const text = yield* Result.try({
      catch: () => 'The file is not valid UTF-8',
      try: () => utf8.decode(bytes),
    });
    const project = yield* Result.mapError(
      S.decodeResult(schema)(text),
      ({ message }) => message,
    );
    return {
      encoding: 'utf-8',
      project,
      records: {
        equipment: equipmentOf(project.fixtures).length,
        fixtures: project.fixtures.length,
        products: project.products.length,
        sites: siteCount(project.fixtures),
      },
    };
  });

const readPsa = ({
  bytes,
  plan,
}: Readonly<{
  bytes: Uint8Array;
  plan: Option.Option<number>;
}>): Result.Result<Read, string> =>
  Result.gen(function* () {
    const { encoding, text } = yield* psaTextFromBytes(bytes);
    const data = yield* Result.mapError(
      S.decodeResult(PsaDataFromPsaText)(text),
      ({ message }) => message,
    );
    const project = yield* Result.mapError(
      S.decodeResult(VazenProjectFromPsaData)({
        ...data,
        planograms: onlyPlan({ plan, planograms: data.planograms }),
      }),
      ({ message }) => message,
    );
    return {
      encoding,
      project,
      records: psaRecordCounts(data),
    };
  });

// The planograms with every one but the plan asked for emptied, so what another
// holds cannot stop it being converted. Each keeps its Planogram row, so its
// number and any id made up for it are the same.
const onlyPlan = ({
  plan,
  planograms,
}: Readonly<{
  plan: Option.Option<number>;
  planograms: PsaData['planograms'];
}>): PsaData['planograms'] =>
  Option.match(plan, {
    onNone: () => planograms,
    onSome: (number) =>
      planograms.map((planogram, index) =>
        index === number - 1
          ? planogram
          : { ...planogram, fixtures: [], performance: [], segments: [] },
      ),
  });

// The rows of each record type the file holds, those reading ignored included.
const psaRecordCounts = ({
  messages,
  planograms,
  products,
}: PsaData): Readonly<Record<PsaMessage['type'], number>> =>
  A.reduce(
    messages,
    {
      Fixture: A.flatMap(planograms, ({ fixtures }) => fixtures).length,
      Performance: A.flatMap(planograms, ({ performance }) => performance)
        .length,
      Planogram: planograms.length,
      Position: A.flatMap(planograms, ({ fixtures }) =>
        A.flatMap(fixtures, ({ positions }) => positions),
      ).length,
      Product: products.length,
      Project: 1,
      Segment: A.flatMap(planograms, ({ segments }) => segments).length,
    },
    (counts, message) =>
      message._tag === 'IgnoredRows'
        ? {
            ...counts,
            [message.type]: counts[message.type] + message.rows.length,
          }
        : counts,
  );

// The fixtures' equipment, and the equipment nested in it, such as a bay's
// shelves.
const equipmentOf = (
  fixtures: VazenProject['fixtures'],
): ReadonlyArray<VazenEquipment> => {
  const nested = (
    equipment: ReadonlyArray<VazenEquipment>,
  ): ReadonlyArray<VazenEquipment> =>
    A.flatMap(equipment, (item) => [item, ...nested(item.equipment)]);
  return nested(A.flatMap(fixtures, ({ equipment }) => equipment));
};

const siteCount = (fixtures: VazenProject['fixtures']): number =>
  A.flatMap(equipmentOf(fixtures), ({ sites }) => sites).length;

const PrettyJson = S.fromJsonString(S.Unknown, { space: 2 });

const inspection = ({ encoding, project, records }: Read): string =>
  `${S.encodeSync(PrettyJson)({
    encoding,
    format: Option.getOrUndefined(
      Option.map(project.source, ({ format }) => format),
    ),
    messages: project.messages,
    plans: project.fixtures.map((fixture, index) => ({
      equipment: equipmentOf([fixture]).length,
      id: Option.getOrUndefined(fixture.id),
      name: Option.getOrUndefined(fixture.name),
      number: index + 1,
      sites: siteCount([fixture]),
    })),
    records,
    version: Option.getOrUndefined(
      Option.flatMap(project.source, ({ declaredVersion }) => declaredVersion),
    ),
  })}\n`;

const conversion = ({
  format,
  plan,
  project,
}: Readonly<{
  format: VazenTextFormat;
  plan: Option.Option<number>;
  project: VazenProject;
}>): Result.Result<string, VazenTomlCliResult> =>
  Result.gen(function* () {
    const fixtures = yield* Option.match(plan, {
      onNone: () => Result.succeed(project.fixtures),
      onSome: (number) =>
        Result.fromOption(
          Option.map(A.get(project.fixtures, number - 1), A.of),
          () =>
            failure({
              kind: 'usage',
              message: `--plan takes a number from 1 to ${project.fixtures.length}, the plans the file has`,
            }),
        ),
    });
    return yield* Result.mapError(
      S.encodeResult(VAZEN_TEXT_SCHEMAS[format])({ ...project, fixtures }),
      ({ message }) => failure({ kind: 'unwritable', message }),
    );
  });

const sentence = (message: PsaMessage): string => {
  const rows = `${message.rows.length} ${message.type} rows`;
  switch (message._tag) {
    case 'DroppedCells': {
      return `${rows} have cells past their last column, which were dropped`;
    }
    case 'IgnoredRows': {
      return `${rows} have no place in the project, so were ignored`;
    }
    case 'UnlistedWidth': {
      return `${rows} have ${message.width} cells, which no listed version gives them, so were read by position and may have values in the wrong columns`;
    }
    case 'UnreadCells': {
      return `${rows} have a ${message.column} cell that could not be read, so was read as empty`;
    }
  }
};
