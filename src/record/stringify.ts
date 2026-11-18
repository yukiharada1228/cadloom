/**
 * Writing a record: `stringifyRecord(record)` is the canonical JSON text of a record, so that equal records
 * (hence equal bodies, through `brepToRecord`) give equal bytes.
 *
 * Canonical form: no whitespace; object keys in ascending code-unit order (whatever order the object was built
 * in); array items in order; absent optional fields omitted; numbers in ECMAScript's shortest round-trip
 * representation (`String(x)`, so `JSON.parse` gives the same double back; a record holds no `-0`, `NaN` or
 * `Infinity`, see `types.ts`); strings JSON-escaped. `parseRecordText(stringifyRecord(r))` is `r` field by
 * field, and `stringifyRecord(parseRecordText(s))` is `s` for every canonical `s`.
 *
 * Upstream consulted: `solidcore/crates/solidcore-record/src/brep.rs` (serde field naming; the record as the
 * persisted form) — SolidCraft / solidcore, Apache-2.0 OR MIT. Not a translation.
 */
import type { BrepRecord } from './types.ts';

/** Canonical JSON of plain record data (bounded depth: a record nests at most five levels). */
function canonical(v: unknown, out: string[]): void {
  if (typeof v === 'number') {
    out.push(String(v === 0 ? 0 : v));
  } else if (typeof v === 'string') {
    out.push(JSON.stringify(v));
  } else if (typeof v === 'boolean') {
    out.push(v ? 'true' : 'false');
  } else if (Array.isArray(v)) {
    out.push('[');
    v.forEach((x: unknown, i) => {
      if (i > 0) out.push(',');
      canonical(x, out);
    });
    out.push(']');
  } else if (typeof v === 'object' && v !== null) {
    const o = v as Readonly<Record<string, unknown>>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    out.push('{');
    keys.forEach((k, i) => {
      if (i > 0) out.push(',');
      out.push(JSON.stringify(k), ':');
      canonical(o[k], out);
    });
    out.push('}');
  } else {
    out.push('null');
  }
}

/** The canonical JSON text of a record (see the module comment). */
export function stringifyRecord(record: BrepRecord): string {
  const out: string[] = [];
  canonical(record, out);
  return out.join('');
}
