import { ToolEntry } from './types.js';

export function buildCorrectionPrompt(params: {
  errorCode: string;
  errors: string[];
  tools: ToolEntry[];
  lastOutput: string;
}): string {
  const { errorCode, errors, tools, lastOutput } = params;

  const toolDescriptions = tools
    .map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shape = (t.schema as any)._def?.shape?.();
      const fields = shape
        ? Object.entries(shape)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(([k, v]: [string, any]) => `    ${k}: ${v._def?.typeName ?? 'unknown'}`)
            .join('\n')
        : '    (no schema details available)';
      return `- ${t.name}${t.description ? ` (${t.description})` : ''}:\n${fields}`;
    })
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

Available tools and their expected args:
${toolDescriptions}

Return ONLY the JSON object, nothing else.`;
}
