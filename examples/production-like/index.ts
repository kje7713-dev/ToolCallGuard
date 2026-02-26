/**
 * Example: production-like
 *
 * Demonstrates registering a refund_order tool with a policy that blocks
 * refunds over $50. The LLM returns a valid schema response above the
 * threshold, causing guardToolCall to return POLICY_TRIPPED.
 */

import { z } from 'zod';
import { createRegistry, guardToolCall } from '../../src/index.js';
import type { CircuitBreakerEvent } from '../../src/index.js';

// 1. Create a registry and register the refund_order tool with a policy
const registry = createRegistry();
registry.registerTool(
  'refund_order',
  z.object({
    order_id: z.string(),
    amount: z.number(),
    reason: z.string(),
  }),
  {
    description: 'Refund an order by ID',
    policy: {
      preExecute({ args }) {
        const { amount } = args as { amount: number };
        if (amount > 50) {
          return {
            allow: false,
            reason: `Refund amount $${amount} exceeds the $50 auto-approval limit`,
            escalate: true,
          };
        }
        return { allow: true };
      },
    },
  },
);

// 2. Simulate a model that returns a valid schema refund above the threshold
async function stubModelCall(_prompt: string): Promise<string> {
  return JSON.stringify({
    tool_name: 'refund_order',
    args: { order_id: 'ORD-99', amount: 120, reason: 'item never arrived' },
  });
}

// 3. Guard the tool call with onEvent logging
async function main() {
  console.log('Running toolcallguard production-like example: policy trip on high-value refund\n');

  const events: CircuitBreakerEvent[] = [];

  const result = await guardToolCall({
    registry,
    modelCall: stubModelCall,
    initialPrompt: 'Refund order ORD-99 for $120 because the item never arrived.',
    maxAttempts: 1,
    onEvent: (event) => {
      events.push(event);
      console.log('[EVENT]', JSON.stringify(event, null, 2));
    },
  });

  console.log('\n--- Result ---');
  if (result.ok) {
    console.log('Success!');
    console.log('  tool_name:', result.tool_name);
    console.log('  args:', result.args);
  } else {
    console.log('Blocked!');
    console.log('  error_code:', result.error_code);
    console.log('  reason:', result.reason);
    console.log('  escalate:', result.escalate);
    console.log('  errors:', result.errors);
  }

  console.log('\n--- Events summary ---');
  console.log(`Total events emitted: ${events.length}`);
  events.forEach((e, i) => console.log(`  [${i + 1}] ${e.eventType}`));
}

main().catch(console.error);
