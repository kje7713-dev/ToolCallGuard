# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in ToolCallGuard, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email the maintainer directly at the address listed on the GitHub profile, or
2. Use [GitHub's private vulnerability reporting](https://github.com/kje7713-dev/ToolCallGuard/security/advisories/new)
   if available for this repository.

### What to Include

Please include as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected versions
- Any suggested mitigations or fixes

### Response Timeline

- **Acknowledgement**: Within 48 hours of receiving the report
- **Initial assessment**: Within 7 days
- **Resolution or workaround**: Within 30 days for critical issues

We appreciate responsible disclosure and will credit researchers in the release notes
(unless anonymity is requested).

## Security Considerations

ToolCallGuard validates LLM tool call outputs against Zod schemas. Be aware of the following:

- **Prompt injection**: The correction prompt includes the model's previous output verbatim.
  Avoid passing user-controlled content as `initialPrompt` without sanitization.
- **Schema exposure**: Tool schemas and descriptions are included in correction prompts,
  which are sent to the LLM. Do not include sensitive information in tool descriptions.
- **Policy hooks**: The `preExecute` policy receives unvalidated context from callers.
  Validate and sanitize all `context` inputs before use in policies.
