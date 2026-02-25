import { ZodSchema } from 'zod';

export type ErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_ENVELOPE'
  | 'TOOL_NOT_ALLOWED'
  | 'UNKNOWN_TOOL'
  | 'INVALID_ARGS'
  | 'RETRIES_EXHAUSTED';

export interface ToolEntry {
  name: string;
  schema: ZodSchema<unknown>;
  description?: string;
}

export interface Registry {
  registerTool(name: string, schema: ZodSchema<unknown>, options?: { description?: string }): void;
  getToolSchema(name: string): ZodSchema<unknown> | undefined;
  listTools(): ToolEntry[];
}

export interface AttemptEvent {
  attempt: number;
  rawOutput: string;
  errorCode?: ErrorCode;
  errors?: string[];
}

export interface GuardParams {
  registry: Registry;
  modelCall: (prompt: string) => Promise<string>;
  initialPrompt: string;
  maxAttempts?: number;
  allowTools?: string[];
  strictJsonOnly?: boolean;
  onAttempt?: (event: AttemptEvent) => void;
}

export type GuardResult<T = unknown> =
  | { ok: true; tool_name: string; args: T }
  | { ok: false; error_code: ErrorCode; errors: string[]; attempts: number; last_output: string };

export interface ToolCallEnvelope {
  tool_name: string;
  args: Record<string, unknown>;
}
