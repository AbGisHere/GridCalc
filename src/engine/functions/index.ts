import { infoFunctions } from './info';
import { logicalFunctions } from './logical';
import { lookupFunctions } from './lookup';
import { mathFunctions } from './math';
import { statisticalFunctions } from './statistical';
import { textFunctions } from './text';
import type { FnDef } from './types';

export type { Category, FnContext, FnDef } from './types';

export const FUNCTIONS: readonly FnDef[] = [
  ...mathFunctions,
  ...statisticalFunctions,
  ...logicalFunctions,
  ...textFunctions,
  ...lookupFunctions,
  ...infoFunctions,
].sort((a, b) => a.name.localeCompare(b.name));

const registry = new Map(FUNCTIONS.map((f) => [f.name, f]));

export const FUNCTION_NAMES: readonly string[] = FUNCTIONS.map((f) => f.name);

export const getFunction = (name: string): FnDef | undefined => registry.get(name.toUpperCase());

export function describeArity(def: FnDef): string {
  const plural = (n: number) => `${n} argument${n === 1 ? '' : 's'}`;
  if (def.max === Infinity) return `at least ${plural(def.min)}`;
  if (def.min === def.max) return def.min === 0 ? 'no arguments' : `exactly ${plural(def.min)}`;
  return `${def.min} to ${def.max} arguments`;
}

/** Does argument i of this function accept a multi-cell range? */
export function acceptsRange(def: FnDef, i: number): boolean {
  return def.ranges === 'all' || (Array.isArray(def.ranges) && def.ranges.includes(i));
}
