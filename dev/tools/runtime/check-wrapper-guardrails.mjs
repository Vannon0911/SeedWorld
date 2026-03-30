import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "app", "src", "sot", "wrapper-guardrails.json");
const allowedStates = new Set(["active", "warn", "expired", "removed"]);
const requiredFields = [
  "wrapperId",
  "owner",
  "ticketRef",
  "canonicalTarget",
  "introducedAt",
  "expiresAt",
  "state",
  "reason",
  "lastObservedAt"
];

/**
 * Validate that a string matches the `YYYY-MM-DD` date format and return it.
 * @param {string} value - The date string to validate (expected `YYYY-MM-DD`).
 * @param {string} fieldName - The field name to include in the error message if validation fails.
 * @param {string} wrapperId - The wrapper identifier to include in the error message if validation fails.
 * @returns {string} The original `value` when it matches `YYYY-MM-DD`.
 * @throws {Error} If `value` does not match `YYYY-MM-DD`, with message `[WRAPPER_GUARD] ${wrapperId}: ${fieldName} must be YYYY-MM-DD`.
 */
function parseDateOnly(value, fieldName, wrapperId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    throw new Error(`[WRAPPER_GUARD] ${wrapperId}: ${fieldName} must be YYYY-MM-DD`);
  }
  return value;
}

/**
 * Resolve the effective "today" date in UTC as a `YYYY-MM-DD` string.
 *
 * If the environment variable `WRAPPER_GUARD_NOW_UTC` is set and non-empty, it is validated to match `YYYY-MM-DD` and returned; otherwise the current UTC date is returned.
 *
 * @returns {string} The date string in `YYYY-MM-DD` format representing today in UTC or the validated override.
 * @throws {Error} If `WRAPPER_GUARD_NOW_UTC` is set but does not match `YYYY-MM-DD`.
 */
function resolveTodayUtc() {
  const override = String(process.env.WRAPPER_GUARD_NOW_UTC || "").trim();
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      throw new Error("[WRAPPER_GUARD] WRAPPER_GUARD_NOW_UTC must be YYYY-MM-DD");
    }
    return override;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Verifies that a named field on a wrapper entry is a non-empty string and returns it trimmed.
 * @param {Object} entry - The wrapper entry object (may contain `wrapperId` used in error messages).
 * @param {string} fieldName - The field name to validate on the entry.
 * @returns {string} The trimmed string value of the field.
 * @throws {Error} If the field is missing or is an empty/blank string; the error message includes the entry's `wrapperId` or `"unknown"`.
 */
function ensureStringField(entry, fieldName) {
  const value = entry?.[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`[WRAPPER_GUARD] ${entry?.wrapperId || "unknown"}: missing ${fieldName}`);
  }
  return value.trim();
}

/**
 * Validate the wrapper guardrails registry and emit warnings for wrappers expiring soon.
 *
 * Reads the JSON at `registryPath`, verifies the presence and required fields of `wrappers[]`,
 * enforces unique `wrapperId`, allowed `state` values, and ISO `YYYY-MM-DD` date formats, logs
 * warnings for wrappers with 7 or fewer days until `expiresAt`, and prints a final OK summary.
 *
 * @throws {Error} If the registry is missing `wrappers[]`, a required field is missing or blank,
 *                 a duplicate `wrapperId` is found, a `state` is invalid, a date is not `YYYY-MM-DD`,
 *                 or a wrapper's `expiresAt` is before the resolved today date.
 */
async function main() {
  const raw = await readFile(registryPath, "utf8");
  const parsed = JSON.parse(raw);
  const wrappers = Array.isArray(parsed?.wrappers) ? parsed.wrappers : null;
  if (!wrappers) {
    throw new Error("[WRAPPER_GUARD] registry must contain wrappers[]");
  }

  const today = resolveTodayUtc();
  const seenIds = new Set();
  const warns = [];

  for (const entry of wrappers) {
    for (const field of requiredFields) {
      ensureStringField(entry, field);
    }

    const wrapperId = entry.wrapperId.trim();
    if (seenIds.has(wrapperId)) {
      throw new Error(`[WRAPPER_GUARD] duplicate wrapperId: ${wrapperId}`);
    }
    seenIds.add(wrapperId);

    const state = entry.state.trim();
    if (!allowedStates.has(state)) {
      throw new Error(`[WRAPPER_GUARD] ${wrapperId}: invalid state '${state}'`);
    }

    parseDateOnly(entry.introducedAt.trim(), "introducedAt", wrapperId);
    const expiresAt = parseDateOnly(entry.expiresAt.trim(), "expiresAt", wrapperId);
    if (expiresAt < today) {
      throw new Error(`[WRAPPER_GUARD] ${wrapperId}: expired at ${expiresAt} (today=${today})`);
    }

    const daysLeft = Math.floor((Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    if (daysLeft <= 7) {
      warns.push(`[WRAPPER_GUARD] WARN ${wrapperId}: expires in ${daysLeft} day(s) at ${expiresAt}`);
    }
  }

  for (const warning of warns) {
    console.warn(warning);
  }
  console.log(`[WRAPPER_GUARD] OK wrappers=${wrappers.length} today=${today}`);
}

try {
  await main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
