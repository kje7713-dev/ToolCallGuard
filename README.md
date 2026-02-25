# toolcallguard

> Schema-validated LLM tool-call guard with automatic retry.

[![CI](https://github.com/ToolCallGuard/ToolCallGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/ToolCallGuard/ToolCallGuard/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/toolcallguard.svg)](https://badge.fury.io/js/toolcallguard)

## Installation

```bash
npm install toolcallguard zod
```

## Quickstart

```ts
import { z } from 'zod';
import { createRegistry, guardToolCall } from 'toolcallguard';

// 1. Register your tools
const registry = createRegistry();
registry.registerTool(
  'refund_order',
  z.object({
    order_id: z.string(),
    reason: z.string(),
  }),
  { description: 'Refund an order by ID' },
);

// 2. Guard a tool call (with automatic retry on bad output)
const result = await guardToolCall({
  registry,
  modelCall: async (prompt) => callYourLLM(prompt), // your LLM integration
  initialPrompt: 'Refund order ORD-99 because the item was damaged.',
  maxAttempts: 3,
});

if (result.ok) {
  console.log(result.tool_name); // "refund_order"
  console.log(result.args);      // { order_id: "ORD-99", reason: "item was damaged" }
} else {
  console.error(result.error_code, result.errors);
}
```

## API Reference

### `createRegistry()`

Creates a tool registry.

```ts
const registry = createRegistry();
```

**Returns:** `Registry`

| Method | Description |
|--------|-------------|
| `registerTool(name, schema, options?)` | Register a tool with a Zod schema |
| `getToolSchema(name)` | Get the Zod schema for a tool by name |
| `listTools()` | List all registered tools |

---

### `guardToolCall(params)`

Validates an LLM output against the registered tools and retries automatically on failure.

**Params:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `registry` | `Registry` | required | The tool registry |
| `modelCall` | `(prompt: string) => Promise<string>` | required | Your LLM call function |
| `initialPrompt` | `string` | required | The first prompt to send to the model |
| `maxAttempts` | `number` | `3` | Maximum number of attempts (including retries) |
| `allowTools` | `string[]` | all registered tools | Allowlist of permitted tool names |
| `strictJsonOnly` | `boolean` | `true` | Reserved for future use |
| `onAttempt` | `(event: AttemptEvent) => void` | — | Callback fired after each attempt |

**Returns:** `Promise<GuardResult<T>>`

```ts
// Success
{ ok: true; tool_name: string; args: T }

// Failure
{ ok: false; error_code: ErrorCode; errors: string[]; attempts: number; last_output: string }
```

---

### Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_JSON` | Model output could not be parsed as JSON |
| `INVALID_ENVELOPE` | JSON does not match `{ tool_name, args }` shape |
| `TOOL_NOT_ALLOWED` | `tool_name` is not in the `allowTools` list |
| `UNKNOWN_TOOL` | `tool_name` is not registered in the registry |
| `INVALID_ARGS` | `args` failed Zod schema validation |
| `RETRIES_EXHAUSTED` | All attempts failed (generic fallback) |

---

### `AttemptEvent`

```ts
interface AttemptEvent {
  attempt: number;       // 1-based attempt number
  rawOutput: string;     // Raw string returned by modelCall
  errorCode?: ErrorCode; // Set if the attempt failed
  errors?: string[];     // Validation error messages
}
```

## Example

See [`examples/raw-openai-style/index.ts`](./examples/raw-openai-style/index.ts) for a complete example using a stub `modelCall` that simulates a bad first response followed by a corrected one.

```ts
import { z } from 'zod';
import { createRegistry, guardToolCall } from 'toolcallguard';

const registry = createRegistry();
registry.registerTool(
  'refund_order',
  z.object({ order_id: z.string(), reason: z.string() }),
  { description: 'Refund an order' },
);

// Simulates a model that gives a bad answer then a good one
const responses = [
  '{"tool_name":"refund_order","args":{"order_id":"42"}}',           // missing reason
  '{"tool_name":"refund_order","args":{"order_id":"42","reason":"broken"}}', // valid
];
let i = 0;
const stubModel = async () => responses[i++] ?? responses.at(-1)!;

const result = await guardToolCall({
  registry,
  modelCall: stubModel,
  initialPrompt: 'Refund order 42 because it was broken.',
});
// result.ok === true, result.args === { order_id: "42", reason: "broken" }
```

## Design Goals

- **Minimal surface area** — two functions, one type. Easy to integrate into any LLM framework.
- **Zod-first** — schemas are the single source of truth for validation and correction prompts.
- **Deterministic retries** — correction prompts include the exact validation errors so the model can self-correct.
- **No vendor lock-in** — `modelCall` is just `(prompt: string) => Promise<string>`. Works with OpenAI, Anthropic, local models, or any stub.
- **Observable** — `onAttempt` callback gives full visibility into every attempt without coupling to a specific logging framework.

## Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Model returns invalid JSON repeatedly | Returns `{ ok: false, error_code: "INVALID_JSON" }` after `maxAttempts` |
| Model uses a tool not in `allowTools` | Returns `{ ok: false, error_code: "TOOL_NOT_ALLOWED" }` after retries |
| Model omits a required field | Correction prompt includes field errors; retried up to `maxAttempts` |
| Model always returns wrong schema | Returns `{ ok: false, error_code: "INVALID_ARGS", errors: [...] }` |
| `modelCall` throws | Exception propagates to caller — wrap in try/catch if needed |

## Development

```bash
npm install
npm run build   # tsup ESM + CJS
npm test        # vitest
npm run lint    # eslint
npm run format  # prettier
```

## License

MIT
