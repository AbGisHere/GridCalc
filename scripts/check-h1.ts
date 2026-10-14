/** Fails unless every prerendered page in the production build has exactly one <h1>. Run after `next build`. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), '.next/server/app');
const pages = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.html'));
if (pages.length === 0) throw new Error(`No built pages in ${dir}. Run \`npm run build\` first.`);

let failed = false;
for (const page of pages) {
  const count = readFileSync(join(dir, page), 'utf8').match(/<h1[\s>]/g)?.length ?? 0;
  console.log(`${count === 1 ? 'ok  ' : 'FAIL'} ${page}: ${count} <h1>`);
  if (count !== 1) failed = true;
}
if (failed) process.exit(1);
