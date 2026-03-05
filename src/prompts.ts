import { ToolEntry } from './types.js';

function buildSchemaHint(tool: ToolEntry): string {
  try {
    const shape = (tool.schema as { shape?: Record<string, { _def?: { typeName?: string } }> })
      .shape;
    if (!shape) return '';
    const fields = Object.entries(shape)
      .map(([key, zodType]) => {
        const typeName = zodType?._def?.typeName ?? 'unknown';
        const simpleType = typeName.replace(/^Zod/, '').toLowerCase();
        return `    "${key}": ${simpleType}`;
      })
      .join(',\n');
    return `${tool.name} args schema:\n{\n${fields}\n}`;
  } catch {
    return '';
  }
}

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

  const schemaHints = tools
    .map((t) => buildSchemaHint(t))
    .filter((h) => h.length > 0)
    .map((h) => `  ${h}`)
    .join('\n\n');

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
${schemaHints.length > 0 ? `\nSchema hints:\n${schemaHints}\n` : ''}
Rules:
  - Return ONLY valid JSON.
  - Do not include markdown.
  - Do not include explanations.
  - Only use tools listed above.

Return ONLY the JSON object, nothing else.`;
}
