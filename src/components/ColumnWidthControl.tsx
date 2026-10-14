'use client';

import { useEffect, useId, useState } from 'react';
import { MAX_COL_WIDTH, MIN_COL_WIDTH } from './geometry';

export function ColumnWidthControl({ column, width, onResize }: { column: string; width: number; onResize(width: number): void }) {
  const id = useId();
  const [value, setValue] = useState(String(Math.round(width)));
  useEffect(() => setValue(String(Math.round(width))), [width]);
  return (
    <form className="column-width" onSubmit={(e) => {
      e.preventDefault();
      const next = Number(value);
      if (Number.isFinite(next) && next >= MIN_COL_WIDTH && next <= MAX_COL_WIDTH) onResize(next);
    }}>
      <label htmlFor={id}>Column {column} width (px)</label>
      <div>
        <input id={id} type="number" min={MIN_COL_WIDTH} max={MAX_COL_WIDTH} step="1" required value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit">Apply</button>
      </div>
    </form>
  );
}
