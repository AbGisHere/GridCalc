import { FUNCTIONS } from '@/engine/functions';

const REPO = 'https://github.com/AbGisHere/GridCalc';

export const DOCS = {
  source: REPO,
  architecture: `${REPO}/blob/main/docs/ARCHITECTURE.md`,
  functions: `${REPO}/blob/main/docs/FUNCTIONS.md`,
};

const SHORTCUTS: [string, string][] = [
  ['Arrows / Tab / Enter', 'Move, or start editing (Enter / F2)'],
  ['Shift + Arrows', 'Extend selection'],
  ['Ctrl/⌘ + Arrows', 'Jump to edge of data'],
  ['Type any key', 'Replace cell contents'],
  ['Esc', 'Cancel editing'],
  ['Esc, then Tab', 'Leave the sheet'],
  ['Ctrl/⌘ + K', 'Search commands, functions and cells'],
  ['F6 / Shift + F6', 'Move between toolbar, formula bar, demo guide and sheet'],
  ['Delete / Backspace', 'Clear selection'],
  ['Ctrl/⌘ + Z / Y', 'Undo / Redo'],
  ['Ctrl/⌘ + C / X / V', 'Copy / Cut / Paste (formulas re-target)'],
  ['Ctrl/⌘ + D / R', 'Fill down / right'],
  ['Drag the fill handle', 'Copy formulas or continue a series'],
  ['Click cells while typing a formula', 'Insert references'],
  ['F8 / Shift + F8', 'Next / previous error'],
  ['Ctrl/⌘ + .', 'Apply the suggested fix'],
  ['F9', 'Recalculate everything'],
  ['Shift + F3', 'Open or close the function list'],
];

export function HelpContent() {
  return (
    <div className="help-content">
      <p>Start in a cell with text, a number or a formula such as =SUM(A1:A3). Demos provides worked examples.</p>
      <h2>Touch</h2>
      <p>Tap a cell, then edit in the formula bar; double-tap starts editing there. Apply saves the edit; Cancel discards it.</p>
      <p>Swipe to scroll. Drag the round grip at the selection’s top-left to select a range, or its bottom-right fill handle to copy formulas or continue a series.</p>
      <h2>Keyboard & pointer</h2>
      <table>
        <tbody>
          {SHORTCUTS.map(([key, description]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              <td>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Under the hood</h2>
      <ul className="doc-links">
        <li>
          <a className="doc-link" href={DOCS.architecture} target="_blank" rel="noopener noreferrer">How the engine works</a>
        </li>
        <li>
          <a className="doc-link" href={DOCS.functions} target="_blank" rel="noopener noreferrer">All {FUNCTIONS.length} functions</a>
        </li>
        <li>
          <a className="doc-link" href={DOCS.source} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        </li>
      </ul>
    </div>
  );
}
