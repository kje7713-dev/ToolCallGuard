import { ToolCallEnvelope } from './types.js';

/**
 * Normalizes an OpenAI-style tool call response into a ToolCallEnvelope.
 *
 * Expected input shape:
 * {
 *   tool_calls: [{ function: { name: string; arguments: string } }]
 * }
 */
export function parseOpenAIToolCall(raw: unknown): ToolCallEnvelope {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('OpenAI tool call must be an object');
  }

  const obj = raw as Record<string, unknown>;
  const toolCalls = obj['tool_calls'];

  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    throw new Error('OpenAI tool call must have a non-empty "tool_calls" array');
  }

  const first = toolCalls[0] as Record<string, unknown>;
  const fn = first['function'] as Record<string, unknown> | undefined;

  if (!fn || typeof fn['name'] !== 'string' || typeof fn['arguments'] !== 'string') {
    throw new Error(
      'OpenAI tool call function must have "name" (string) and "arguments" (string)',
    );
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(fn['arguments']) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse OpenAI tool call arguments as JSON: ${fn['arguments']}`);
  }

  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error('OpenAI tool call arguments must be a JSON object');
  }

  return { tool_name: fn['name'], args };
}

/**
 * Normalizes an Anthropic-style tool call response into a ToolCallEnvelope.
 *
 * Expected input shape:
 * { name: string; input: Record<string, unknown> }
 */
export function parseAnthropicToolCall(raw: unknown): ToolCallEnvelope {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Anthropic tool call must be an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['name'] !== 'string') {
    throw new Error('Anthropic tool call must have a "name" (string)');
  }

  if (typeof obj['input'] !== 'object' || obj['input'] === null || Array.isArray(obj['input'])) {
    throw new Error('Anthropic tool call must have an "input" (object)');
  }

  return {
    tool_name: obj['name'],
    args: obj['input'] as Record<string, unknown>,
  };
}
