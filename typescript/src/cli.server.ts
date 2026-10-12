#!/usr/bin/env node
import { Effect } from 'effect';
import { NodeRuntime } from '@effect/platform-node-shared';

import { runVazenTomlCli } from './vazen-toml-cli.server';

runVazenTomlCli(process.argv.slice(2)).pipe(
  Effect.flatMap(({ exitCode, stderr, stdout }) =>
    Effect.sync(() => {
      // A reader that stops early, as `head` does, closes the pipe: it wants
      // no more. Nothing can report stderr failing.
      process.stdout.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EPIPE') {
          return;
        }
        process.exitCode = 1;
        process.stderr.write(
          `${JSON.stringify({ kind: 'unexpected', message: error.message })}\n`,
        );
      });
      process.stderr.on('error', () => {});
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      // Not a failure, which `runMain` ends with `process.exit`, cutting off
      // output still on its way down a pipe.
      process.exitCode = exitCode;
    }),
  ),
  NodeRuntime.runMain,
);
