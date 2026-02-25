# ToolCallGuard
Incorporate schema validation into LLM outputs. 
You are a GitHub coding agent. Build a new TypeScript library named "toolcallguard" in this repo.

GOAL
Create a minimal, production-credible SDK that:
1) Registers tools with Zod schemas.
2) Validates LLM tool-call outputs in a universal envelope:
   {
     "tool_name": string,
     "args": object
   }
3) Enforces an allowlist of tools.
4) If invalid, automatically retries by calling a provided "modelCall" function with a correction prompt that includes validation errors.
5) Returns either:
   - { ok: true, tool_name, args } (args typed)
   - { ok: false, error_code, errors, attempts, last_output }

NON-GOALS (DO NOT BUILD)
- No web UI, no database, no hosted service.
- No LangChain integration (provide examples only).
- No complicated plugin architecture.

TECH STACK
- Node 20+, TypeScript
- Zod for validation
- vitest for tests
- tsup for build
- eslint + prettier for formatting

DELIVERABLES
1) Source code under /src with clean exports.
2) Unit tests covering:
   - valid tool call passes
   - invalid JSON (not parseable) triggers retry
   - wrong tool_name triggers retry then fails with allowlist error
   - args missing required field triggers retry then passes
   - retries exhausted returns ok:false with errors
3) Examples under /examples:
   - /examples/raw-openai-style (no actual API call; stub modelCall)
   - Demonstrate: register refund_order tool and guard a bad output into a valid one
4) Documentation:
   - README.md explaining installation, quickstart, API reference, and example.
   - Include “Design goals” and “Failure modes” sections.
5) GitHub Actions:
   - CI workflow: lint + test + build on PRs and pushes.
   - Release workflow: on tag v* publish to npm (assume secrets NPM_TOKEN set).
6) Package readiness:
   - package.json with proper name "toolcallguard"
   - types exported
   - ESM + CJS builds (tsup config)
   - semantic version friendly
   - no broken imports

API DESIGN (IMPLEMENT THIS)
- createRegistry(): returns registry with:
   - registerTool(name: string, schema: ZodSchema<any>, options?: { description?: string })
   - getToolSchema(name)
   - listTools()
- guardToolCall(params):
   params = {
     registry,
     modelCall: (prompt: string) => Promise<string>,
     initialPrompt: string,
     maxAttempts?: number (default 3),
     allowTools?: string[] (default registry tools),
     strictJsonOnly?: boolean (default true),
     onAttempt?: (event) => void  // optional callback for tracing
   }
   Behavior:
   - Call modelCall(initialPrompt) to get raw string output.
   - Try parse JSON.
   - Validate envelope shape: tool_name string; args object.
   - Validate tool_name in allowlist.
   - Validate args against the tool’s schema.
   - If any step fails and attempts remain:
       Build a correction prompt that includes:
         * the schema expectations (tool names + field hints)
         * the validation error messages
         * instruction: return ONLY valid JSON matching the envelope
       Call modelCall(correctionPrompt) again.
   - If success, return ok:true.
   - If exhausted, return ok:false with structured error details.

ERROR CODES
Use these string codes:
- INVALID_JSON
- INVALID_ENVELOPE
- TOOL_NOT_ALLOWED
- UNKNOWN_TOOL
- INVALID_ARGS
- RETRIES_EXHAUSTED

IMPLEMENTATION DETAILS
- Put prompt-building logic in src/prompts.ts
- Put parsing/validation in src/validate.ts
- Main export in src/index.ts
- Keep functions small and testable.

CODING RULES
- No any-types leaking in public API. Use generics where reasonable.
- No console.log in library code.
- All files must be formatted with prettier.
- Tests must be deterministic.

OUTPUT
Create a PR with all files added/updated. Ensure CI passes.
