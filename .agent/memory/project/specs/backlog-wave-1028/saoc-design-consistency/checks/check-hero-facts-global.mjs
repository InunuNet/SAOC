// F1c: the `.hero-facts` levers are GLOBAL, never per route. On the SAOC host the selector `.hero-facts` appears only in app/globals.css; the NOS host's own
// overrides live under app/(nos)/ behind `.nos-theme`. Any other file styling `.hero-facts` (a route stylesheet, a CSS module, an inline <style>) fails.
import { execFileSync } from 'node:child_process';
import { check, finish } from './lib.mjs';
let out = '';
try { out = execFileSync('git', ['grep', '-n', '--', '\\.hero-facts\\|\\[&_\\.hero-facts', '--', 'app', 'components', 'lib', ':!app/globals.css', ':!app/(nos)'], { encoding: 'utf8' }); } catch { /* git grep exits 1 on no match */ }
for (const line of out.split('\n').filter(Boolean)) check(false, `per-route .hero-facts styling outside app/globals.css: ${line.slice(0, 140)}`);
finish('hero-facts-global');
