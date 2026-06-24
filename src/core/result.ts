import { ClearLaneError } from "./errors.js";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ClearLaneError; fallbackUsed?: boolean };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(
  code: string,
  message: string,
  causeValue?: unknown,
  fallbackUsed?: boolean
): Result<T> {
  return {
    ok: false,
    error: new ClearLaneError(code, message, causeValue),
    ...(fallbackUsed !== undefined ? { fallbackUsed } : {})
  };
}
