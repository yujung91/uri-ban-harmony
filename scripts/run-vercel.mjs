// Explicitly select Next.js without changing the Sites/Vinext execution profile.
import { fileURLToPath } from 'node:url';
process.env.HARMONY_NEXT_RUNTIME = '1';
const cli = new URL('../node_modules/next/dist/bin/next', import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), ...process.argv.slice(2)];
await import(cli.href);
