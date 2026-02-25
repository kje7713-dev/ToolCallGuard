import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createRegistry } from '../registry.js';
import { guardToolCall } from '../guard.js';

function makeRegistry() {
  const registry = createRegistry();
  registry.registerTool(
    'refund_order',
    z.object({
      order_id: z.string(),
      reason: z.string(),
    }),
    { description: 'Refund an order' },
  );
  registry.registerTool(
    'cancel_order',
    z.object({
      order_id: z.string(),
    }),
    { description: 'Cancel an order' },
  );
  return registry;
}

describe('guardToolCall', () => {
  it('valid tool call passes on first attempt', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValue('{"tool_name":"refund_order","args":{"order_id":"123","reason":"damaged"}}');

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool_name).toBe('refund_order');
      expect(result.args).toEqual({ order_id: '123', reason: 'damaged' });
    }
    expect(modelCall).toHaveBeenCalledTimes(1);
  });

  it('invalid JSON triggers retry and succeeds on second attempt', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce(
        '{"tool_name":"refund_order","args":{"order_id":"123","reason":"damaged"}}',
      );

    const events: unknown[] = [];
    const result = await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      onAttempt: (e) => events.push(e),
    });

    expect(result.ok).toBe(true);
    expect(modelCall).toHaveBeenCalledTimes(2);
    expect(events[0]).toMatchObject({ attempt: 1, errorCode: 'INVALID_JSON' });
  });

  it('wrong tool_name triggers retry then fails with TOOL_NOT_ALLOWED when allowTools is restricted', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValue('{"tool_name":"cancel_order","args":{"order_id":"123"}}');

    const result = await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      allowTools: ['refund_order'],
      maxAttempts: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('TOOL_NOT_ALLOWED');
      expect(result.attempts).toBe(2);
    }
    expect(modelCall).toHaveBeenCalledTimes(2);
  });

  it('args missing required field triggers retry then passes', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValueOnce('{"tool_name":"refund_order","args":{"order_id":"123"}}')
      .mockResolvedValueOnce(
        '{"tool_name":"refund_order","args":{"order_id":"123","reason":"damaged"}}',
      );

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args).toEqual({ order_id: '123', reason: 'damaged' });
    }
    expect(modelCall).toHaveBeenCalledTimes(2);
  });

  it('retries exhausted returns ok:false with errors', async () => {
    const registry = makeRegistry();
    const modelCall = vi.fn().mockResolvedValue('this is not json');

    const result = await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      maxAttempts: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('INVALID_JSON');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.attempts).toBe(3);
      expect(result.last_output).toBe('this is not json');
    }
    expect(modelCall).toHaveBeenCalledTimes(3);
  });

  it('onAttempt callback is called for each attempt', async () => {
    const registry = makeRegistry();
    const modelCall = vi.fn().mockResolvedValue('bad json');
    const events: unknown[] = [];

    await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      maxAttempts: 2,
      onAttempt: (e) => events.push(e),
    });

    expect(events).toHaveLength(2);
  });

  it('uses registry tool list as default allowlist', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValue('{"tool_name":"cancel_order","args":{"order_id":"123"}}');

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool_name).toBe('cancel_order');
    }
  });

  it('INVALID_ARGS error includes field details', async () => {
    const registry = makeRegistry();
    const modelCall = vi
      .fn()
      .mockResolvedValue('{"tool_name":"refund_order","args":{"order_id":123,"reason":"x"}}');

    const result = await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      maxAttempts: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('INVALID_ARGS');
      expect(result.errors.some((e) => e.includes('order_id'))).toBe(true);
    }
  });

  it('JSON inside fenced code block parses and succeeds', async () => {
    const registry = makeRegistry();
    const raw =
      '```json\n{"tool_name":"refund_order","args":{"order_id":"123","reason":"damaged"}}\n```';
    const modelCall = vi.fn().mockResolvedValue(raw);

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool_name).toBe('refund_order');
      expect(result.args).toEqual({ order_id: '123', reason: 'damaged' });
    }
  });

  it('JSON preceded and followed by text parses and succeeds', async () => {
    const registry = makeRegistry();
    const raw =
      'Sure! Here you go:\n```json\n{"tool_name":"refund_order","args":{"order_id":"123","reason":"x"}}\n```\nAnything else?';
    const modelCall = vi.fn().mockResolvedValue(raw);

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool_name).toBe('refund_order');
    }
  });

  it('JSON embedded in text without fences parses and succeeds', async () => {
    const registry = makeRegistry();
    const raw =
      'Call this: {"tool_name":"refund_order","args":{"order_id":"123","reason":"x"}} thanks';
    const modelCall = vi.fn().mockResolvedValue(raw);

    const result = await guardToolCall({ registry, modelCall, initialPrompt: 'test' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool_name).toBe('refund_order');
    }
  });

  it('garbage JSON-like text returns INVALID_JSON', async () => {
    const registry = makeRegistry();
    const modelCall = vi.fn().mockResolvedValue('Here is {not json}');

    const result = await guardToolCall({
      registry,
      modelCall,
      initialPrompt: 'test',
      maxAttempts: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe('INVALID_JSON');
    }
  });
});
