// Secret bundles. Secret Manager bills per active secret version beyond a free tier of six per
// billing account, so every App Hosting secret lives in one of two JSON bundles, each ONE secret
// with ONE enabled version, bound in apphosting.yaml as a single RUNTIME env var:
//   SAOC_APP_SECRETS      everything except payment-gateway credentials
//   SAOC_PAYMENT_SECRETS  Ozow and PayFast credentials, so the live-Ozow swap touches only this one
// Each bundle is a JSON object of string values. getSecret(name) reads the bundles first and falls
// back to process.env[name], so local dev with .env.local (one variable per secret) is unchanged.
//
// Edge-safe: imports nothing, so proxy.ts can use it. A malformed bundle throws; the message names
// the bundle variable (and the offending key), never a value.

export const SECRET_BUNDLE_VARS = ['SAOC_APP_SECRETS', 'SAOC_PAYMENT_SECRETS'] as const;

type SecretMap = Record<string, string>;

const parsedByRaw = new Map<string, SecretMap>();

function parseBundle(varName: string, raw: string): SecretMap {
  const cached = parsedByRaw.get(raw);
  if (cached) return cached;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `${varName} is not valid JSON; refusing to start with a corrupt secret bundle.`
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${varName} must be a JSON object of string values.`);
  }

  const map: SecretMap = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`${varName} key ${key} must be a string.`);
    }
    map[key] = value;
  }
  parsedByRaw.set(raw, map);
  return map;
}

function readBundles(): SecretMap[] {
  const bundles: SecretMap[] = [];
  for (const varName of SECRET_BUNDLE_VARS) {
    const raw = process.env[varName];
    if (raw) bundles.push(parseBundle(varName, raw));
  }
  return bundles;
}

export function getSecret(name: string): string | undefined {
  for (const bundle of readBundles()) {
    if (Object.prototype.hasOwnProperty.call(bundle, name)) return bundle[name];
  }
  return process.env[name];
}

// For helpers that take an env record (speakers-partner, payments, show-pages): process.env with
// every bundle key layered on top.
export function secretsEnv(): Record<string, string | undefined> {
  return Object.assign({}, process.env, ...readBundles());
}
