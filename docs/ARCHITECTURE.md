# Architecture

GridCalc has two halves with a hard boundary between them:

- **`src/engine/`**: a framework-free TypeScript calculation engine (lexer → parser → evaluator → dependency graph). It has no React or DOM imports and is fully unit-tested in Node.
- **`src/components/` + `src/state/`**: the React UI (virtualized grid, formula bar, diagnostics) and pure UI logic (selection, undo/redo, drag-to-fill, clipboard parsing).

```
 keystroke ─► Spreadsheet (controller) ─► engine.setCells(edits)
                                             │
                     ┌───────────────────────┼─────────────────────────┐
                     ▼                       ▼                         ▼
               lexer.tokenize ─► parser.parseFormula ─► references.collectReferences
                                     │ (AST or Diagnostic)          │ (cells + ranges)
                                     ▼                              ▼
                              evaluator.evaluate ◄── topological order ◄── dependency graph
                                     │                                   (Tarjan SCC → #CIRC!)
                                     ▼
                        cell values ─► engine.version++ ─► Grid re-renders visible cells only
```

## 1. Lexer: `src/engine/lexer.ts`

A hand-written single-pass scanner turns formula text into tokens: numbers, strings, booleans, cell references (`A1`, `$B$2`), identifiers (function names), error literals (`#N/A`), operators and punctuation.

- Every token keeps its **exact source position**. Diagnostics use the positions to place the caret, and the reference shifter uses them to rewrite formulas without touching their formatting.
- Ambiguity such as `LOG10(` (which looks like cell `LOG10`) is resolved by looking ahead: a word followed by `(` is always a function name.
- Common typos get their own diagnostics with a fix: `==` → `=`, `!=` → `<>`, `=>` → `>=`, `**` → `^`, `;` → `,`, curly quotes → straight quotes, unterminated strings.

## 2. Parser: `src/engine/parser.ts`

A **Pratt (top-down operator-precedence) parser** builds an AST (`src/engine/ast.ts`). Each operator has a binding power:

| Level | Operators |
| --- | --- |
| 1 (lowest) | `=` `<>` `<` `>` `<=` `>=` |
| 2 | `&` |
| 3 | `+` `-` |
| 4 | `*` `/` |
| 5 | `^` |
| 6 | unary `-` `+` (so `-2^2 = 4`, as in Excel) |
| 7 | postfix `%` |

Ranges (`A1:B10`), nested parentheses, and nested function calls with any number of arguments are handled in the prefix parselets.

### Error diagnostics

The parser stops at the first problem and throws a structured `Diagnostic`:

```ts
{ code: '#ERROR!', message: 'Missing closing parenthesis.', start: 11, end: 11,
  suggestion: "Add ')' at the end of the formula.", fix: '=SUM(A1, B2)',
  related: { start: 4, end: 5, label: 'opened here' } }
```

- **Position.** `start`/`end` index into the raw formula, and the UI draws a `^~~` caret under that span. `related` marks a second location, such as the unmatched `(`.
- **Targeted messages.** Missing or extra parentheses, a missing value after an operator, a missing comma between arguments, trailing or empty arguments, incomplete ranges, references outside the sheet, bare unknown names, and more.
- **Semantic validation** runs after parsing. Unknown functions get a "Did you mean SUM?" suggestion based on Levenshtein distance, and wrong argument counts are reported together with the function's signature.
- **Verified fixes.** A fix is offered only if the corrected formula actually parses. If the first fix still leaves an error, fixes are chained. For example, `=SUM(A1, B2+` first loses the trailing `+`, then gets a `)`, giving `=SUM(A1, B2)`. If no chain produces a valid formula, no fix button is shown.

## 3. Evaluator: `src/engine/evaluator.ts`

A recursive tree-walking interpreter over the AST.

