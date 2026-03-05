# toolcallguard

> **ToolCallGuard is an AI Action Circuit Breaker:** it ensures LLM-suggested tool calls are valid and policy-compliant before execution. Schema validation catches malformed outputs; policy hooks block unsafe actions before they run.

[![CI](https://github.com/kje7713-dev/ToolCallGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/kje7713-dev/ToolCallGuard/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/toolcallguard.svg)](https://www.npmjs.com/package/toolcallguard)

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
| `registerTool(name, schema, options?)` | Register a tool with a Zod schema and optional policy |
| `getToolSchema(name)` | Get the Zod schema for a tool by name |
| `getToolEntry(name)` | Get the full `ToolEntry` (including policy) for a tool by name |
| `listTools()` | List all registered tools |

#### Registering a tool with a policy

```ts
registry.registerTool(
  'refund_order',
  z.object({ order_id: z.string(), amount: z.number() }),
  {
    description: 'Refund an order',
    policy: {
      preExecute({ args, context }) {
        const { amount } = args as { amount: number };
        if (amount > 50) {
          return { allow: false, reason: 'Refund exceeds $50 limit', escalate: true };
        }
        return { allow: true };
      },
    },
  },
);
```

When the policy returns `{ allow: false }`, `guardToolCall` returns `{ ok: false, error_code: "POLICY_TRIPPED", reason, escalate }` without executing the tool.

---

### `guardToolCall(params)`

Validates an LLM output against the registered tools, evaluates policies, and retries automatically on failure.

> **Note:** ToolCallGuard attempts to extract JSON from markdown fences or surrounding text before parsing.

**Params:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `registry` | `Registry` | required | The tool registry |
| `modelCall` | `(prompt: string) => Promise<string>` | required | Your LLM call function |
| `initialPrompt` | `string` | required | The first prompt to send to the model |
| `maxAttempts` | `number` | `3` | Maximum number of attempts (including retries) |
| `allowTools` | `string[]` | all registered tools | Allowlist of permitted tool names |
| `strictJsonOnly` | `boolean` | `false` | If `true`, skip all JSON extraction heuristics — only accept raw `JSON.parse` |
| `toolCallFormat` | `"envelope" \| "openai" \| "anthropic"` | `"envelope"` | Input format adapter — see [Adapters](#adapters) |
| `onAttempt` | `(event: AttemptEvent) => void` | — | Callback fired after each attempt (backwards-compatible) |
| `context` | `unknown` | — | Optional context passed to policy `preExecute` hooks |
| `onEvent` | `(event: CircuitBreakerEvent) => void` | — | Callback fired for structured telemetry events |

**Returns:** `Promise<GuardResult<T>>`

```ts
// Success
{ ok: true; tool_name: string; args: T }

// Failure
{ ok: false; error_code: ErrorCode; errors: string[]; attempts: number; last_output: string; reason?: string; escalate?: boolean }
```

#### Using `onEvent` for telemetry

```ts
const result = await guardToolCall({
  registry,
  modelCall,
  initialPrompt: 'Refund order ORD-42.',
  onEvent: (event) => {
    console.log(JSON.stringify(event));
    // { eventType: 'ACTION_ALLOWED', tool_name: 'refund_order', timestamp: '2024-...' }
    // { eventType: 'RETRY_ATTEMPT', attempt: 1, error_code: 'INVALID_JSON', errors: [...], timestamp: '...' }
    // { eventType: 'POLICY_TRIPPED', tool_name: 'refund_order', reason: '...', escalate: true, timestamp: '...' }
  },
});
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
| `POLICY_TRIPPED` | A registered policy blocked the action |

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

### `CircuitBreakerEvent`

```ts
interface CircuitBreakerEvent {
  eventType: 'RETRY_ATTEMPT' | 'ACTION_ALLOWED' | 'ACTION_BLOCKED' | 'POLICY_TRIPPED' | 'INVALID_STRUCTURE' | 'ACTION_EXECUTED';
  attempt?: number;
  tool_name?: string;
  error_code?: ErrorCode;
  errors?: string[];
  reason?: string;
  escalate?: boolean;
  timestamp: string;          // ISO 8601
  metadata?: Record<string, unknown>;
}
```

### `ToolPolicy`

```ts
interface ToolPolicy {
  preExecute?: (input: {
    toolName: string;
    args: unknown;
    context?: unknown;
  }) => PolicyDecision | Promise<PolicyDecision>;
}

type PolicyDecision =
  | { allow: true }
  | { allow: false; reason: string; escalate?: boolean };
```

## Adapters

ToolCallGuard supports normalizing OpenAI and Anthropic tool call formats into the internal envelope automatically.

### OpenAI tool call format

```ts
import { createRegistry, guardToolCall } from 'toolcallguard';
import { z } from 'zod';

const registry = createRegistry();
registry.registerTool('refund_order', z.object({ order_id: z.string(), reason: z.string() }));

// modelCall returns an OpenAI-style response string
const modelCall = async (prompt: string) =>
  JSON.stringify({
    tool_calls: [
      {
        function: {
          name: 'refund_order',
          arguments: JSON.stringify({ order_id: 'ORD-99', reason: 'damaged' }),
        },
      },
    ],
  });

const result = await guardToolCall({
  registry,
  modelCall,
  initialPrompt: 'Refund order ORD-99.',
  toolCallFormat: 'openai',
});

if (result.ok) {
  console.log(result.tool_name); // "refund_order"
  console.log(result.args);      // { order_id: "ORD-99", reason: "damaged" }
}
```

### Anthropic tool call format

```ts
const modelCall = async (prompt: string) =>
  JSON.stringify({
    name: 'refund_order',
    input: { order_id: 'ORD-99', reason: 'damaged' },
  });

const result = await guardToolCall({
  registry,
  modelCall,
  initialPrompt: 'Refund order ORD-99.',
  toolCallFormat: 'anthropic',
});
```

You can also use the adapter functions directly:

```ts
import { parseOpenAIToolCall, parseAnthropicToolCall } from 'toolcallguard';

const envelope = parseOpenAIToolCall(openAiResponse);
// { tool_name: "refund_order", args: { order_id: "ORD-99", reason: "damaged" } }
```

---

## Typed args

`registerTool` is generic over the Zod schema, so you can extract the inferred arg type:

```ts
import { z } from 'zod';
import { createRegistry, guardToolCall, SchemaArgs } from 'toolcallguard';

const refundSchema = z.object({ order_id: z.string(), reason: z.string() });
type RefundArgs = SchemaArgs<typeof refundSchema>; // { order_id: string; reason: string }

const registry = createRegistry();
registry.registerTool('refund_order', refundSchema);

const result = await guardToolCall<RefundArgs>({
  registry,
  modelCall,
  initialPrompt: 'Refund order ORD-1.',
});

if (result.ok) {
  result.args.order_id; // string — strongly typed!
  result.args.reason;   // string — strongly typed!
}
```

---

## `guardAndExecute` helper

Combines guard + execute in a single call. If the guard passes, `executeTool` is called and an `ACTION_EXECUTED` event is emitted.

```ts
import { z } from 'zod';
import { createRegistry, guardAndExecute } from 'toolcallguard';

const registry = createRegistry();
registry.registerTool('refund_order', z.object({ order_id: z.string(), reason: z.string() }));

const result = await guardAndExecute({
  registry,
  modelCall: async (prompt) => callYourLLM(prompt),
  initialPrompt: 'Refund order ORD-99.',
  executeTool: async (toolName, args) => {
    // your execution logic
    return { success: true, refundId: 'REF-001' };
  },
  onEvent: (event) => console.log(event),
});

if (result.ok) {
  console.log(result.tool_name);       // "refund_order"
  console.log(result.args);            // { order_id: "ORD-99", reason: "..." }
  console.log(result.executionResult); // { success: true, refundId: "REF-001" }
}
```

---

## Strict JSON mode

By default, ToolCallGuard tries to extract JSON from markdown fences or surrounding text. To disable this behaviour and only accept raw `JSON.parse` output:

```ts
const result = await guardToolCall({
  registry,
  modelCall,
  initialPrompt: 'Refund order ORD-99.',
  strictJsonOnly: true, // only accept raw JSON — no markdown stripping, no extraction
});
```

This is useful when your LLM is configured in a structured output mode and you want to fail fast on any non-JSON response.

---


- [`examples/raw-openai-style/index.ts`](./examples/raw-openai-style/index.ts) — basic retry flow with stub model
- [`examples/production-like/index.ts`](./examples/production-like/index.ts) — policy hook that blocks high-value refunds, with `onEvent` telemetry

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

- **Circuit breaker** — policy hooks block unsafe LLM actions before execution, with structured event telemetry for auditing.
- **Minimal surface area** — two functions, one type. Easy to integrate into any LLM framework.
- **Zod-first** — schemas are the single source of truth for validation and correction prompts.
- **Deterministic retries** — correction prompts include the exact validation errors so the model can self-correct.
- **No vendor lock-in** — `modelCall` is just `(prompt: string) => Promise<string>`. Works with OpenAI, Anthropic, local models, or any stub.
- **Observable** — `onAttempt` and `onEvent` callbacks give full visibility into every attempt and event without coupling to a specific logging framework.

## Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Model returns invalid JSON repeatedly | Returns `{ ok: false, error_code: "INVALID_JSON" }` after `maxAttempts` |
| Model uses a tool not in `allowTools` | Returns `{ ok: false, error_code: "TOOL_NOT_ALLOWED" }` after retries |
| Model omits a required field | Correction prompt includes field errors; retried up to `maxAttempts` |
| Model always returns wrong schema | Returns `{ ok: false, error_code: "INVALID_ARGS", errors: [...] }` |
| Policy blocks the action | Returns `{ ok: false, error_code: "POLICY_TRIPPED", reason, escalate }` immediately |
| `modelCall` throws | Exception propagates to caller — wrap in try/catch if needed |

## Releasing

This project publishes to npm automatically via GitHub Actions.

**Option 1 — Tag-based release (recommended):**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**Option 2 — Manual release:**

Go to **GitHub → Actions → Release → Run workflow**.

Requires the `NPM_TOKEN` secret to be set in the repository settings. See [RELEASING.md](./RELEASING.md) for full instructions.

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
