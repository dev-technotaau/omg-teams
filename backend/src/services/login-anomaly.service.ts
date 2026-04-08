import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";
import { COUNTRY_CENTROIDS, haversineKm } from "../data/country-centroids.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Login Anomaly Evaluator — §16 hardening
//
//  Layered defenses for non-admin accounts that sit ON TOP of device
//  binding. Device binding catches "wrong device"; this catches:
//
//    • Right device, wrong country (stolen/cloned device cookie)
//    • Right device, impossible travel (definitive fraud)
//    • Suspicious IP infrastructure (TOR exits, high CF threat score)
//
//  Two entry points:
//
//    evaluateIpReputation(ip, cfThreatScore)
//      Pre-credential check. Cheap, IP-only. Runs as early as possible
//      so credential-stuffing bots from TOR exits never get to bcrypt.
//      Hard-block, no bypass.
//
//    evaluateUserAnomaly(userId, geoLocation)
//      Post-credential check. Compares against the user's login history
//      to detect new countries and impossible travel. Runs only after
//      password verification so attackers can't probe the baseline.
//      New-country → hard-block (backup code bypass allowed).
//      Impossible-travel → hard-block (no bypass).
//
//  Admins are exempt — admins legitimately log in from any country, and
//  device binding doesn't apply to them either.
// ──────────────────────────────────────────────

const TOR_EXIT_REDIS_KEY = "ip:tor";
/** CF threat score threshold (0-100). Cloudflare flags >30 as suspicious. */
const CF_THREAT_SCORE_BLOCK_THRESHOLD = 30;
/** How many recent successful logins make up a user's "country baseline". */
const BASELINE_LOOKBACK_LIMIT = 30;
/**
 * Minimum baseline size before we trip on new countries. Without this, the
 * very first cross-country login (e.g. user travels for the first time) would
 * always be flagged.
 */
const BASELINE_MIN_FOR_DECISION = 3;
/**
 * Maximum realistic travel speed in km/h. 1000 km/h covers commercial
 * aviation cruising speed (~900) plus margin. Anything above this between
 * two consecutive logins is physically impossible → fraud.
 */
const MAX_TRAVEL_SPEED_KMH = 1000;

export type AnomalyVerdict =
  | { allowed: true }
  | {
      allowed: false;
      /** Internal reason — used for logging + LoginHistory.failureReason */
      reason: string;
      /**
       * Whether the user can bypass this block by supplying a valid backup
       * code (same flow as device-mismatch). Only true for "new country"
       * since impossible-travel and IP reputation are always fraud.
       */
      allowBackupCode: boolean;
      /** Country code that triggered the block, if applicable */
      country?: string;
    };

// ──────────────────────────────────────────────
//  IP reputation (pre-credential)
// ──────────────────────────────────────────────

/**
 * Pre-credential IP reputation check. Hard-blocks TOR exits and high CF
 * threat scores. Recruiters and reporting managers do not legitimately use
 * TOR or VPNs (per ops policy), so blocking these outright is safe.
 */
export async function evaluateIpReputation(
  ipAddress: string | undefined,
  cfThreatScore: number | undefined,
): Promise<AnomalyVerdict> {
  // No IP → can't evaluate, allow (rate limiter still applies)
  if (!ipAddress) return { allowed: true };

  // Cloudflare threat score — free intelligence from the upstream proxy.
  // CF rates each request 0–100; >30 is "suspicious", >50 is "highly likely
  // to be malicious". We block at 30 since recruiters don't use Tor/VPNs.
  if (
    typeof cfThreatScore === "number" &&
    Number.isFinite(cfThreatScore) &&
    cfThreatScore > CF_THREAT_SCORE_BLOCK_THRESHOLD
  ) {
    return {
      allowed: false,
      reason: `CF threat score ${cfThreatScore} > ${CF_THREAT_SCORE_BLOCK_THRESHOLD}`,
      allowBackupCode: false,
    };
  }

  // TOR exit list — refreshed every 2h by tor-list.queue.ts into a Redis set.
  // Tolerate Redis errors (don't fail-open hard, but don't fail-closed
  // either if Redis is briefly unavailable — the rate limiter still bounds
  // attack volume).
  try {
    const redis = getRedisClient();
    const isTor = await redis.sismember(TOR_EXIT_REDIS_KEY, ipAddress);
    if (isTor === 1) {
      return {
        allowed: false,
        reason: "TOR exit node",
        allowBackupCode: false,
      };
    }
  } catch (err) {
    logger.warn("TOR exit check failed (Redis error)", { error: (err as Error).message });
  }

  return { allowed: true };
}

