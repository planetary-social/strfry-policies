import { Keydb } from "../deps.ts";

import type { Policy } from "../types.ts";

/** Policy options for `rateLimitPolicy`. */
interface RateLimit {
  /** How often (ms) to check whether `max` has been exceeded. Default: `60000` (1 minute). */
  interval?: number;
  /** How long (ms) to ban IPs that were rate-limited. Default: `0` (never). */
  ban_interval?: number;
  /** Max number of requests within the `interval` until the IP is rate-limited. Default: `10`. */
  max?: number;
  /** List of IP addresses to skip this policy. */
  whitelist?: string[];
  /** Database connection string. Default: `sqlite:///tmp/strfry-rate-limit-policy.sqlite3` */
  databaseUrl?: string;
}

/**
 * Rate-limits users by their IP address.
 *
 * IPs are stored in an SQLite database. If you are running internal services,
 * it's a good idea to at least whitelist `127.0.0.1` etc.
 *
 * @example
 * ```ts
 * // Limit to 10 events per second.
 * rateLimitPolicy(msg, { max: 10, interval: 60000 });
 * ```
 */
const rateLimitPolicy: Policy<RateLimit> = async (msg, opts = {}) => {
  const {
    interval = 60000,
    ban_interval = 0,
    max = 10,
    whitelist = [],
    databaseUrl = "sqlite:///tmp/strfry-rate-limit-policy.sqlite3",
  } = opts;

  if (
    (msg.sourceType === "IP4" || msg.sourceType === "IP6") &&
    !whitelist.includes(msg.sourceInfo)
  ) {
    const db = new Keydb(databaseUrl);
    const count = (await db.get<number>(msg.sourceInfo)) || 0;
    await db.set(msg.sourceInfo, count + 1, interval);

    if (count >= max) {
      if (ban_interval > 0) {
        await db.set(`${msg.sourceInfo}-banned`, true, ban_interval);
      }

      return {
        id: msg.event.id,
        action: "reject",
        msg: "rate-limited: too many requests",
      };
    }
  }

  if (ban_interval > 0) {
    const db = new Keydb(databaseUrl);
    const is_banned =
      (await db.get<boolean>(`${msg.sourceInfo}-banned`)) ?? false;

    if (is_banned) {
      console.error(
        `Banned rate-limited IP ${msg.sourceInfo}. Pubkey: ${msg.event.pubkey}, kind: ${msg.event.kind}, id ${msg.event.id}.`
      );

      return {
        id: msg.event.id,
        action: "shadowReject",
        msg: "",
      };
    }
  }

  return {
    id: msg.event.id,
    action: "accept",
    msg: "",
  };
};

export default rateLimitPolicy;

export type { RateLimit };