- **Values** (`values.ts`): `number | string | boolean | null (empty) | CellError`. Ranges evaluate to a `RangeValue`, a 2-D block with a label used in error messages.
- **Coercion** (`coerce.ts`) follows spreadsheet rules: an empty cell is 0 or `""`, `TRUE` is 1, numeric text becomes a number, comparisons order number < text < boolean, and text compares case-insensitively. Numbers are compared at 15 significant digits, so `0.1+0.2=0.3` is `TRUE`.
- **Errors are values.** They propagate through operators and functions. An error read through a reference is tagged with its `origin` cell, so the diagnostics panel can say *"This error comes from H2"* and link to that cell.
- **Runtime errors carry a span.** `=E9/(C2-120)` reports *"Division by zero: the divisor C2-120 evaluates to 0."* with the caret under `C2-120`.
- **Function dispatch** (`functions/`): every function is a declarative `FnDef` with its arity, which arguments accept ranges, and an eager `call` or a lazy `lazy` implementation. Lazy functions (`IF`, `IFS`, `IFERROR`, `IFNA`, `SWITCH`, `CHOOSE`, `NOT`) receive thunks, so `IF(TRUE, 1, 1/0)` never evaluates the division. Functions abort by throwing a `CellError`, which the dispatcher catches and turns into a value. One registry drives parsing, validation, autocomplete, the in-app function browser and `docs/FUNCTIONS.md`.

## 4. Dependency tracking & recalculation: `src/engine/engine.ts`, `graph.ts`

### The graph

When a formula is written, `collectReferences` statically extracts what it reads, and the engine records edges in the **dependents** direction (input cell → formulas that read it):

- **Single-cell references** go in `Map<cellKey, Set<formulaKey>>`.
- **Range references** go in a **spatial index** (`RangeIndex`) instead of being expanded. Each range is filed under the 64-row buckets it overlaps. `=SUM(A1:A100000)` therefore costs about 1,600 bucket entries instead of 100,000 edges. It also automatically depends on cells that are empty today and filled in later.

Editing a formula first unlinks its old edges, so the graph always matches the current formulas.

### Incremental recalculation

`setCells(edits)` applies a batch of edits and then:

1. **Collects the affected subgraph:** a breadth-first search from the edited cells (plus volatile `RAND` cells) along dependent edges. Cells outside this set are never touched.
2. **Orders it** with **Tarjan's strongly-connected-components algorithm**. Tarjan's algorithm emits components in reverse topological order, so the engine walks the list backwards and evaluates every cell after all of its inputs, and each cell exactly once (a diamond `A1→B1,C1→D1` evaluates D1 once).
3. **Handles cycles.** Any component with more than one cell, or a cell that references itself, is a circular reference. Every cell in it gets `#CIRC!` with the cycle spelled out (*"Circular reference: H5 → H6 → H5"*), found by a breadth-first search inside the component. The caret points at the exact reference that closes the loop. Cells downstream of a cycle receive the propagated error. Nothing loops, nothing recurses unboundedly, and breaking the cycle recalculates the cells normally.

Tarjan's algorithm is implemented **iteratively**, so a 20,000-cell dependency chain (tested) cannot overflow the JavaScript call stack.

The status bar reports how many cells each edit re-evaluated. In the 10k-row stress test, editing `B2` recalculates about 10,008 cells (its total, the 10,000-long running-total chain, and the summaries), while editing `B10001` recalculates about 9.

## 5. Grid virtualization: `src/components/Grid.tsx`

The sheet is 100,000 rows × 100 columns (10 million cells). The grid is a custom virtualizer, with no grid library:

- A scroll container holds a "canvas" sized to the full sheet (2.6 million px tall), so native scrolling, scrollbars and momentum all work.
- On scroll (throttled with `requestAnimationFrame`), the visible window is computed. Rows are a fixed height, and columns are looked up with **prefix sums plus binary search**, so resizable columns cost O(log n). Only the visible cells plus a small overscan are rendered, typically 500–700 elements.
- Empty cells render nothing. Horizontal grid lines are one CSS background, and vertical lines are one element per visible column.
- Column and row headers are `position: sticky` layers inside the same scroller, so they stay aligned without any JavaScript scroll syncing.
- Selection, the fill handle, reference highlights and the copy marquee are single absolutely-positioned overlays, not per-cell state.

## 6. UI state: `src/state/`

| Module | Responsibility |
| --- | --- |
| `history.ts` | Command-style undo/redo. Each entry stores `{before, after}` raw text for the cells it touched, plus the selection to restore. Batched actions such as fill, paste, clear and load are a single entry. |
| `fill.ts` | Drag-to-fill. Formulas are copied with relative references shifted (`$` anchors kept), numeric series are continued (1, 2 → 3, 4, 5), and numbered text counts up (`Item 9` → `Item 10`). |
| `selection.ts` | Anchor/head selection model, plus Ctrl+Arrow jump-to-edge. |
| `csv.ts` | RFC 4180 CSV import/export and TSV clipboard parsing. |

`engine/references.ts#shiftFormula` rewrites references token by token for fill and paste. References pushed off the sheet become `#REF!`.
