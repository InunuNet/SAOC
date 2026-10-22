// Runs `next build` in its own process group and kills the whole group on a timeout, so a hung static-generation worker cannot outlive the
// check (a hung build once ran for 81 minutes). QA input, hash-locked. Usage: node _build.mjs <next-bin> <timeoutMs>; exit 124 on timeout.
import { spawn } from 'node:child_process';

const [nextBin, timeoutMs] = process.argv.slice(2);
const child = spawn(nextBin, ['build'], { stdio: 'inherit', detached: true });
const killGroup = (signal) => { try { process.kill(-child.pid, signal); } catch { /* group already gone */ } };
const timer = setTimeout(() => { console.error(`next build exceeded ${timeoutMs}ms: killing its process group`); killGroup('SIGKILL'); process.exit(124); }, Number(timeoutMs));
child.once('exit', (code) => { clearTimeout(timer); killGroup('SIGKILL'); process.exit(code ?? 1); });
