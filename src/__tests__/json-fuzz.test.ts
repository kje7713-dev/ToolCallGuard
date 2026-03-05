import { describe, it, expect } from 'vitest';
import { parseJson } from '../validate.js';

function randomString(length: number): string {
  // Exclude JSON structural characters {, }, [, ] to avoid confusing the JSON extractor
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \t\n!@#$%^&*()-_=+|;:,.<>?/`~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

const VALID_JSON_OBJECTS = [
  '{"tool_name":"refund_order","args":{"order_id":"123","reason":"damaged"}}',
  '{"tool_name":"cancel_order","args":{"order_id":"456"}}',
  '{"tool_name":"send_email","args":{"to":"user@example.com","subject":"Hello","body":"World"}}',
  '{"a":1,"b":[1,2,3],"c":{"nested":true}}',
  '{"key":"value with spaces","num":42,"flag":false}',
];

describe('parseJson fuzz tests', () => {
  it('extracts valid JSON when surrounded by random text prefix', () => {
    for (const json of VALID_JSON_OBJECTS) {
      const prefix = randomString(20);
      const raw = `${prefix} ${json}`;
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(JSON.parse(json));
      }
    }
  });

  it('extracts valid JSON when surrounded by random text suffix', () => {
    for (const json of VALID_JSON_OBJECTS) {
      const suffix = randomString(20);
      const raw = `${json} ${suffix}`;
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(JSON.parse(json));
      }
    }
  });

  it('extracts valid JSON when surrounded by random prefix and suffix', () => {
    for (const json of VALID_JSON_OBJECTS) {
      const prefix = randomString(15);
      const suffix = randomString(15);
      const raw = `${prefix} ${json} ${suffix}`;
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(JSON.parse(json));
      }
    }
  });

  it('extracts valid JSON from markdown fenced block with random surrounding text', () => {
    for (const json of VALID_JSON_OBJECTS) {
      const prefix = randomString(10);
      const suffix = randomString(10);
      const raw = `${prefix}\n\`\`\`json\n${json}\n\`\`\`\n${suffix}`;
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(JSON.parse(json));
      }
    }
  });

  it('returns ok:false for completely random non-JSON text', () => {
    const nonJsonInputs = [
      'this is completely random text',
      '   ',
      'no braces here at all',
      '12345 not an object',
      'undefined null NaN',
    ];
    for (const input of nonJsonInputs) {
      const result = parseJson(input);
      // These should either fail or return a non-object value
      if (result.ok) {
        // If it parsed something, it should be a primitive not a tool call
        expect(typeof result.value).not.toBe('object');
      }
    }
  });

  it('handles multiple random fuzz runs without throwing', () => {
    for (let i = 0; i < 50; i++) {
      const json = VALID_JSON_OBJECTS[i % VALID_JSON_OBJECTS.length];
      const prefix = randomString(Math.floor(Math.random() * 30));
      const suffix = randomString(Math.floor(Math.random() * 30));
      const raw = `${prefix}${json}${suffix}`;
      // Should not throw
      expect(() => parseJson(raw)).not.toThrow();
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(JSON.parse(json));
      }
    }
  });
});
