/**
 * Example: raw-openai-style
 *
 * Demonstrates registering a refund_order tool and guarding a bad LLM output
 * into a valid one using a stub modelCall (no real API calls).
 */

import { z } from 'zod';
import { createRegistry, guardToolCall } from '../../src/index.js';

// 1. Create a registry and register the refund_order tool
const registry = createRegistry();
registry.registerTool(
  'refund_order',
  z.object({
    order_id: z.string(),
    reason: z.string(),
  }),
  { description: 'Refund an order by ID with a reason' },
);

// 2. Simulate a "bad" first response and a corrected second response
const responses = [
  // First attempt: invalid - missing "reason" field
  JSON.stringify({ tool_name: 'refund_order', args: { order_id: 'ORD-42' } }),
  // Second attempt (after correction prompt): valid
  JSON.stringify({ tool_name: 'refund_order', args: { order_id: 'ORD-42', reason: 'item broken' } }),
];

let callCount = 0;
async function stubModelCall(prompt: string): Promise<string> {
  console.log(`\n--- modelCall #${callCount + 1} ---`);
  if (callCount > 0) {
    console.log('Correction prompt received (first 200 chars):');
    console.log(prompt.slice(0, 200) + '...');
  }
  const response = responses[callCount] ?? responses[responses.length - 1];
  callCount++;
  return response;
}

// 3. Guard the tool call
async function main() {
  console.log('Running toolcallguard example: refund_order\n');

  const result = await guardToolCall({
    registry,
    modelCall: stubModelCall,
    initialPrompt: 'Please call the refund_order tool to refund order ORD-42.',
    maxAttempts: 3,
    onAttempt: (event) => {
      if (event.errorCode) {
        console.log(`  Attempt ${event.attempt} failed: [${event.errorCode}] ${event.errors?.join(', ')}`);
      } else {
        console.log(`  Attempt ${event.attempt} succeeded.`);
      }
    },
  });

  console.log('\n--- Result ---');
  if (result.ok) {
    console.log('Success!');
    console.log('  tool_name:', result.tool_name);
    console.log('  args:', result.args);
  } else {
    console.log('Failed after', result.attempts, 'attempts');
    console.log('  error_code:', result.error_code);
    console.log('  errors:', result.errors);
  }
}

main().catch(console.error);
