/**
 * Generates docs/FUNCTIONS.md from the function registry, so the documentation
 * can never drift from what the engine actually supports.
 *   npm run docs:functions
 */
import { writeFileSync } from 'node:fs';
import { FUNCTIONS, type Category } from '../src/engine/functions';

const ORDER: Category[] = ['Math', 'Statistical', 'Logical', 'Lookup', 'Text', 'Information'];
const esc = (s: string) => s.replace(/\|/g, '\\|');

const lines: string[] = [
  '# Supported functions',
  '',
  `GridCalc implements **${FUNCTIONS.length} functions** in its own formula engine (no third-party formula library).`,
  'Optional arguments are shown in `[brackets]`. Function names are case-insensitive.',
  '',
  '> Generated from `src/engine/functions` by `npm run docs:functions`.',
  '',
  '## Contents',
  '',
  ...ORDER.map((c) => `- [${c}](#${c.toLowerCase()}) (${FUNCTIONS.filter((f) => f.category === c).length})`),
  '',
];

for (const cat of ORDER) {
  lines.push(`## ${cat}`, '', '| Function | Description | Example |', '| --- | --- | --- |');
  for (const f of FUNCTIONS.filter((x) => x.category === cat)) {
    const flags = f.volatile ? ' *(volatile)*' : '';
    lines.push(`| \`${esc(f.signature)}\` | ${esc(f.description)}${flags} | ${f.example ? `\`${esc(f.example)}\`` : ''} |`);
  }
  lines.push('');
}

lines.push(
  '## Operators',
  '',
  '| Operator | Meaning | Precedence (high → low) |',
  '| --- | --- | --- |',
  '| `%` | Percent (postfix): `50%` = 0.5 | 1 |',
  '| `-` `+` (unary) | Negation | 2 |',
  '| `^` | Exponent (`-2^2` = 4, left-associative) | 3 |',
  '| `*` `/` | Multiply, divide | 4 |',
  '| `+` `-` | Add, subtract | 5 |',
  '| `&` | Text concatenation | 6 |',
  '| `=` `<>` `<` `>` `<=` `>=` | Comparison (text is case-insensitive) | 7 |',
  '',
  '## Error values',
  '',
  '| Error | Meaning |',
  '| --- | --- |',
  '| `#DIV/0!` | Division by zero |',
  '| `#VALUE!` | Wrong type of value (e.g. text used in arithmetic, a range where one value is expected) |',
  '| `#REF!` | Invalid reference (outside the sheet, or index outside a range) |',
  '| `#NAME?` | Unknown function or name |',
  '| `#N/A` | Value not found (lookups) |',
  '| `#NUM!` | Invalid numeric result (e.g. `SQRT(-1)`) |',
  '| `#CIRC!` | Circular reference |',
  '| `#ERROR!` | Formula syntax error |',
  '',
);

writeFileSync(new URL('../docs/FUNCTIONS.md', import.meta.url), lines.join('\n'));
console.log(`Wrote docs/FUNCTIONS.md (${FUNCTIONS.length} functions)`);
