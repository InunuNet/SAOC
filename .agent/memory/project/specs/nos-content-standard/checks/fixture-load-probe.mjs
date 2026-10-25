// Child process for A16: import lib/sanity-fixture.ts the way the server does (module load) under whatever environment the parent set.
// Exit 0 and print "LOADED active=<bool>" if it loads, exit 1 and print "THREW <message>" if module load throws.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

register();
try {
  const m = await import(pathToFileURL(path.resolve(process.env.NOS_STD_ROOT ?? process.cwd(), 'lib/sanity-fixture.ts')).href);
  console.log(`LOADED active=${m.isFixtureActive()}`);
  process.exit(0);
} catch (e) {
  console.log(`THREW ${String(e && e.message).slice(0, 160)}`);
  process.exit(1);
}
