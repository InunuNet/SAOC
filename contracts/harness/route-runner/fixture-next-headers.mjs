export const cookieJar = new Map();
export async function cookies() {
  return {
    get: (name) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => { cookieJar.set(name, value); },
  };
}
