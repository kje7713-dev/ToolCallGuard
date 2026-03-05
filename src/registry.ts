import { ZodSchema } from 'zod';
import { Registry, ToolEntry, ToolPolicy } from './types.js';

export function createRegistry(): Registry {
  const tools = new Map<string, ToolEntry>();

  return {
    registerTool<S extends ZodSchema<any>>(
      name: string,
      schema: S,
      options?: { description?: string; policy?: ToolPolicy },
    ): void {
      tools.set(name, { name, schema, description: options?.description, policy: options?.policy });
    },

    getToolSchema(name: string): ZodSchema<unknown> | undefined {
      return tools.get(name)?.schema;
    },

    getToolEntry(name: string): ToolEntry | undefined {
      return tools.get(name);
    },

    listTools(): ToolEntry[] {
      return Array.from(tools.values());
    },
  };
}
