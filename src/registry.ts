import { ZodSchema } from 'zod';
import { Registry, ToolEntry } from './types.js';

export function createRegistry(): Registry {
  const tools = new Map<string, ToolEntry>();

  return {
    registerTool(
      name: string,
      schema: ZodSchema<unknown>,
      options?: { description?: string },
    ): void {
      tools.set(name, { name, schema, description: options?.description });
    },

    getToolSchema(name: string): ZodSchema<unknown> | undefined {
      return tools.get(name)?.schema;
    },

    listTools(): ToolEntry[] {
      return Array.from(tools.values());
    },
  };
}
