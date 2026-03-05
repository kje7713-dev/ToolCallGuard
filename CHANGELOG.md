# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2024-03-05

### Added
- OpenAI and Anthropic tool call adapters (`parseOpenAIToolCall`, `parseAnthropicToolCall`)
- `toolCallFormat` option for `guardToolCall` (`"envelope"` | `"openai"` | `"anthropic"`)
- `guardAndExecute` helper for guard + execute in a single call
- `ACTION_EXECUTED` event emitted after successful tool execution
- Strict JSON mode (`strictJsonOnly: true`) — skips all heuristics, only accepts raw `JSON.parse`
- Schema hints in correction prompts to guide the model toward valid args
- `SchemaArgs<S>` helper type for extracting Zod schema arg types
- Coverage script (`npm run coverage`) using `@vitest/coverage-v8`
- Fuzz tests for JSON extraction (`src/__tests__/json-fuzz.test.ts`)
- Release safety check script (`scripts/check-version.mjs`)
- `LICENSE` (MIT), `CHANGELOG.md`, `SECURITY.md`

### Changed
- `ToolEntry` is now generic (`ToolEntry<S extends ZodSchema>`) for better type inference
- `registerTool` is now generic over the schema type
- `CircuitBreakerEvent.eventType` includes `"ACTION_EXECUTED"`
- Correction prompts now include per-tool schema hints and explicit rules
- `package.json` version bumped to `0.3.0`

## [0.2.0] - 2024-01-15

### Added
- Policy hooks: `preExecute` callback on tool entries for custom business rules
- `POLICY_TRIPPED` error code and event
- `escalate` flag on policy decisions
- `context` parameter for passing user/session context to policies
- `onEvent` callback for structured event emission (`CircuitBreakerEvent`)
- `ACTION_ALLOWED`, `ACTION_BLOCKED`, `POLICY_TRIPPED`, `RETRY_ATTEMPT`, `INVALID_STRUCTURE` events

### Changed
- `GuardResult` extended with `reason` and `escalate` fields on failure

## [0.1.1] - 2024-01-08

### Fixed
- JSON extraction now handles markdown fenced code blocks (`\`\`\`json`)
- JSON embedded in surrounding text is correctly extracted

## [0.1.0] - 2024-01-01

### Added
- Initial release
- `createRegistry` for registering Zod-validated tools
- `guardToolCall` with automatic retry and correction prompts
- `INVALID_JSON`, `INVALID_ENVELOPE`, `TOOL_NOT_ALLOWED`, `UNKNOWN_TOOL`, `INVALID_ARGS`, `RETRIES_EXHAUSTED` error codes
- `onAttempt` callback for observability
- `allowTools` allowlist filtering
- `maxAttempts` configuration
