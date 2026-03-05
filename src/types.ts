import { ZodSchema, z } from 'zod';

export type ErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_ENVELOPE'
  | 'TOOL_NOT_ALLOWED'
  | 'UNKNOWN_TOOL'
  | 'INVALID_ARGS'
  | 'RETRIES_EXHAUSTED'
  | 'POLICY_TRIPPED';

export type PolicyDecision =
  | { allow: true }
  | { allow: false; reason: string; escalate?: boolean };

export interface ToolPolicy {
  preExecute?: (input: {
    toolName: string;
    args: unknown;
    context?: unknown;
  }) => PolicyDecision | Promise<PolicyDecision>;
}

export interface ToolEntry<S extends ZodSchema = ZodSchema<unknown>> {
  name: string;
  schema: S;
  description?: string;
  policy?: ToolPolicy;
}

export interface Registry {
  registerTool<S extends ZodSchema<any>>(
    name: string,
    schema: S,
    options?: { description?: string; policy?: ToolPolicy },
  ): void;
  getToolSchema(name: string): ZodSchema<unknown> | undefined;
  getToolEntry(name: string): ToolEntry | undefined;
  listTools(): ToolEntry[];
}

export interface AttemptEvent {
  attempt: number;
  rawOutput: string;
  errorCode?: ErrorCode;
  errors?: string[];
}

export interface CircuitBreakerEvent {
  eventType:
    | 'RETRY_ATTEMPT'
    | 'ACTION_ALLOWED'
    | 'ACTION_BLOCKED'
    | 'POLICY_TRIPPED'
    | 'INVALID_STRUCTURE'
    | 'ACTION_EXECUTED';
  attempt?: number;
  tool_name?: string;
  error_code?: ErrorCode;
  errors?: string[];
  reason?: string;
  escalate?: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GuardParams {
  registry: Registry;
  modelCall: (prompt: string) => Promise<string>;
  initialPrompt: string;
  maxAttempts?: number;
  allowTools?: string[];
  strictJsonOnly?: boolean;
  toolCallFormat?: 'envelope' | 'openai' | 'anthropic';
  onAttempt?: (event: AttemptEvent) => void;
  context?: unknown;
  onEvent?: (event: CircuitBreakerEvent) => void;
}

export type GuardResult<T = unknown> =
  | { ok: true; tool_name: string; args: T }
  | {
      ok: false;
      error_code: ErrorCode;
      errors: string[];
      attempts: number;
      last_output: string;
      reason?: string;
      escalate?: boolean;
    };

/** Helper type to extract the inferred argument type from a Zod schema. */
export type SchemaArgs<S extends ZodSchema> = z.infer<S>;

export interface ToolCallEnvelope {
  tool_name: string;
  args: Record<string, unknown>;
}
