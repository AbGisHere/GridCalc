/** A small showcase sheet: real calculations plus one example of each kind of error. */
export const SAMPLE_SHEET: Record<string, string> = {
  A1: 'Product',
  B1: 'Region',
  C1: 'Units',
  D1: 'Price',
  E1: 'Revenue',
  A2: 'Widget',
  B2: 'North',
  C2: '120',
  D2: '4.5',
  A3: 'Gadget',
  B3: 'South',
  C3: '45',
  D3: '19.99',
  A4: 'Gizmo',
  B4: 'North',
  C4: '80',
  D4: '7.25',
  A5: 'Doohickey',
  B5: 'East',
  C5: '15',
  D5: '49',
  A6: 'Sprocket',
  B6: 'South',
  C6: '200',
  D6: '1.2',
  A7: 'Thingamajig',
  B7: 'West',
  C7: '33',
  D7: '12.5',
  E2: '=C2*D2',
  E3: '=C3*D3',
  E4: '=C4*D4',
  E5: '=C5*D5',
  E6: '=C6*D6',
  E7: '=C7*D7',

  A9: 'Total revenue',
  E9: '=SUM(E2:E7)',
  A10: 'Average price',
  E10: '=ROUND(AVERAGE(D2:D7), 2)',
  A11: 'North units',
  E11: '=SUMIF(B2:B7, "North", C2:C7)',
  A12: 'Gizmo price',
  E12: '=VLOOKUP("Gizmo", A2:D7, 4, FALSE)',
  A13: 'Orders over 500',
  E13: '=COUNTIF(E2:E7, ">500")',
  A14: 'Status',
  E14: '=IF(E9>3000, "Target met", "Below target")',
  A15: 'Best seller',
  E15: '=INDEX(A2:A7, MATCH(MAX(E2:E7), E2:E7, 0))',
  A16: 'Summary',
  E16: '=CONCAT(COUNTA(A2:A7), " products, ", TEXT(E9, "$#,##0.00"))',

  // Errors with a one-click fix come first, so the first red cell a visitor clicks shows the whole diagnosis.
  G1: 'Error examples',
  H1: 'Click a red cell ↓',
  G2: 'Typo in function',
  H2: '=SUMM(C2:C7)',
  G3: 'Missing paren',
  H3: '=SUM(C2, C3',
  G4: 'Division by zero',
  H4: '=E9/(C2-120)',
  G5: 'Lookup miss',
  H5: '=VLOOKUP("Gizmo X", A2:D7, 4, FALSE)',
  G6: 'Text in maths',
  H6: '=A2*2',
  G7: 'Too few args',
  H7: '=IF(C2>5)',
  G8: 'Circular (A)',
  H8: '=H9+1',
  G9: 'Circular (B)',
  H9: '=H8*2',
  G10: 'Chained error',
  H10: '=H4+1',
};

/**
 * 10,000 data rows (60k+ cells) for stress-testing virtualization and recalculation.
 * Column E is a running total (a 10,000-long dependency chain), and the summary block
 * aggregates entire columns — so editing B2 ripples through ~10,000 cells, while editing
 * the last row touches only a handful.
 */
export function stressSheet(rows = 10_000): Record<string, string> {
  const cells: Record<string, string> = {
    A1: 'Item',
    B1: 'Qty',
    C1: 'Price',
    D1: 'Total',
    E1: 'Running total',
    F1: 'Band',
  };
  const last = rows + 1;
  for (let r = 2; r <= last; r++) {
    const i = r - 1;
    cells[`A${r}`] = `Item ${i}`;
    cells[`B${r}`] = String(((i * 7) % 50) + 1);
    cells[`C${r}`] = String(Math.round(((i * 13) % 97) * 2.5 + 5) / 10);
    cells[`D${r}`] = `=B${r}*C${r}`;
    cells[`E${r}`] = r === 2 ? '=D2' : `=E${r - 1}+D${r}`;
    cells[`F${r}`] = `=IF(D${r}>200, "High", IF(D${r}>80, "Mid", "Low"))`;
  }
  Object.assign(cells, {
    H1: 'Grand total',
    I1: `=SUM(D2:D${last})`,
    H2: 'Average',
    I2: `=AVERAGE(D2:D${last})`,
    H3: 'Largest',
    I3: `=MAX(D2:D${last})`,
    H4: 'High-band rows',
    I4: `=COUNTIF(F2:F${last}, "High")`,
    H5: 'Item 5000 total',
    I5: `=VLOOKUP("Item 5000", A2:D${last}, 4, FALSE)`,
    H6: 'Check',
    I6: `=IF(ROUND(I1-E${last}, 6)=0, "Running total matches", "Mismatch")`,
  });
  return cells;
}
