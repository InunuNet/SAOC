export interface CheckoutAppCheckClient {
  getCheckoutAppCheckToken(): Promise<string | null>;
}

export async function appCheckHeaders(
  loadClient: (() => Promise<CheckoutAppCheckClient>) | undefined,
): Promise<Record<string, string>> {
  if (!loadClient) return {};
  try {
    const token = await (await loadClient()).getCheckoutAppCheckToken();
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    // anchor: appcheck-header-fallback
    return {};
  }
}
