import { ZodSchema } from 'zod';
import { ErrorCode, ToolCallEnvelope } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errorCode?: ErrorCode;
  errors?: string[];
  envelope?: ToolCallEnvelope;
}

export function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export function validateEnvelope(value: unknown): ValidationResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Record<string, unknown>).tool_name !== 'string' ||
    typeof (value as Record<string, unknown>).args !== 'object' ||
    (value as Record<string, unknown>).args === null ||
    Array.isArray((value as Record<string, unknown>).args)
  ) {
    return {
      ok: false,
      errorCode: 'INVALID_ENVELOPE',
      errors: ['Output must be a JSON object with "tool_name" (string) and "args" (object)'],
    };
  }
  return {
    ok: true,
    envelope: value as ToolCallEnvelope,
  };
}

export function validateAllowlist(toolName: string, allowlist: string[]): ValidationResult {
  if (!allowlist.includes(toolName)) {
    return {
      ok: false,
      errorCode: 'TOOL_NOT_ALLOWED',
      errors: [`Tool "${toolName}" is not in the allowlist: [${allowlist.join(', ')}]`],
    };
  }
  return { ok: true };
}

export function validateToolExists(
  toolName: string,
  getSchema: (name: string) => ZodSchema<unknown> | undefined,
): ValidationResult {
  if (!getSchema(toolName)) {
    return {
      ok: false,
      errorCode: 'UNKNOWN_TOOL',
      errors: [`Tool "${toolName}" is not registered`],
    };
  }
  return { ok: true };
}

export function validateArgs(
  args: Record<string, unknown>,
  schema: ZodSchema<unknown>,
): ValidationResult {
  const result = schema.safeParse(args);
  if (!result.success) {
    return {
      ok: false,
      errorCode: 'INVALID_ARGS',
      errors: result.error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`),
    };
  }
  return { ok: true };
}