// ──────────────────────────────────────────────
//  User-context anomaly (post-credential)
// ──────────────────────────────────────────────

interface GeoSnapshot {
  country?: string | null;
  city?: string | null;
  region?: string | null;
}

/**
 * Post-credential anomaly check. Runs only after password has verified, so
 * the attacker would already need to know the right credentials to probe
 * this surface (and at that point, lockout + notifications take over).
 *
 * Returns:
 *   • { allowed: true } if no anomaly
 *   • { allowed: false, allowBackupCode: true } for new-country (legit
 *     traveling user can unlock with admin-issued backup code)
 *   • { allowed: false, allowBackupCode: false } for impossible-travel
 *     (no realistic legit cause — always fraud)
 */
export async function evaluateUserAnomaly(
  userId: string,
  geo: GeoSnapshot | undefined,
): Promise<AnomalyVerdict> {
  const country = geo?.country?.toUpperCase().trim();

  // No country → CF/proxy headers missing, can't evaluate. Allow.
  // (This happens in dev when not behind CF, or for direct-IP requests.)
  if (!country) return { allowed: true };

  const prisma = getPrisma();

  // Pull last N successful logins WITH a recorded country, ordered most-recent
  // first. We need both the baseline set AND the most recent successful login
  // (for the velocity check), so a single query covers both.
  //
  // NOTE: Prisma's `{ not: null }` filter on a `Json?` column requires
  // `Prisma.DbNull`, NOT TypeScript null — see Prisma docs on Json filtering.
  const recent = await prisma.loginHistory.findMany({
    where: {
      userId,
      success: true,
      geoLocation: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    take: BASELINE_LOOKBACK_LIMIT,
    select: { geoLocation: true, createdAt: true },
  });

  // Build the country baseline set
  const baselineCountries = new Set<string>();
  for (const r of recent) {
    const c = extractCountry(r.geoLocation);
    if (c) baselineCountries.add(c);
  }

  // ── Check 1: Velocity / impossible travel ──
  // Compare against the *most recent* successful login regardless of country.
  // If the user was in country A 10 minutes ago and is now in country B, the
  // implied travel speed is computed from the centroids. >1000 km/h = fraud.
  const lastLogin = recent[0];
  if (lastLogin) {
    const lastCountry = extractCountry(lastLogin.geoLocation);
    if (lastCountry && lastCountry !== country) {
      const a = COUNTRY_CENTROIDS[lastCountry];
      const b = COUNTRY_CENTROIDS[country];
      if (a && b) {
        const distanceKm = haversineKm(a, b);
        const elapsedSec = Math.max(1, (Date.now() - lastLogin.createdAt.getTime()) / 1000);
        const elapsedHours = elapsedSec / 3600;
        const speedKmh = distanceKm / elapsedHours;

        if (speedKmh > MAX_TRAVEL_SPEED_KMH) {
          return {
            allowed: false,
            reason: `Impossible travel: ${lastCountry}→${country}, ${Math.round(distanceKm)}km in ${Math.round(elapsedSec / 60)}min (${Math.round(speedKmh)}km/h)`,
            allowBackupCode: false,
            country,
          };
        }
      }
    }
  }

  // ── Check 2: New country baseline ──
  // Only trips after the user has at least N historical countries on record,
  // so a brand-new account doesn't get blocked on every login.
  if (baselineCountries.size >= BASELINE_MIN_FOR_DECISION && !baselineCountries.has(country)) {
    return {
      allowed: false,
      reason: `New country: ${country} (baseline: ${[...baselineCountries].join(",")})`,
      allowBackupCode: true,
      country,
    };
  }

  return { allowed: true };
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

/** Pull a normalized ISO country code out of a stored geoLocation Json blob */
function extractCountry(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const country = (raw as { country?: unknown }).country;
  if (typeof country !== "string") return null;
  const trimmed = country.toUpperCase().trim();
  return trimmed.length > 0 ? trimmed : null;
}
