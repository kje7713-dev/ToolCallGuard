#!/usr/bin/env node
/**
 * Release safety check: verifies that NODE_AUTH_TOKEN is set before publishing.
 * Exits with code 1 if the token is missing.
 * NOTE: The token value is never printed.
 */

if (!process.env.NODE_AUTH_TOKEN) {
  console.error('ERROR: NODE_AUTH_TOKEN is not set.');
  console.error('Set the NPM_TOKEN secret in GitHub repository settings and wire it to NODE_AUTH_TOKEN in the release workflow.');
  process.exit(1);
}

console.log('✓ NODE_AUTH_TOKEN is set — ready to publish.');
