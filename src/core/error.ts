/** Entity named by an error. Ids are the arena indices of a `Brep`. */
export type EntityRef =
  | { readonly kind: 'vertex' | 'edge' | 'coedge' | 'loop' | 'face' | 'shell' | 'body'; readonly id: number };

/** Kernel errors are values (upstream `SolidError`): library code never throws on input-derived data. */
export type SolidError =
  | { readonly kind: 'invalid-input'; readonly operation: string; readonly reason: string }
  | { readonly kind: 'not-found'; readonly operation: string; readonly entity: EntityRef }
  | { readonly kind: 'degenerate'; readonly operation: string; readonly entity?: EntityRef }
  | { readonly kind: 'not-converged'; readonly operation: string; readonly iterations: number }
  | { readonly kind: 'invalid-topology'; readonly operation: string; readonly reason: string; readonly entity?: EntityRef };

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SolidError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: SolidError): Result<T> {
  return { ok: false, error };
}

export function invalidInput<T = never>(operation: string, reason: string): Result<T> {
  return err({ kind: 'invalid-input', operation, reason });
}

/** Unwraps a result, throwing a `SolidKernelError` on failure. For tests and examples, not for kernel code. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new SolidKernelError(result.error);
}

export class SolidKernelError extends Error {
  readonly error: SolidError;
  constructor(error: SolidError) {
    super(`${error.operation}: ${error.kind}`);
    this.name = 'SolidKernelError';
    this.error = error;
  }
}
