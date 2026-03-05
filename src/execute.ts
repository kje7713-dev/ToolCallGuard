import { Registry, GuardResult, CircuitBreakerEvent } from './types.js';
import { guardToolCall } from './guard.js';

export interface GuardAndExecuteParams {
  registry: Registry;
  modelCall: (prompt: string) => Promise<string>;
  initialPrompt: string;
  executeTool: (toolName: string, args: unknown) => Promise<unknown>;
  maxAttempts?: number;
  allowTools?: string[];
  strictJsonOnly?: boolean;
  toolCallFormat?: 'envelope' | 'openai' | 'anthropic';
  onAttempt?: (event: { attempt: number; rawOutput: string; errorCode?: string; errors?: string[] }) => void;
  context?: unknown;
  onEvent?: (event: CircuitBreakerEvent) => void;
}

export type GuardAndExecuteResult<T = unknown> =
  | { ok: true; tool_name: string; args: T; executionResult: unknown }
  | {
      ok: false;
      error_code: string;
      errors: string[];
      attempts: number;
      last_output: string;
      reason?: string;
      escalate?: boolean;
    };

export async function guardAndExecute<T = unknown>(
  params: GuardAndExecuteParams,
): Promise<GuardAndExecuteResult<T>> {
  const { executeTool, onEvent, ...guardParams } = params;

  const guardResult: GuardResult<T> = await guardToolCall<T>(guardParams);

  if (!guardResult.ok) {
    return guardResult;
  }

  const executionResult = await executeTool(guardResult.tool_name, guardResult.args);

  onEvent?.({
    eventType: 'ACTION_EXECUTED' as CircuitBreakerEvent['eventType'],
    tool_name: guardResult.tool_name,
    timestamp: new Date().toISOString(),
  });

  return {
    ok: true,
    tool_name: guardResult.tool_name,
    args: guardResult.args,
    executionResult,
  };
}
