import { GuardParams, GuardResult, ErrorCode } from './types.js';
import {
  parseJson,
  validateEnvelope,
  validateAllowlist,
  validateToolExists,
  validateArgs,
} from './validate.js';
import { buildCorrectionPrompt } from './prompts.js';

export async function guardToolCall<T = unknown>(params: GuardParams): Promise<GuardResult<T>> {
  const { registry, modelCall, initialPrompt, maxAttempts = 3, allowTools, onAttempt } = params;

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

    // Success
    onAttempt?.({ attempt, rawOutput: raw });
    return { ok: true, tool_name, args: args as T };
  }

  return {
    ok: false,
    error_code: lastErrorCode,
    errors: lastErrors,
    attempts: maxAttempts,
    last_output: lastOutput,
  };
}
