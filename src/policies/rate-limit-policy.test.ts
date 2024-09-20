import { assertEquals } from "../deps.ts";
import { buildEvent, buildInputMessage } from "../test.ts";
import { Keydb } from "../deps.ts";

import rateLimitPolicy from "./rate-limit-policy.ts";
import { delay } from "https://deno.land/std@0.200.0/async/mod.ts";

const DATABASE_URL = "sqlite:///tmp/strfry-rate-limit-policy.sqlite3";

async function removeDb() {
  const url = new URL(DATABASE_URL);
  const path = url.pathname;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
}

Deno.test({
  name: "blocks events from IPs that are publishing events too quickly",
  fn: async () => {
    await removeDb();

    const opts = {
      max: 4,
      interval: 50,
      databaseUrl: DATABASE_URL,
    };

    const msg = buildInputMessage({
      sourceType: "IP4",
      sourceInfo: "1.1.1.1",
      event: buildEvent(),
    });

    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");

    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");

    await delay(50);

    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
  },
  sanitizeResources: false,
});

Deno.test({
  name: "shadow ban Ips during banInterval after exceeding rate limit",
  fn: async () => {
    await removeDb();

    const opts = {
      max: 4,
      interval: 50,
      banInterval: 100,
      databaseUrl: DATABASE_URL,
    };

    const msg = buildInputMessage({
      sourceType: "IP4",
      sourceInfo: "1.1.1.1",
      event: buildEvent(),
    });

    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");

    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");

    await delay(50);

    // Now the rate limit has elapsed, but the ip is still banned
    assertEquals((await rateLimitPolicy(msg, opts)).action, "shadowReject");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "shadowReject");

    await delay(50);

    // Here both rate limit and ip ban have elapsed
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");

    // And we hit it again
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
    assertEquals((await rateLimitPolicy(msg, opts)).action, "reject");

    await delay(50);

    // Once more
    assertEquals((await rateLimitPolicy(msg, opts)).action, "shadowReject");

    await delay(50);
    assertEquals((await rateLimitPolicy(msg, opts)).action, "accept");
  },
  sanitizeResources: false,
});
