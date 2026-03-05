import { ZodSchema } from 'zod';
import { ErrorCode, ToolCallEnvelope } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errorCode?: ErrorCode;
  errors?: string[];
  envelope?: ToolCallEnvelope;
}

export function stripMarkdownFences(raw: string): string {
  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : raw;
}

export function extractFirstJsonValue(raw: string): string | null {
  const openIdx = raw.search(/[{[]/);
  if (openIdx === -1) return null;

  const openChar = raw[openIdx];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = openIdx; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return raw.slice(openIdx, i + 1);
      }
    }
  }
  return null;
}

export function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Try stripping markdown fences first, then extract first JSON value
    const candidates = [stripMarkdownFences(raw), extractFirstJsonValue(raw)].filter(
      (c): c is string => c !== null,
    );
    for (const candidate of candidates) {
      try {
        return { ok: true, value: JSON.parse(candidate) };
      } catch {
        // continue
      }
    }
    return { ok: false };
  }
}

/**
 * Strict JSON parser — only accepts raw JSON.parse without any heuristics.
 * Used when strictJsonOnly=true.
 */
export function parseJsonStrict(raw: string): { ok: true; value: unknown } | { ok: false } {
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
