import { ToolEntry } from './types.js';

export function buildCorrectionPrompt(params: {
  errorCode: string;
  errors: string[];
  tools: ToolEntry[];
  lastOutput: string;
}): string {
  const { errorCode, errors, tools, lastOutput } = params;

  const toolDescriptions = tools
    .map((t) => `  - ${t.name}${t.description ? ` (${t.description})` : ''}`)
    .join('\n');

  return `Your previous response was invalid.

Error code: ${errorCode}
Validation errors:
${errors.map((e) => `  - ${e}`).join('\n')}

Your last output was:
${lastOutput}

You must return ONLY valid JSON (no markdown, no explanation) matching this exact envelope:
{
  "tool_name": "<one of the allowed tools>",
  "args": { ... }
}

Available tools:
${toolDescriptions}

Return ONLY the JSON object, nothing else.`;
}
