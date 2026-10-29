/**
 * Browser half of Firebase App Check for the checkout POST (spec.md D7). Returns a fresh
 * limited-use token per call, or null. It never throws into the checkout submit and never caches
 * a token: with the server flag off a null costs the buyer nothing, with it on the server decides.
 *
 * No script when off: the site key is a build-time public env var, read as a literal
 * `process.env.` expression so a build without it constant-folds the only dynamic import of the
 * App Check SDK away. A flag-off bundle then contains no reCAPTCHA Enterprise or App Check code
 * (proved by the bundle scan in the sec-abuse-controls contract). The SDK is never imported
 * statically anywhere.
 */

const BUILD_SITE_KEY = process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY;

export interface AppCheckTokenSource {
  getLimitedUseToken(siteKey: string): Promise<string>;
}

export interface AppCheckClientDeps {
  siteKey?: string;
  load?: () => Promise<AppCheckTokenSource>;
}

// The whole SDK-touching implementation sits inside the build-key ternary, so a build without
// the key drops it (and its string literals) from the bundle entirely, not just the import.
const loadBuildSource = BUILD_SITE_KEY
  ? async (): Promise<AppCheckTokenSource> => {
      const sdk = await import('firebase/app-check');
      const { getFirebaseApp } = await import('./firebase');
      let appCheck: ReturnType<typeof sdk.initializeAppCheck> | null = null;
      return {
        async getLimitedUseToken(siteKey: string): Promise<string> {
          appCheck ??= sdk.initializeAppCheck(getFirebaseApp(), {
            provider: new sdk.ReCaptchaEnterpriseProvider(siteKey),
            isTokenAutoRefreshEnabled: false,
          });
          return (await sdk.getLimitedUseToken(appCheck)).token;
        },
      };
    }
  : undefined;

let defaultSource: Promise<AppCheckTokenSource> | null = null;

function loadDefaultSource(): Promise<AppCheckTokenSource> {
  if (!loadBuildSource) return Promise.reject(new Error('App Check is not built into this bundle'));
  defaultSource ??= loadBuildSource();
  return defaultSource;
}

export async function getCheckoutAppCheckToken(deps: AppCheckClientDeps = {}): Promise<string | null> {
  const siteKey = (deps.siteKey ?? BUILD_SITE_KEY)?.trim();
  // anchor: client-gate
  if (!siteKey) return null;
  try {
    const source = await (deps.load ?? loadDefaultSource)();
    return await source.getLimitedUseToken(siteKey);
  } catch {
    return null;
  }
}
