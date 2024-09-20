import { readLines } from "./deps.ts";

import type { InputMessage, OutputMessage } from "./types.ts";

/**
 * Parse strfy messages from stdin.
 * strfry may batch multiple messages at once.
 *
 * @example
 * ```ts
 * // Loop through strfry input messages
 * for await (const msg of readStdin()) {
 *   // handle `msg`
 * }
 * ```
 */
async function* readStdin(): AsyncGenerator<InputMessage> {
  for await (const line of readLines(Deno.stdin)) {
    try {
      yield JSON.parse(line);
    } catch (e) {
      console.error(line);
      throw e;
    }
  }
}

/** Writes the output message to stdout. */
function writeStdout(msg: OutputMessage): void {
  console.log(JSON.stringify(msg));
}

/** Log to stderr. Ensure we don't send the logs through the buffer and we don't
 * block */
function log(message: string) {
  setTimeout(() => {
    try {
      Deno.stderr.writeSync(new TextEncoder().encode(message + "\n"));
    } catch (e) {
      // This is buffered but at least we don't fails silently
      console.error("Logging failed:", e);
    }
  }, 0);
}

export { readStdin, writeStdout, log };
