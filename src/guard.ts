import { GuardParams, GuardResult, ErrorCode, CircuitBreakerEvent } from './types.js';
import {
  parseJson,
  validateEnvelope,
  validateAllowlist,
  validateToolExists,
  validateArgs,
} from './validate.js';
import { buildCorrectionPrompt } from './prompts.js';

function emit(
  onEvent: ((e: CircuitBreakerEvent) => void) | undefined,
  event: CircuitBreakerEvent,
): void {
  onEvent?.(event);
}

function emitAttemptFailure(
  onEvent: ((e: CircuitBreakerEvent) => void) | undefined,
  attempt: number,
  errorCode: ErrorCode,
  errors: string[],
  includeInvalidStructure = false,
): void {
  const timestamp = new Date().toISOString();
  emit(onEvent, { eventType: 'RETRY_ATTEMPT', attempt, error_code: errorCode, errors, timestamp });
  if (includeInvalidStructure) {
    emit(onEvent, {
      eventType: 'INVALID_STRUCTURE',
      attempt,
      error_code: errorCode,
      errors,
      timestamp,
    });
  }
}

export async function guardToolCall<T = unknown>(params: GuardParams): Promise<GuardResult<T>> {
  const {
    registry,
    modelCall,
    initialPrompt,
    maxAttempts = 3,
    allowTools,
    onAttempt,
    onEvent,
    context,
  } = params;

  const effectiveAllowlist = allowTools ?? registry.listTools().map((t) => t.name);
  let currentPrompt = initialPrompt;
  let lastOutput = '';
  let lastErrorCode: ErrorCode = 'RETRIES_EXHAUSTED';
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await modelCall(currentPrompt);
    lastOutput = raw;

    // Step 1: Parse JSON
    const parsed = parseJson(raw);
    if (!parsed.ok) {
      lastErrorCode = 'INVALID_JSON';
      lastErrors = ['Output is not valid JSON'];
      onAttempt?.({ attempt, rawOutput: raw, errorCode: lastErrorCode, errors: lastErrors });
      emitAttemptFailure(onEvent, attempt, lastErrorCode, lastErrors, true);
      if (attempt < maxAttempts) {
        currentPrompt = buildCorrectionPrompt({
          errorCode: lastErrorCode,
          errors: lastErrors,
          tools: registry.listTools().filter((t) => effectiveAllowlist.includes(t.name)),
          lastOutput: raw,
        });
        continue;
      }
      break;
    }

    // Step 2: Validate envelope
    const envelopeResult = validateEnvelope(parsed.value);
    if (!envelopeResult.ok) {
      lastErrorCode = envelopeResult.errorCode!;
      lastErrors = envelopeResult.errors!;
      onAttempt?.({ attempt, rawOutput: raw, errorCode: lastErrorCode, errors: lastErrors });
      emitAttemptFailure(onEvent, attempt, lastErrorCode, lastErrors, true);
      if (attempt < maxAttempts) {
        currentPrompt = buildCorrectionPrompt({
          errorCode: lastErrorCode,
          errors: lastErrors,
          tools: registry.listTools().filter((t) => effectiveAllowlist.includes(t.name)),
          lastOutput: raw,
        });
        continue;
      }
      break;
    }

    const { tool_name, args } = envelopeResult.envelope!;

    // Step 3: Validate allowlist
    const allowResult = validateAllowlist(tool_name, effectiveAllowlist);
    if (!allowResult.ok) {
      lastErrorCode = allowResult.errorCode!;
      lastErrors = allowResult.errors!;
      onAttempt?.({ attempt, rawOutput: raw, errorCode: lastErrorCode, errors: lastErrors });
      emitAttemptFailure(onEvent, attempt, lastErrorCode, lastErrors);
      if (attempt < maxAttempts) {
        currentPrompt = buildCorrectionPrompt({
          errorCode: lastErrorCode,
          errors: lastErrors,
          tools: registry.listTools().filter((t) => effectiveAllowlist.includes(t.name)),
          lastOutput: raw,
        });
        continue;
      }
      break;
    }

    // Step 4: Validate tool exists
    const existsResult = validateToolExists(tool_name, registry.getToolSchema.bind(registry));
    if (!existsResult.ok) {
      lastErrorCode = existsResult.errorCode!;
      lastErrors = existsResult.errors!;
      onAttempt?.({ attempt, rawOutput: raw, errorCode: lastErrorCode, errors: lastErrors });
      emitAttemptFailure(onEvent, attempt, lastErrorCode, lastErrors);
      if (attempt < maxAttempts) {
        currentPrompt = buildCorrectionPrompt({
          errorCode: lastErrorCode,
          errors: lastErrors,
          tools: registry.listTools().filter((t) => effectiveAllowlist.includes(t.name)),
          lastOutput: raw,
        });
        continue;
      }
      break;
    }

    // Step 5: Validate args against schema
    const schema = registry.getToolSchema(tool_name)!;
    const argsResult = validateArgs(args, schema);
    if (!argsResult.ok) {
      lastErrorCode = argsResult.errorCode!;
      lastErrors = argsResult.errors!;
      onAttempt?.({ attempt, rawOutput: raw, errorCode: lastErrorCode, errors: lastErrors });
      emitAttemptFailure(onEvent, attempt, lastErrorCode, lastErrors);
      if (attempt < maxAttempts) {
        currentPrompt = buildCorrectionPrompt({
          errorCode: lastErrorCode,
          errors: lastErrors,
          tools: registry.listTools().filter((t) => effectiveAllowlist.includes(t.name)),
          lastOutput: raw,
        });
        continue;
      }
      break;
    }

    // Step 6: Evaluate policy
    const toolEntry = registry.getToolEntry(tool_name);
    if (toolEntry?.policy?.preExecute) {
      const decision = await toolEntry.policy.preExecute({ toolName: tool_name, args, context });
      if (!decision.allow) {
        emit(onEvent, {
          eventType: 'POLICY_TRIPPED',
          tool_name,
          reason: decision.reason,
          escalate: decision.escalate,
          timestamp: new Date().toISOString(),
        });
        return {
          ok: false,
          error_code: 'POLICY_TRIPPED',
          errors: [decision.reason],
          attempts: attempt,
          last_output: raw,
          reason: decision.reason,
          escalate: decision.escalate,
        };
      }
    }

    // Success
    onAttempt?.({ attempt, rawOutput: raw });
    emit(onEvent, {
      eventType: 'ACTION_ALLOWED',
      tool_name,
      timestamp: new Date().toISOString(),
    });
    return { ok: true, tool_name, args: args as T };
  }

  emit(onEvent, {
    eventType: 'ACTION_BLOCKED',
    error_code: lastErrorCode,
    errors: lastErrors,
    timestamp: new Date().toISOString(),
  });

  return {
    ok: false,
    error_code: lastErrorCode,
    errors: lastErrors,
    attempts: maxAttempts,
    last_output: lastOutput,
  };
}
